"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, BookOpen, Settings, LogOut, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/SupabaseProvider";

const navItems = [
  { href: "/teacher/dashboard", icon: LayoutDashboard, labelKey: "nav.teacher.dashboard" },
  { href: "/teacher/students", icon: Users, labelKey: "nav.teacher.students" },
  { href: "/teacher/courses", icon: BookOpen, labelKey: "nav.teacher.courses" },
  { href: "/teacher/settings", icon: Settings, labelKey: "nav.teacher.settings" },
] as const;

/**
 * Top navigation for the teacher dashboard.
 * Professional design matching ParentNav pattern.
 * Provides access to dashboard, student management, courses, and settings.
 */
export function TeacherNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  const locale = pathname.split("/")[1];

  async function handleLogout() {
    await signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href={`/${locale}/teacher/dashboard`} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <Music className="h-4 w-4" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {t("common.appName")}
          </span>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, icon: Icon, labelKey }) => {
            const fullHref = `/${locale}${href}`;
            // Match both exact and nested paths (e.g., /teacher/students and /teacher/students/add)
            const isActive =
              href === "/teacher/dashboard"
                ? pathname === fullHref
                : pathname.startsWith(fullHref);

            return (
              <Link
                key={href}
                href={fullHref}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-100 text-blue-900"
                    : "text-muted-foreground hover:bg-blue-50 hover:text-blue-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(labelKey)}</span>
              </Link>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
