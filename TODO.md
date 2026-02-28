# PracticeHero Implementation TODO

**Start Date:** 2026-02-28
**Status:** Ready to implement
**Total Estimated Time:** 5-7 days

---

## Phase 1: Database (1 day) [IN PROGRESS ✓]

### Migration 009: Teacher Module
- [x] Create file `/supabase/migrations/009_teacher_module.sql`
- [x] Add user_role ENUM value 'teacher'
- [x] Create studios table
- [x] Create courses table
- [x] Create course_lessons table
- [x] Create teacher_students table
- [x] Alter profiles.family_id to nullable
- [x] Alter practice_sessions (add studio_id, make family_id nullable)
- [x] Alter streaks, points, super_credits (make family_id nullable)
- [x] Create RLS policies (studios, courses, course_lessons, teacher_students)
- [x] Extend RLS policies on existing tables (practice_sessions, streaks, points, super_credits)
- [x] Create RPC function: lookup_student_by_codes()
- [x] Create RPC function: generate_teacher_code()
- [x] Create RPC function: generate_student_code()
- [ ] Test migration locally with `supabase migration up`

### TypeScript Types
- [x] Update `src/types/database.ts`
  - [x] Change UserRole to include 'teacher'
  - [x] Make Profile.family_id nullable
  - [x] Make PracticeSession.family_id nullable
  - [x] Add studio_id to PracticeSession
  - [x] Add Studio interface
  - [x] Add Course interface
  - [x] Add CourseLesson interface
  - [x] Add TeacherStudent interface

### handle_new_user Trigger
- [ ] Check if trigger needs updating for teacher role
- [ ] OR create post-registration createStudio() action

---

## Phase 2: Authentication (1 day) [COMPLETE ✓✓✓]

### Teacher Registration & Studio
- [x] Add `registerTeacher()` to `/src/lib/actions/auth.ts`
  - [x] Call supabase.auth.signUp with role='teacher' in metadata
  - [x] Return appropriate response
- [x] Add `createStudio()` to `/src/lib/actions/auth.ts`
  - [x] Generate teacher_code via RPC
  - [x] Insert studio record
  - [x] Return studio ID and teacher code

### Student Login
- [x] Add `loginStudent()` to `/src/lib/actions/auth.ts`
  - [x] Call lookup_student_by_codes() RPC
  - [x] Get student's auth email via admin
  - [x] Sign in with PIN password
  - [x] Error handling

### Teacher Creates Student
- [x] Create `/src/lib/actions/teacher.ts`
- [x] Add `addStudent()` function
  - [x] Verify teacher authenticated
  - [x] Get teacher's studio
  - [x] Create Supabase Auth user (student-{uuid}@...)
  - [x] Wait for profile trigger
  - [x] Link instruments via child_instruments
  - [x] Generate student code via RPC
  - [x] Create teacher_students record
  - [x] Return student code and ID
- [x] Add all teacher server actions (15+ functions)
  - [x] Studio management (getStudio, updateStudio)
  - [x] Student CRUD (get, add, detail, progress, deactivate)
  - [x] Course management (CRUD + lessons)
  - [x] Teacher dashboard overview

### Middleware Updates
- [x] Update `/middleware.ts`
  - [x] Add teacherOnlyPaths array
  - [x] Add role === 'teacher' redirect logic
  - [x] Update root path redirect for teacher role
  - [x] Update teacher redirect in public paths handling

---

## Phase 3: Teacher UI (2-3 days) [COMPLETE ✓✓✓]

### Components
- [x] Create `/src/components/layout/TeacherNav.tsx`
  - [x] Navigation items for Dashboard, Students, Courses, Settings
  - [x] Active state styling with blue/cyan theme
  - [x] Logo/branding consistent with app

### Routes
- [x] Create `/src/app/[locale]/(teacher)/layout.tsx`
  - [x] Import TeacherNav
  - [x] Apply margin/padding for nav
  - [x] Render children

