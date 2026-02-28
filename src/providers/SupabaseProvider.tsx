"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

/**
 * Internal auth state tracked by the provider.
 */
interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

/**
 * Values exposed to consumers via React context.
 */
interface SupabaseContextValue {
  supabase: SupabaseClient;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Context = createContext<SupabaseContextValue | undefined>(undefined);

/**
 * Provides the Supabase client instance and authentication state
 * (user, profile) to the entire component tree.
 *
 * Listens for auth state changes (sign-in, sign-out, token refresh)
 * and automatically fetches the corresponding profile row.
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    // Fetch profile helper — reused by initial load and auth listener
    async function fetchProfile(userId: string): Promise<Profile | null> {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      return data;
    }

    // Get the initial session (reads from local storage, fast)
    async function initAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;

        setAuthState({ user: session.user, profile, loading: false });

        // Remember family for child login on this device
        if (profile?.role === "parent" && profile.family_id) {
          try {
            localStorage.setItem("practicehero_family_id", profile.family_id);
          } catch {
            // localStorage may not be available (SSR, private mode)
          }
        }
      } else {
        setAuthState({ user: null, profile: null, loading: false });
      }
    }

    initAuth();

    // Subscribe to auth changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!mounted) return;

        setAuthState({ user: session.user, profile, loading: false });

        if (profile?.role === "parent" && profile.family_id) {
          try {
            localStorage.setItem("practicehero_family_id", profile.family_id);
          } catch {
            // Ignore localStorage errors
          }
        }
      } else {
        setAuthState({ user: null, profile: null, loading: false });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthState({ user: null, profile: null, loading: false });
  };

  return (
    <Context.Provider
      value={{
        supabase,
        user: authState.user,
        profile: authState.profile,
        loading: authState.loading,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}

/**
 * Access the raw Supabase client.
 * Useful for direct database queries and realtime subscriptions.
 */
export function useSupabase() {
  const context = useContext(Context);
  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return context.supabase;
}

/**
 * Access authentication state: user, profile, loading flag, and signOut.
 */
export function useAuth() {
  const context = useContext(Context);
  if (!context) {
    throw new Error("useAuth must be used within SupabaseProvider");
  }
  return {
    user: context.user,
    profile: context.profile,
    loading: context.loading,
    signOut: context.signOut,
  };
}
