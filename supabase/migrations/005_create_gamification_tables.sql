-- Streak status enum
CREATE TYPE streak_status AS ENUM ('active', 'recovery', 'broken');

-- Point source enum
CREATE TYPE point_source AS ENUM ('bonus_time', 'streak_milestone', 'achievement', 'spent');

-- Streaks: materialized streak state per child.
CREATE TABLE streaks (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id                 UUID NOT NULL REFERENCES families(id),
  current_count             INTEGER DEFAULT 0,
  longest_count             INTEGER DEFAULT 0,
  status                    streak_status DEFAULT 'active',
  last_practice_date        DATE,
  frozen_count              INTEGER DEFAULT 0,
  recovery_sessions_needed  INTEGER DEFAULT 0,
  missed_days               INTEGER DEFAULT 0,
  grace_dates               DATE[] DEFAULT '{}',
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id)
);

CREATE INDEX idx_streaks_child ON streaks(child_id);

-- Points: ledger-style for full auditability.
CREATE TABLE points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id     UUID NOT NULL REFERENCES families(id),
  amount        INTEGER NOT NULL,
  source        point_source NOT NULL,
  reference_id  UUID,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_points_child ON points(child_id);

-- Super credits
CREATE TABLE super_credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id     UUID NOT NULL REFERENCES families(id),
  amount        INTEGER NOT NULL,
  source        TEXT NOT NULL,
  reference_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_credits_child ON super_credits(child_id);

-- Shop items catalog
CREATE TABLE shop_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key        TEXT NOT NULL,
  description_key TEXT NOT NULL,
  cost_credits    INTEGER NOT NULL,
  item_type       TEXT NOT NULL,
  icon            TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Purchases
CREATE TABLE purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shop_item_id  UUID NOT NULL REFERENCES shop_items(id),
  family_id     UUID NOT NULL REFERENCES families(id),
  used          BOOLEAN DEFAULT false,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Achievements
CREATE TABLE achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key        TEXT NOT NULL UNIQUE,
  description_key TEXT NOT NULL,
  icon            TEXT NOT NULL,
  category        TEXT NOT NULL,
  threshold       INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Child achievements (unlocked badges)
CREATE TABLE child_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id  UUID NOT NULL REFERENCES achievements(id),
  unlocked_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, achievement_id)
);

-- Messages (parent to child, with realtime support)
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID NOT NULL REFERENCES families(id),
  sender_id     UUID NOT NULL REFERENCES profiles(id),
  recipient_id  UUID NOT NULL REFERENCES profiles(id),
  content       TEXT NOT NULL,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_recipient ON messages(recipient_id, is_read);

-- Enable RLS on all gamification tables
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Streaks: children see own, parents see family
CREATE POLICY "Children can view own streak"
  ON streaks FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "Parents can view family streaks"
  ON streaks FOR SELECT
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'));

-- Points: children see own, parents see family
CREATE POLICY "Children can view own points"
  ON points FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "Parents can view family points"
  ON points FOR SELECT
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'));

-- Super credits: children see own, parents see family
CREATE POLICY "Children can view own credits"
  ON super_credits FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "Parents can view family credits"
  ON super_credits FOR SELECT
  USING (family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'));

-- Shop items: readable by all authenticated
CREATE POLICY "Authenticated users can read shop items"
  ON shop_items FOR SELECT TO authenticated USING (true);

-- Purchases: children see own
CREATE POLICY "Children can view own purchases"
  ON purchases FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "Children can create purchases"
  ON purchases FOR INSERT WITH CHECK (child_id = auth.uid());

-- Achievements: readable by all authenticated
CREATE POLICY "Authenticated users can read achievements"
  ON achievements FOR SELECT TO authenticated USING (true);

-- Child achievements: children see own
CREATE POLICY "Children can view own achievements"
  ON child_achievements FOR SELECT USING (child_id = auth.uid());

CREATE POLICY "Parents can view family achievements"
  ON child_achievements FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM profiles WHERE family_id IN (
        SELECT family_id FROM profiles WHERE id = auth.uid() AND role = 'parent'
      )
    )
  );

-- Messages: sender and recipient can see
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can mark as read"
  ON messages FOR UPDATE
  USING (recipient_id = auth.uid());

-- Seed shop items
INSERT INTO shop_items (name_key, description_key, cost_credits, item_type, icon) VALUES
  ('shop.items.streakRestorer', 'shop.items.streakRestorerDesc', 3, 'streak_restorer', '🛡️'),
  ('shop.items.pauseDay', 'shop.items.pauseDayDesc', 2, 'pause_day', '📅');

-- Seed achievements
INSERT INTO achievements (name_key, description_key, icon, category, threshold) VALUES
  ('First Practice', 'Complete your first practice session', '🎵', 'special', 1),
  ('3 Day Streak', 'Practice 3 days in a row', '🔥', 'streak', 3),
  ('7 Day Streak', 'Practice 7 days in a row', '🔥', 'streak', 7),
  ('30 Day Streak', 'Practice 30 days in a row', '🔥', 'streak', 30),
  ('100 Day Streak', 'Practice 100 days in a row', '🏆', 'streak', 100),
  ('1 Hour Total', 'Practice for a total of 1 hour', '⏰', 'time', 60),
  ('10 Hours Total', 'Practice for a total of 10 hours', '⏰', 'time', 600),
  ('50 Hours Total', 'Practice for a total of 50 hours', '⏰', 'time', 3000),
  ('Weekend Warrior', 'Practice on a weekend', '⭐', 'special', NULL),
  ('Multi-Instrument', 'Practice two different instruments', '🎼', 'instrument', 2),
  ('Point Collector', 'Earn 50 bonus points', '⚡', 'points', 50),
  ('Super Saver', 'Save 10 Super Credits', '💎', 'points', 10);
