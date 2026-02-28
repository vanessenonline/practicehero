# PracticeHero Implementation Plan
## Features: Child Mode Switch + Teacher Module
**Status:** Plan approved, ready for implementation
**Last Updated:** 2026-02-28
**Session Agent ID:** a83acd24d7b2595f5 (Explore), af92e6a971357cd94 (Plan)

---

## QUICK SUMMARY

Two major features need implementation:

1. **Feature 1: Parent "Child Mode" Switch** (0.5 days)
   - Parent logs in → clicks "Kindmodus" button → signs out → child PIN login page appears
   - Child can log in with PIN, practice, then click "Terug naar ouder" to go back
   - No database changes, minimal code changes

2. **Feature 2: Teacher (Docent) Module** (5-7 days)
   - Teachers create accounts and get unique "docentcode" (e.g., T-1234)
   - Teachers configure courses with lessons (1-10) at levels (1-10)
   - Teachers create students with unique "leerlingcode" (e.g., S-5678)
   - Students log in with docentcode + leerlingcode + PIN combination
   - **Critical:** A child can be BOTH family child AND teacher student (dual role), with SHARED practice data
   - Teachers see same practice sessions, streaks, points as parents (per their student)
   - Future: Subscription model ($9.99/month + 1 student, +$9.99 per 5 students)

---

## FEATURE 1: Parent Child Mode Switch

### Architecture Decision
- **Approach:** Parent logs out → child logs in via existing child PIN page
- **Why not session switching?** Supabase Auth allows only one session per browser. Safer and simpler to use logout/login flow.
- **localStorage flag:** "practicehero_child_mode" tracks that we're in child mode, shows "Back to parent" button

### Implementation Files (5 files)

#### 1. `/src/components/layout/ParentNav.tsx`
Add "Kindmodus" button that signs out parent and redirects to child login with ?tab=child parameter:
```typescript
import { Baby } from "lucide-react";

async function handleChildMode() {
  try {
    localStorage.setItem("practicehero_child_mode", "true");
  } catch {}
  await supabase.auth.signOut();
  router.push(`/${locale}/login?tab=child`);
  router.refresh();
}

// Add button before LogOut button:
<Button variant="ghost" size="sm" onClick={handleChildMode}>
  <Baby className="h-4 w-4" />
  <span className="hidden sm:inline ml-1">{t("parent.childMode")}</span>
</Button>
```

#### 2. `/src/components/layout/ChildNav.tsx`
Add floating "Terug naar ouder" button if in child mode:
```typescript
"use client";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export function ChildNav() {
  const [isChildMode, setIsChildMode] = useState(false);

  useEffect(() => {
    try {
      setIsChildMode(localStorage.getItem("practicehero_child_mode") === "true");
    } catch {}
  }, []);

  async function handleBackToParent() {
    try {
      localStorage.removeItem("practicehero_child_mode");
    } catch {}
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <>
      {isChildMode && (
        <div className="fixed bottom-20 right-4 z-50">
          <button
            onClick={handleBackToParent}
            className="flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-2 text-xs text-white shadow-lg"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("auth.backToParent")}
          </button>
        </div>
      )}
      {/* Existing nav code */}
    </>
  );
}
```

#### 3. `/src/app/[locale]/(auth)/login/page.tsx`
Add support for `?tab=child` query parameter:
```typescript
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "child" ? "child" : "parent";

  return (
    <Tabs defaultValue={defaultTab}>
      {/* existing tabs */}
    </Tabs>
  );
}
```

#### 4. `messages/nl.json`
Add translation keys:
```json
{
  "parent": {
    "childMode": "Kindmodus"
  },
  "auth": {
    "backToParent": "Terug naar ouder"
  }
}
```

#### 5. `messages/en.json`
Add translation keys:
```json
{
  "parent": {
    "childMode": "Child mode"
  },
  "auth": {
    "backToParent": "Back to parent"
  }
}
```

### Testing Feature 1
1. Login as parent
2. Click "Kindmodus" button
3. Should see child PIN login with "Child" tab selected by default
4. Select child, enter PIN, login
5. Should see "Terug naar ouder" floating button
6. Click it, should go back to parent login page

