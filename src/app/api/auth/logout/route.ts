import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side logout endpoint.
 *
 * The client-side Supabase signOut() hangs due to the Browser Lock Manager
 * API timing out (10 seconds). Even with a Promise.race() timeout, the auth
 * cookies are NOT cleared, so the middleware still sees the user as
 * authenticated and redirects them back to the dashboard.
 *
 * This route solves that by:
 * 1. Calling signOut() server-side (no Lock Manager issue on the server)
 * 2. Explicitly deleting all Supabase auth cookies in the response
 * 3. Redirecting to the specified URL (defaults to /nl/login)
 *
 * Usage from client components:
 *   window.location.href = '/api/auth/logout?redirect=/nl/login'
 *   window.location.href = '/api/auth/logout?redirect=/nl/login?tab=child'
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirect = searchParams.get("redirect") ?? "/nl/login";

  // 1. Attempt server-side signOut (best-effort, non-blocking)
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Server-side signOut failed, but we'll clear cookies manually anyway
  }

  // 2. Build redirect response
  const redirectUrl = new URL(redirect, origin);
  const response = NextResponse.redirect(redirectUrl);

  // 3. Explicitly delete ALL Supabase auth cookies
  //    Supabase SSR stores session data in cookies prefixed with 'sb-'
  const cookiesToClear = request.cookies.getAll().filter((c) =>
    c.name.startsWith("sb-")
  );

  for (const cookie of cookiesToClear) {
    response.cookies.delete(cookie.name);
  }

  return response;
}
