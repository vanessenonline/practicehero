"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

// NOTE: All database queries in this file use the admin client to work around
// the ES256 JWT / PostgREST HS256 mismatch that causes RLS to silently filter
// all rows. Security is enforced by filtering on user.id from auth.getUser()
// (which calls the Auth API endpoint directly, not PostgREST).

// ---------------------------------------------------------------------------
// Parent registration
// ---------------------------------------------------------------------------

interface RegisterResult {
  success?: boolean;
  needsConfirmation?: boolean;
  error?: string;
}

/**
 * Register a new parent account.
 * The database trigger `handle_new_user` automatically creates
 * a family row and a profile row for the new parent.
 */
export async function registerParent(
  email: string,
  password: string,
  familyName: string
): Promise<RegisterResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        family_name: familyName,
        role: "parent",
        display_name: familyName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // When email confirmation is enabled, signUp returns a user but no session.
  if (data.user && !data.session) {
    return { success: true, needsConfirmation: true };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Parent login
// ---------------------------------------------------------------------------

interface LoginResult {
  success?: boolean;
  error?: string;
}

/**
 * Sign in a parent with email and password.
 */
export async function loginParent(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Child login
// ---------------------------------------------------------------------------

/**
 * Sign in a child using their profile ID and 4-digit PIN.
 * Looks up the child's generated auth email via the admin API,
 * then authenticates with the regular Supabase client so session
 * cookies are set properly.
 */
export async function loginChild(
  childId: string,
  pin: string
): Promise<LoginResult> {
  try {
    const admin = createAdminClient();

    // Look up the child's auth email
    const { data: authUser, error: lookupError } =
      await admin.auth.admin.getUserById(childId);

    if (lookupError || !authUser.user?.email) {
      return { error: "Gebruiker niet gevonden." };
    }

    // Sign in via the server client (sets cookies for the browser)
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password: pin,
    });

    if (error) {
      return { error: "Verkeerde PIN. Probeer opnieuw." };
    }

    return { success: true };
  } catch {
    return {
      error: "Kan niet inloggen. Vraag een ouder om hulp.",
    };
  }
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

/**
 * Sign out the current user.
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the authenticated user's profile row.
 * Returns null when not signed in or when the profile doesn't exist yet
 * (can happen briefly between auth creation and trigger execution).
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Use admin client to bypass RLS (ES256 JWT / PostgREST HS256 mismatch).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

// ---------------------------------------------------------------------------
// Child management (parent-only)
// ---------------------------------------------------------------------------

interface AddChildResult {
  success?: boolean;
  childId?: string;
  error?: string;
}

/**
 * Create a new child account within the parent's family.
 *
 * Uses the admin API to:
 * 1. Create a Supabase Auth user (with email confirmation skipped)
 * 2. The database trigger auto-creates the profile and initial streak
 * 3. Link selected instruments to the child
 */
export async function addChild(
  displayName: string,
  pin: string,
  instrumentIds: string[]
): Promise<AddChildResult> {
  // Verify the caller is an authenticated parent
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Use admin client to bypass RLS (ES256 JWT / PostgREST HS256 mismatch).
  const admin = createAdminClient();

  const { data: parentProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!parentProfile || parentProfile.role !== "parent") {
    return { error: "Alleen ouders kunnen kinderen toevoegen." };
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { error: "PIN moet precies 4 cijfers zijn." };
  }

  // Create the child's Supabase Auth user via admin API
  const childEmail = `child-${crypto.randomUUID().slice(0, 8)}@practicehero.local`;

  const { data: newUser, error: createError } =
    await admin.auth.admin.createUser({
      email: childEmail,
      password: pin,
      email_confirm: true, // Skip email verification for children
      user_metadata: {
        role: "child",
        family_id: parentProfile.family_id,
        display_name: displayName,
      },
    });

  if (createError) {
    return { error: createError.message };
  }

  // Link instruments to the new child
  if (newUser.user && instrumentIds.length > 0) {
    const instrumentLinks = instrumentIds.map((instrumentId, index) => ({
      child_id: newUser.user.id,
      instrument_id: instrumentId,
      is_primary: index === 0,
    }));

    await admin.from("child_instruments").insert(instrumentLinks);
  }

  return { success: true, childId: newUser.user?.id };
}

// ---------------------------------------------------------------------------
// Family children (for login page)
// ---------------------------------------------------------------------------

interface FamilyChild {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/**
 * Get the list of children belonging to a family.
 * Uses a SECURITY DEFINER RPC function so it works without authentication
 * (needed for the child login page).
 */
export async function getFamilyChildren(
  familyId: string
): Promise<{ children: FamilyChild[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_family_children", {
    family_uuid: familyId,
  });

  if (error) {
    return { error: error.message, children: [] };
  }

  return { children: data || [] };
}

// ---------------------------------------------------------------------------
// Teacher registration (atomic: profile + studio in one operation)
// ---------------------------------------------------------------------------

interface RegisterTeacherResult {
  success?: boolean;
  needsConfirmation?: boolean;
  teacherCode?: string;
  error?: string;
}

/**
 * Register a new teacher account and create their studio atomically.
 *
 * Unlike parent registration, teachers need a studio record created immediately
 * (to generate a teacher_code). We use the admin client for studio creation so
 * this works even when email confirmation is pending (no active session).
 *
 * Flow:
 * 1. Create auth user via signUp() — DB trigger creates profile automatically
 * 2. Ensure profile exists as a fallback (in case trigger didn't run in prod)
 * 3. Generate unique teacher_code via RPC
 * 4. Create studio via admin client (bypasses RLS — no active session needed)
 * 5. Return { success, teacherCode, needsConfirmation }
 */
export async function registerTeacher(
  email: string,
  password: string,
  studioName: string
): Promise<RegisterTeacherResult> {
  try {
    const supabase = await createClient();

    // Step 1: Create auth user (DB trigger handle_new_user creates the profile)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "teacher",
          display_name: studioName,
          studio_name: studioName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Registratie mislukt — geen gebruiker aangemaakt." };
    }

    const userId = data.user.id;
    console.log(`[registerTeacher] Created user: ${userId} (session: ${!!data.session})`);
    const admin = createAdminClient();

    // Step 2: Ensure profile exists as a fallback.
    // The DB trigger (handle_new_user) runs synchronously and should have
    // created the profile already. We create it manually only if it's missing,
    // e.g. when migration 010 wasn't applied in production yet.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        family_id: null, // Teachers have no family
        role: "teacher",
        display_name: studioName,
        locale: "nl",
      });

      if (profileError) {
        return {
          error: "Kan profiel niet aanmaken: " + profileError.message,
        };
      }
    }

    // Step 3: Generate unique teacher_code via RPC
    const { data: teacherCode, error: codeError } = await admin.rpc(
      "generate_teacher_code"
    );

    if (codeError || !teacherCode) {
      return { error: "Kan docentcode niet genereren." };
    }

    // Step 4: Create studio using admin client (bypasses RLS, no session needed)
    const { data: studio, error: studioError } = await admin
      .from("studios")
      .insert({
        owner_id: userId,
        name: studioName,
        teacher_code: teacherCode,
      })
      .select("id, teacher_code")
      .single();

    if (studioError) {
      console.error(`[registerTeacher] Studio insert error for userId ${userId}:`, studioError);
      return { error: "Kan studio niet aanmaken: " + studioError.message };
    }

    console.log(`[registerTeacher] Studio created: id=${studio.id}, owner=${userId}, code=${studio.teacher_code}`);

    // Step 5: Return result — needsConfirmation is true when email must be confirmed
    return {
      success: true,
      teacherCode: studio.teacher_code,
      needsConfirmation: !data.session,
    };
  } catch (err) {
    console.error("registerTeacher error:", err);
    return { error: "Registratie mislukt — probeer opnieuw." };
  }
}

