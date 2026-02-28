"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/database";

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

  const { data: profile } = await supabase
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

  const { data: parentProfile } = await supabase
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
  const admin = createAdminClient();
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
// Teacher registration
// ---------------------------------------------------------------------------

/**
 * Register a new teacher account.
 * The database trigger `handle_new_user` should be updated to handle teacher role,
 * or we create the studio in a follow-up action via createStudio().
 */
export async function registerTeacher(
  email: string,
  password: string,
  studioName: string
): Promise<RegisterResult> {
  const supabase = await createClient();

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

  if (data.user && !data.session) {
    return { success: true, needsConfirmation: true };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Studio creation (after teacher registration)
// ---------------------------------------------------------------------------

interface CreateStudioResult {
  success?: boolean;
  studioId?: string;
  teacherCode?: string;
  error?: string;
}

/**
 * Create a studio for an authenticated teacher.
 * Generates a unique teacher_code via RPC and inserts the studio record.
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

    // Look up student by teacher_code + student_code
    const { data: lookup, error: lookupError } = await admin.rpc(
      "lookup_student_by_codes",
      {
        p_teacher_code: teacherCode,
        p_student_code: studentCode,
      }
    );

    if (lookupError || !lookup || lookup.length === 0) {
      return {
        error: "Leerling niet gevonden. Controleer de docent- en leerlingcode.",
      };
    }

    const studentId = lookup[0].student_id;

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