---

## FEATURE 2: Teacher (Docent) Module

### Architecture Decisions

#### Decision 1: User Role
- **Add 'teacher' to user_role ENUM** (currently 'parent' | 'child')
- New roles: 'parent' | 'child' | 'teacher'
- Matches existing pattern for middleware routing and RLS policies

#### Decision 2: Studio Entity
- Teachers don't have "families", they have "studios"
- `studios` table: owner_id (teacher's profile), name, teacher_code
- Analogous to how `families` work for parents

#### Decision 3: Dual-Role Architecture (CRITICAL)
- A child can be BOTH a family child AND a teacher's student
- Both refer to the SAME `profiles` record (same auth user)
- `practice_sessions` can have BOTH `family_id` (for family context) AND `studio_id` (for teacher context)
- Both parent and teacher see the same practice sessions
- For MVP: Teacher always creates standalone students. Dual-role linking is v2.

#### Decision 4: Student Code Generation
- Teachers get unique "docentcode" (e.g., T-1234) - generated once at studio creation
- Students get unique "leerlingcode" per teacher (e.g., S-5678)
- Login: user enters docentcode + leerlingcode + PIN

### Database Migration (009_teacher_module.sql)

**File:** `/supabase/migrations/009_teacher_module.sql`

Key changes:
```sql
-- 1. Extend user_role ENUM
ALTER TYPE user_role ADD VALUE 'teacher';

-- 2. Create studios table (for teachers, analogous to families)
CREATE TABLE studios (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),  -- teacher's profile
  name TEXT NOT NULL,
  teacher_code TEXT UNIQUE NOT NULL,      -- e.g., "T-1234"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create courses table (teacher's curriculum)
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  studio_id UUID REFERENCES studios(id),
  instrument_id UUID REFERENCES instruments(id),
  name TEXT NOT NULL,
  description TEXT,
  total_lessons INTEGER DEFAULT 10,
  total_levels INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);

-- 4. Create course_lessons (individual lesson definitions)
CREATE TABLE course_lessons (
  id UUID PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  lesson_number INTEGER,
  level_number INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  audio_url TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);

-- 5. Create teacher_students (links students to teachers)
CREATE TABLE teacher_students (
  id UUID PRIMARY KEY,
  studio_id UUID REFERENCES studios(id),
  student_id UUID REFERENCES profiles(id),  -- reuses child profile
  course_id UUID REFERENCES courses(id),
  student_code TEXT NOT NULL,               -- e.g., "S-5678"
  current_level INTEGER DEFAULT 1,
  current_lesson INTEGER DEFAULT 1,
  start_date DATE NOT NULL,
  target_end_date DATE,
  student_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  UNIQUE(studio_id, student_code),
  UNIQUE(studio_id, student_id)
);

-- 6. Make profiles.family_id nullable (for teacher-only students)
ALTER TABLE profiles ALTER COLUMN family_id DROP NOT NULL;

-- 7. Add studio_id to practice_sessions
ALTER TABLE practice_sessions ADD COLUMN studio_id UUID REFERENCES studios(id);

-- 8. Make family_id nullable in practice_sessions, streaks, points, super_credits
ALTER TABLE practice_sessions ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE streaks ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE points ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE super_credits ALTER COLUMN family_id DROP NOT NULL;

-- 9. RLS Policies for studios, courses, teacher_students (see detailed schema in IMPLEMENTATION_PLAN_DETAILED.md)

-- 10. RPC function for student login lookup
CREATE OR REPLACE FUNCTION lookup_student_by_codes(
  p_teacher_code TEXT, p_student_code TEXT
) RETURNS TABLE(student_id UUID, studio_id UUID) ...

-- 11. Function to generate unique teacher_code
CREATE OR REPLACE FUNCTION generate_teacher_code() RETURNS TEXT ...

-- 12. Function to generate unique student_code per studio
CREATE OR REPLACE FUNCTION generate_student_code(p_studio_id UUID) RETURNS TEXT ...
```

### TypeScript Types

**File:** `/src/types/database.ts`

Changes to existing:
```typescript
export type UserRole = "parent" | "child" | "teacher";  // WAS: "parent" | "child"

export interface Profile {
  // ... existing fields
  family_id: string | null;  // WAS: string (NOT NULL), now nullable for teacher-only students
  role: UserRole;            // Updated enum
}

export interface PracticeSession {
  // ... existing fields
  family_id: string | null;  // WAS: string (NOT NULL), now nullable
  studio_id: string | null;  // NEW: link to teacher's studio
}
```

New interfaces:
```typescript
export interface Studio {
  id: string;
  owner_id: string;
  name: string;
  teacher_code: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  studio_id: string;
  instrument_id: string;
  name: string;
  description: string | null;
  total_lessons: number;
  total_levels: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  lesson_number: number;
  level_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  audio_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TeacherStudent {
  id: string;
  studio_id: string;
  student_id: string;
  course_id: string | null;
  student_code: string;
  current_level: number;
  current_lesson: number;
  start_date: string;
  target_end_date: string | null;
  student_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Authentication

#### Teacher Registration
**File:** `/src/lib/actions/auth.ts`

New function:
```typescript
export async function registerTeacher(
  email: string,
  password: string,
  studioName: string
): Promise<RegisterResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "teacher",
        display_name: studioName,
      },
    },
  });

  if (error) return { error: error.message };
  if (data.user && !data.session) {
    return { success: true, needsConfirmation: true };
  }
  return { success: true };
}
```

After successful signup, call new function to create studio:
```typescript
export async function createStudio(studioName: string): Promise<{
  studioId?: string;
  teacherCode?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Generate teacher code
  const admin = createAdminClient();
  const { data: code } = await admin.rpc('generate_teacher_code');

  const { data: studio, error } = await admin
    .from('studios')
    .insert({
      owner_id: user.id,
      name: studioName,
      teacher_code: code,
    })
    .select('id, teacher_code')
    .single();

  if (error) return { error: error.message };
  return { studioId: studio.id, teacherCode: studio.teacher_code };
}
```

#### Student Login
**File:** `/src/lib/actions/auth.ts`

New function:
```typescript
export async function loginStudent(
  teacherCode: string,
  studentCode: string,
  pin: string
): Promise<LoginResult> {
  try {
    const admin = createAdminClient();

    // Lookup student by codes
    const { data: lookup, error: lookupError } = await admin.rpc(
      'lookup_student_by_codes',
      { p_teacher_code: teacherCode, p_student_code: studentCode }
    );

    if (lookupError || !lookup || lookup.length === 0) {
      return { error: "Leerling niet gevonden. Controleer de codes." };
    }

    const studentId = lookup[0].student_id;

    // Get auth email via admin
    const { data: authUser, error: authError } =
      await admin.auth.admin.getUserById(studentId);

    if (authError || !authUser.user?.email) {
      return { error: "Gebruiker niet gevonden." };
    }

    // Sign in with PIN as password
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password: pin,
    });

    if (error) {
      return { error: "Verkeerde PIN." };
    }

    return { success: true };
  } catch {
    return { error: "Kan niet inloggen." };
  }
}
```

#### Teacher Creates Student
**File:** `/src/lib/actions/teacher.ts` (NEW)

```typescript
export async function addStudent(
  displayName: string,
  pin: string,
  courseId: string | null,
  startDate: string,
  startLevel: number,
  instrumentIds: string[]
): Promise<AddStudentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify teacher has studio
  const { data: studio } = await supabase
    .from('studios')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!studio) return { error: "Studio not found." };

  // Create auth user for student
  const admin = createAdminClient();
  const studentEmail = `student-${crypto.randomUUID()}@practicehero.local`;

  const { data: studentAuth, error: authError } = await admin.auth.admin.createUser({
    email: studentEmail,
    password: pin,
    email_confirm: true,
    user_metadata: {
      role: 'child',
      display_name: displayName,
      studio_id: studio.id,
    },
  });

  if (authError || !studentAuth.user) {
    return { error: authError?.message || "Failed to create student." };
  }

  // Profile trigger will create profile with role='child', family_id=null

  // Link instruments
  for (const instrumentId of instrumentIds) {
    await admin
      .from('child_instruments')
      .insert({
        child_id: studentAuth.user.id,
        instrument_id: instrumentId,
        is_primary: instrumentIds[0] === instrumentId,
      });
  }

  // Generate student code
  const { data: studentCode } = await admin.rpc('generate_student_code', {
    p_studio_id: studio.id,
  });

  // Create teacher_students link
  const { data: teacherStudent, error: linkError } = await admin
    .from('teacher_students')
    .insert({
      studio_id: studio.id,
      student_id: studentAuth.user.id,
      course_id: courseId || null,
      student_code: studentCode,
      current_level: startLevel,
      current_lesson: 1,
      start_date: startDate,
      is_active: true,
    })
    .select('student_code')
    .single();

  if (linkError) return { error: linkError.message };

  return {
    success: true,
    studentCode: teacherStudent.student_code,
    studentId: studentAuth.user.id,
  };
}
```

### Middleware Updates

**File:** `/middleware.ts`

```typescript
// Add to auth checks:
const teacherOnlyPaths = ["/teacher"];

