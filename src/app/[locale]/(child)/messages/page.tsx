import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChildMessagesClient } from "./ChildMessagesClient";
import {
  getStudentTeacherInfo,
  getStudioMessagesForConversation,
} from "@/lib/actions/studio-messages";

/**
 * Messages page for children – server component.
 *
 * Handles two cases:
 * 1. Family child (family_id !== null) → family messaging with parent
 * 2. Teacher-student (family_id === null) → studio messaging with teacher
 *
 * Uses admin client for all DB queries to bypass the ES256 JWT /
 * PostgREST HS256 mismatch that causes RLS to silently filter all rows.
 * Security is enforced by scoping queries to the verified user.id.
 */
export default async function ChildMessagesPage() {
  await getTranslations(); // Ensure translations are loaded
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Niet ingelogd
      </div>
    );
  }

  // Use admin client to bypass RLS JWT mismatch
  const admin = createAdminClient();

  // Fetch child profile (for can_send_messages and family_id)
  const { data: profile } = await admin
    .from("profiles")
    .select("can_send_messages, family_id")
    .eq("id", user.id)
    .single();

  // ── Teacher-student path (family_id === null) ─────────────────────────
  if (profile?.family_id === null) {
    const teacherInfo = await getStudentTeacherInfo();

    if (!teacherInfo) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          Leraar niet gevonden
        </div>
      );
    }

    // Load studio messages for this student ↔ teacher conversation
    const studioMessages = await getStudioMessagesForConversation(
      teacherInfo.studio_id,
      teacherInfo.teacher_id
    );

    // Mark unread messages as read (fire-and-forget via admin client)
    const unreadIds = studioMessages
      .filter((m) => m.recipient_id === user.id && !m.is_read)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      admin
        .from("studio_messages")
        .update({ is_read: true })
        .in("id", unreadIds)
        .then(() => {});
    }

    return (
      <ChildMessagesClient
        messages={[]} // Family messages not used in teacher mode
        childId={user.id}
        parentId={null}
        canSend={teacherInfo.can_send}
        teacherMode={true}
        teacherName={teacherInfo.teacher_name}
        teacherId={teacherInfo.teacher_id}
        studioMessages={studioMessages}
      />
    );
  }

  // ── Family child path (family_id !== null) ────────────────────────────
  const canSend = profile?.can_send_messages ?? false;

  // Find parent(s) in the same family
  let parentId: string | null = null;
  if (profile) {
    const { data: parents } = await admin
      .from("profiles")
      .select("id")
      .eq("family_id", profile.family_id)
      .eq("role", "parent")
      .limit(1);

    parentId = parents?.[0]?.id ?? null;
  }

  // Fetch family messages involving this child
  const { data: messages } = await admin
    .from("messages")
    .select("id, content, is_read, created_at, sender_id, recipient_id")
    .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
    .order("created_at", { ascending: true })
    .limit(100);

  // Mark unread received messages as read (fire-and-forget)
  const unreadIds = (messages ?? [])
    .filter((m) => m.recipient_id === user.id && !m.is_read)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    admin
      .from("messages")
      .update({ is_read: true })
      .in("id", unreadIds)
      .then(() => {});
  }

  return (
    <ChildMessagesClient
      messages={messages ?? []}
      childId={user.id}
      parentId={parentId}
      canSend={canSend}
    />
  );
}
