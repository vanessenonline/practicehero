# PracticeHero Implementation TODO

**Start Date:** 2026-02-28
**Last Updated:** 2026-03-01
**Status:** Phase 7 in progress (bug fixes applied, further testing needed)

---

## Phase 1: Database (1 day) [COMPLETE ✅]

- [x] Migration 009-012: Teacher module (studios, courses, course_lessons, teacher_students)
- [x] Add user_role ENUM values: 'teacher'
- [x] Make profiles.family_id nullable
- [x] RLS policies (studios, courses, teacher_students)
- [x] RPC functions: generate_teacher_code, generate_student_code, lookup_student_by_codes
- [x] Update TypeScript types (database.ts)
- [ ] **PENDING:** Migration 013 — add 'student' role to user_role ENUM (not yet applied to production)

---

## Phase 2: Authentication (1 day) [COMPLETE ✅]

- [x] registerTeacher() in auth.ts
- [x] createStudio() in auth.ts
- [x] loginStudent() in auth.ts
- [x] addStudent() in teacher.ts
- [x] All 15+ teacher server actions in teacher.ts
- [x] Middleware updates for teacher role routing

---

## Phase 3: Teacher UI (2-3 days) [COMPLETE ✅]

- [x] TeacherNav.tsx
- [x] Teacher layout with nav
- [x] /teacher/dashboard — stats, recent sessions
- [x] /teacher/students — list with status badges
- [x] /teacher/students/add — form + generated student code
- [x] /teacher/students/[studentId] — detail with practice history
- [x] /teacher/courses — grid of courses
- [x] /teacher/courses/add — form
- [x] /teacher/courses/[courseId] — detail with lesson grid
- [x] /teacher/courses/[courseId]/lessons — lesson matrix management
- [x] /teacher/settings — studio info + teacher code
- [x] i18n keys (nl.json + en.json)

---

## Phase 4: Login Updates (0.5 days) [COMPLETE ✅]

- [x] Login page: 3-tab system (parent | child | student)
- [x] StudentLoginForm component (teacher_code + student_code + PIN)
- [x] Register page: 2-tab system (parent | teacher)
- [x] Login page reads `?tab=child` query param to preselect tab

---

## Phase 5: Parent Child Mode Switch (0.5 days) [COMPLETE ✅]

- [x] Kindmodus knop in ParentNav.tsx
- [x] "Terug naar ouder" floating button in ChildNav.tsx
- [x] localStorage flag: practicehero_child_mode
- [x] **BUGFIX:** Server-side logout via /api/auth/logout (commit b6d74fd)
  - Client-side signOut() hing 10s door Browser Lock Manager bug
  - Cookies werden niet verwijderd → middleware redirect loop
  - Server-side route verwijdert sb-* cookies expliciet

---

## Phase 6: Existing Code Updates (1 day) [COMPLETE ✅]

- [x] practice.ts: startPracticeSession() met studio_id support
- [x] practice.ts: completePracticeSession() null-safe voor family_id
- [x] practice.ts: getTodayPracticeSeconds() — nieuw, voor cumulatieve tijdtracking
- [x] child.ts: getChildDashboard() — al null-safe
- [x] shop.ts: null-safe family_id in alle purchases
- [x] messages.ts: null-check voor teacher students zonder family
- [x] **BUGFIX:** PracticeSession.tsx laadt nu cumulatieve oefentijd op mount (commit 8d3c1df)

---

## Phase 7: Testing & Bug Fixes [IN PROGRESS 🔄]

### Auth Flow Tests
- [x] **GEFIXT:** Kindmodus-knop werkt (→ kind loginscherm)
- [x] **GEFIXT:** Uitloggen werkt (→ parent loginscherm)
- [x] **GEFIXT:** "Terug naar ouder" werkt (→ parent loginscherm)
- [ ] Register teacher → verify studio aangemaakt met teacher_code
- [ ] Create student → verify auth user + profile + teacher_students link
- [ ] Login als student met teacher_code + student_code + PIN
- [ ] Verify middleware stuurt teacher door naar /teacher/dashboard
- [ ] Verify student (child role) gaat naar /home