// In role-based access control:
if (
  role === "child" &&
  (parentOnlyPaths.some((p) => path.startsWith(p)) ||
   teacherOnlyPaths.some((p) => path.startsWith(p)))
) {
  return NextResponse.redirect(new URL(`/${locale}/home`, request.url));
}

if (
  role === "teacher" &&
  parentOnlyPaths.some((p) => path.startsWith(p))
) {
  return NextResponse.redirect(new URL(`/${locale}/teacher/dashboard`, request.url));
}

// Update root redirect:
let dest: string;
if (role === "child") dest = `/${locale}/home`;
else if (role === "teacher") dest = `/${locale}/teacher/dashboard`;
else dest = `/${locale}/dashboard`;
return NextResponse.redirect(new URL(dest, request.url));
```

### Routes

New files for teacher module:

```
src/app/[locale]/(teacher)/
  layout.tsx                         -- TeacherNav wrapper
  dashboard/
    page.tsx                         -- Studio overview, student list, recent activity
  students/
    page.tsx                         -- All students list with search/filter
    add/
      AddStudentForm.tsx             -- Client component form
      page.tsx                       -- Add student page
    [studentId]/
      page.tsx                       -- Student detail (progress, sessions)
      content/
        page.tsx                     -- Manage lesson content for student
  courses/
    page.tsx                         -- All courses list
    add/
      page.tsx                       -- Create new course
    [courseId]/
      page.tsx                       -- Course detail
      lessons/
        page.tsx                     -- Manage course lessons
  settings/
    page.tsx                         -- Studio settings, teacher code display
