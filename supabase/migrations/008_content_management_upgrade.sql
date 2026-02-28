-- Migration 008: Content management upgrade
-- Adds week scheduling, media links, repeat tracking, and bonus points to practice_content

-- Add new columns to practice_content table
ALTER TABLE practice_content
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS is_repeat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_content_id UUID REFERENCES practice_content(id),
  ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0;

-- Migrate existing active content to have date ranges (current week)
-- Calculate Monday of current week as start, Sunday as end
UPDATE practice_content
SET
  start_date = date_trunc('week', CURRENT_DATE)::DATE,
  end_date = (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::DATE
WHERE is_active = true
  AND start_date IS NULL;

-- Add index for date-based content queries
CREATE INDEX IF NOT EXISTS idx_content_dates
  ON practice_content(child_id, instrument_id, start_date, end_date)
  WHERE is_active = true;

-- Add constraint for bonus_points (non-negative)
ALTER TABLE practice_content
  ADD CONSTRAINT practice_content_bonus_points_check CHECK (bonus_points >= 0);
