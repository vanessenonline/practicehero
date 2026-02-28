-- Create user role enum
CREATE TYPE user_role AS ENUM ('parent', 'child');

-- Create profiles table linking Supabase Auth users to families.
-- Each user belongs to exactly one family with a role.
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role          user_role NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  locale        TEXT DEFAULT 'nl' CHECK (locale IN ('nl', 'en')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_family ON profiles(family_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own family members
CREATE POLICY "Users can view own family profiles"
  ON profiles FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Profiles: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());
