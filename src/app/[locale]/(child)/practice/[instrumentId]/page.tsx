import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticeSession } from "./PracticeSession";
import { getPracticeContent } from "@/lib/actions/practice";

/**
 * Server component wrapper for the practice session page.
 * Loads the instrument, child profile, and lesson content,
 * then hands off to the PracticeSession client component.
 */
export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ locale: string; instrumentId: string }>;
}) {
  const { locale, instrumentId } = await params;
  const supabase = await createClient();

  // Verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Load the child's profile for display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "child") {
    notFound();
  }

  // Load the instrument by ID
  const { data: instrument } = await supabase
    .from("instruments")
    .select("*")
    .eq("id", instrumentId)
    .single();

  if (!instrument) {
    notFound();
  }

  // Load lesson + motivator content set by the parent
  const { lesson, motivator } = await getPracticeContent(user.id, instrumentId);

  return (
    <PracticeSession
      instrument={instrument}
      locale={locale}
      childName={profile.display_name}
      lesson={lesson}
      motivator={motivator}
    />
  );
}
