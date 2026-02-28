"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Music, ShoppingBag, Trophy, MessageCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/providers/SupabaseProvider";

const navItems = [
  { href: "/home", icon: Home, labelKey: "nav.home" },
  { href: "/practice", icon: Music, labelKey: "nav.practice" },
  { href: "/shop", icon: ShoppingBag, labelKey: "nav.shop" },
  { href: "/achievements", icon: Trophy, labelKey: "nav.achievements" },
  { href: "/messages", icon: MessageCircle, labelKey: "nav.messages" },
] as const;

/**
 * Bottom navigation bar for the child view.
 * Colorful, large touch targets, fun design for kids.
 * Includes a "back to parent" button when in child mode.
 */
export function ChildNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();

  // Track if we're in child mode (parent handed device to child)
  const [isChildMode, setIsChildMode] = useState(false);

  // Extract locale from pathname (e.g., /nl/home -> nl)
  const locale = pathname.split("/")[1];

  // Check localStorage for child mode flag on mount
  useEffect(() => {
    const childModeFlag = localStorage.getItem("practicehero_child_mode");
    setIsChildMode(childModeFlag === "true");
  }, []);

  // Handle back to parent
  async function handleBackToParent() {
    try {
      localStorage.removeItem("practicehero_child_mode");
    } catch {
      // localStorage may not be available
    }

    // Sign out and redirect to login
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <>
      {/* Back to parent button (floating) */}
      {isChildMode && (
        <Button
          onClick={handleBackToParent}
          className="fixed top-4 left-4 z-50 bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Terug naar ouder</span>
        </Button>
      )}

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
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive && "text-orange-500"
                )}
              />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
