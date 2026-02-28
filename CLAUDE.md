# PracticeHero - Project Context for Claude Code

## 🤖 **RECOMMENDED MODEL: SONNET**
> **Why Sonnet?** This is a complex full-stack project (Next.js, TypeScript, Supabase, database design, middleware, authentication). Sonnet provides the right balance of capability and efficiency for implementation work. NOT Haiku (too limited), NOT Opus (overkill cost).

---

## What Is This Project?

**PracticeHero** is a music practice motivation app for families and music teachers. It helps children maintain consistent practice habits through gamification (streaks, points, achievements, shop system) while giving parents and teachers insight into progress.

**Current Status:** Core features complete (practice tracking, streaks, points, achievements, shop, messages). Ready for two major new features.

---

## Current Architecture (Quick Reference)

### Tech Stack
- **Next.js 16.1.6** (App Router, React 19)
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL, Auth)
- **shadcn/ui + Tailwind CSS 4**
- **next-intl** (Dutch/English i18n)
- **Zustand** (state), **React Query** (data), **Framer Motion** (animations)
- **PWA ready** (service worker, manifest)

### Database Model
- **families** ← parents
- **profiles** (parent | child) ← Supabase Auth users
- **practice_sessions** ← tracking (15-min daily goal)
- **streaks** ← gamification (active/recovery/broken states)
- **points**, **super_credits** ← economy
- **shop_items**, **purchases** ← rewards
- **achievements** ← badges
- **messages** ← parent→child communication
- **RLS:** family-scoped (row-level security enforces multi-tenant isolation)

### Routes
```
(auth)   ← /login (parent email + child PIN), /register, /forgot-password
(child)  ← /home, /practice/[instrumentId], /shop, /achievements, /messages
(parent) ← /dashboard, /children, /inbox, /settings
```

### Key Patterns
1. **Server components** fetch data directly in pages
2. **Server actions** in `src/lib/actions/` handle mutations
3. **Middleware** enforces auth, role-based routing, locale
4. **Admin client** used for sensitive ops (auth creation, code generation)

---

## ACTIVE WORK: Two New Features

### Feature 1: Parent "Child Mode" Switch ⏱️ 0.5 days
Parent logs in → clicks "Kindmodus" → signs out → child PIN login. Child can then click "Terug naar ouder" to return.
**Status:** Design complete, ready to implement
**Files to modify:** ParentNav.tsx, ChildNav.tsx, login/page.tsx, i18n

### Feature 2: Teacher (Docent) Module ⏱️ 5-7 days
Teachers create accounts, configure courses (lessons 1-10 at levels 1-10), create students with unique codes (T-XXXX + S-XXXX), students log in and practice. **Critical:** A child can be BOTH a family child AND a teacher's student with SHARED practice data.
**Status:** Architecture designed, migration documented, ready to build
**Database:** 4 new tables (studios, courses, course_lessons, teacher_students)
**Routes:** New (teacher) group with dashboard, students, courses, settings

---

## Documentation Files

**READ THESE FIRST:**
1. **IMPLEMENTATION_PLAN.md** — Full design spec, database schema, code examples, all architectural decisions
2. **TODO.md** — Task checklist, 7 phases, quick progress tracker
3. **This file (CLAUDE.md)** — Quick reference, what you need to know

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
   - Open `IMPLEMENTATION_PLAN.md` → see full spec

3. **Quick facts to remember:**
   - Teachers need new role in `user_role` ENUM ('parent' | 'child' | 'teacher')
   - `profiles.family_id` becomes nullable (teacher-only students have no family)
   - `practice_sessions` gets optional `studio_id` field
   - RLS policies need to extend for teacher access
   - Students use login tab 3: teacher_code + student_code + PIN

4. **Key existing patterns to follow:**
   - Child creation → `/lib/actions/auth.ts` addChild() function
   - Parent routes → `/(parent)` route structure
   - Server actions → all mutations use `createClient()` or `createAdminClient()`
   - RLS policies → see migrations 001-008.sql

---

## Critical Files to Know

