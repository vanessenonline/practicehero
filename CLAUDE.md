# PracticeHero - Project Context for Claude Code

## 🤖 **RECOMMENDED MODEL: SONNET**
> **Why Sonnet?** This is a complex full-stack project (Next.js, TypeScript, Supabase, database design, middleware, authentication). Sonnet provides the right balance of capability and efficiency for implementation work. NOT Haiku (too limited), NOT Opus (overkill cost).

---

## ⚠️ CRITICAL TECHNICAL KNOWLEDGE — READ BEFORE TOUCHING AUTH

### Supabase signOut() is BROKEN in the browser

**The Problem:**
`supabase.auth.signOut()` in the browser calls the Browser Lock Manager API
(`Navigator.locks.request()`). This call **hangs for 10 full seconds** before
timing out. Even with a `Promise.race()` workaround, the session cookies are
**NOT cleared** when signOut times out. The Next.js middleware then reads the
still-valid cookies, sees an authenticated user, and **redirects them back to
the dashboard** — making logout and child mode completely non-functional.

**THE FIX — always use the server-side logout route:**
```typescript
// ❌ NEVER do this in ParentNav or ChildNav:
await supabase.auth.signOut()           // hangs 10s, cookies NOT cleared
router.push('/nl/login')                // middleware redirects back!

// ✅ ALWAYS do this instead:
window.location.href = `/api/auth/logout?redirect=/${locale}/login`
// This hits the server-side route which properly deletes all sb-* cookies
```

**Server-side logout route:** `src/app/api/auth/logout/route.ts`
- Calls signOut() server-side (no Lock Manager issue on server)
- Explicitly deletes all `sb-*` cookies in the response
- Redirects to specified URL via `?redirect=` query param

**For child mode (redirect with query params, must URL-encode):**
```typescript
window.location.href = `/api/auth/logout?redirect=${encodeURIComponent(`/${locale}/login?tab=child`)}`;
```

### Middleware Redirect Logic (middleware.ts)
- Reads Supabase session from **HTTP-only cookies** (not localStorage)
- Authenticated users are **ALWAYS redirected away** from public routes (login, register)
- This is why client-side signOut that doesn't clear cookies causes an infinite redirect loop
- Role-based routing: parent → /dashboard, child → /home, teacher → /teacher/dashboard

---

## What Is This Project?

**PracticeHero** is a music practice motivation app for families and music teachers. It helps children maintain consistent practice habits through gamification (streaks, points, achievements, shop system) while giving parents and teachers insight into progress.

**Current Status:** Core features complete + Teacher module complete + Child mode complete. Phase 7 (testing + bug fixes) in progress.

---

## Current Architecture (Quick Reference)

### Tech Stack
- **Next.js 16.1.6** (App Router, React 19)
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL, Auth, @supabase/ssr v0.8.0)
- **shadcn/ui + Tailwind CSS 4**
- **next-intl** (Dutch/English i18n)
- **Zustand** (state), **React Query** (data), **Framer Motion** (animations)
- **PWA ready** (service worker, manifest)

### Database Model
- **families** ← parents
- **profiles** (parent | child | teacher) ← Supabase Auth users — `family_id` is NULLABLE (teachers have no family)
- **practice_sessions** ← tracking (15-min daily goal) — has optional `studio_id`
- **streaks** ← gamification (active/recovery/broken states)
- **points**, **super_credits** ← economy
- **shop_items**, **purchases** ← rewards
- **achievements** ← badges
- **messages** ← parent→child communication
- **studios** ← teacher's studio with `teacher_code`
- **courses** ← lesson plans per instrument
- **course_lessons** ← individual lessons per level
- **teacher_students** ← links students to studio
- **RLS:** family-scoped + teacher-scoped (row-level security enforces multi-tenant isolation)

### Routes
```
(auth)    ← /login (3 tabs: parent | child | student), /register (parent|teacher), /forgot-password
(child)   ← /home, /practice/[instrumentId], /shop, /achievements, /messages
(parent)  ← /dashboard, /children, /inbox, /settings
(teacher) ← /teacher/dashboard, /teacher/students, /teacher/courses, /teacher/settings
admin     ← /admin (separate route group)
api       ← /api/auth/callback, /api/auth/logout ← CRITICAL (see above)
```

### Key Patterns
1. **Server components** fetch data directly in pages
2. **Server actions** in `src/lib/actions/` handle mutations
3. **Middleware** enforces auth, role-based routing, locale (reads cookies, NOT localStorage)
4. **Admin client** used for sensitive ops (auth creation, code generation)
5. **Server-side logout** via `/api/auth/logout` — never use client-side signOut() for navigation

---

## Feature Status

### ✅ Feature 1: Parent "Child Mode" Switch — COMPLETE
- Parent clicks "👶 Kindmodus" in ParentNav → `window.location.href` to `/api/auth/logout?redirect=.../login?tab=child`
- Child logs in with PIN → sees "← Terug naar ouder" floating button (top-left)
- Button only visible when `localStorage.practicehero_child_mode === "true"`
- Clicking it → `window.location.href` to `/api/auth/logout?redirect=.../login`
- Parent sees login page and can log back in

### ✅ Feature 2: Teacher (Docent) Module — COMPLETE
- Teachers register → studio created with unique `teacher_code` (T-XXXX)
- Teacher creates students → unique `student_code` (S-XXXX) generated per student
- Students log in with teacher_code + student_code + PIN
- Teacher sees all student practice data
- Middleware routes teacher to /teacher/dashboard
- RLS policies enforce studio isolation

