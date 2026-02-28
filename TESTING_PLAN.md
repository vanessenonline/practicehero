# Phase 7: Comprehensive Testing Plan

## Overview
This document tracks all testing activities for PracticeHero to verify all 6 phases work correctly together.

**Test Date:** 2026-02-28
**Tester:** Claude
**Environment:** Local dev server + Supabase testing

---

## 1. DATABASE TESTS

### 1.1 Migration Status
- [ ] Verify migration 009 applied correctly to Supabase
  - Check: `studios` table exists
  - Check: `teacher_students` table exists
  - Check: `profiles.family_id` is nullable
  - Check: `practice_sessions.studio_id` exists
  - Check: RLS policies created

### 1.2 RLS Policies
- [ ] Test studios policy: Teacher can list/view own studios
- [ ] Test courses policy: Teacher can manage own courses
- [ ] Test practice_sessions policy: Child/teacher can view own sessions
- [ ] Test teacher_students policy: Teacher can view own students

### 1.3 RPC Functions
- [ ] Test `generate_teacher_code()`: Creates unique teacher code
- [ ] Test `generate_student_code()`: Creates unique student code
- [ ] Test `lookup_student_by_codes()`: Finds student by codes

---

## 2. AUTH FLOW TESTS

### 2.1 Teacher Registration
```
[ ] Go to /register → Teacher tab
[ ] Fill: Studio name, email, password
[ ] Click "Account aanmaken"
[ ] Verify: Email confirmation sent
[ ] Verify: Studio created in DB
[ ] Verify: Teacher code generated and displayed
```

### 2.2 Teacher Login
```
[ ] Go to /login → Parent tab
[ ] Enter email + password
[ ] Verify: Redirected to /teacher/dashboard
[ ] Verify: Studio info displayed
[ ] Verify: Student list shown (empty initially)
```

### 2.3 Student Creation
```
[ ] Go to /teacher/students/add
[ ] Fill: Name, PIN (4 digits), instruments, dates
[ ] Click "Add student"
[ ] Verify: Student code displayed (S-XXXX)
[ ] Verify: Student in database
[ ] Verify: Auth user created (student-{uuid}@...)
[ ] Verify: Profile created with role='child'
[ ] Verify: teacher_students link created
```

### 2.4 Student Login
```
[ ] Go to /login → Student tab
[ ] Enter: Teacher code, Student code, PIN
[ ] Click "Inloggen"
[ ] Verify: Redirected to /home
[ ] Verify: Child dashboard loads
[ ] Verify: Instruments displayed
```

### 2.5 Middleware Redirects
```
[ ] Teacher login → should go to /teacher/dashboard (NOT /home)
[ ] Student login → should go to /home (NOT /teacher/dashboard)
[ ] Parent login → should go to /dashboard (NOT /home)
```

---

## 3. UI/FEATURE TESTS

### 3.1 Teacher Dashboard
```
[ ] Load /teacher/dashboard
[ ] Verify: Studio name shown
[ ] Verify: Teacher code with copy button
[ ] Verify: Student count displayed
[ ] Verify: "Practiced today" count shown
[ ] Verify: Recent sessions listed
[ ] Verify: "Add student" button visible
```

### 3.2 Teacher Students Page
```
[ ] Load /teacher/students
[ ] Verify: Student list shows all created students
[ ] Verify: Each student shows: name, code, instruments
[ ] Verify: "Add student" button works
[ ] Verify: Can click student for detail view
```

### 3.3 Student Detail Page
```
[ ] Load /teacher/students/[studentId]
[ ] Verify: Student name + info displayed
[ ] Verify: Practice sessions listed
[ ] Verify: Streak/points shown
[ ] Verify: Can view recent practice data
```

### 3.4 Courses Management
```
[ ] Create course: /teacher/courses/add
[ ] Fill: Name, Instrument, total lessons/levels
[ ] Verify: Course created and listed
[ ] View course: /teacher/courses/[courseId]
[ ] Add lesson: Via lessons page
[ ] Verify: Lesson appears in matrix
```

### 3.5 Parent Child Mode Switch
```
[ ] Load parent dashboard
[ ] Verify: "Kindmodus" button visible in navbar
[ ] Click "Kindmodus"
[ ] Verify: Sets localStorage.practicehero_child_mode = 'true'
[ ] Verify: Redirected to /login?tab=child
[ ] Verify: Child tab pre-selected
[ ] Select and login as child
[ ] Verify: Child nav shows "Terug naar ouder" button (top-left)
[ ] Click "Terug naar ouder"
[ ] Verify: Clears localStorage flag
[ ] Verify: Redirected to parent login
```

