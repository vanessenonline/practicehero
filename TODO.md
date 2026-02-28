# PracticeHero Implementation TODO

**Start Date:** 2026-02-28
**Status:** Ready to implement
**Total Estimated Time:** 5-7 days

---

## Phase 1: Database (1 day) [NOT STARTED]

### Migration 009: Teacher Module
- [ ] Create file `/supabase/migrations/009_teacher_module.sql`
- [ ] Add user_role ENUM value 'teacher'
- [ ] Create studios table
- [ ] Create courses table
- [ ] Create course_lessons table
- [ ] Create teacher_students table
- [ ] Alter profiles.family_id to nullable
- [ ] Alter practice_sessions (add studio_id, make family_id nullable)
- [ ] Alter streaks, points, super_credits (make family_id nullable)
- [ ] Create RLS policies (studios, courses, course_lessons, teacher_students)
- [ ] Extend RLS policies on existing tables (practice_sessions, streaks, points, super_credits)
- [ ] Create RPC function: lookup_student_by_codes()
- [ ] Create RPC function: generate_teacher_code()
- [ ] Create RPC function: generate_student_code()
- [ ] Test migration locally with `supabase migration up`

### TypeScript Types
- [ ] Update `src/types/database.ts`
  - [ ] Change UserRole to include 'teacher'
  - [ ] Make Profile.family_id nullable
  - [ ] Make PracticeSession.family_id nullable
  - [ ] Add studio_id to PracticeSession
  - [ ] Add Studio interface
  - [ ] Add Course interface
  - [ ] Add CourseLesson interface
  - [ ] Add TeacherStudent interface

### handle_new_user Trigger
- [ ] Check if trigger needs updating for teacher role
- [ ] OR create post-registration createStudio() action

---

## Phase 2: Authentication (1 day) [NOT STARTED]

### Teacher Registration & Studio
- [ ] Add `registerTeacher()` to `/src/lib/actions/auth.ts`
  - [ ] Call supabase.auth.signUp with role='teacher' in metadata
  - [ ] Return appropriate response
- [ ] Add `createStudio()` to `/src/lib/actions/auth.ts`
  - [ ] Generate teacher_code via RPC
  - [ ] Insert studio record
  - [ ] Return studio ID and teacher code

### Student Login
- [ ] Add `loginStudent()` to `/src/lib/actions/auth.ts`
  - [ ] Call lookup_student_by_codes() RPC
  - [ ] Get student's auth email via admin
  - [ ] Sign in with PIN password
  - [ ] Error handling

### Teacher Creates Student
- [ ] Create `/src/lib/actions/teacher.ts`
- [ ] Add `addStudent()` function
  - [ ] Verify teacher authenticated
  - [ ] Get teacher's studio
  - [ ] Create Supabase Auth user (student-{uuid}@...)
  - [ ] Wait for profile trigger
  - [ ] Link instruments via child_instruments
  - [ ] Generate student code via RPC
  - [ ] Create teacher_students record
  - [ ] Return student code and ID

### Middleware Updates
- [ ] Update `/middleware.ts`
  - [ ] Add teacherOnlyPaths array
  - [ ] Add role === 'teacher' redirect logic
  - [ ] Update root path redirect for teacher role
  - [ ] Add /register/teacher to public paths

---

## Phase 3: Teacher UI (2-3 days) [NOT STARTED]

### Components
- [ ] Create `/src/components/layout/TeacherNav.tsx`
  - [ ] Navigation items for Dashboard, Students, Courses, Settings
  - [ ] Active state styling
  - [ ] Logo/branding

### Routes
- [ ] Create `/src/app/[locale]/(teacher)/layout.tsx`
  - [ ] Import TeacherNav
  - [ ] Apply margin/padding for nav
  - [ ] Render children

- [ ] Create `/src/app/[locale]/(teacher)/dashboard/page.tsx`
  - [ ] Call getTeacherDashboard()
  - [ ] Display studio name + teacher code
  - [ ] Show student count, practiced today count
  - [ ] List recent practice sessions
  - [ ] Link to "Add student" button

- [ ] Create `/src/app/[locale]/(teacher)/students/page.tsx`
  - [ ] Call getStudents()
  - [ ] Display list/table of students
  - [ ] Show code, level, lesson, start date
  - [ ] "Add student" button

- [ ] Create `/src/app/[locale]/(teacher)/students/add/page.tsx` + `AddStudentForm.tsx`
  - [ ] Form: name, PIN (4 digits), instrument select, course select, start date, end date
  - [ ] Call addStudent()
  - [ ] Display generated student code on success
  - [ ] Copy-to-clipboard button for code

- [ ] Create `/src/app/[locale]/(teacher)/students/[studentId]/page.tsx`
  - [ ] Call getStudentDetail()
  - [ ] Display student info, current level/lesson
  - [ ] Show streak, points, super credits
  - [ ] List recent practice sessions
  - [ ] "Manage content" link

- [ ] Create `/src/app/[locale]/(teacher)/students/[studentId]/content/page.tsx`
  - [ ] Similar to parent child content management
  - [ ] Set lessons/motivators for student per instrument
  - [ ] Date ranges for content activation

- [ ] Create `/src/app/[locale]/(teacher)/courses/page.tsx`
  - [ ] List all courses for studio
  - [ ] Instrument name, total lessons, total levels
  - [ ] "Add course" button
  - [ ] Click to edit

- [ ] Create `/src/app/[locale]/(teacher)/courses/add/page.tsx`
  - [ ] Form: name, instrument, total lessons, total levels, description
  - [ ] Call createCourse()

- [ ] Create `/src/app/[locale]/(teacher)/courses/[courseId]/page.tsx`
  - [ ] Display course details
  - [ ] Show lesson grid or list (lesson_number x level_number)
  - [ ] Edit/delete buttons per lesson
  - [ ] Link to lessons management

- [ ] Create `/src/app/[locale]/(teacher)/courses/[courseId]/lessons/page.tsx`
  - [ ] Lesson form: title, description, video URL, audio URL, lesson#, level#
  - [ ] Create/update/delete lessons
  - [ ] Drag-to-reorder

- [ ] Create `/src/app/[locale]/(teacher)/settings/page.tsx`
  - [ ] Display studio name + teacher code
  - [ ] Copy button for code
  - [ ] Edit studio name
  - [ ] (Future: Subscription info)

### Server Actions in teacher.ts
- [ ] `getStudio()` - fetch current teacher's studio
- [ ] `updateStudio(name)` - rename studio
- [ ] `getStudents()` - fetch all students for studio
- [ ] `getStudentDetail(studentId)` - detailed student data
- [ ] `updateStudentProgress(studentId, level, lesson)` - update student's current level/lesson
- [ ] `deactivateStudent(studentId)` - deactivate student link
- [ ] `createCourse(name, instrumentId, totalLessons, totalLevels, description)` - new course
- [ ] `getCourses()` - all courses for studio
- [ ] `getCourseDetail(courseId)` - course with lessons
- [ ] `saveCourseLesson(courseId, lessonNumber, levelNumber, title, description, videoUrl, audioUrl)` - create/update lesson
- [ ] `deleteCourseLesson(lessonId)` - delete lesson
- [ ] `getTeacherDashboard()` - overview data

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