// ---------------------------------------------------------------------------
// Studio creation (standalone — for use after email confirmation flow)
// ---------------------------------------------------------------------------

interface CreateStudioResult {
  success?: boolean;
  studioId?: string;
  teacherCode?: string;
  error?: string;
}

/**
 * Create a studio for an already-authenticated teacher.
 * Used as a standalone action when the teacher is already signed in
 * (e.g. after completing email confirmation).
 * For the initial registration flow, use registerTeacher() instead —
 * it creates the studio atomically without requiring an active session.
 */
export async function createStudio(
  studioName: string
): Promise<CreateStudioResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Niet ingelogd." };
    }

    const admin = createAdminClient();

    // Generate unique teacher code
    const { data: teacherCode, error: codeError } = await admin.rpc(
      "generate_teacher_code"
    );

    if (codeError || !teacherCode) {
      return { error: "Kan docentcode niet genereren." };
    }

    // Create studio
    const { data: studio, error: studioError } = await admin
      .from("studios")
      .insert({
        owner_id: user.id,
        name: studioName,
        teacher_code: teacherCode,
      })
      .select("id, teacher_code")
      .single();

    if (studioError) {
      return { error: studioError.message };
    }

    return {
      success: true,
      studioId: studio.id,
      teacherCode: studio.teacher_code,
    };
  } catch (err) {
    return { error: "Kan studio niet aanmaken." };
  }
}

// ---------------------------------------------------------------------------
// Student login (via teacher code + student code + PIN)
// ---------------------------------------------------------------------------

/**
 * Sign in a student using teacher_code, student_code, and PIN.
 * Looks up the student via the lookup_student_by_codes() RPC function,
 * then authenticates with the student's password (PIN).
 */
export async function loginStudent(
  teacherCode: string,
  studentCode: string,
  pin: string
): Promise<LoginResult> {
  try {
    const admin = createAdminClient();

    // Look up student by teacher_code + student_code directly via admin client.
    // The lookup_student_by_codes() RPC is not reliably in PostgREST's schema
    // cache, so we implement the same join logic with two queries here.

    // Step 1: find the studio that has this teacher_code
    const { data: studio, error: studioError } = await admin
      .from("studios")
      .select("id")
      .eq("teacher_code", teacherCode.toUpperCase())
      .maybeSingle();

    if (studioError || !studio) {
      return {
        error: "Leerling niet gevonden. Controleer de docent- en leerlingcode.",
      };
    }

    // Step 2: find the teacher_students record for this studio + student_code
    const { data: tsRecord, error: tsError } = await admin
      .from("teacher_students")
      .select("student_id")
      .eq("studio_id", studio.id)
      .eq("student_code", studentCode.toUpperCase())
      .maybeSingle();

    if (tsError || !tsRecord) {
      return {
        error: "Leerling niet gevonden. Controleer de docent- en leerlingcode.",
      };
    }

    const studentId = tsRecord.student_id;

    // Get student's auth email via admin
    const { data: authUser, error: authError } =
      await admin.auth.admin.getUserById(studentId);

    if (authError || !authUser.user?.email) {
      return { error: "Gebruiker niet gevonden." };
    }

    // Sign in with PIN (same as child login)
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password: pin,
    });

    if (error) {
      return { error: "Verkeerde PIN. Probeer opnieuw." };
    }

    return { success: true };
  } catch (err) {
    return { error: "Kan niet inloggen. Probeer opnieuw." };
  }
}