### Database & Types
- `/supabase/migrations/` ← SQL schema (001-008 exist, 009 to be created)
- `/src/types/database.ts` ← TypeScript interfaces for all tables

### Authentication
- `/src/lib/actions/auth.ts` ← registerParent, loginParent, loginChild, addChild
- `/middleware.ts` ← role-based routing, session refresh
- `/src/app/[locale]/(auth)/` ← login, register pages

### Core Features
- `/src/lib/actions/practice.ts` ← session logic, 15-min goal, points
- `/src/lib/actions/family.ts` ← family/parent data
- `/src/lib/actions/child.ts` ← child dashboard data

### UI
- `/src/components/layout/ParentNav.tsx` ← parent navbar (will add Kindmodus button)
- `/src/components/layout/ChildNav.tsx` ← child navbar (will add Back button)
- `/src/app/[locale]/(parent)/` ← parent dashboard structure
- `/src/app/[locale]/(child)/` ← child dashboard structure

### i18n
- `/messages/nl.json` ← Dutch translations
- `/messages/en.json` ← English translations
- `/i18n/routing.ts` ← locale config

---

## Database Migration Checklist (Phase 1)

```sql
-- Main additions needed:
ALTER TYPE user_role ADD VALUE 'teacher';          -- ✓ Documented
CREATE TABLE studios (...);                         -- ✓ Documented
CREATE TABLE courses (...);                         -- ✓ Documented
CREATE TABLE course_lessons (...);                  -- ✓ Documented
CREATE TABLE teacher_students (...);                -- ✓ Documented
ALTER TABLE profiles ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE practice_sessions ADD COLUMN studio_id UUID;
-- Full migration in IMPLEMENTATION_PLAN.md section 2.2
```

---

## Testing Checklist

### Feature 1 (Child Mode)
- [ ] Parent clicks "Kindmodus" → logout + child login appears
- [ ] Child logs in with PIN
- [ ] "Terug naar ouder" button appears
- [ ] Click it → logout + parent login appears

### Feature 2 (Teacher Module)
- [ ] Teacher registers → studio created with teacher_code
- [ ] Teacher adds student → student_code generated
- [ ] Student logs in with teacher_code + student_code + PIN
- [ ] Teacher sees student's practice data
- [ ] Middleware routes teacher to /teacher/dashboard
- [ ] RLS policies enforce isolation (teacher can't see other studios)

---

## Quick Links

- **App Root:** `/Users/Andre/Claude - Projects/practicehero`
- **Dev Server:** `npm run dev` → localhost:3000
- **Supabase:** Project URL in .env.local (NEXT_PUBLIC_SUPABASE_URL)
- **Database Docs:** See IMPLEMENTATION_PLAN.md section 2.2
- **Auth Docs:** See IMPLEMENTATION_PLAN.md section 2.4

---

## Context for Claude AI

When you resume:
1. You have full memory via `IMPLEMENTATION_PLAN.md` (all decisions, schema, code examples)
2. You have task tracking via `TODO.md` (check off boxes, see progress)
3. You have quick facts in this file (what to remember)
4. **Do NOT re-explore the codebase** — it's already mapped in the context files
5. **Start Phase 1** (database migration) when ready

**Cost:** Using token budget to store detailed implementation spec (more efficient than re-exploring each session)

---

## Session History

### Session 1 (2026-02-28)
- [x] Explored full codebase (routes, auth, UI, database)
- [x] Designed Feature 1: Parent Child Mode Switch
- [x] Designed Feature 2: Teacher Module (full spec)
- [x] Created IMPLEMENTATION_PLAN.md (full design doc)
- [x] Created TODO.md (task checklist)
- [x] Created this CLAUDE.md (quick reference)

### Session 2+ (Future)
- Start with Phase 1 (database migration)
- Follow TODO.md for task tracking
- Refer to IMPLEMENTATION_PLAN.md for any design questions
- Refer to existing code for patterns

---

**Last Updated:** 2026-02-28
**Plan Status:** ✅ Approved & Documented
**Ready to Implement:** YES
**Estimated Duration:** 5-7 days
