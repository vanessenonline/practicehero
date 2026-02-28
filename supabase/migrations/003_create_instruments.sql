-- Create instruments table with detection profile for audio classification.
CREATE TABLE instruments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key          TEXT NOT NULL UNIQUE,
  icon              TEXT NOT NULL,
  detection_profile TEXT NOT NULL CHECK (detection_profile IN ('pitched', 'percussive')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Create child_instruments join table for which child plays which instruments.
CREATE TABLE child_instruments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  is_primary    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, instrument_id)
);

CREATE INDEX idx_child_instruments_child ON child_instruments(child_id);

-- Enable RLS
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_instruments ENABLE ROW LEVEL SECURITY;

-- Instruments are readable by all authenticated users
CREATE POLICY "Authenticated users can read instruments"
  ON instruments FOR SELECT
  TO authenticated
  USING (true);

-- Child instruments: viewable by family members
CREATE POLICY "Family members can view child instruments"
  ON child_instruments FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM profiles WHERE family_id IN (
        SELECT family_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Seed instruments
INSERT INTO instruments (name_key, icon, detection_profile) VALUES
  ('piano', '🎹', 'pitched'),
  ('drums', '🥁', 'percussive'),
  ('guitar', '🎸', 'pitched');
