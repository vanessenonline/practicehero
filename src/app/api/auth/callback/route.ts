import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handle auth callbacks from Supabase (email confirmation, password reset, OAuth).
 *
 * Supabase sends the user here with a `code` query parameter after they click
 * a link in their email. We exchange that code for a session and redirect.
 *
 * For password resets, the `next` parameter is set to `/[locale]/reset-password`
 * so the user lands on the new-password form after the session is established.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/nl";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Fallback: if no code or exchange failed, go back to login
  return NextResponse.redirect(`${origin}/nl/login`);
}
