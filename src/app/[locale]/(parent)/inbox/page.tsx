import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLinkedStudiosForParent } from "@/lib/actions/studio-messages";
import { MessagesClient } from "./MessagesClient";

/**
 * Parent messages page – server component that loads children, recent family
 * messages, and linked teacher studios.
 *
 * Uses admin client for all DB queries to bypass the ES256 JWT /
 * PostgREST HS256 mismatch that causes RLS to silently filter all rows.
 * Security is enforced by scoping all queries to the verified user.id.
 */
export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const { locale } = await params;
  const { to: preselectedChildId } = await searchParams;

  const t = await getTranslations();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Niet ingelogd
      </div>
    );
  }

  // Use admin client to bypass RLS JWT mismatch
  const admin = createAdminClient();

  // Get parent's family_id
  const { data: parentProfile } = await admin
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (!parentProfile) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Profiel niet gevonden
      </div>
    );
  }

  // Get all children in family
  const { data: children } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("family_id", parentProfile.family_id)
    .eq("role", "child")
    .order("created_at");

  // Get recent family messages (last 50)
  const { data: messages } = await admin
    .from("messages")
    .select("*")
    .eq("family_id", parentProfile.family_id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get linked teacher studios (for "Leraren" tab)
  const linkedStudios = await getLinkedStudiosForParent();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("parent.messages.title")}</h1>

      <MessagesClient
        children={children ?? []}
        messages={(messages ?? []).reverse()}
        parentId={user.id}
        familyId={parentProfile.family_id}
        preselectedChildId={preselectedChildId}
        locale={locale}
        linkedStudios={linkedStudios}
      />
    </div>
  );
}
