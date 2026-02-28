"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Theme, DayOfWeek } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdateSettingsData {
  display_name?: string;
  locale?: "nl" | "en";
  theme?: Theme;
  daily_goal_minutes?: number;
  practice_days?: DayOfWeek[];
  notifications_enabled?: boolean;
  notification_streak_reminder?: boolean;
  notification_achievement?: boolean;
}

export interface UpdateChildSettingsData {
  can_send_messages?: boolean;
  daily_goal_minutes?: number;
  practice_days?: DayOfWeek[];
}

export interface SettingsResult {
  success?: boolean;
  error?: string;
}

const VALID_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ---------------------------------------------------------------------------
// Get current user settings
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's profile settings.
 */
export async function getSettings(): Promise<{
  profile: Profile | null;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { profile: null, error: "Niet ingelogd." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { profile: null, error: "Profiel niet gevonden." };

  return { profile };
}

// ---------------------------------------------------------------------------
// Update own settings
// ---------------------------------------------------------------------------

/**
 * Update settings for the currently logged-in user.
 * Both parents and children can update their own settings.
 */
export async function updateSettings(
  data: UpdateSettingsData
): Promise<SettingsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  // Validate fields
  if (data.display_name !== undefined && data.display_name.trim().length === 0) {
    return { error: "Naam mag niet leeg zijn." };
  }

  if (data.daily_goal_minutes !== undefined) {
    if (data.daily_goal_minutes < 5 || data.daily_goal_minutes > 120) {
      return { error: "Dagelijks doel moet tussen 5 en 120 minuten zijn." };
    }
  }

  if (data.practice_days !== undefined) {
    const invalid = data.practice_days.some((d) => !VALID_DAYS.includes(d));
    if (invalid) return { error: "Ongeldige oefendagen." };
    if (data.practice_days.length === 0) {
      return { error: "Selecteer minimaal één oefendag." };
    }
  }

  if (data.theme !== undefined && !["light", "dark", "system"].includes(data.theme)) {
    return { error: "Ongeldig thema." };
  }

  if (data.locale !== undefined && !["nl", "en"].includes(data.locale)) {
    return { error: "Ongeldige taal." };
  }

  // Build update object with only provided fields
  const updateObj: Record<string, unknown> = {};
  if (data.display_name !== undefined) updateObj.display_name = data.display_name.trim();
  if (data.locale !== undefined) updateObj.locale = data.locale;
  if (data.theme !== undefined) updateObj.theme = data.theme;
  if (data.daily_goal_minutes !== undefined) updateObj.daily_goal_minutes = data.daily_goal_minutes;
  if (data.practice_days !== undefined) updateObj.practice_days = data.practice_days;
  if (data.notifications_enabled !== undefined) updateObj.notifications_enabled = data.notifications_enabled;
  if (data.notification_streak_reminder !== undefined) updateObj.notification_streak_reminder = data.notification_streak_reminder;
  if (data.notification_achievement !== undefined) updateObj.notification_achievement = data.notification_achievement;

  const { error } = await supabase
    .from("profiles")
    .update(updateObj)
    .eq("id", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

// ---------------------------------------------------------------------------
// Update child-specific settings (parent only)
// ---------------------------------------------------------------------------

/**
 * Parent updates a child's settings (messaging permissions, practice config).
 * Verifies the parent and child are in the same family.
 */
export async function updateChildSettings(
  childId: string,
  data: UpdateChildSettingsData
): Promise<SettingsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  // Verify caller is a parent
  const { data: parentProfile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("id", user.id)
    .single();

  if (!parentProfile || parentProfile.role !== "parent") {
    return { error: "Alleen ouders kunnen kind-instellingen wijzigen." };
  }

  // Verify child is in the same family
  const { data: childProfile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("id", childId)
    .single();

  if (!childProfile || childProfile.family_id !== parentProfile.family_id) {
    return { error: "Kind niet gevonden." };
  }

  if (childProfile.role !== "child") {
    return { error: "Profiel is geen kind." };
  }

  // Validate fields
  if (data.daily_goal_minutes !== undefined) {
    if (data.daily_goal_minutes < 5 || data.daily_goal_minutes > 120) {
      return { error: "Dagelijks doel moet tussen 5 en 120 minuten zijn." };
    }
  }

  if (data.practice_days !== undefined) {
    const invalid = data.practice_days.some((d) => !VALID_DAYS.includes(d));
    if (invalid) return { error: "Ongeldige oefendagen." };
    if (data.practice_days.length === 0) {
      return { error: "Selecteer minimaal één oefendag." };
    }
  }

  // Build update object
  const updateObj: Record<string, unknown> = {};
  if (data.can_send_messages !== undefined) updateObj.can_send_messages = data.can_send_messages;
  if (data.daily_goal_minutes !== undefined) updateObj.daily_goal_minutes = data.daily_goal_minutes;
  if (data.practice_days !== undefined) updateObj.practice_days = data.practice_days;

  const { error } = await supabase
    .from("profiles")
    .update(updateObj)
    .eq("id", childId);

  if (error) return { error: error.message };

  return { success: true };
}
