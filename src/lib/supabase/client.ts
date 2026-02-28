import { createBrowserClient } from "@supabase/ssr";

/**
 * Check whether Supabase environment variables are configured.
 * Returns false during development if placeholder values are still present.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    url.startsWith("http") &&
    key.length > 20
  );
}

export function createClient() {
  if (!isSupabaseConfigured()) {
    // Return a dummy client that won't crash during development
    // when Supabase is not yet configured.
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
    );
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
