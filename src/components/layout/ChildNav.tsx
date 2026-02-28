"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Music, ShoppingBag, Trophy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
 */
export function ChildNav() {
  const t = useTranslations();
  const pathname = usePathname();

  // Extract locale from pathname (e.g., /nl/home -> nl)
  const locale = pathname.split("/")[1];

  return (
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
  );
}
