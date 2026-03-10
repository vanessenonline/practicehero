-- ============================================================
-- Migration 014: Studio Messaging
-- ============================================================
-- Adds bidirectional messaging between teachers, their students,
-- and parents who have linked themselves to a studio via teacher code.
-- Security is enforced in the application layer (admin client + explicit
-- user.id filtering) matching the pattern used throughout this project.
-- ============================================================

-- Studio messages: teacher ↔ student and teacher ↔ parent
CREATE TABLE IF NOT EXISTS studio_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  sender_id    uuid        NOT NULL REFERENCES profiles(id),
  recipient_id uuid        NOT NULL REFERENCES profiles(id),
  content      text        NOT NULL,
  is_read      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_messages_studio    ON studio_messages(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_messages_recipient ON studio_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_studio_messages_sender    ON studio_messages(sender_id);

-- Parent-studio links: parent enters teacher code → linked to that studio
CREATE TABLE IF NOT EXISTS studio_parent_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id  uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  parent_id  uuid        NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_parent_links_studio ON studio_parent_links(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_parent_links_parent ON studio_parent_links(parent_id);