```

#### TeacherNav Component
**File:** `/src/components/layout/TeacherNav.tsx`

```typescript
const navItems = [
  { href: "/teacher/dashboard", icon: LayoutDashboard, labelKey: "nav.teacherDashboard" },
  { href: "/teacher/students", icon: Users, labelKey: "nav.students" },
  { href: "/teacher/courses", icon: BookOpen, labelKey: "nav.courses" },
  { href: "/teacher/settings", icon: Settings, labelKey: "nav.settings" },
];
// Similar pattern to ParentNav
```

#### Teacher Layout
**File:** `/src/app/[locale]/(teacher)/layout.tsx`

```typescript
import { TeacherNav } from "@/components/layout/TeacherNav";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

### Login Page Updates

**File:** `/src/app/[locale]/(auth)/login/page.tsx`

Add third tab for student login:

```typescript
<Tabs defaultValue={defaultTab} className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="parent">{t("auth.parentLogin")}</TabsTrigger>
    <TabsTrigger value="child">{t("auth.childLogin")}</TabsTrigger>
    <TabsTrigger value="student">{t("auth.studentLogin")}</TabsTrigger>
  </TabsList>

  {/* Parent tab - existing */}
  {/* Child tab - existing */}

  <TabsContent value="student">
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.studentLogin")}</CardTitle>
      </CardHeader>
      <CardContent>
        <StudentLoginForm />
      </CardContent>
    </Card>
  </TabsContent>
</Tabs>
```