### UI/Feature Tests
- [ ] Teacher dashboard toont studenten en recente sessies
- [ ] Student toevoegen genereert student code
- [ ] Student detail pagina toont oefendata
- [ ] Cursus aanmaken + lessen toevoegen
- [x] **GEFIXT:** Practice tijd reset — laadt nu correct vanuit DB (commit 8d3c1df)

### Database Tests
- [ ] Verify migration 013 toepassen ('student' role enum)
- [ ] Check RLS policies: parent kan alleen eigen family data zien
- [ ] Check RLS policies: teacher kan alleen eigen studio data zien
- [ ] Test RPC functions (generate codes, lookup by codes)

### Security Tests
- [ ] Parent kan GEEN data van andere families zien
- [ ] Teacher kan GEEN studenten van andere studios zien
- [ ] Kind kan GEEN parent routes bereiken
- [ ] Student kan GEEN cursussen zien waar ze niet aan deelnemen

### Multi-User Tests
- [ ] 2 teachers aanmaken → verificeer studios los van elkaar
- [ ] Studenten onder elke teacher → verificeer isolatie
- [ ] Parent + student (zelfde kind) → beide zien oefendata

---

## Openstaande Taken (Bugfixes & Verbeteringen)

### Must Fix
- [ ] **Migration 013 toepassen** — voeg 'student' toe aan user_role ENUM
  ```sql
  ALTER TYPE user_role ADD VALUE 'student';
  ```
  (Kan via Supabase dashboard: SQL Editor)

### Nice to Have
- [ ] Uitlog-bevestiging toevoegen (modal "Weet je zeker dat je wilt uitloggen?")
- [ ] Betere error handling bij server-side logout failures
- [ ] Teacher module: student kan niveau/les aanpassen
- [ ] Admin panel: gebruikersbeheer verfijnen

---

## Bekende Bugs (Opgelost)

| Bug | Commit | Beschrijving |
|-----|--------|--------------|
| Kindmodus hangt | b6d74fd | Browser Lock Manager timeout → server-side logout |
| Uitloggen hangt | b6d74fd | Zelfde root cause, zelfde fix |
| Practice reset 15m | 8d3c1df | getTodayPracticeSeconds() op mount |
| Terug naar ouder hangt | b6d74fd | Zelfde root cause als kindmodus |
| URL encoding redirect | b6d74fd | encodeURIComponent voor ?tab=child param |

> Zie **KNOWN_ISSUES.md** voor volledige details per bug.

---

## Progress Tracking

### Voltooid
- [x] Codebase verkenning
- [x] Architectuur design & beslissingen
- [x] Implementatieplan gedocumenteerd
- [x] Phase 1: Database (migrations, RLS, RPC functions)
- [x] Phase 2: Authentication (teacher/student registratie, login flows)
- [x] Phase 3: Teacher UI (dashboard, students, courses, settings)
- [x] Phase 4: Login Updates (3-tab systeem, StudentLoginForm)
- [x] Phase 5: Parent Child Mode Switch (Kindmodus knop, localStorage)
- [x] Phase 6: Nullable family_id Support (startPracticeSession, messages)
- [x] Bugfix: Auth logout/kindmodus (server-side route)
- [x] Bugfix: Practice tijd tracking (cumulatieve loading)

### In Progress
- [ ] Phase 7: Volledig testen van teacher module
- [ ] Migration 013 toepassen op productie

### Nog te doen
- [ ] Verdere iteraties op basis van gebruikers feedback

---

## Quick Start voor Volgende Sessie

1. Lees **KNOWN_ISSUES.md** — weet wat NIET te doen bij auth
2. Check **CLAUDE.md** — kritische technische kennis
3. Begin met Migration 013 (student role enum)
4. Ga dan door met Phase 7 tests (teacher module)
5. Test elke phase voor je verder gaat

**Productie URL:** https://practicehero.vercel.app
**Local dev:** `npm run dev` → localhost:3000
