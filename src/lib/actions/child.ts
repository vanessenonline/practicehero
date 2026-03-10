"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentCurrentLesson } from "@/lib/actions/practice";
import type {
  Profile,
  Instrument,
  ChildInstrument,
  Streak,
} from "@/types/database";
import type { LessonContent } from "@/types/lesson";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChildDashboard {
  profile: Profile;
  instruments: (ChildInstrument & { instrument: Instrument })[];
  streak: Streak | null;
  /** Sum of all positive point entries minus spent entries. */
  totalPoints: number;
  /** Sum of all super credit entries. */
  superCredits: number;
  practicedToday: boolean;
  /** Minutes practiced per day this week (Mon=0 … Sun=6), 0 if none. */
  weeklyMinutes: number[];
  /** Number of unread messages for this child. */
  unreadMessages: number;
  /**
   * Current course lesson for teacher-managed students.
   * Null for family children or students without an assigned course.
   */
  currentLesson: LessonContent | null;
}

// ---------------------------------------------------------------------------
// Fetch dashboard data for the currently logged-in child
// ---------------------------------------------------------------------------

/**
 * Fetch all data the child home screen needs in a single round-trip set.
 * Returns an error string when the user is not authenticated as a child.
 *
 * Uses the admin client for all database queries to work around the ES256
 * JWT / PostgREST HS256 mismatch that causes RLS to silently filter all rows.
 * Security is enforced by scoping all queries to the verified user.id from
 * auth.getUser() (which calls the Auth API endpoint directly, not PostgREST).
 */
export async function getChildDashboard(): Promise<{
  dashboard: ChildDashboard | null;
  error?: string;
}> {
  // Auth API call — uses JWT verification endpoint, not PostgREST.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { dashboard: null, error: "Not authenticated" };
  }

  // All database queries use admin client with explicit child_id = user.id filtering.
  const admin = createAdminClient();

  // Load the child's profile
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { dashboard: null, error: "Profile not found" };
  }

  if (profile.role !== "child") {
    return { dashboard: null, error: "Not a child account" };
  }

  // Build the week date range for session queries
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sundayEnd = new Date(monday);
  sundayEnd.setDate(monday.getDate() + 6);
  sundayEnd.setHours(23, 59, 59, 999);

  // Run the remaining queries in parallel — all scoped to user.id
  const [
    childInstrumentsResult,
    allInstrumentsResult,
    streakResult,
    pointsResult,
    creditsResult,
    sessionsResult,
    messagesResult,
  ] = await Promise.all([
    // Instrument links for this child
    admin
      .from("child_instruments")
      .select("*")
      .eq("child_id", user.id)
      .order("is_primary", { ascending: false }),

    // All instruments reference table
    admin.from("instruments").select("*"),

    // Current streak row
    admin
      .from("streaks")
      .select("*")
      .eq("child_id", user.id)
      .single(),

    // All point entries (to sum balance)
    admin
      .from("points")
      .select("amount")
      .eq("child_id", user.id),

    // All super credit entries (to sum balance)
    admin
      .from("super_credits")
      .select("amount")
      .eq("child_id", user.id),

    // This week's completed practice sessions
    admin
      .from("practice_sessions")
      .select("started_at, duration_seconds")
      .eq("child_id", user.id)
      .eq("status", "completed")
      .gte("started_at", monday.toISOString())
      .lte("started_at", sundayEnd.toISOString()),

    // Unread messages for this child
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false),
  ]);

  // --- Instruments: manually join child_instruments with instruments ---
  const allInstruments = allInstrumentsResult.data ?? [];
  const instruments: (ChildInstrument & { instrument: Instrument })[] = (
    childInstrumentsResult.data ?? []
  ).map((ci) => ({
    ...ci,
    instrument: allInstruments.find((inst) => inst.id === ci.instrument_id)!,
  }));

  // --- Streak ---
  const streak = streakResult.data ?? null;

  // --- Points balance ---
  const totalPoints = (pointsResult.data ?? []).reduce(
    (sum, entry) => sum + entry.amount,
    0
  );

  // --- Super credits balance ---
  const superCredits = (creditsResult.data ?? []).reduce(
    (sum, entry) => sum + entry.amount,
    0
  );

  // --- Weekly minutes + practiced today ---
  const sessions = sessionsResult.data ?? [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const practicedToday = sessions.some(
    (s) => new Date(s.started_at) >= todayStart
  );

  const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
  sessions.forEach((s) => {
    const d = new Date(s.started_at);
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0 … Sun=6
    weeklyMinutes[dayIndex] += Math.round((s.duration_seconds ?? 0) / 60);
  });

  // --- Unread messages ---
  const unreadMessages = messagesResult.count ?? 0;

  // --- Current course lesson (teacher students only) ---
  // Only fetch for students (family_id = null) — family children don't have a course.
  const currentLesson =
    profile.family_id === null
      ? (await getStudentCurrentLesson(user.id)).lesson
      : null;

  return {
    dashboard: {
      profile,
      instruments,
      streak,
      totalPoints,
      superCredits,
      practicedToday,
      weeklyMinutes,
      unreadMessages,
      currentLesson,
    },
  };
}