### Server Actions

#### New File: `/src/lib/actions/teacher.ts`
```typescript
// Studio management
export async function getStudio(): Promise<Studio | null>
export async function updateStudio(name: string): Promise<...>

// Student management
export async function addStudent(...): Promise<AddStudentResult>
export async function getStudents(): Promise<TeacherStudentWithProgress[]>
export async function getStudentDetail(studentId: string): Promise<...>
export async function updateStudentProgress(studentId: string, level: number, lesson: number): Promise<...>
export async function deactivateStudent(studentId: string): Promise<...>

// Course management
export async function createCourse(...): Promise<Course>
export async function getCourses(): Promise<Course[]>
export async function getCourseDetail(courseId: string): Promise<Course>
export async function saveCourseLesson(...): Promise<CourseLesson>
export async function deleteCourseLesson(lessonId: string): Promise<...>

// Dashboard
export async function getTeacherDashboard(): Promise<{
  studio: Studio;
  students: TeacherStudentOverview[];
  recentSessions: PracticeSession[];
}>
```

#### Modify Existing: `/src/lib/actions/practice.ts`
Update `startPracticeSession` to support teacher context:
```typescript
export async function startPracticeSession(instrumentId: string): Promise<StartSessionResult> {
  // ... existing code

  // NEW: Check if student is linked to teacher
  const { data: teacherLink } = await supabase
    .from('teacher_students')
    .select('studio_id')
    .eq('student_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  // Insert with both family_id and studio_id
  const { data: session, error } = await supabase
    .from('practice_sessions')
    .insert({
      child_id: user.id,
      instrument_id: instrumentId,
      family_id: profile.family_id || null,    // may be null
      studio_id: teacherLink?.studio_id || null, // NEW
      started_at: new Date().toISOString(),
      status: 'active',
      audio_verified: false,
    })
    .select('id')
    .single();

  // ... rest
}
```

### i18n Keys

**Add to `messages/nl.json`:**
```json
{
  "nav": {
    "teacherDashboard": "Dashboard",
    "students": "Leerlingen",
    "courses": "Cursussen"
  },
  "auth": {
    "studentLogin": "Leerling inloggen",
    "enterStudentCodes": "Voer je docent- en leerlingcode in",
    "teacherCode": "Docentcode",
    "studentCode": "Leerlingcode",
    "registerTeacher": "Docentaccount aanmaken",
    "studioName": "Studio / schoolnaam"
  },
  "teacher": {
    "dashboard": {
      "title": "Docentdashboard",
      "teacherCode": "Jouw docentcode",
      "totalStudents": "Totaal leerlingen",
      "activeToday": "Actief vandaag"
    },
    "students": {
      "title": "Leerlingen",
      "add": "Leerling toevoegen",
      "name": "Naam leerling",
      "pin": "4-cijferige PIN",
      "code": "Leerlingcode",
      "added": "Leerling toegevoegd!"
    },
    "courses": {
      "title": "Cursussen",
      "add": "Cursus toevoegen",
      "name": "Cursusnaam",
      "lessons": "Lessen"
    },
    "settings": {
      "title": "Studio instellingen",
      "teacherCode": "Docentcode"
    }
  }
}
```

---

## MVP vs LATER

### MVP (v1) - Essentieel (5-7 days)
1. Database migration 009 (all tables, RLS, RPC functions)
2. Teacher registration + studio auto-creation
3. Student creation (standalone, no family linking)
4. Student login (teacher_code + student_code + PIN)
5. Teacher dashboard (student list overview)
6. Course CRUD (basic: name, instrument, lessons)
7. Middleware routing for teacher
8. i18n for all teacher features
9. Parent "Child Mode" switch (Feature 1)

### v2+ Features
1. Dual-role linking (koppel bestaand family child to teacher)
2. Subscription/billing (Stripe integration)
3. Advanced course management (automatic progression)
4. Teacher-to-student messaging
5. Progress reports & export
6. Multi-studio support for teachers

---

## Implementation Order (Phased)

### Phase 1: Database (1 day)
- [ ] Create migration 009_teacher_module.sql
- [ ] Test migration with supabase local dev
- [ ] Update TypeScript types in database.ts
- [ ] Update handle_new_user trigger if needed

