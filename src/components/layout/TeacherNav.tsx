"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, BookOpen, Settings, LogOut, Music, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutConfirmDialog } from "@/components/layout/LogoutConfirmDialog";

const navItems = [
  { href: "/teacher/dashboard", icon: LayoutDashboard, labelKey: "nav.teacher.dashboard" },
  { href: "/teacher/students", icon: Users, labelKey: "nav.teacher.students" },
  { href: "/teacher/courses", icon: BookOpen, labelKey: "nav.teacher.courses" },
  { href: "/teacher/messages", icon: MessageCircle, labelKey: "nav.teacher.messages" },
  { href: "/teacher/settings", icon: Settings, labelKey: "nav.teacher.settings" },
] as const;

interface TeacherNavProps {
  /** Number of unread messages to display as a badge on the messages nav item */
  unreadMessages?: number;
}

/**
 * Top navigation for the teacher dashboard.
 * Professional design matching ParentNav pattern.
 * Provides access to dashboard, student management, courses, messages, and settings.
 * Shows an unread badge on the messages link when there are unread messages.
 */
export function TeacherNav({ unreadMessages = 0 }: TeacherNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const locale = pathname.split("/")[1];

  /**
   * Server-side logout via the /api/auth/logout route.
   * Uses window.location.href (full page reload) so the browser processes
   * the cleared session cookies from the server before the next request.
   * Client-side signOut() is avoided because it can hang for 10s due to
   * a Browser Lock Manager bug (see KNOWN_ISSUES.md, commit b6d74fd).
   */
  function handleLogout() {
    const loginUrl = encodeURIComponent(`/${locale}/login`);
    window.location.href = `/api/auth/logout?redirect=${loginUrl}`;
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
                {href === "/teacher/messages" && unreadMessages > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLogoutConfirm(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>

        <LogoutConfirmDialog
          open={showLogoutConfirm}
          onOpenChange={setShowLogoutConfirm}
          onConfirm={handleLogout}
        />
      </div>
    </header>
  );
}
