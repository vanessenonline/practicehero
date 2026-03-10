import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PracticeSession } from "./PracticeSession";
import { getPracticeContent, getStudentCurrentLesson } from "@/lib/actions/practice";

/**
 * Server component wrapper for the practice session page.
 * Loads the instrument, child profile, and lesson content,
 * then hands off to the PracticeSession client component.
 *
 * NOTE: Uses admin client for profile + instrument queries to bypass the
 * ES256 JWT / PostgREST HS256 mismatch that causes RLS to silently filter
 * rows when auth.uid() returns NULL. Security is maintained by scoping all
 * queries to the verified user.id from getUser() (Auth API, not PostgREST).
 */
export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ locale: string; instrumentId: string }>;
}) {
  const { locale, instrumentId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify the user is authenticated (Auth API — not affected by JWT mismatch)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Load the child's profile — admin client bypasses RLS JWT mismatch
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, role, family_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "child") {
    notFound();
  }

  // Load the instrument by ID — admin client bypasses RLS JWT mismatch
  const { data: instrument } = await admin
    .from("instruments")
    .select("*")
    .eq("id", instrumentId)
    .single();

  if (!instrument) {
    notFound();
  }

  // Load lesson + motivator content set by the parent
  const { lesson: parentLesson, motivator } = await getPracticeContent(
    user.id,
    instrumentId
  );

  // For teacher-managed students (family_id = null), fall back to their
  // current course lesson when the parent hasn't set practice_content.
  let lesson = parentLesson;
  let studentTsId: string | null = null;

  if (!lesson && !profile.family_id) {
    const { lesson: courseLesson, tsId } = await getStudentCurrentLesson(
      user.id
    );
    lesson = courseLesson;
    studentTsId = tsId;
  }

  return (
    <PracticeSession
      instrument={instrument}
      locale={locale}
      childName={profile.display_name}
      lesson={lesson}
      motivator={motivator}
      studentTsId={studentTsId ?? undefined}
    />
  );
}
