import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Locale root page — redirects users based on authentication status and role.
 *
 * The middleware already handles most redirects, but this page acts as a
 * server-side fallback for edge cases (e.g. direct navigation).
 */
export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const role = user.user_metadata?.role;

  if (role === "child") {
    redirect(`/${locale}/home`);
  } else {
    redirect(`/${locale}/dashboard`);
  }
}