### ✅ Feature 3: Practice Time Tracking Fix — COMPLETE
- `cumulativePriorSeconds` now loaded from DB on PracticeSession mount
- `getTodayPracticeSeconds()` server action queries completed sessions for today
- Child rounding: 2m20s = 2m practiced, 15m - 2m = 13m remaining (correct)

---

## Documentation Files

**READ THESE FIRST:**
1. **CLAUDE.md** (this file) — Critical technical knowledge, quick reference
2. **TODO.md** — Task checklist, 7 phases, quick progress tracker
3. **KNOWN_ISSUES.md** — What went wrong and why, lessons learned
4. **IMPLEMENTATION_PLAN.md** — Full design spec, database schema, code examples

---

## How to Resume Work

### When Returning to This Project

1. **Run the app:**
   ```bash
   cd /Users/Andre/Claude - Projects/practicehero
   npm run dev  # Runs on localhost:3000
   ```

2. **Check progress:**
   - Open `TODO.md` → see what phase you're on
   - Open `KNOWN_ISSUES.md` → know what NOT to do
   - Open `IMPLEMENTATION_PLAN.md` → see full spec

3. **Quick facts to remember:**
   - Teachers need role 'teacher' in `user_role` ENUM (migration 009 applied)
   - `profiles.family_id` is nullable (teacher-only students have no family)
   - `practice_sessions` has optional `studio_id` field
   - RLS policies use both family_id AND studio_id scoping
   - Students use login tab 3: teacher_code + student_code + PIN
   - **Logout ALWAYS goes via `/api/auth/logout`** — never client-side signOut()

4. **Key existing patterns to follow:**
   - Child creation → `/lib/actions/auth.ts` addChild() function
   - Parent routes → `/(parent)` route structure
   - Server actions → all mutations use `createClient()` or `createAdminClient()`
   - RLS policies → see migrations 001-012.sql
   - **Logout → `/api/auth/logout?redirect=...`** (see src/app/api/auth/logout/route.ts)

---

## Critical Files to Know

### Auth & Session (CRITICAL)
- `/src/app/api/auth/logout/route.ts` ← **Server-side logout** — clears sb-* cookies
- `/src/app/api/auth/callback/route.ts` ← OAuth/email confirmation callbacks
- `/src/lib/supabase/middleware.ts` ← Session refresh + cookie handling
- `/src/lib/supabase/server.ts` ← Server-side Supabase client
- `/src/providers/SupabaseProvider.tsx` ← Client-side auth context
- `/middleware.ts` ← Role-based routing, reads cookies

### Navigation (Where Logout Lives)
- `/src/components/layout/ParentNav.tsx` ← Has Kindmodus + Logout (both use server-side logout)
- `/src/components/layout/ChildNav.tsx` ← Has "Terug naar ouder" button (uses server-side logout)
- `/src/components/layout/TeacherNav.tsx` ← Teacher navigation

### Database & Types
- `/supabase/migrations/` ← SQL schema (001-012 applied to production, 013 pending)
- `/src/types/database.ts` ← TypeScript interfaces for all tables

### Authentication Actions
- `/src/lib/actions/auth.ts` ← registerParent, loginParent, loginChild, addChild, registerTeacher, loginStudent, createStudio
- `/src/lib/actions/teacher.ts` ← 15+ teacher-specific server actions

### Core Features
- `/src/lib/actions/practice.ts` ← session logic, 15-min goal, points, `getTodayPracticeSeconds()`
- `/src/lib/actions/family.ts` ← family/parent data
- `/src/lib/actions/child.ts` ← child dashboard data

### i18n
- `/messages/nl.json` ← Dutch translations (primary)
- `/messages/en.json` ← English translations

---

## Known Issues & Gotchas

> See **KNOWN_ISSUES.md** for full details. Summary:

1. **Supabase Browser Lock Manager** — signOut() hangs 10s → use server-side `/api/auth/logout`
2. **Middleware redirect loop** — incomplete signOut → cookies remain → middleware redirects back
3. **Practice time reset** — fixed: `getTodayPracticeSeconds()` called on mount
4. **Migration 013** — adds 'student' role enum value — not yet applied to production

---

## Session History

### Session 1 (2026-02-28)
- [x] Explored full codebase (routes, auth, UI, database)
- [x] Designed Feature 1: Parent Child Mode Switch
- [x] Designed Feature 2: Teacher Module (full spec)
- [x] Created IMPLEMENTATION_PLAN.md (full design doc)
- [x] Created TODO.md (task checklist)
- [x] Created this CLAUDE.md (quick reference)

### Session 2 (2026-02-28 → 2026-03-01)
- [x] Implemented Phase 1-6 (database, auth, teacher UI, login updates, child mode, nullable family_id)
- [x] Deployed to Vercel production
- [x] Phase 7 testing started

### Session 3 (2026-03-01)
- [x] Debugged Kindmodus button (Browser Lock Manager timeout)
- [x] Fixed signOut with Promise.race 3s timeout in ParentNav + ChildNav
- [x] Discovered root cause: cookies NOT cleared even after timeout
- [x] Created server-side `/api/auth/logout` route (proper fix)
- [x] Fixed practice time tracking (getTodayPracticeSeconds on mount)
- [x] Fixed "Terug naar ouder" button in ChildNav
- [x] All nav components now use server-side logout
- [x] Updated all documentation

### Next Session
- Start by reading **KNOWN_ISSUES.md** and **TODO.md**
- Migration 013 still pending (add 'student' role to enum)
- Continue Phase 7 testing with working auth flows

---

**Last Updated:** 2026-03-01
**Plan Status:** ✅ Core features complete, bug fixes applied
**Auth Status:** ✅ Server-side logout working correctly
**Ready to Continue:** Phase 7 testing
