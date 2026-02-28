"use server";

import { createClient } from "@/lib/supabase/server";
import type { PracticeContent } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentForInstrument {
  instrumentId: string;
  lesson: PracticeContent | null;
  motivator: PracticeContent | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the Monday of the week containing the given date (ISO weeks start on Monday).
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday of the week containing the given date.
 */
function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/**
 * Format a Date as an ISO date string (YYYY-MM-DD) for database storage.
 */
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Basic validation for YouTube URLs.
 * Accepts youtube.com/watch, youtu.be/, youtube.com/embed/ patterns.
 */
function isValidYouTubeUrl(url: string): boolean {
  if (!url.trim()) return true; // Empty is allowed
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    );
  } catch {
    return false;
  }
}

/**
 * Basic validation for Spotify URLs.
 * Accepts open.spotify.com/track/, /album/, /playlist/ patterns.
 */
function isValidSpotifyUrl(url: string): boolean {
  if (!url.trim()) return true; // Empty is allowed
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("spotify.com");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Verify parent access to a child (shared auth logic)
// ---------------------------------------------------------------------------

async function verifyParentAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string
): Promise<{ familyId: string; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { familyId: "", error: "Niet ingelogd." };

  const { data: parentProfile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("id", user.id)
    .single();

  if (!parentProfile || parentProfile.role !== "parent") {
    return { familyId: "", error: "Alleen ouders kunnen lesinhoud beheren." };
  }

  const { data: childProfile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", childId)
    .single();

  if (!childProfile || childProfile.family_id !== parentProfile.family_id) {
    return { familyId: "", error: "Kind niet gevonden in jouw gezin." };
  }

  return { familyId: childProfile.family_id };
}

// ---------------------------------------------------------------------------
// Fetch current (active) content for all instruments of a child
// ---------------------------------------------------------------------------

/**
 * Fetch the active practice content (lesson + motivator) for each
 * instrument a child plays. Uses date-based filtering when available,
 * falls back to is_active flag for legacy rows.
 * Called from the parent content management page.
 */
export async function getContentForChild(childId: string): Promise<{
  content: ContentForInstrument[];
  error?: string;
}> {
  const supabase = await createClient();
  const { familyId, error } = await verifyParentAccess(supabase, childId);

  if (error) return { content: [], error };

  // Get the child's instruments
  const { data: childInstruments } = await supabase
    .from("child_instruments")
    .select("instrument_id")
    .eq("child_id", childId);

  if (!childInstruments || childInstruments.length === 0) {
    return { content: [] };
  }

  const today = toDateString(new Date());

  // Get all active content for this child — date-aware query
  // Fetch content that is either:
  // 1. Within the current date range (start_date <= today <= end_date), OR
  // 2. Has is_active=true but no dates set (legacy rows)
  const { data: allContent } = await supabase
    .from("practice_content")
    .select("*")
    .eq("child_id", childId)
    .eq("is_active", true)
    .or(`and(start_date.lte.${today},end_date.gte.${today}),start_date.is.null`);

  // Group by instrument
  const content: ContentForInstrument[] = childInstruments.map(
    ({ instrument_id }) => {
      const forThisInstrument = (allContent ?? []).filter(
        (c) => c.instrument_id === instrument_id
      );
      return {
        instrumentId: instrument_id,
        lesson:
          forThisInstrument.find((c) => c.content_type === "lesson") ?? null,
        motivator:
          forThisInstrument.find((c) => c.content_type === "motivator") ?? null,
      };
    }
  );

  return { content };
}

// ---------------------------------------------------------------------------
// Fetch content history for a child + instrument
// ---------------------------------------------------------------------------

/**
 * Fetch past content for a specific child and instrument.
 * Returns rows where end_date < today or is_active = false, ordered most recent first.
 * Used by parents to browse old lessons and optionally reuse them as challenges.
 */
export async function getContentHistory(
  childId: string,
  instrumentId: string
): Promise<{ history: PracticeContent[]; error?: string }> {
  const supabase = await createClient();
  const { error } = await verifyParentAccess(supabase, childId);

  if (error) return { history: [], error };

  const today = toDateString(new Date());

  // Fetch past content: ended before today OR explicitly deactivated
  const { data } = await supabase
    .from("practice_content")
    .select("*")
    .eq("child_id", childId)
    .eq("instrument_id", instrumentId)
    .or(`end_date.lt.${today},is_active.eq.false`)
    .order("created_at", { ascending: false })
    .limit(20);

  return { history: data ?? [] };
}

// ---------------------------------------------------------------------------
// Save (upsert) lesson and motivator for a child + instrument
// ---------------------------------------------------------------------------

interface SaveContentInput {
  childId: string;
  instrumentId: string;
  lessonTitle: string;
  lessonDescription: string;
  motivatorTitle: string;
  motivatorDescription: string;
  videoUrl?: string;
  audioUrl?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Upsert the lesson and motivator content for a specific child and instrument.
 * Deactivates existing content for the same date range first, then creates
 * or updates the active content row. Supports media URLs and date scheduling.
 */
export async function saveContent(
  input: SaveContentInput
): Promise<{ success?: boolean; error?: string }> {
  const {
    childId,
    instrumentId,
    lessonTitle,
    lessonDescription,
    motivatorTitle,
    motivatorDescription,
    videoUrl,
    audioUrl,
    startDate,
    endDate,
  } = input;

  // Validate media URLs
  if (videoUrl && !isValidYouTubeUrl(videoUrl)) {
    return { error: "Ongeldige YouTube URL." };
  }
  if (audioUrl && !isValidSpotifyUrl(audioUrl)) {
    return { error: "Ongeldige Spotify URL." };
  }

  const supabase = await createClient();
  const { familyId, error } = await verifyParentAccess(supabase, childId);

  if (error) return { error };

  // Calculate week dates: use provided dates or default to current week
  const now = new Date();
  const effectiveStartDate = startDate || toDateString(getMonday(now));
  const effectiveEndDate = endDate || toDateString(getSunday(now));

  // Calculate ISO week number for reference
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7
  );

  // Helper: upsert a single content row
  async function upsertContent(
    contentType: "lesson" | "motivator",
    title: string,
    description: string,
    mediaVideoUrl?: string,
    mediaAudioUrl?: string
  ) {
    // Deactivate existing active content of this type for this child+instrument
    // that overlaps with the target date range
    await supabase
      .from("practice_content")
      .update({ is_active: false })
      .eq("child_id", childId)
      .eq("instrument_id", instrumentId)
      .eq("content_type", contentType)
      .eq("is_active", true);

    if (!title.trim()) return; // Don't create empty content

    // Check if there's already a row to update (most recent for this combo)
    const { data: existing } = await supabase
      .from("practice_content")
      .select("id")
      .eq("child_id", childId)
      .eq("instrument_id", instrumentId)
      .eq("content_type", contentType)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const contentData = {
      title: title.trim(),
      description: description.trim() || null,
      is_active: true,
      week_number: weekNumber,
      start_date: effectiveStartDate,
      end_date: effectiveEndDate,
      video_url: mediaVideoUrl?.trim() || null,
      audio_url: mediaAudioUrl?.trim() || null,
      updated_at: now.toISOString(),
    };

    if (existing) {
      await supabase
        .from("practice_content")
        .update(contentData)
        .eq("id", existing.id);
    } else {
      await supabase.from("practice_content").insert({
        child_id: childId,
        instrument_id: instrumentId,
        family_id: familyId,
        content_type: contentType,
        sort_order: contentType === "lesson" ? 1 : 2,
        ...contentData,
      });
    }
  }

  // Save lesson (with video) and motivator (with audio)
  await Promise.all([
    upsertContent("lesson", lessonTitle, lessonDescription, videoUrl, undefined),
    upsertContent("motivator", motivatorTitle, motivatorDescription, undefined, audioUrl),
  ]);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reuse a historical content item as a new challenge (motivator)
// ---------------------------------------------------------------------------

/**
 * Create a new motivator based on a historical content item.
 * Sets is_repeat=true and source_content_id to trace the origin.
 * Optionally awards bonus points when the child completes the challenge.
 */
export async function reuseAsChallenge(
  sourceContentId: string,
  childId: string,
  instrumentId: string,
  bonusPoints: number = 5
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { familyId, error } = await verifyParentAccess(supabase, childId);

  if (error) return { error };

  // Fetch the source content
  const { data: source } = await supabase
    .from("practice_content")
    .select("*")
    .eq("id", sourceContentId)
    .single();

  if (!source) {
    return { error: "Broninhoud niet gevonden." };
  }

  const now = new Date();
  const effectiveStartDate = toDateString(getMonday(now));
  const effectiveEndDate = toDateString(getSunday(now));

  // Deactivate existing active motivator for this child+instrument
  await supabase
    .from("practice_content")
    .update({ is_active: false })
    .eq("child_id", childId)
    .eq("instrument_id", instrumentId)
    .eq("content_type", "motivator")
    .eq("is_active", true);

  // Create a new motivator based on the historical content
  await supabase.from("practice_content").insert({
    child_id: childId,
    instrument_id: instrumentId,
    family_id: familyId,
    content_type: "motivator" as const,
    title: source.title,
    description: source.description,
    video_url: source.video_url,
    audio_url: source.audio_url,
    is_active: true,
    is_repeat: true,
    source_content_id: sourceContentId,
    bonus_points: bonusPoints,
    start_date: effectiveStartDate,
    end_date: effectiveEndDate,
    sort_order: 2,
    week_number: null,
  });

  return { success: true };
}
