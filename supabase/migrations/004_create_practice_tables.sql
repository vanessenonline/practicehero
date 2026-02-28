-- Session status enum
CREATE TYPE session_status AS ENUM ('active', 'completed', 'abandoned');

-- Practice sessions: the core tracking table.
CREATE TABLE practice_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instrument_id     UUID NOT NULL REFERENCES instruments(id),
  family_id         UUID NOT NULL REFERENCES families(id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  duration_seconds  INTEGER,
  status            session_status DEFAULT 'active',
  audio_verified    BOOLEAN DEFAULT false,
  audio_confidence  REAL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_child_date ON practice_sessions(child_id, started_at);
CREATE INDEX idx_sessions_family ON practice_sessions(family_id);

-- Practice content: what to practice this week, managed by parents.
CREATE TABLE practice_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instrument_id   UUID NOT NULL REFERENCES instruments(id),
  family_id       UUID NOT NULL REFERENCES families(id),
  content_type    TEXT NOT NULL CHECK (content_type IN ('lesson', 'motivator')),
  title           TEXT NOT NULL,
  description     TEXT,
  week_number     INTEGER,
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_child ON practice_content(child_id, is_active);

-- Motivators library: chords, fills, etc.
CREATE TABLE motivators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id     UUID NOT NULL REFERENCES instruments(id),
  title             TEXT NOT NULL,
  description       TEXT,
  difficulty_level  INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  media_url         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_motivators_instrument ON motivators(instrument_id, difficulty_level);

-- Enable RLS on all tables
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivators ENABLE ROW LEVEL SECURITY;

-- RLS: Children can view and create their own sessions
CREATE POLICY "Children can view own sessions"
  ON practice_sessions FOR SELECT
  USING (child_id = auth.uid());

CREATE POLICY "Children can create sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (child_id = auth.uid());

CREATE POLICY "Children can update own sessions"
  ON practice_sessions FOR UPDATE
  USING (child_id = auth.uid());

-- RLS: Parents can view all family sessions
CREATE POLICY "Parents can view family sessions"
  ON practice_sessions FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM profiles
      WHERE id = auth.uid() AND role = 'parent'
    )
  );

-- RLS: Practice content viewable by family
CREATE POLICY "Family can view practice content"
  ON practice_content FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS: Parents can manage practice content
CREATE POLICY "Parents can manage practice content"
  ON practice_content FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM profiles
      WHERE id = auth.uid() AND role = 'parent'
    )
  );

-- RLS: Motivators readable by all authenticated users
CREATE POLICY "Authenticated users can read motivators"
  ON motivators FOR SELECT
  TO authenticated
  USING (true);
