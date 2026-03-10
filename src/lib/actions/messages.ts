"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface SendMessageResult {
  success?: boolean;
  error?: string;
}

/**
 * Send a message from the logged-in parent to a child in the same family.
 *
 * Uses the admin client for all DB queries to work around the ES256 JWT /
 * PostgREST HS256 mismatch that causes RLS to silently filter all rows.
 * Security is enforced by verifying the user via auth.getUser() and
 * checking same-family membership before inserting the message.
 */
export async function sendMessage(
  recipientId: string,
  content: string
): Promise<SendMessageResult> {
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

  // Get the sender's profile to verify family membership and permissions
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("family_id, role, can_send_messages")
    .eq("id", user.id)
    .single();

  if (!senderProfile) {
    return { error: "Profiel niet gevonden" };
  }

  // Children can only send messages if can_send_messages is enabled
  if (senderProfile.role === "child" && !senderProfile.can_send_messages) {
    return { error: "Berichten versturen is niet ingeschakeld" };
  }

  // Verify the recipient is in the same family
  const { data: recipientProfile } = await admin
    .from("profiles")
    .select("family_id")
    .eq("id", recipientId)
    .single();

  if (!recipientProfile) {
    return { error: "Ontvanger niet gevonden" };
  }

  // Messages only work within a family context (both must have the same family_id)
  // Teacher students (family_id = null) cannot participate in family messaging
  if (
    senderProfile.family_id === null ||
    recipientProfile.family_id === null ||
    recipientProfile.family_id !== senderProfile.family_id
  ) {
    return { error: "Ontvanger niet gevonden" };
  }

  const { error } = await admin.from("messages").insert({
    family_id: senderProfile.family_id,
    sender_id: user.id,
    recipient_id: recipientId,
    content: content.trim(),
    is_read: false,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Mark messages as read for the current user.
 */
export async function markMessagesRead(
  senderIds: string[]
): Promise<void> {
  if (senderIds.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const admin = createAdminClient();

  await admin
    .from("messages")
    .update({ is_read: true })
    .eq("recipient_id", user.id)
    .in("sender_id", senderIds)
    .eq("is_read", false);
}
