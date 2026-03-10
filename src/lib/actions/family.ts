"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Profile,
  Instrument,
  ChildInstrument,
  Streak,
  PracticeSession,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types for aggregated data
// ---------------------------------------------------------------------------

/** Course progress info when a child is also a teacher-managed student. */
export interface CourseProgress {
  courseName: string;
  currentLevel: number;
  currentLesson: number;
  lessonTitle: string | null;
}

export interface ChildOverview {
  profile: Profile;
  instruments: (ChildInstrument & { instrument: Instrument })[];
  streak: Streak | null;
  practicedToday: boolean;
  /** Minutes practiced per day this week (Mon-Sun), 0 if none. */
  weeklyMinutes: number[];
  totalPoints: number;
  /** Non-null when the child is enrolled in a teacher-assigned course. */
  courseProgress: CourseProgress | null;
}

// ---------------------------------------------------------------------------
// Fetch children with full overview data (for dashboard)
// ---------------------------------------------------------------------------

/**
 * Fetch all children in the logged-in parent's family,
 * together with their instruments, streaks, and this week's practice data.
 *
 * Uses the admin client for all database queries to work around the ES256
 * JWT / PostgREST HS256 mismatch that causes RLS to silently filter all rows.
 * Security is enforced by filtering on family_id derived from the verified
 * user session (auth.getUser() calls the Auth API, not PostgREST).
 */
export async function getFamilyOverview(): Promise<{
  familyName: string;
  children: ChildOverview[];
  error?: string;
}> {
  // Auth API call — uses JWT verification endpoint, not PostgREST, so ES256 works.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { familyName: "", children: [], error: "Not authenticated" };
  }

  // All database queries use admin client (bypasses RLS) with explicit user filters.
  const admin = createAdminClient();

  // Get the parent's profile to find the family_id
  const { data: parentProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!parentProfile) {
    return { familyName: "", children: [], error: "Profile not found" };
  }

  const familyId = parentProfile.family_id;

  // Get family name
  const { data: family } = await admin
    .from("families")
    .select("name")
    .eq("id", familyId)
    .single();

  // Get all child profiles in this family
  const { data: childProfiles } = await admin
    .from("profiles")
    .select("*")
    .eq("family_id", familyId)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  if (!childProfiles || childProfiles.length === 0) {
    return { familyName: family?.name ?? "", children: [] };
  }

  // Get all instruments (reference table)
  const { data: allInstruments } = await admin
    .from("instruments")
    .select("*");

  // Get child_instruments for all children in one query
  const childIds = childProfiles.map((c) => c.id);
  const { data: childInstruments } = await admin
    .from("child_instruments")
    .select("*")
    .in("child_id", childIds);

  // Get streaks for all children
  const { data: streaks } = await admin
    .from("streaks")
    .select("*")
    .in("child_id", childIds);

  // Calculate this week's date range (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sundayEnd = new Date(monday);
  sundayEnd.setDate(monday.getDate() + 6);
  sundayEnd.setHours(23, 59, 59, 999);

  // Get practice sessions for this week (scoped to this family)
  const { data: sessions } = await admin
    .from("practice_sessions")
    .select("*")
    .eq("family_id", familyId)
    .gte("started_at", monday.toISOString())
    .lte("started_at", sundayEnd.toISOString())
    .eq("status", "completed");

  // Get total points for each child (scoped to family members)
  const { data: pointEntries } = await admin
    .from("points")
    .select("child_id, amount")
    .in("child_id", childIds);

  // Get teacher_students rows for children who are also teacher-managed students
  const { data: teacherStudentRows } = await admin
    .from("teacher_students")
    .select("student_id, course_id, current_level, current_lesson")
    .in("student_id", childIds)
    .eq("is_active", true);

  // Fetch course names + lesson titles for enrolled students
  const tsCourseIds = (teacherStudentRows ?? [])
    .map((ts) => ts.course_id)
    .filter((id): id is string => id !== null);

  const [tsCoursesResult, tsLessonsResult] = await Promise.all([
    tsCourseIds.length > 0
      ? admin.from("courses").select("id, name").in("id", tsCourseIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    tsCourseIds.length > 0
      ? admin
          .from("course_lessons")
          .select("course_id, level_number, lesson_number, title")
          .in("course_id", tsCourseIds)
      : Promise.resolve(
          { data: [] as { course_id: string; level_number: number; lesson_number: number; title: string }[] }
        ),
  ]);

  const tsCourseMap = new Map(
    (tsCoursesResult.data ?? []).map((c) => [c.id, c.name])
  );
  const tsLessonTitleMap = new Map(
    (tsLessonsResult.data ?? []).map((l) => [
      `${l.course_id}:${l.level_number}:${l.lesson_number}`,
      l.title,
    ])
  );

  // Build lookup: child_id → CourseProgress
  const courseProgressMap = new Map<string, CourseProgress>();
  for (const ts of teacherStudentRows ?? []) {
    if (ts.course_id && tsCourseMap.has(ts.course_id)) {
      courseProgressMap.set(ts.student_id, {
        courseName: tsCourseMap.get(ts.course_id)!,
        currentLevel: ts.current_level,
        currentLesson: ts.current_lesson,
        lessonTitle:
          tsLessonTitleMap.get(
            `${ts.course_id}:${ts.current_level}:${ts.current_lesson}`
          ) ?? null,
      });
    }
  }

  // Build the overview for each child
  const children: ChildOverview[] = childProfiles.map((profile) => {
    // Instruments with full instrument data
    const myInstrumentLinks = (childInstruments ?? []).filter(
      (ci) => ci.child_id === profile.id
    );
    const instrumentsWithData = myInstrumentLinks.map((ci) => ({
      ...ci,
      instrument: (allInstruments ?? []).find(
        (inst) => inst.id === ci.instrument_id
      )!,
    }));

    // Streak
    const streak =
      (streaks ?? []).find((s) => s.child_id === profile.id) ?? null;

    // Today's practice
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const practicedToday = (sessions ?? []).some(
      (s) =>
        s.child_id === profile.id &&
        new Date(s.started_at) >= todayStart
    );

    // Weekly minutes (Mon=0 ... Sun=6)
    const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
    (sessions ?? [])
      .filter((s) => s.child_id === profile.id)
      .forEach((s) => {
        const sessionDate = new Date(s.started_at);
        const dayIndex =
          sessionDate.getDay() === 0 ? 6 : sessionDate.getDay() - 1;
        weeklyMinutes[dayIndex] += Math.round(
          (s.duration_seconds ?? 0) / 60
        );
      });

    // Total points
    const totalPoints = (pointEntries ?? [])
      .filter((p) => p.child_id === profile.id)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      profile,
      instruments: instrumentsWithData,
      streak,
      practicedToday,
      weeklyMinutes,
      totalPoints,
      courseProgress: courseProgressMap.get(profile.id) ?? null,
    };
  });

  return {
    familyName: family?.name ?? "",
    children,
  };
}

