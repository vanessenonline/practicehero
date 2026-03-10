"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StudioMessage } from "@/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StudioContact {
  /** Profile ID of the contact */
  id: string;
  display_name: string;
  avatar_url: string | null;
  /** "student" or "parent" — used for grouping in UI */
  contact_type: "student" | "parent";
  /** Number of unread messages from this contact (received by current user) */
  unread_count: number;
}

export interface LinkedStudio {
  studio_id: string;
  studio_name: string;
  teacher_id: string;
  teacher_name: string;
  /** Number of unread studio messages from teacher for this parent */
  unread_count: number;
}

export interface StudentTeacherInfo {
  studio_id: string;
  teacher_id: string;
  teacher_name: string;
  /** Whether the student is allowed to send messages */
  can_send: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// sendStudioMessage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a studio message from the authenticated user to a recipient.
 *
 * Authorization per role:
 * - Teacher: can message any of their students or linked parents in their studio
 * - Child/Student (family_id = null): can message their teacher if can_send_messages is true
 * - Parent: can message a teacher if linked via studio_parent_links
 *
 * All DB queries use the admin client to bypass the ES256 JWT / PostgREST
 * HS256 mismatch. Security is enforced via explicit ID checks below.
 */
export async function sendStudioMessage(
  recipientId: string,
  content: string
): Promise<{ success?: boolean; error?: string }> {
  if (!content.trim()) {
    return { error: "Bericht mag niet leeg zijn" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd" };
  }

  const admin = createAdminClient();

  // Load sender profile
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("role, family_id, can_send_messages")
    .eq("id", user.id)
    .single();

  if (!senderProfile) {
    return { error: "Profiel niet gevonden" };
  }

  let studioId: string | null = null;

  // ── Teacher sending ──────────────────────────────────────────────────────
  if (senderProfile.role === "teacher") {
    // Get the teacher's studio
    const { data: studio } = await admin
      .from("studios")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!studio) {
      return { error: "Studio niet gevonden" };
    }

    // Verify recipient is a student OR linked parent in this studio
    const [{ data: studentLink }, { data: parentLink }] = await Promise.all([
      admin
        .from("teacher_students")
        .select("student_id")
        .eq("studio_id", studio.id)
        .eq("student_id", recipientId)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("studio_parent_links")
        .select("parent_id")
        .eq("studio_id", studio.id)
        .eq("parent_id", recipientId)
        .maybeSingle(),
    ]);

    if (!studentLink && !parentLink) {
      return { error: "Ontvanger niet gevonden in uw studio" };
    }

    studioId = studio.id;
  }

  // ── Student/child (teacher-student, family_id = null) sending ─────────────
  else if (senderProfile.role === "child" && senderProfile.family_id === null) {
    if (!senderProfile.can_send_messages) {
      return { error: "Berichten versturen is niet ingeschakeld" };
    }

    // Get the teacher_students record to find the studio
    const { data: teacherStudent } = await admin
      .from("teacher_students")
      .select("studio_id")
      .eq("student_id", user.id)
      .single();

    if (!teacherStudent) {
      return { error: "Leerlingkoppeling niet gevonden" };
    }

    // Verify the recipient is the studio owner
    const { data: studio } = await admin
      .from("studios")
      .select("id, owner_id")
      .eq("id", teacherStudent.studio_id)
      .single();

    if (!studio || studio.owner_id !== recipientId) {
      return { error: "Ontvanger niet gevonden" };
    }

    studioId = studio.id;
  }

  // ── Parent sending ────────────────────────────────────────────────────────
  else if (senderProfile.role === "parent") {
    // Find a studio where:
    //  1. This parent is linked (studio_parent_links)
    //  2. The recipient is the studio owner
    const { data: studioLink } = await admin
      .from("studio_parent_links")
      .select("studio_id")
      .eq("parent_id", user.id)
      .in(
        "studio_id",
        // Sub-query: studios owned by the recipient
        (
          await admin
            .from("studios")
            .select("id")
            .eq("owner_id", recipientId)
        ).data?.map((s: { id: string }) => s.id) ?? []
      )
      .maybeSingle();

    if (!studioLink) {
      return { error: "U bent niet gekoppeld aan deze leraar" };
    }

    studioId = studioLink.studio_id;
  }

  // ── Unknown role ───────────────────────────────────────────────────────────
  else {
    return { error: "Geen toestemming om berichten te sturen" };
  }

  if (!studioId) {
    return { error: "Studio niet bepaald" };
  }

  // Insert the message
  const { error: insertError } = await admin.from("studio_messages").insert({
    studio_id: studioId,
    sender_id: user.id,
    recipient_id: recipientId,
    content: content.trim(),
    is_read: false,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// markStudioMessagesRead
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark studio messages as read.
 * Only marks messages where recipient_id = current user to prevent spoofing.
 */
export async function markStudioMessagesRead(
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const admin = createAdminClient();

  await admin
    .from("studio_messages")
    .update({ is_read: true })
    .in("id", messageIds)
    .eq("recipient_id", user.id)
    .eq("is_read", false);
}

// ─────────────────────────────────────────────────────────────────────────────
// getTeacherContacts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all contacts (students + linked parents) for a teacher's studio,
 * including the unread message count per contact.
 *
 * Used on the teacher messages page to populate the contact list.
 */
export async function getTeacherContacts(
  studioId: string
): Promise<StudioContact[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const admin = createAdminClient();

  // Verify caller owns this studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", studioId)
    .eq("owner_id", user.id)
    .single();

  if (!studio) return [];

  // Load students
  const { data: teacherStudents } = await admin
    .from("teacher_students")
    .select("student_id")
    .eq("studio_id", studioId)
    .eq("is_active", true);

  // Load linked parents
  const { data: parentLinks } = await admin
    .from("studio_parent_links")
    .select("parent_id")
    .eq("studio_id", studioId);

  // Collect all contact IDs
  const studentIds = (teacherStudents ?? []).map((r) => r.student_id);
  const parentIds = (parentLinks ?? []).map((r) => r.parent_id);
  const allIds = [...studentIds, ...parentIds];

  if (allIds.length === 0) return [];

  // Batch fetch profiles
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", allIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  // Count unread per contact (messages received by this teacher)
  const { data: unreadRows } = await admin
    .from("studio_messages")
    .select("sender_id")
    .eq("studio_id", studioId)
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  const unreadMap = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadMap.set(row.sender_id, (unreadMap.get(row.sender_id) ?? 0) + 1);
  }

  const contacts: StudioContact[] = [];

  for (const id of studentIds) {
    const p = profileMap.get(id);
    if (!p) continue;
    contacts.push({
      id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      contact_type: "student",
      unread_count: unreadMap.get(id) ?? 0,
    });
  }

  for (const id of parentIds) {
    const p = profileMap.get(id);
    if (!p) continue;
    contacts.push({
      id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      contact_type: "parent",
      unread_count: unreadMap.get(id) ?? 0,
    });
  }

  return contacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// getStudioMessagesForConversation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the conversation between the current user and a specific contact
 * within a studio. Returns messages ordered oldest-first (for display).
 */
export async function getStudioMessagesForConversation(
  studioId: string,
  contactId: string
): Promise<StudioMessage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const admin = createAdminClient();

  const { data: messages } = await admin
    .from("studio_messages")
    .select("*")
    .eq("studio_id", studioId)
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${contactId}),` +
        `and(sender_id.eq.${contactId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(100);

  return messages ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// linkParentToStudio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Link the current parent to a studio by teacher code.
 * Returns the studio name on success so the UI can display a confirmation.
 */
export async function linkParentToStudio(teacherCode: string): Promise<{
  success?: boolean;
  studioName?: string;
  error?: string;
}> {
  const trimmed = teacherCode.trim().toUpperCase();
  if (!trimmed) {
    return { error: "Voer een leraarcode in" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd" };
  }

  const admin = createAdminClient();

  // Find the studio by teacher code (case-insensitive)
  const { data: studio } = await admin
    .from("studios")
    .select("id, name")
    .ilike("teacher_code", trimmed)
    .single();

  if (!studio) {
    return { error: "Leraarcode niet gevonden" };
  }

  // Check if already linked
  const { data: existing } = await admin
    .from("studio_parent_links")
    .select("id")
    .eq("studio_id", studio.id)
    .eq("parent_id", user.id)
    .maybeSingle();

  if (existing) {
    return { success: true, studioName: studio.name }; // Idempotent — already linked
  }

  // Verify the current user is a parent
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent") {
    return { error: "Alleen ouders kunnen zich koppelen aan een studio" };
  }

  // Create the link
  const { error: linkError } = await admin.from("studio_parent_links").insert({
    studio_id: studio.id,
    parent_id: user.id,
  });

  if (linkError) {
    console.error("studio_parent_links insert error:", linkError.message);
    return { error: "Er ging iets mis bij het koppelen. Probeer het later opnieuw." };
  }

  return { success: true, studioName: studio.name };
}

// ─────────────────────────────────────────────────────────────────────────────
// getLinkedStudiosForParent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all studios the current parent is linked to, with teacher info
 * and unread message counts. Used on the parent inbox "Leraren" tab.
 */
export async function getLinkedStudiosForParent(): Promise<LinkedStudio[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const admin = createAdminClient();

  // Find all studios this parent is linked to
  const { data: links } = await admin
    .from("studio_parent_links")
    .select("studio_id")
    .eq("parent_id", user.id);

  if (!links || links.length === 0) return [];

  const studioIds = links.map((l) => l.studio_id);

  // Load studios
  const { data: studios } = await admin
    .from("studios")
    .select("id, name, owner_id")
    .in("id", studioIds);

  if (!studios || studios.length === 0) return [];

  // Load teacher profiles
  const teacherIds = studios.map((s) => s.owner_id);
  const { data: teacherProfiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", teacherIds);

  const teacherMap = new Map(
    (teacherProfiles ?? []).map((p) => [p.id, p.display_name])
  );

  // Count unread studio messages per studio for this parent
  const { data: unreadRows } = await admin
    .from("studio_messages")
    .select("studio_id")
    .in("studio_id", studioIds)
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  const unreadMap = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadMap.set(row.studio_id, (unreadMap.get(row.studio_id) ?? 0) + 1);
  }

  return studios.map((s) => ({
    studio_id: s.id,
    studio_name: s.name,
    teacher_id: s.owner_id,
    teacher_name: teacherMap.get(s.owner_id) ?? "Leraar",
    unread_count: unreadMap.get(s.id) ?? 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// getStudentTeacherInfo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For a teacher-student (family_id = null), resolve the studio and teacher
 * they belong to. Used on the child messages page to route to studio messaging.
 */
export async function getStudentTeacherInfo(): Promise<StudentTeacherInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  // Look up the teacher_students record for this student
  const { data: ts } = await admin
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", user.id)
    .single();

  if (!ts) return null;

  // Load studio + owner
  const { data: studio } = await admin
    .from("studios")
    .select("id, owner_id")
    .eq("id", ts.studio_id)
    .single();

  if (!studio) return null;

  // Load teacher display name
  const { data: teacherProfile } = await admin
    .from("profiles")
    .select("display_name, can_send_messages")
    .eq("id", studio.owner_id)
    .single();

  // Load student's own can_send_messages setting
  const { data: studentProfile } = await admin
    .from("profiles")
    .select("can_send_messages")
    .eq("id", user.id)
    .single();

  return {
    studio_id: studio.id,
    teacher_id: studio.owner_id,
    teacher_name: teacherProfile?.display_name ?? "Leraar",
    can_send: studentProfile?.can_send_messages ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unread count helpers (for nav badges)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Count total unread studio messages for the authenticated teacher.
 * Used by the teacher layout to render a badge in TeacherNav.
 */
export async function getTeacherUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const admin = createAdminClient();

  const { count } = await admin
    .from("studio_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  return count ?? 0;
}

/**
 * Count total unread messages for the authenticated parent.
 * Combines unread family messages + unread studio messages (from teachers).
 * Used by the parent layout to render a badge in ParentNav.
 */
export async function getParentUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const admin = createAdminClient();

  // Count unread family messages
  const { count: familyCount } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  // Count unread studio messages (from teachers)
  const { count: studioCount } = await admin
    .from("studio_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  return (familyCount ?? 0) + (studioCount ?? 0);
}

/**
 * Count total unread messages for the authenticated child/student.
 * For family children: counts unread family messages.
 * For teacher-students: counts unread studio messages.
 * Used by the child layout to render a badge in ChildNav.
 */
export async function getChildUnreadCount(): Promise<number> {
  const result = await getChildNavData();
  return result.unreadCount;
}

/**
 * Fetch both unread count and user role for the child nav in a single auth call.
 * Returns { unreadCount, userRole } so the layout can pass both to ChildNav.
 */
export async function getChildNavData(): Promise<{
  unreadCount: number;
  userRole: "child" | "student";
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { unreadCount: 0, userRole: "child" };

  const admin = createAdminClient();

  // Load profile to check if family child or teacher-student
  const { data: profile } = await admin
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { unreadCount: 0, userRole: "child" };

  // Students have family_id = null (created by teacher, no family link)
  const userRole: "child" | "student" = profile.family_id ? "child" : "student";

  if (profile.family_id) {
    // Family child — count unread family messages
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    return { unreadCount: count ?? 0, userRole };
  } else {
    // Teacher-student — count unread studio messages
    const { count } = await admin
      .from("studio_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    return { unreadCount: count ?? 0, userRole };
  }
}