### 3.6 Parent-driven Child
```
[ ] Parent adds child via /children/add
[ ] Verify: Child created with family_id
[ ] Child logs in (normal way, not teacher-student)
[ ] Verify: Dashboard shows practice data
[ ] Parent sets lesson content
[ ] Verify: Child sees lesson in practice
```

---

## 4. RLS/SECURITY TESTS

### 4.1 Parent Data Isolation
```
[ ] Create 2 parent accounts (different families)
[ ] Each adds a child
[ ] Test: Parent A cannot see Parent B's family data
[ ] Test: Parent A cannot see Parent B's children
[ ] Test: Parent A's child cannot see Parent B's data
```

### 4.2 Teacher Data Isolation
```
[ ] Create 2 teacher accounts (different studios)
[ ] Each creates students
[ ] Test: Teacher A cannot see Teacher B's students
[ ] Test: Teacher A cannot see Teacher B's studio data
[ ] Test: Student A cannot see Teacher B's courses
```

### 4.3 Role-based Access
```
[ ] Child tries to access /teacher/dashboard → should redirect
[ ] Child tries to access /dashboard (parent) → should redirect
[ ] Student tries to access parent routes → should redirect
[ ] Teacher tries to access parent routes → should redirect
```

### 4.4 RLS Query Testing
```
-- Verify teacher_students RLS
[ ] SELECT * FROM teacher_students (as teacher) → see own students only
[ ] SELECT * FROM teacher_students (as student) → see nothing

-- Verify practice_sessions RLS
[ ] SELECT * FROM practice_sessions (as child) → see own sessions
[ ] SELECT * FROM practice_sessions (as teacher) → see studio students' sessions
[ ] SELECT * FROM practice_sessions (as parent) → see family children's sessions
```

---

## 5. MULTI-USER TESTS

### 5.1 Two Independent Teachers
```
[ ] Create Teacher A + Studio A + 3 students
[ ] Create Teacher B + Studio B + 2 students
[ ] Verify: Teacher A sees only their 3 students
[ ] Verify: Teacher B sees only their 2 students
[ ] Verify: Data completely isolated
```

### 5.2 Parent + Teacher-Student Relationship
```
[ ] Parent A creates child (family_id = A)
[ ] Teacher B creates student (studio_id = B, family_id = NULL)
[ ] Verify: No accidental data sharing
[ ] Verify: Each flow works independently
```

### 5.3 Practice Session Data Flow
```
[ ] Teacher-student practices (session created with studio_id)
[ ] Verify: Points awarded correctly
[ ] Verify: Streak updated
[ ] Verify: Session visible in teacher dashboard
[ ] Parent-student practices (session created with family_id)
[ ] Verify: Points awarded correctly
[ ] Verify: Streak updated
[ ] Verify: Session visible in parent dashboard
```

---

## 6. NULLABLE FAMILY_ID TESTS

### 6.1 Teacher Student Context
```
[ ] Create teacher + student (family_id = NULL)
[ ] Student starts practice session
[ ] Verify: practice_sessions.family_id = NULL
[ ] Verify: practice_sessions.studio_id = [studio_uuid]
[ ] Student completes session
[ ] Verify: Points recorded with family_id = NULL
[ ] Verify: Streak updated with family_id = NULL
[ ] Verify: Super credits created with family_id = NULL
```

### 6.2 Family Messages (Should Fail)
```
[ ] Teacher-student tries to send message
[ ] Verify: Error "Ontvanger niet gevonden"
[ ] Verify: No message created
[ ] Parent-child sends message
[ ] Verify: Message created successfully
```

### 6.3 Shop Items (Should Work)
```
[ ] Parent-child buys shop item
[ ] Verify: Purchase recorded with family_id
[ ] Teacher-student buys shop item
[ ] Verify: Purchase recorded with family_id = NULL
[ ] Use streak restorer (both contexts)
[ ] Verify: Works correctly regardless of family_id
```

---

## Test Results Summary

| Test Category | Status | Notes |
|---------------|--------|-------|
| Database | [ ] | |
| Auth Flow | [ ] | |
| UI/Features | [ ] | |
| RLS/Security | [ ] | |
| Multi-User | [ ] | |
| Nullable family_id | [ ] | |

**Overall Status:** [ ] PASS / [ ] FAIL / [ ] PARTIAL

---

## Known Issues & Blockers

(To be filled as testing progresses)

---

## Test Artifacts

- Supabase test queries: [link to queries]
- Browser console logs: [captured during testing]
- Database snapshots: [if needed]

---

**Phase 7 Completion Date:** _____
**Signed Off By:** _____
