-- Migration 015: Make family_id nullable on purchases
--
-- Migration 009 dropped NOT NULL on profiles, practice_sessions, streaks,
-- points, and super_credits for teacher-managed students (family_id = null).
-- The purchases table was missed — teacher-students cannot buy shop items
-- until family_id is also nullable.
--
-- Note: child_achievements does NOT have a family_id column, so no change needed there.

ALTER TABLE purchases ALTER COLUMN family_id DROP NOT NULL;
