import { TeacherNav } from "@/components/layout/TeacherNav";
import { getTeacherUnreadCount } from "@/lib/actions/studio-messages";

/**
 * Teacher layout with top navigation bar.
 * Fetches unread message count server-side to display badge in TeacherNav.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const unreadMessages = await getTeacherUnreadCount();

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNav unreadMessages={unreadMessages} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
