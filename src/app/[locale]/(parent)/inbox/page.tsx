import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MessagesClient } from "./MessagesClient";

/**
 * Parent messages page – server component that loads children and recent messages.
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

  // Get parent's family_id
  const { data: parentProfile } = await supabase
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
  const { data: children } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("family_id", parentProfile.family_id)
    .eq("role", "child")
    .order("created_at");

  // Get recent messages (last 50)
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("family_id", parentProfile.family_id)
    .order("created_at", { ascending: false })
    .limit(50);

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
      />
    </div>
  );
}
