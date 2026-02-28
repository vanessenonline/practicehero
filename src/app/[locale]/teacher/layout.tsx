import { TeacherNav } from "@/components/layout/TeacherNav";

/**
 * Teacher layout with top navigation bar.
 * Provides navigation to dashboard, students, courses, and settings.
 */
export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