### Phase 2: Auth (1 day)
- [ ] registerTeacher() in auth.ts
- [ ] loginStudent() in auth.ts
- [ ] addStudent() in teacher.ts (new file)
- [ ] createStudio() in auth.ts
- [ ] Update middleware for teacher routes

### Phase 3: Teacher UI (2-3 days)
- [ ] Create TeacherNav component
- [ ] Create (teacher) route group + layout
- [ ] Teacher dashboard page
- [ ] Students list + add form
- [ ] Student detail page
- [ ] Courses list + add form
- [ ] Course detail + lessons management
- [ ] Teacher settings page

### Phase 4: Login Updates (0.5 days)
- [ ] Add 3rd tab to login page for students
- [ ] StudentLoginForm component
- [ ] Update register page for teacher option

### Phase 5: Feature 1 (Child Mode) (0.5 days)
- [ ] Add "Kindmodus" button to ParentNav
- [ ] Add "Terug naar ouder" button to ChildNav
- [ ] Support ?tab=child query parameter in login
- [ ] Add i18n keys

### Phase 6: Existing Code Updates (1 day)
- [ ] practice.ts: support nullable family_id + studio_id
- [ ] child.ts: make family_id queries null-safe
- [ ] Add all i18n keys (nl + en)
- [ ] Update SupabaseProvider for teacher role

### Phase 7: Testing (1 day)
- [ ] Test teacher registration → studio creation
- [ ] Test student creation + login
- [ ] Test practice session as student
- [ ] Test teacher sees student data
- [ ] Test child mode switch flow
- [ ] Test RLS policies

---

## Key Files to Remember

### Core Changes
- `/src/types/database.ts` - Update UserRole enum, make family_id nullable
- `/src/lib/actions/auth.ts` - Add registerTeacher, loginStudent, createStudio
- `/src/lib/actions/teacher.ts` - NEW file for teacher server actions
- `/src/lib/actions/practice.ts` - Update startPracticeSession for studio context
- `/middleware.ts` - Add teacher route guards
- `/supabase/migrations/009_teacher_module.sql` - Major schema update

### New Components
- `/src/components/layout/TeacherNav.tsx` - Teacher navigation bar
- `/src/app/[locale]/(teacher)/layout.tsx` - Teacher layout wrapper
- `/src/app/[locale]/(teacher)/dashboard/page.tsx` - Teacher dashboard

### UI Updates
- `/src/components/layout/ParentNav.tsx` - Add "Kindmodus" button
- `/src/components/layout/ChildNav.tsx` - Add "Terug naar ouder" button
- `/src/app/[locale]/(auth)/login/page.tsx` - Add student login tab
- `messages/nl.json` - Add teacher i18n keys
- `messages/en.json` - Add teacher i18n keys

---

## Critical Architecture Notes

1. **Dual-role students:** practice_sessions can have both family_id AND studio_id filled. Teachers/parents see same data via RLS filters.

2. **Nullable family_id:** Teacher-only students have family_id=NULL. Make sure all queries using family_id are null-safe (IN vs = comparisons).

3. **Auth email pattern:** Students use `student-{uuid}@practicehero.local`, same as family children use `child-{uuid}@...`

4. **RLS for teachers:** Teachers can view student data via:
   ```sql
   child_id IN (
     SELECT student_id FROM teacher_students
     WHERE studio_id IN (SELECT id FROM studios WHERE owner_id = auth.uid())
   )
   ```

5. **Student login RPC:** `lookup_student_by_codes(teacher_code, student_code)` returns student_id for auth lookup.

---

## Context for Next Session

When resuming:
1. Read this file first (already done!)
2. Check TODO.md for current task status
3. All architectural decisions are documented above
4. Migration SQL is documented in the "Database Migration" section
5. If stuck, refer to existing similar code:
   - Child creation: see `addChild()` in auth.ts
   - Parent routes: see (parent) route structure
   - RLS policies: see existing policies in migrations 001-008

Last worked on: 2026-02-28
Next session: Start with Phase 1 (Database migration)
