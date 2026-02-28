import { ChildNav } from "@/components/layout/ChildNav";

/**
 * Child layout with bottom navigation bar.
 * Uses padding bottom to account for the fixed nav bar.
 */
export default function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-purple-50/50 pb-20">
      <main className="mx-auto max-w-lg px-4 py-4">
        {children}
      </main>
      <ChildNav />
    </div>
  );
}
