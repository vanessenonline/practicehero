import { ChildNav } from "@/components/layout/ChildNav";
import { getChildNavData } from "@/lib/actions/studio-messages";

/**
 * Child layout with bottom navigation bar.
 * Uses padding bottom to account for the fixed nav bar.
 * Fetches unread message count and user role server-side for the nav.
 */
export default async function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { unreadCount, userRole } = await getChildNavData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-purple-50/50 pb-20">
      <main className="mx-auto max-w-lg px-4 py-4">
        {children}
      </main>
      <ChildNav unreadMessages={unreadCount} userRole={userRole} />
    </div>
  );
}
