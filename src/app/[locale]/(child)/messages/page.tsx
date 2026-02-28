import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ChildMessagesClient } from "./ChildMessagesClient";

/**
 * Messages page for children – server component that loads messages,
 * profile info (for send permission), and parent ID, then delegates
 * to ChildMessagesClient for interactive display and optional composing.
 */
export default async function ChildMessagesPage() {
  const t = await getTranslations();
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

  // Fetch child profile (for can_send_messages and family_id)
  const { data: profile } = await supabase
    .from("profiles")
    .select("can_send_messages, family_id")
    .eq("id", user.id)
    .single();

  const canSend = profile?.can_send_messages ?? false;

  // Find parent(s) in the same family to know who to send messages to
  let parentId: string | null = null;
  if (canSend && profile) {
    const { data: parents } = await supabase
      .from("profiles")
      .select("id")
      .eq("family_id", profile.family_id)
      .eq("role", "parent")
      .limit(1);

    parentId = parents?.[0]?.id ?? null;
  }

  // Fetch messages involving this child (both received and sent)
  const { data: messages } = await supabase
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
    supabase
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
