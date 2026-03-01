"use server";

import { createClient } from "@/lib/supabase/server";
import type { PracticeContent } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartSessionResult {
  sessionId?: string;
  error?: string;
}

export interface CompleteSessionResult {
  bonusPoints: number;
  newStreakCount: number;
  streakMilestone: boolean; // true when streak hits a 10-day multiple
  totalPoints: number;
  superCreditsEarned: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Start a practice session
// ---------------------------------------------------------------------------

/**
 * Create a new active practice_sessions row when the child presses Start.
 * Returns the session ID to track on the client side.
 */
export async function startPracticeSession(
  instrumentId: string
): Promise<StartSessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "child") {
    return { error: "Alleen kinderen kunnen oefensessies starten." };
  }

  // Check if this child is a teacher student (has studio_id)
  let studioId: string | null = null;
  const { data: teacherStudent } = await supabase
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", user.id)
    .single();

  if (teacherStudent) {
    studioId = teacherStudent.studio_id;
  }

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .insert({
      child_id: user.id,
      instrument_id: instrumentId,
      family_id: profile.family_id,
      studio_id: studioId,
      started_at: new Date().toISOString(),
      status: "active",
      audio_verified: false,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { sessionId: session.id };
}

// ---------------------------------------------------------------------------
// Complete a practice session
// ---------------------------------------------------------------------------

/**
 * Mark a practice session as completed, award bonus points,
 * and update the child's streak.
 *
 * Business rules:
 * - Goal: 15 minutes total across all attempts today (cumulativePriorSeconds + durationSeconds)
 * - Bonus points: 1 per 5 minutes above the 15-minute daily goal (rounded down)
 *   Calculated only for the portion of THIS session that exceeds the goal,
 *   avoiding double-counting when retrying after an early stop.
 * - Streak: only advanced when the cumulative daily total reaches ≥ 15 min
 *   • Same day as last_practice_date → no change
 *   • Yesterday (calendar day) → +1
 *   • Older → reset to 1 (full streak logic added in a later phase)
 * - Every 10 total points → 1 super credit (auto-converted)
 * - Streak milestone: every 10 consecutive days → 1 super credit bonus
 *
 * @param cumulativePriorSeconds - Total seconds practiced in earlier attempts today
 *   before this session. Pass 0 for the first attempt of the day.
 *   Used to correctly split the 15-min goal across multiple retries so
 *   bonus points are never double-counted.
 */
export async function completePracticeSession(
  sessionId: string,
  durationSeconds: number,
  cumulativePriorSeconds: number,
  audioVerified: boolean,
  audioConfidence: number | null
): Promise<CompleteSessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { bonusPoints: 0, newStreakCount: 0, streakMilestone: false, totalPoints: 0, superCreditsEarned: 0, error: "Niet ingelogd." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { bonusPoints: 0, newStreakCount: 0, streakMilestone: false, totalPoints: 0, superCreditsEarned: 0, error: "Profiel niet gevonden." };
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // 1. Update the practice session row
  const { error: updateError } = await supabase
    .from("practice_sessions")
    .update({
      ended_at: now.toISOString(),
      duration_seconds: durationSeconds,
      status: "completed",
      audio_verified: audioVerified,
      audio_confidence: audioConfidence,
    })
    .eq("id", sessionId)
    .eq("child_id", user.id); // ensure ownership

  if (updateError) {
    return { bonusPoints: 0, newStreakCount: 0, streakMilestone: false, totalPoints: 0, superCreditsEarned: 0, error: updateError.message };
  }

  // 2. Calculate bonus points for THIS session only.
  //    We track cumulative time to avoid double-counting bonus across retries.
  //    bonus_start = the point in time from which this session's bonus begins.
  //    - If prior time already exceeded the goal, every second of this session is bonus.
  //    - If prior time was below the goal, bonus only starts once we cross the goal.
  const GOAL_SECONDS = 15 * 60;
  const totalPracticedSeconds = cumulativePriorSeconds + durationSeconds;
  const bonusStartForThisSession = Math.max(cumulativePriorSeconds, GOAL_SECONDS);
  const bonusSeconds = Math.max(0, totalPracticedSeconds - bonusStartForThisSession);
  const bonusPoints = Math.floor(bonusSeconds / 300); // 300s = 5 min

  // 3. Award bonus points if any
  if (bonusPoints > 0) {
    await supabase.from("points").insert({
      child_id: user.id,
      family_id: profile.family_id,
      amount: bonusPoints,
      source: "bonus_time",
      reference_id: sessionId,
      description: `Bonus: ${Math.floor(bonusSeconds / 60)} extra minuten`,
    });
  }

  // 4. Get current total points (after the insert above)
  const { data: pointEntries } = await supabase
    .from("points")
    .select("amount")
    .eq("child_id", user.id);

  const totalPoints = (pointEntries ?? []).reduce(
    (sum, e) => sum + e.amount,
    0
  );

  // 5. Auto-convert every 10 points to 1 super credit
  //    Check how many credits should exist vs how many do exist
  const expectedCredits = Math.floor(totalPoints / 10);
  const { data: existingCredits } = await supabase
    .from("super_credits")
    .select("amount")
    .eq("child_id", user.id)
    .eq("source", "points_conversion");

  const currentConvertedCredits = (existingCredits ?? []).reduce(
    (sum, c) => sum + c.amount,
    0
  );

  let superCreditsEarned = 0;
  if (expectedCredits > currentConvertedCredits) {
    superCreditsEarned = expectedCredits - currentConvertedCredits;
    await supabase.from("super_credits").insert({
      child_id: user.id,
      family_id: profile.family_id,
      amount: superCreditsEarned,
      source: "points_conversion",
      reference_id: sessionId,
    });
  }

  // 6. Update streak – ONLY if the cumulative daily total reached 15 minutes.
  //    This supports retrying after an early stop: if the child practiced 8 min,
  //    stopped, and then practiced 7+ more minutes (same day), the streak qualifies.
  //    Stopping early still saves the session record but does NOT advance the streak.
  const goalMet = totalPracticedSeconds >= GOAL_SECONDS;

  const { data: existingStreak } = await supabase
    .from("streaks")
    .select("*")
    .eq("child_id", user.id)
    .single();

  // Default: keep current streak unchanged
  let newStreakCount = existingStreak?.current_count ?? 0;
  let streakMilestone = false;

  if (goalMet) {
    if (!existingStreak) {
      // First qualifying session – create streak row
      await supabase.from("streaks").insert({
        child_id: user.id,
        family_id: profile.family_id,
        current_count: 1,
        longest_count: 1,
        status: "active",
        last_practice_date: todayStr,
        frozen_count: 0,
        recovery_sessions_needed: 0,
        missed_days: 0,
        grace_dates: [],
      });
      newStreakCount = 1;
    } else {
      const last = existingStreak.last_practice_date;

      if (last === todayStr) {
        // Already earned streak credit today – keep as-is
        newStreakCount = existingStreak.current_count;
      } else {
        // Check if yesterday (calendar day comparison)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        if (last === yesterdayStr) {
          newStreakCount = existingStreak.current_count + 1;
        } else {
          // Missed at least one day → reset to 1
          newStreakCount = 1;
        }

        const newLongest = Math.max(existingStreak.longest_count, newStreakCount);
        // Milestone: every 10 consecutive days earns 1 bonus super credit
        const prevMilestone = Math.floor(existingStreak.current_count / 10);
        const newMilestone = Math.floor(newStreakCount / 10);
        streakMilestone = newMilestone > prevMilestone && newMilestone > 0;

        await supabase
          .from("streaks")
          .update({
            current_count: newStreakCount,
            longest_count: newLongest,
            last_practice_date: todayStr,
            status: "active",
            missed_days: 0,
            recovery_sessions_needed: 0,
          })
          .eq("child_id", user.id);

        // Award streak milestone super credit
        if (streakMilestone) {
          await supabase.from("super_credits").insert({
            child_id: user.id,
            family_id: profile.family_id,
            amount: 1,
            source: "streak_milestone",
            reference_id: sessionId,
          });
        }
      }
    }
  }

  return {
    bonusPoints,
    newStreakCount,
    streakMilestone,
    totalPoints,
    superCreditsEarned,
  };
}

