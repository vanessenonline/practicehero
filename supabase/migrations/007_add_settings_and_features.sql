-- Migration 007: Add settings columns and feature flags
-- Adds profile settings for themes, notifications, practice configuration, and messaging permissions

-- Add new columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_send_messages BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS practice_days TEXT[] DEFAULT '{mon,tue,wed,thu,fri}',
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_streak_reminder BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_achievement BOOLEAN DEFAULT true;

-- Add constraint for theme values
ALTER TABLE profiles
  ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('light', 'dark', 'system'));

-- Add constraint for daily goal (reasonable bounds)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_daily_goal_check CHECK (daily_goal_minutes >= 5 AND daily_goal_minutes <= 120);

-- Add constraint for practice days (valid day abbreviations)
-- Note: We validate day values at the application level since CHECK on array elements is complex
