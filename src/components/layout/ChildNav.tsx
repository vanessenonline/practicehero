"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Music, ShoppingBag, Trophy, MessageCircle, ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutConfirmDialog } from "@/components/layout/LogoutConfirmDialog";

const navItems = [
  { href: "/home", icon: Home, labelKey: "nav.home" },
  { href: "/practice", icon: Music, labelKey: "nav.practice" },
  { href: "/shop", icon: ShoppingBag, labelKey: "nav.shop" },
  { href: "/achievements", icon: Trophy, labelKey: "nav.achievements" },
  { href: "/messages", icon: MessageCircle, labelKey: "nav.messages" },
] as const;

interface ChildNavProps {
  /** Number of unread messages to display as a badge on the messages nav item */
  unreadMessages?: number;
  /** User role: "child" (family child) or "student" (teacher-linked student) */
  userRole?: "child" | "student";
}

/**
 * Bottom navigation bar for the child view.
 * Colorful, large touch targets, fun design for kids.
 *
 * Shows a contextual exit button (fixed top-left):
 * - Child mode (parent handed device): "Terug naar ouder" → parent login
 * - Student (leerlingcode login): "Uitloggen" → student login tab
 * - Family child (direct PIN login): "Uitloggen" → child login tab
 *
 * Uses the server-side /api/auth/logout route instead of client-side
 * Supabase signOut(), because the latter hangs due to the Browser Lock
 * Manager API and fails to clear session cookies.
 */
export function ChildNav({ unreadMessages = 0, userRole = "child" }: ChildNavProps) {
  const t = useTranslations();
  const pathname = usePathname();

  // Track if we're in child mode (parent handed device to child)
  const [isChildMode, setIsChildMode] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Extract locale from pathname (e.g., /nl/home -> nl)
  const locale = pathname.split("/")[1];

  // Check localStorage for child mode flag on mount
  useEffect(() => {
    const childModeFlag = localStorage.getItem("practicehero_child_mode");
    setIsChildMode(childModeFlag === "true");
  }, []);

  /** Go back to parent: clear flag, log out via server, redirect to parent login */
  function handleBackToParent() {
    try {
      localStorage.removeItem("practicehero_child_mode");
    } catch {
      // localStorage may not be available
    }

    window.location.href = `/api/auth/logout?redirect=/${locale}/login`;
  }

  /** Log out: redirect to the appropriate login tab so next user can log in quickly */
  function handleLogout() {
    const tab = userRole === "student" ? "student" : "child";
    window.location.href = `/api/auth/logout?redirect=/${locale}/login?tab=${tab}`;
  }

  return (
    <>
      {/* Contextual exit button (floating top-left) */}
      {isChildMode ? (
        <Button
          onClick={handleBackToParent}
          className="fixed top-4 left-4 z-50 bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Terug naar ouder</span>
        </Button>
      ) : (
        <Button
          onClick={() => setShowLogoutConfirm(true)}
          variant="outline"
          className="fixed top-4 left-4 z-50 gap-2 bg-white/90 backdrop-blur-sm border-gray-200 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Uitloggen</span>
        </Button>
      )}

      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={handleLogout}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur-sm safe-area-bottom">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map(({ href, icon: Icon, labelKey }) => {
          const fullHref = `/${locale}${href}`;
          const isActive = pathname.startsWith(fullHref);

          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                "min-w-[3rem] min-h-[3rem]",
                isActive
                  ? "text-orange-600 scale-110"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive && "text-orange-500"
                  )}
                />
                {href === "/messages" && unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </div>
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