// ---------------------------------------------------------------------------
// Get practice content for a child + instrument
// ---------------------------------------------------------------------------

/**
 * Fetch the active lesson and motivator content set by the parent
 * for a specific child and instrument. Uses date-based filtering when
 * available, falls back to is_active flag for legacy rows without dates.
 */
export async function getPracticeContent(
  childId: string,
  instrumentId: string
): Promise<{
  lesson: PracticeContent | null;
  motivator: PracticeContent | null;
}> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch content that is either:
  // 1. Active and within the current date range (start_date <= today <= end_date), OR
  // 2. Active but no dates set (legacy rows)
  const { data } = await supabase
    .from("practice_content")
    .select("*")
    .eq("child_id", childId)
    .eq("instrument_id", instrumentId)
    .eq("is_active", true)
    .or(`and(start_date.lte.${today},end_date.gte.${today}),start_date.is.null`)
    .order("sort_order");

  const lesson =
    (data ?? []).find((c) => c.content_type === "lesson") ?? null;
  const motivator =
    (data ?? []).find((c) => c.content_type === "motivator") ?? null;

  return { lesson, motivator };
}

// ---------------------------------------------------------------------------
// Get today's cumulative practice time
// ---------------------------------------------------------------------------

/**
 * Get the total number of seconds the current child has practiced today.
 * Sums up duration_seconds from all completed practice_sessions for today.
 * Used to restore cumulative practice time when child re-enters practice mode.
 */
export async function getTodayPracticeSeconds(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: sessions, error } = await supabase
    .from("practice_sessions")
    .select("duration_seconds")
    .eq("child_id", user.id)
    .eq("status", "completed")
    .gte("started_at", startOfDay.toISOString())
    .lte("started_at", endOfDay.toISOString());

  if (error) {
    console.error("Error fetching today's practice sessions:", error);
    return 0;
  }

  // Sum all duration_seconds (null-safe)
  const totalSeconds = (sessions ?? []).reduce((sum, session) => {
    return sum + (session.duration_seconds ?? 0);
  }, 0);

  return totalSeconds;
}
