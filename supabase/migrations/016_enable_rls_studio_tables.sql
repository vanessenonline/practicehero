-- ============================================================
-- Migration 016: Enable RLS on studio messaging tables
-- ============================================================
-- Migration 014 forgot to enable Row Level Security on these two
-- tables. Although the application uses the admin/service-role
-- client for all queries (which bypasses RLS), enabling RLS is
-- defense-in-depth: it prevents direct access via the anon key.
-- No policies are needed because the service-role key is exempt.
-- ============================================================

ALTER TABLE studio_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_parent_links ENABLE ROW LEVEL SECURITY;
