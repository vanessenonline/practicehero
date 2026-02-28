"use server";

import { createClient } from "@/lib/supabase/server";
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

export interface ChildOverview {
  profile: Profile;
  instruments: (ChildInstrument & { instrument: Instrument })[];
  streak: Streak | null;
  practicedToday: boolean;
  /** Minutes practiced per day this week (Mon-Sun), 0 if none. */
  weeklyMinutes: number[];
  totalPoints: number;
}

// ---------------------------------------------------------------------------
// Fetch children with full overview data (for dashboard)
// ---------------------------------------------------------------------------

/**
 * Fetch all children in the logged-in parent's family,
 * together with their instruments, streaks, and this week's practice data.
 */
export async function getFamilyOverview(): Promise<{
  familyName: string;
  children: ChildOverview[];
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { familyName: "", children: [], error: "Not authenticated" };
  }

  // Get the parent's profile to find the family_id
  const { data: parentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!parentProfile) {
    return { familyName: "", children: [], error: "Profile not found" };
  }

  const familyId = parentProfile.family_id;

  // Get family name
  const { data: family } = await supabase
    .from("families")
    .select("name")
    .eq("id", familyId)
    .single();

  // Get all child profiles in this family
  const { data: childProfiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("family_id", familyId)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  if (!childProfiles || childProfiles.length === 0) {
    return { familyName: family?.name ?? "", children: [] };
  }

  // Get all instruments (reference table)
  const { data: allInstruments } = await supabase
    .from("instruments")
    .select("*");

  // Get child_instruments for all children in one query
  const childIds = childProfiles.map((c) => c.id);
  const { data: childInstruments } = await supabase
    .from("child_instruments")
    .select("*")
    .in("child_id", childIds);

  // Get streaks for all children
  const { data: streaks } = await supabase
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

  // Get practice sessions for this week
  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("family_id", familyId)
    .gte("started_at", monday.toISOString())
    .lte("started_at", sundayEnd.toISOString())
    .eq("status", "completed");

  // Get total points for each child
  const { data: pointEntries } = await supabase
    .from("points")
    .select("child_id, amount")
    .in("child_id", childIds);

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
  const supabase = await createClient();
  const { data } = await supabase
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

  const { data: parentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!parentProfile) {
    return { children: [], error: "Profile not found" };
  }

  const familyId = parentProfile.family_id;

  const { data: childProfiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("family_id", familyId)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  if (!childProfiles || childProfiles.length === 0) {
    return { children: [] };
  }

  const childIds = childProfiles.map((c) => c.id);

  const { data: allInstruments } = await supabase
    .from("instruments")
    .select("*");

  const { data: childInstruments } = await supabase
    .from("child_instruments")
    .select("*")
    .in("child_id", childIds);

  const { data: streaks } = await supabase
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