// ---------------------------------------------------------------------------
// Get instruments (reference data)
// ---------------------------------------------------------------------------

/**
 * Fetch all available instruments from the database.
 */
export async function getInstruments(): Promise<Instrument[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("instruments")
    .select("*")
    .order("created_at");
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get children list (simple, for management page)
// ---------------------------------------------------------------------------

export interface ChildWithInstruments {
  profile: Profile;
  instruments: (ChildInstrument & { instrument: Instrument })[];
  streak: Streak | null;
}

/**
 * Fetch children with their linked instruments.
 *
 * Uses the admin client to work around the ES256 JWT / PostgREST RLS issue.
 * Security is enforced via family_id scoping from the verified parent session.
 */
export async function getChildren(): Promise<{
  children: ChildWithInstruments[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { children: [], error: "Not authenticated" };
  }

  const admin = createAdminClient();

  const { data: parentProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!parentProfile) {
    return { children: [], error: "Profile not found" };
  }

  const familyId = parentProfile.family_id;

  const { data: childProfiles } = await admin
    .from("profiles")
    .select("*")
    .eq("family_id", familyId)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  if (!childProfiles || childProfiles.length === 0) {
    return { children: [] };
  }

  const childIds = childProfiles.map((c) => c.id);

  const { data: allInstruments } = await admin
    .from("instruments")
    .select("*");

  const { data: childInstruments } = await admin
    .from("child_instruments")
    .select("*")
    .in("child_id", childIds);

  const { data: streaks } = await admin
    .from("streaks")
    .select("*")
    .in("child_id", childIds);

  const children: ChildWithInstruments[] = childProfiles.map((profile) => {
    const myLinks = (childInstruments ?? []).filter(
      (ci) => ci.child_id === profile.id
    );
    const instrumentsWithData = myLinks.map((ci) => ({
      ...ci,
      instrument: (allInstruments ?? []).find(
        (inst) => inst.id === ci.instrument_id
      )!,
    }));

    const streak =
      (streaks ?? []).find((s) => s.child_id === profile.id) ?? null;

    return { profile, instruments: instrumentsWithData, streak };
  });

  return { children };
}
