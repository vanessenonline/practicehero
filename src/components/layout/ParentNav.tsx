"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, MessageCircle, Settings, LogOut, Music, Baby } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/SupabaseProvider";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/children", icon: Users, labelKey: "nav.children" },
  { href: "/inbox", icon: MessageCircle, labelKey: "nav.messages" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
] as const;

/**
 * Top/side navigation for the parent dashboard.
 * Clean, professional design with child mode switch.
 * Features: Dashboard, Children management, Messages, Settings, Child mode toggle, Logout
 * Deployment: Public repository enabled, Vercel can now deploy
 */
export function ParentNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  const locale = pathname.split("/")[1];

  async function handleLogout() {
    try {
      console.log('🔓 Logging out...');
      try {
        // Use a timeout to handle potential Lock Manager hanging
        const signOutPromise = signOut();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SignOut timeout')), 5000)
        );
        await Promise.race([signOutPromise, timeoutPromise]);
        console.log('✅ Signed out from Supabase');
      } catch (signOutError) {
        console.warn('⚠️  SignOut failed or timed out, proceeding with logout anyway:', signOutError);
      }

      // Clear any local storage related to session
      try {
        localStorage.removeItem('practicehero_child_mode');
        localStorage.removeItem('practicehero_family_id');
      } catch {
        // localStorage may not be available
      }

      // Push to login and refresh
      router.push(`/${locale}/login`);
      router.refresh();
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force redirect using window.location as fallback
      try {
        router.push(`/${locale}/login`);
      } catch {
        // Last resort: hard redirect
        window.location.href = `/${locale}/login`;
      }
    }
  }

  async function handleChildMode() {
    try {
      console.log('👶 Entering child mode...');

      // Set flag to show child login tab
      try {
        localStorage.setItem("practicehero_child_mode", "true");
        console.log('✅ Child mode flag set');
      } catch {
        console.warn('⚠️  localStorage not available');
      }

      // Sign out and redirect to login with child tab
      console.log('🔓 Signing out...');
      try {
        // Use a timeout to handle potential Lock Manager hanging
        const signOutPromise = signOut();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SignOut timeout')), 5000)
        );
        await Promise.race([signOutPromise, timeoutPromise]);
        console.log('✅ Signed out');
      } catch (signOutError) {
        console.warn('⚠️  SignOut failed or timed out, forcing redirect anyway:', signOutError);
      }

      console.log(`📍 Redirecting to login...`);
      router.push(`/${locale}/login?tab=child`);
      router.refresh();
    } catch (error) {
      console.error('❌ Child mode error:', error);
      // Force redirect using window.location as fallback
      try {
        router.push(`/${locale}/login?tab=child`);
      } catch {
        // Last resort: hard redirect
        window.location.href = `/${locale}/login?tab=child`;
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 text-white">
            <Music className="h-4 w-4" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
            {t("common.appName")}
          </span>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, icon: Icon, labelKey }) => {
            const fullHref = `/${locale}${href}`;
            // Match both exact and nested paths (e.g., /children and /children/add)
            const isActive =
              href === "/dashboard"
                ? pathname === fullHref
                : pathname.startsWith(fullHref);

            return (
              <Link
                key={href}
                href={fullHref}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
            onClick={handleChildMode}
            className="text-muted-foreground hover:text-blue-600"
            title="Kindmodus"
          >
            <Baby className="h-4 w-4" />
            <span className="hidden sm:inline ml-1 text-xs">Kindmodus</span>
          </Button>

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
