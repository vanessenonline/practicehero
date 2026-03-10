import { ParentNav } from "@/components/layout/ParentNav";
import { getCurrentProfile } from "@/lib/actions/auth";
import { getParentUnreadCount } from "@/lib/actions/studio-messages";

/**
 * Parent layout with top navigation bar.
 * Fetches the family_id server-side so ParentNav can persist it to
 * localStorage before switching to child mode.
 * Also fetches unread message count for the nav badge.
 */
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const familyId = profile?.family_id ?? null;
  const unreadMessages = await getParentUnreadCount();

  return (
    <div className="min-h-screen bg-gray-50">
      <ParentNav familyId={familyId} unreadMessages={unreadMessages} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
