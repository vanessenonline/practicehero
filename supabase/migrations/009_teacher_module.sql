-- Migration 009: Teacher (Docent) Module
-- Adds teacher role, studios, courses, and teacher-student relationships
-- Enables dual-role architecture where a child can be both a family child AND a teacher's student

-- ============================================================
-- 1. Extend user_role ENUM with 'teacher'
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher';

-- ============================================================
-- 2. Studios table (teacher's workspace, analogous to families)
-- ============================================================
CREATE TABLE studios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  teacher_code  TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_studios_owner ON studios(owner_id);
CREATE UNIQUE INDEX idx_studios_teacher_code ON studios(teacher_code);

-- ============================================================
-- 3. Courses table (teacher's curriculum)
-- ============================================================
CREATE TABLE courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  name          TEXT NOT NULL,
  description   TEXT,
  total_lessons INTEGER NOT NULL DEFAULT 10 CHECK (total_lessons >= 1 AND total_lessons <= 100),
  total_levels  INTEGER NOT NULL DEFAULT 10 CHECK (total_levels >= 1 AND total_levels <= 20),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_courses_studio ON courses(studio_id);

-- ============================================================
-- 4. Course lessons table (individual lesson definitions)
-- ============================================================
CREATE TABLE course_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL CHECK (lesson_number >= 1),
  level_number  INTEGER NOT NULL CHECK (level_number >= 1),
  title         TEXT NOT NULL,
  description   TEXT,
  video_url     TEXT,
  audio_url     TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, lesson_number, level_number)
);

CREATE INDEX idx_course_lessons_course ON course_lessons(course_id);

-- ============================================================
-- 5. Teacher-student relationship table
-- ============================================================
CREATE TABLE teacher_students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE SET NULL,
  student_code    TEXT NOT NULL,
  current_level   INTEGER DEFAULT 1 CHECK (current_level >= 1),
  current_lesson  INTEGER DEFAULT 1 CHECK (current_lesson >= 1),
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  target_end_date DATE,
  student_email   TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(studio_id, student_code),
  UNIQUE(studio_id, student_id)
);

CREATE INDEX idx_teacher_students_studio ON teacher_students(studio_id);
CREATE INDEX idx_teacher_students_student ON teacher_students(student_id);
CREATE INDEX idx_teacher_student_login ON teacher_students(student_code) WHERE is_active = true;

-- ============================================================
-- 6. Make profiles.family_id nullable (for teacher-only students)
-- ============================================================
ALTER TABLE profiles ALTER COLUMN family_id DROP NOT NULL;

-- ============================================================
-- 7. Add studio_id to practice_sessions for teacher context
-- ============================================================
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id) ON DELETE SET NULL;

-- Allow family_id to be null (for teacher-only students)
ALTER TABLE practice_sessions ALTER COLUMN family_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_studio ON practice_sessions(studio_id);

-- ============================================================
-- 8. Make family_id nullable in streaks, points, super_credits
-- ============================================================
ALTER TABLE streaks ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE points ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE super_credits ALTER COLUMN family_id DROP NOT NULL;

-- ============================================================
-- 9. Enable RLS on new tables
-- ============================================================
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_students ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS Policies for Studios
-- ============================================================
CREATE POLICY "Teachers can view own studio"
  ON studios
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Teachers can update own studio"
  ON studios
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Teachers can insert own studio"
  ON studios
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 11. RLS Policies for Courses
-- ============================================================
-- Teachers can manage their own studio's courses
CREATE POLICY "Teachers can manage own courses"
  ON courses
  FOR ALL
  USING (
    studio_id IN (
      SELECT id FROM studios WHERE owner_id = auth.uid()
    )
  );

-- Students can read courses they're enrolled in
CREATE POLICY "Students can view enrolled courses"
  ON courses
  FOR SELECT
  USING (
    id IN (
      SELECT course_id FROM teacher_students
      WHERE student_id = auth.uid() AND course_id IS NOT NULL AND is_active = true
    )
  );

-- ============================================================
-- 12. RLS Policies for Course Lessons
-- ============================================================
-- Teachers can manage lessons in their courses
CREATE POLICY "Teachers can manage own course lessons"
  ON course_lessons
  FOR ALL
  USING (
    course_id IN (
      SELECT id FROM courses WHERE studio_id IN (
        SELECT id FROM studios WHERE owner_id = auth.uid()
      )
    )
  );

-- Students can read lessons in their enrolled courses
CREATE POLICY "Students can view enrolled course lessons"
  ON course_lessons
  FOR SELECT
  USING (
    course_id IN (
      SELECT course_id FROM teacher_students
      WHERE student_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================
-- 13. RLS Policies for Teacher-Students
-- ============================================================
-- Teachers can manage their students
CREATE POLICY "Teachers can manage own students"
  ON teacher_students
  FOR ALL
  USING (
    studio_id IN (
      SELECT id FROM studios WHERE owner_id = auth.uid()
    )
  );

-- Students can view their own teacher link
CREATE POLICY "Students can view own teacher link"
  ON teacher_students
  FOR SELECT
  USING (student_id = auth.uid());

-- ============================================================
-- 14. Extend RLS for practice_sessions (teacher access)
-- ============================================================
CREATE POLICY "Teachers can view student sessions"
  ON practice_sessions
  FOR SELECT
  USING (
    child_id IN (
      SELECT student_id FROM teacher_students
      WHERE studio_id IN (
        SELECT id FROM studios WHERE owner_id = auth.uid()
      )
      AND is_active = true
    )
  );

-- ============================================================
-- 15. Extend RLS for streaks (teacher access)
-- ============================================================
CREATE POLICY "Teachers can view student streaks"
  ON streaks
  FOR SELECT
  USING (
    child_id IN (
      SELECT student_id FROM teacher_students
      WHERE studio_id IN (
        SELECT id FROM studios WHERE owner_id = auth.uid()
      )
      AND is_active = true
    )
  );

-- ============================================================
-- 16. Extend RLS for points (teacher access)
-- ============================================================
CREATE POLICY "Teachers can view student points"
  ON points
  FOR SELECT
  USING (
    child_id IN (
      SELECT student_id FROM teacher_students
      WHERE studio_id IN (
        SELECT id FROM studios WHERE owner_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 17. Extend RLS for super_credits (teacher access)
-- ============================================================
CREATE POLICY "Teachers can view student credits"
  ON super_credits
  FOR SELECT
  USING (
    child_id IN (
      SELECT student_id FROM teacher_students
      WHERE studio_id IN (
        SELECT id FROM studios WHERE owner_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 18. RPC function for student login lookup
-- ============================================================
CREATE OR REPLACE FUNCTION lookup_student_by_codes(
  p_teacher_code TEXT,
  p_student_code TEXT
)
RETURNS TABLE(student_id UUID, studio_id UUID)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ts.student_id, ts.studio_id
  FROM teacher_students ts
  JOIN studios s ON s.id = ts.studio_id
  WHERE s.teacher_code = p_teacher_code
    AND ts.student_code = p_student_code
    AND ts.is_active = true
  LIMIT 1;
$$;

-- ============================================================
-- 19. Function to generate unique teacher_code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_teacher_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'T-' || LPAD(floor(random() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM studios WHERE teacher_code = new_code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 20. Function to generate unique student_code per studio
-- ============================================================
CREATE OR REPLACE FUNCTION generate_student_code(p_studio_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'S-' || LPAD(floor(random() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(
      SELECT 1 FROM teacher_students
      WHERE studio_id = p_studio_id AND student_code = new_code
    ) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;