- [x] Create `/src/app/[locale]/(teacher)/dashboard/page.tsx`
  - [x] Call getTeacherDashboard()
  - [x] Display studio name + teacher code with copy button
  - [x] Show student count, practiced today count (stat cards)
  - [x] List recent practice sessions (today's sessions)
  - [x] Link to "Add student" button

- [x] Create `/src/app/[locale]/(teacher)/students/page.tsx`
  - [x] Call getStudents()
  - [x] Display list of students with status badges
  - [x] Show code, level, lesson, start/end dates
  - [x] "Add student" button

- [x] Create `/src/app/[locale]/(teacher)/students/add/page.tsx` + `AddStudentForm.tsx`
  - [x] Form: name, PIN (4 digits), instrument multi-select, course select, start/end dates
  - [x] Call addStudent()
  - [x] Display generated student code on success with copy button
  - [x] Instrument selection with emoji icons

- [x] Create `/src/app/[locale]/(teacher)/students/[studentId]/page.tsx`
  - [x] Call getStudentDetail()
  - [x] Display student info, current level/lesson
  - [x] Show streak, points, super credits in stat cards
  - [x] List recent practice sessions
  - [x] Show enrollment dates and status

- [x] Create `/src/app/[locale]/(teacher)/courses/page.tsx`
  - [x] List all courses for studio in grid
  - [x] Show instrument, total lessons, total levels
  - [x] "Add course" button
  - [x] Links to course detail and lessons management

- [x] Create `/src/app/[locale]/(teacher)/courses/add/page.tsx` + `AddCourseForm.tsx`
  - [x] Form: name, instrument dropdown, total lessons/levels, description
  - [x] Call createCourse()
  - [x] Validation and success screen

- [x] Create `/src/app/[locale]/(teacher)/courses/[courseId]/page.tsx`
  - [x] Display course details and stats
  - [x] Show lessons grid organized by level
  - [x] Show lesson info (title, urls, sort order)
  - [x] Link to lessons management

- [x] Create `/src/app/[locale]/(teacher)/courses/[courseId]/lessons/page.tsx`
  - [x] Lesson matrix table view (levels × lessons)
  - [x] Add lessons via modal/page
  - [x] Edit/delete buttons for lessons
  - [x] Helper text for workflow

- [x] Create `/src/app/[locale]/(teacher)/settings/page.tsx`
  - [x] Display studio name + teacher code
  - [x] Copy buttons for both codes
  - [x] Account status and creation date
  - [x] Onboarding guide for adding students

### i18n Keys
- [x] Update `messages/nl.json`:
  - [x] Add nav.teacher.* keys
  - [x] Add teacher.* section with all keys
- [x] Update `messages/en.json`:
  - [x] Add nav.teacher.* keys
  - [x] Add teacher.* section with all keys

---

## Phase 4: Login Updates (0.5 days) [NOT STARTED]

### Login Page
- [ ] Update `/src/app/[locale]/(auth)/login/page.tsx`
  - [ ] Change TabsList from grid-cols-2 to grid-cols-3
  - [ ] Add student login TabsContent
  - [ ] Import/create StudentLoginForm component

### StudentLoginForm Component
- [ ] Create `/src/components/auth/StudentLoginForm.tsx`
  - [ ] Teacher code input (T-XXXX)
  - [ ] Student code input (S-XXXX)
  - [ ] PIN input (4 digits, masked)
  - [ ] Call loginStudent()
  - [ ] Handle errors
  - [ ] Loading state

### Register Page
- [ ] Update `/src/app/[locale]/(auth)/register/page.tsx`
  - [ ] Add tabs: Parent register | Teacher register
  - [ ] Teacher form: email, password, studio name
  - [ ] Call registerTeacher() + createStudio()

---

## Phase 5: Parent Child Mode Switch (0.5 days) [NOT STARTED]

### ParentNav.tsx
- [ ] Add import: `{ Baby } from "lucide-react"`
- [ ] Add `handleChildMode()` function
  - [ ] Set localStorage.practicehero_child_mode = 'true'
  - [ ] Call supabase.auth.signOut()
  - [ ] Navigate to `/${locale}/login?tab=child`
- [ ] Add Button before LogOut:
  ```
  <Button variant="ghost" size="sm" onClick={handleChildMode}>
    <Baby className="h-4 w-4" />
    <span className="hidden sm:inline ml-1">{t("parent.childMode")}</span>
  </Button>
  ```

### ChildNav.tsx
- [ ] Add imports: `useEffect`, `useState`, `ArrowLeft`
- [ ] Add state: `isChildMode`
- [ ] Add useEffect to check localStorage
- [ ] Add `handleBackToParent()` function
  - [ ] Remove localStorage flag
  - [ ] signOut
  - [ ] Navigate to login
- [ ] Add floating button (if isChildMode):
  ```
  {isChildMode && (
    <div className="fixed bottom-20 right-4 z-50">
      <button onClick={handleBackToParent} className="...">
        <ArrowLeft className="h-3 w-3" />
        {t("auth.backToParent")}
      </button>
    </div>
  )}
  ```

### Login Page
- [ ] Add `useSearchParams()` hook
- [ ] Read `tab` query parameter
- [ ] Set `defaultTab` based on parameter
- [ ] Update Tabs component: `defaultValue={defaultTab}`

---

## Phase 6: Existing Code Updates (1 day) [NOT STARTED]

### practice.ts
- [ ] Update `startPracticeSession()`
  - [ ] After getting profile, query teacher_students
  - [ ] Pass studio_id to practice_sessions insert if exists
  - [ ] Keep family_id logic (may be null)

- [ ] Update `completePracticeSession()`
  - [ ] Ensure family_id null-safety in points calculation
  - [ ] If no family_id, still award points (use NULL for family context)

### child.ts
- [ ] Review `getChildDashboard()`
  - [ ] All queries already use child_id, should be fine
  - [ ] Check if any joins explicitly filter on family_id (should be safe with NULL)

### shop.ts
- [ ] Review `purchaseItem()`, `useStreakRestorer()`, `usePauseDay()`
  - [ ] Check family_id usage, ensure null-safe

### messages.ts
- [ ] Review message handling
  - [ ] Teacher-only students (no parent) shouldn't try to fetch parent messages
  - [ ] Optional: allow teacher-to-student messaging (v2 feature)

### i18n Keys
- [ ] Update `messages/nl.json`:
  - [ ] Add parent.childMode: "Kindmodus"
  - [ ] Add auth.backToParent: "Terug naar ouder"
  - [ ] Add all teacher.* keys (nav, dashboard, students, courses, settings)
  - [ ] Add auth.studentLogin, teacher_code, student_code, etc.

- [ ] Update `messages/en.json`:
  - [ ] Same keys in English

### SupabaseProvider
- [ ] Check if provider handles role='teacher' properly
- [ ] Ensure no hardcoded parent/child role checks

---

## Phase 7: Testing (1 day) [NOT STARTED]

### Database Tests
- [ ] [ ] Verify migration applied correctly
- [ ] [ ] Check RLS policies work (list studios, courses by owner)
- [ ] [ ] Test RPC functions (generate codes, lookup by codes)

### Auth Flow Tests
- [ ] [ ] Register teacher → verify studio created with teacher_code
- [ ] [ ] Create student → verify auth user + profile + teacher_students link
- [ ] [ ] Login as student with teacher_code + student_code + PIN
- [ ] [ ] Verify middleware redirects teacher to /teacher/dashboard
- [ ] [ ] Verify student (child role) redirects to /home

### UI/Feature Tests
- [ ] [ ] Teacher dashboard shows students and recent sessions
- [ ] [ ] Add student form generates student code
- [ ] [ ] Student detail page shows practice data
- [ ] [ ] Create course + lessons
- [ ] [ ] Parent clicks "Kindmodus" → child login appears with tab selected
- [ ] [ ] Child logs in, clicks "Terug naar ouder" → parent login appears

### RLS/Security Tests
- [ ] [ ] Parent cannot see other families' data
- [ ] [ ] Teacher cannot see other studios' students
- [ ] [ ] Child cannot access parent routes
- [ ] [ ] Student cannot see courses not enrolled in

### Multi-User Tests
- [ ] [ ] Create 2 teachers, verify studios separate
- [ ] [ ] Create students under each teacher, verify isolation
- [ ] [ ] Parent + student (same child) both see practice data

---

## NOTES

### Potential Blockers
1. `profiles.family_id NOT NULL` → must carefully test RLS with NULL values
2. `handle_new_user` trigger → may need modification to skip family creation for teachers
3. Existing RLS policies → some may need modification to handle NULL family_id

### Resources
- Migration examples: `/supabase/migrations/001-008.sql`
- Existing auth patterns: `/src/lib/actions/auth.ts` (addChild, loginChild)
- Existing routes: `/src/app/[locale]/(parent)/` structure
- i18n example: `messages/nl.json`, `messages/en.json`

### Queries to Test
```sql
-- Check nullable family_id doesn't break queries
SELECT * FROM practice_sessions
WHERE family_id = (SELECT family_id FROM profiles WHERE id = $1)
  OR family_id IS NULL;  -- FIX: use explicit NULL check if needed

-- Check teacher can see student data
SELECT ps.* FROM practice_sessions ps
WHERE ps.child_id IN (
  SELECT ts.student_id FROM teacher_students ts
  WHERE ts.studio_id IN (SELECT id FROM studios WHERE owner_id = auth.uid())
);
```

---

## Progress Tracking

### Completed
- [x] Codebase exploration
- [x] Architecture design & decisions
- [x] Implementation plan documented
- [x] TODO created

### Not Started
- [ ] Phase 1-7 tasks (all pending)

### Current Status
Ready to begin Phase 1 (Database migration)

---

## Quick Start for Next Session

1. Open `IMPLEMENTATION_PLAN.md` for full context
2. Find the current phase in this TODO
3. Check off boxes as you complete tasks
4. If blocked, refer to "Potential Blockers" section above
5. Test each phase before moving to next

**Estimated completion:** 5-7 days of focused work
