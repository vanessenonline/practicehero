-- Migration 006: Add missing write (INSERT/UPDATE) RLS policies
-- These policies were missing from the initial migrations, causing:
--   - Streaks not being saved after practice sessions
--   - Points and credits not being awarded
--   - Shop purchases silently failing

-- ============================================================
-- STREAKS: children need INSERT (first session) and UPDATE
-- ============================================================
CREATE POLICY "Children can insert own streak"
  ON streaks FOR INSERT
  WITH CHECK (child_id = auth.uid());

CREATE POLICY "Children can update own streak"
  ON streaks FOR UPDATE
  USING (child_id = auth.uid());

-- ============================================================
-- POINTS: children need INSERT (server action awards points)
-- ============================================================
CREATE POLICY "Children can insert own points"
  ON points FOR INSERT
  WITH CHECK (child_id = auth.uid());

-- ============================================================
-- SUPER CREDITS: children need INSERT (auto-converted from points)
-- ============================================================
CREATE POLICY "Children can insert own super_credits"
  ON super_credits FOR INSERT
  WITH CHECK (child_id = auth.uid());

-- ============================================================
-- CHILD ACHIEVEMENTS: children need INSERT to unlock badges
-- ============================================================
CREATE POLICY "Children can insert own achievements"
  ON child_achievements FOR INSERT
  WITH CHECK (child_id = auth.uid());

-- ============================================================
-- MESSAGES: children can mark received messages as read
-- Already in 005 as "Recipients can mark as read" but adding
-- WITH CHECK for completeness
-- ============================================================
-- (Already exists in 005, no action needed)
