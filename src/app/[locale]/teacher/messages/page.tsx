import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherContacts } from "@/lib/actions/studio-messages";
import { TeacherMessagesClient } from "./TeacherMessagesClient";

/**
 * Teacher messages page – server component.
 * Loads studio, contacts (students + linked parents), and passes
 * everything to TeacherMessagesClient for interactive display.
 */
export default async function TeacherMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  await params; // locale not used directly here
  const { to: preselectedContactId } = await searchParams;

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

  // Load teacher's studio
  const admin = createAdminClient();
  const { data: studio } = await admin
    .from("studios")
    .select("id, name")
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Studio niet gevonden
      </div>
    );
  }

  // Load all contacts (students + linked parents) with unread counts
  const contacts = await getTeacherContacts(studio.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("teacher.messages.title")}</h1>

      <TeacherMessagesClient
        contacts={contacts}
        studioId={studio.id}
        teacherId={user.id}
        preselectedContactId={preselectedContactId}
      />
    </div>
  );
}
