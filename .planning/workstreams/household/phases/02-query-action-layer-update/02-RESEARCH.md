# Phase 2: Query + Action Layer Update — Research

**Researched:** 2026-04-16
**Domain:** Next.js 16 App Router multi-tenancy retrofit — URL-scoped routing, layout chokepoint with React `cache()`, Prisma 7 nested-relation filtering, Server Action live membership enforcement
**Confidence:** HIGH

## Summary

Phase 2 carries one high-leverage technical decision (D-03): a Next.js 16 layout file at `src/app/(main)/h/[householdSlug]/layout.tsx` runs `resolveHouseholdBySlug` + `requireHouseholdAccess` once, stores the rich `{ household, member, role }` object behind a React `cache()`-wrapped `getCurrentHousehold()` helper, and nested Server Components read it without re-querying. React `cache()` is request-scoped (not cross-request) [VERIFIED: Context7 `/vercel/next.js` `06-fetching-data.mdx`], which gives the "called once per request" property for free without violating D-18's live-DB-check requirement.

Server Actions execute in a different render-tree context than Server Components, so the React `cache()` memoization does NOT cross the Action↔Component boundary. Per D-04, this is the desired behavior: every mutating action redundantly calls `requireHouseholdAccess(householdId)` (live DB hit) — guaranteeing stale-JWT defense (Pitfall 16). The cache is purely a performance optimization for the read path within a single page render.

Three secondary findings shape planning:
1. **The codebase is currently type-broken** for Plant/Room queries — Phase 1 dropped `Plant.userId` and `Room.userId` from the schema, but every feature module still references them. Phase 2 is *load-bearing* — without it the app does not compile [VERIFIED: codebase grep + schema diff].
2. **Next.js 16 `revalidatePath` requires the `'page' | 'layout'` type parameter for dynamic segments** [VERIFIED: Context7 `/vercel/next.js` `revalidatePath.mdx`]. Every action's `revalidatePath('/dashboard')` becomes `revalidatePath('/h/[householdSlug]/dashboard', 'page')` — note the literal `[householdSlug]` token, NOT the resolved slug.
3. **The `HouseholdMember.isDefault` column does not yet exist** in `prisma/schema.prisma` (verified inline). Phase 2 must add it as `Boolean @default(false)` via an additive Prisma migration [VERIFIED: schema inspection].

**Primary recommendation:** Execute the move in this order — (Wave 0) `isDefault` migration + test scaffold, (Wave 1) household chokepoint (`getCurrentHousehold`, layout, slug-resolver enrich) + `createHousehold` + `getUserHouseholds`, (Wave 2) feature query+action migration in parallel (5 modules) + legacy redirect stubs + login landing target, (Wave 3) MainLayout move + dashboard/plants/rooms move under `/h/[slug]/` + reminder query signature update with stub assignee field, (Wave 4) cross-household isolation tests + ForbiddenError tests for all 13 actions + integration tests for createHousehold/getUserHouseholds. Treat the layout-tier file move and the query/action rewrite as a single atomic commit per feature module — partial commits leave the build red.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Household plumbing & URL layer**
- **D-01:** Ship the `/h/[householdSlug]/` URL prefix in Phase 2. Elevation from ROADMAP Phase 6 to prevent a double move; Pitfall 17's intent honored in spirit.
- **D-02:** All `src/app/(main)/...` routes move under `src/app/(main)/h/[householdSlug]/...` in one cut-over. Scope: `dashboard/`, `plants/`, `plants/[id]/`, `rooms/`, `rooms/[id]/`, and any nested pages. Legacy paths (`/dashboard`, `/plants`, `/rooms`, etc.) keep a thin redirect stub that resolves `session.user.activeHouseholdId` → `household.slug` and `redirect()`s to `/h/[slug]/<suffix>`. One-shot bridge; removable later.
- **D-03:** The household authorization chokepoint is `src/app/(main)/h/[householdSlug]/layout.tsx`. The layout resolves the slug via `resolveHouseholdBySlug`, calls `requireHouseholdAccess(household.id)`, and stores the result behind a React `cache()`-wrapped helper (tentatively `getCurrentHousehold()` exported from `src/features/household/context.ts`). Nested Server Components and pages read the cached `{ household, member, role }` without repeating the DB round-trip. 404 when slug is unknown; 403 (`ForbiddenError`) when user is not a member.
- **D-04:** Server Actions receive `householdId` as an explicit argument, threaded via `<input type="hidden" name="householdId">` rendered by server-component forms. The first line of every mutating action is `await requireHouseholdAccess(householdId)` — live DB check on every invocation (Pitfall 16; D-18 enforced). No derive-from-entity, no JWT-read fallback, no implicit context.
- **D-05:** Middleware (`proxy.ts`) stays as-is: edge session check only. It cannot replace the guard because (a) it cannot return the rich `{ household, member, role }` object downstream code needs, (b) a DB-backed membership check from edge would either require `@prisma/adapter-pg` retooling or JWT-cached memberships (latter violates D-14/D-18), and (c) Auth.js v5 guidance recommends middleware for optimistic session checks and delegating real authorization to Server Components/Actions.

**HSLD-02: create household**
- **D-06:** `createHousehold(data)` Server Action ships in `src/features/household/actions.ts`. Uses `db.$transaction` to insert `Household` + `HouseholdMember(role='OWNER', rotationOrder=0)`. Slug via `generateHouseholdSlug` from `src/lib/slug.ts`. Default timezone = caller's browser-detected timezone; default cycleDuration = 7; rotationStrategy = `sequential`. Returns `{ household }` or `{ error }`.
- **D-07:** No UI in Phase 2. The action is reachable only from tests until Phase 6. Integration test asserts: transaction atomicity, unique-slug correctness, OWNER role assignment, rotationOrder default.

**HSLD-03: list my households**
- **D-08:** `getUserHouseholds(userId)` query ships in `src/features/household/queries.ts`. Returns `Array<{ household: Household, role: 'OWNER' | 'MEMBER', isDefault: boolean, joinedAt: Date }>`, sorted by `joinedAt` ascending so the auto-created solo household appears first. `isDefault` reads the forthcoming `HouseholdMember.isDefault` column — if not present from Phase 1, Phase 2 adds it as a nullable Boolean with default `false`.
- **D-09:** No UI in Phase 2.

**Query-layer migration**
- **D-10:** Every `where: { userId }` clause in `src/features/{plants,rooms,watering,notes,reminders}/queries.ts` swaps to `where: { householdId }` (direct for Plant/Room; nested `plant: { householdId }` for WateringLog/Note/Reminder which reach household via their plant relation). Query function signatures change from `(userId: string, ...)` to `(householdId: string, ...)`. Callers (pages) supply `householdId` from `getCurrentHousehold().household.id`.
- **D-11:** No backward-compatibility shims. `userId` parameters are removed outright. The audit columns (`createdByUserId` / `performedByUserId`) are populated at write sites from `session.user.id` — pure audit, never used in query filters.

**Action-layer migration**
- **D-12:** Every mutating Server Action in `src/features/{plants,rooms,watering,notes,reminders}/actions.ts` is rewritten to:
  1. `auth()` → reject if no session
  2. Demo-mode guard: `if (session.user.isDemo) return { error: "..." }`
  3. Zod parse — now accepting `householdId: z.string().cuid()`
  4. `await requireHouseholdAccess(householdId)` — throws `ForbiddenError` on miss
  5. For mutations on existing entities: `db.X.findFirst({ where: { id, householdId } })` before update/delete
  6. Write — populate `createdByUserId` / `performedByUserId` from `session.user.id`
  7. `revalidatePath` as before, but paths now `/h/[slug]/<suffix>`
- **D-13:** The `createPlant` action also updates the nested `reminders: { create: { userId: ..., enabled: true } }` pattern — Reminder still carries the creator's userId (per-user-per-plant preference). Reminder's relationship to household is transitively via `plant.householdId`.

**Reminders interface (Phase 5 coordination)**
- **D-14:** `getReminderCount(householdId)` and `getReminderItems(householdId)` signatures are stable across Phase 2 → Phase 5. Phase 2 body: `{ where: { plant: { householdId }, enabled: true } }`. Phase 5 modifies the same function body to add the active Cycle join and `assignedUserId === session.user.id` gate. Callers do not change. Satisfies Pitfall 13.
- **D-15:** Phase 2 UX behavior: every member sees the same household-level reminder count. Deliberate temporary regression — roommates get false-positive "due today" banners until Phase 5.

**Test strategy**
- **D-16:** Cross-household read isolation proved via unit tests with mocked Prisma. For each of the 5 feature query modules, tests assert that `db.X.findMany`/`findFirst` was called with `where: { householdId: <expected> }`. Mock via `vi.mock('@/lib/db')`.
- **D-17:** Every mutating Server Action gets a dedicated Forbidden test asserting a non-member triggers `ForbiddenError`. Minimum 13 tests: `createPlant`, `updatePlant`, `archivePlant`, `unarchivePlant`, `deletePlant`, `logWatering`, `editWateringLog`, `deleteWateringLog`, `createRoom`, `updateRoom`, `deleteRoom`, `createNote`, `deleteNote`. Add `snoozeReminder`/`snoozeCustomReminder`/`togglePlantReminder` if those exist.
- **D-18:** `createHousehold` and `getUserHouseholds` get integration tests (real Prisma test DB, same pattern as Phase 1 `tests/household.test.ts`). Create asserts transactional invariants; list asserts a user with two memberships returns both with correct roles.

### Claude's Discretion

- Exact file layout for the React `cache()` helper (`src/features/household/context.ts` vs extending `guards.ts`) and the consumer function name (`getCurrentHousehold()` is a placeholder).
- Legacy-path redirect implementation: single `src/app/(main)/layout.tsx` redirect vs one redirect `page.tsx` per legacy route segment. Either works.
- Null/undefined `session.user.activeHouseholdId` edge case handling at the legacy-path redirect and at login landing — probably redirect to `/login` since Phase 1 guarantees every authenticated user has a membership, but document the fallback.
- Login post-authentication landing target: `auth.config.ts:22` currently hardcodes `/dashboard`. This probably needs to become `/h/[activeSlug]/dashboard`; the slug lookup path (redirect page vs `redirect` callback vs post-login client navigation) is a planning-time call.
- Whether `updateTimezone` (`src/features/auth/actions.ts:104`) needs to move to or mirror in `src/features/household/actions.ts` as `updateHouseholdTimezone` — since household now owns the timezone, the user-level timezone column may be redundant. Planner to audit.
- Test-file organization: one `tests/phase-02/cross-household-isolation.test.ts` or per-feature `tests/<feature>-authz.test.ts`. Pick whatever keeps runs fast.
- Whether to address the advisory warnings from Phase 1 review (WR-01 JWT null/undefined, WR-03 role cast) opportunistically in this phase since consumers now materialize, or defer to a cleanup phase.

### Deferred Ideas (OUT OF SCOPE)

- **Household switcher UI and settings page** — Phase 6 (HSET-01, HSET-03).
- **Default-household selection UI (HSET-02)** — Phase 6. Phase 2 surfaces `isDefault` on `getUserHouseholds` but has no write path for it.
- **Assignee-scoped reminder gating** — Phase 5. Phase 2 leaves reminder surface fully household-scoped.
- **Demo-household seeding** — Phase 7. Demo-mode `isDemo` checks stay verbatim.
- **Real-DB integration tests for cross-household read isolation** — rejected; mocked-Prisma + ForbiddenError tests on every mutating action are the chosen safety net.
- **Integration test for `updateTimezone`** — adjacent but not in scope; planner may opportunistically fix WR-04 (IANA validation).
- **JWT `activeHouseholdId` null/undefined normalization (WR-01)** — may bite legacy redirects; planner decides whether to normalize at the callback or at consumer sites.
- **Legacy path cleanup** — redirect stubs stay indefinitely for bookmark compatibility.
- **Entity-derive action contract** — rejected in favor of explicit hidden-field arg.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HSLD-02 | User can create additional households from settings (becomes owner of each) | D-06: `createHousehold` Server Action with interactive `db.$transaction` (User + HouseholdMember(OWNER)); slug via `generateHouseholdSlug`; integration test pattern from Phase 1 `tests/household.test.ts`. UI deferred to Phase 6 — HSLD-02 is *partially* satisfied by this phase (data layer only); the requirement is checked-complete only when Phase 6 ships the form. Document this partial-satisfaction in the verification step. |
| HSLD-03 | User can view a list of all households they belong to, with their role in each | D-08: `getUserHouseholds(userId)` query returning `Array<{ household, role, isDefault, joinedAt }>` sorted by `joinedAt` asc. UI deferred to Phase 6 — HSLD-03 is also *partially* satisfied (data layer only). Phase 2 adds `HouseholdMember.isDefault` column if not present. |

**Note on partial satisfaction:** HSLD-02 and HSLD-03 cannot be checked-complete in REQUIREMENTS.md at Phase 2 closure because the user-facing surface ships in Phase 6. Phase 2's verification should record "data-layer satisfied; UI satisfied in Phase 6" so the traceability table remains honest.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slug→household resolution | API/Backend (Server Component layout) | — | Reads from PostgreSQL; needs server-side DB access; runs once per request via React `cache()` |
| Household membership enforcement (`requireHouseholdAccess`) | API/Backend (Server Component / Server Action) | — | Live DB check; cannot be done in proxy.ts edge runtime (D-05); cannot be JWT-only (Pitfall 16) |
| Optimistic session check (logged-in vs not) | Edge (proxy.ts) | — | Auth.js v5 best practice — proxy.ts handles "is there a session?" only |
| URL routing / household scope segregation | Frontend Server (Next.js dynamic segment) | — | `[householdSlug]` is the URL contract; layout-tier code reads it |
| Plant/Room/Watering/Note/Reminder reads | API/Backend (Server Component direct Prisma) | Database | App-Router pattern — Server Components query Prisma directly with `where: { householdId }` |
| Plant/Room/Watering/Note/Reminder writes | API/Backend (Server Action) | Database | "use server" + Zod + Prisma writes; `revalidatePath` invalidates the layout cache |
| Form `householdId` propagation | Frontend Server (form HTML) | API/Backend (Server Action) | Hidden `<input>` rendered by server component, parsed in action |
| Legacy `/dashboard` → `/h/[slug]/dashboard` bridge | API/Backend (Server Component page that calls `redirect()`) | — | Reads `session.user.activeHouseholdId`, looks up slug, redirects |
| Cross-household data isolation guarantee | API/Backend (Prisma `where` clause) + Test (Vitest mock assertion) | — | Defense in depth: query filter + test that proves filter is present |
| Login post-auth redirect | Edge (proxy.ts `authorized` callback) OR Backend page (`/dashboard` redirect stub) | — | Either choice valid; recommendation in §Open Questions Q4 |

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.2 (project pin); 16.2.4 latest [VERIFIED: `npm view next version`] | App Router, Server Components, Server Actions, layout chokepoint, dynamic params | Project standard per CLAUDE.md; layout + React `cache()` is the canonical Next.js 16 chokepoint pattern |
| React | 19.2.4 | `cache()` per-request memoization, async Server Components | `cache()` is the React-native primitive for request-scoped dedup [CITED: react.dev/reference/react/cache] |
| Prisma | 7.7.0 [VERIFIED: `npm view @prisma/client version`] | Nested-relation `where` filter, `$transaction` interactive form | Project standard; v7 nested-relation filter syntax `{ plant: { householdId } }` works directly without `is:` wrapper [VERIFIED: Context7 `/prisma/prisma`] |
| NextAuth (Auth.js) | 5.0.0-beta.30 | `auth()` server-side session, JWT enrichment, `unstable_update` if needed | Already wired by Phase 1; stays |
| Zod | 4.x via `zod/v4` import | Schema parse for Server Action inputs incl. `householdId: z.string().cuid()` | Project standard per CLAUDE.md hard rule; existing `householdRoleSchema` already uses this path |
| date-fns | 4.x | `addDays` for nextWateringAt math (existing) | No change |

### Supporting (no new packages required)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react` `cache` import | bundled with React 19 | `import { cache } from 'react'` to wrap `getCurrentHousehold` | Wrap any function that needs per-request memoization across Server Components in the same render |
| `next/cache` `revalidatePath` | bundled with Next.js 16 | Invalidate cached page output after a mutation | Use type=`'page' \| 'layout'` parameter for paths with `[householdSlug]` dynamic segment |
| `next/navigation` `redirect`, `notFound` | bundled with Next.js 16 | Redirect from layout/page; 404 unknown slug | `notFound()` from layout when `resolveHouseholdBySlug` returns null |

**No new dependencies required.** Phase 2 is pure code refactor + new query/action functions on top of existing primitives.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React `cache()` for layout dedup | `unstable_cache` (Next.js cross-request) | Wrong primitive — cross-request cache would let a removed user keep seeing membership data; React `cache()` invalidates per request which is what D-18 demands |
| Custom `ForbiddenError` class | Next.js 16 `forbidden()` from `next/navigation` | `forbidden()` requires `experimental.authInterrupts: true` in `next.config.ts` and is canary-only as of April 2026 [VERIFIED: nextjs.org/docs/app/api-reference/config/next-config-js/authInterrupts]. Phase 1 already shipped the custom class with `Object.setPrototypeOf` — keep it |
| Nested `is: {}` wrapper for relation filter | Direct nested syntax `{ plant: { householdId } }` | Both work; direct syntax is cleaner and matches existing v1 code (e.g., `watering/queries.ts:159` uses `plant: { userId }` direct). Stick with direct |
| Hidden `<input type="hidden" name="householdId">` | `action={myAction.bind(null, householdId)}` | Hidden field works with both progressive enhancement AND react-hook-form's `register` flow. `bind` requires JS and breaks RHF integration. Hidden field is the canonical choice per D-04 |
| One layout-level redirect for all legacy paths | One `page.tsx` per legacy route | Layout-level redirect is cleaner if every child route should redirect; but legacy `/dashboard`, `/plants/[id]`, `/rooms/[id]` need different `<suffix>` mapping, so per-page redirect is more explicit. Recommendation: per-page (see Q19a) |

### Installation

No new packages. Verify lockfile is clean:
```bash
npm ci
npx prisma generate
```

If `HouseholdMember.isDefault` migration is added (D-08), run:
```bash
npx prisma migrate dev --name add_household_member_is_default
```

**Version verification (run during planning):**
```bash
npm view next version              # confirm 16.2.x range
npm view @prisma/client version    # confirm 7.7.0
npm view next-auth@beta version    # confirm v5 beta still active
npm view zod version               # confirm 4.x
```

## Architecture Patterns

### System Architecture Diagram

```
                                    INCOMING REQUEST
                                          │
                                          ▼
                      ┌────────────────────────────────────┐
                      │  proxy.ts (edge runtime, D-05)     │
                      │  • Session cookie check only       │
                      │  • Redirects unauthed → /login     │
                      │  • Does NOT verify household       │
                      └────────────────┬───────────────────┘
                                       │
                            ┌──────────┴──────────┐
                            │ authenticated?      │
                            └──────────┬──────────┘
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │  /h/[householdSlug]/layout.tsx (D-03)    │
                  │  ┌────────────────────────────────────┐  │
                  │  │ resolveHouseholdBySlug(slug)       │  │
                  │  │   ├ found? → continue              │  │
                  │  │   └ null?  → notFound() (404)      │  │
                  │  ├────────────────────────────────────┤  │
                  │  │ requireHouseholdAccess(id)         │  │
                  │  │   ├ member? → cache result         │  │
                  │  │   └ no?    → ForbiddenError (403)  │  │
                  │  ├────────────────────────────────────┤  │
                  │  │ React.cache() wraps the above as   │  │
                  │  │ getCurrentHousehold() —            │  │
                  │  │ memoized for the WHOLE REQUEST     │  │
                  │  └────────────────────────────────────┘  │
                  └────────────────┬─────────────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
      ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
      │ dashboard/page   │  │ plants/page      │  │ plants/[id]/page │
      │ getCurrentHouse  │  │ getCurrentHouse  │  │ getCurrentHouse  │
      │   hold() — CACHE │  │   hold() — CACHE │  │   hold() — CACHE │
      │   HIT (no DB)    │  │   HIT (no DB)    │  │   HIT (no DB)    │
      ├──────────────────┤  ├──────────────────┤  ├──────────────────┤
      │ getDashboardPlts │  │ getPlants        │  │ getPlant         │
      │ (householdId)    │  │ (householdId)    │  │ (id, householdId)│
      └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
               │                     │                     │
               ▼                     ▼                     ▼
      ┌─────────────────────────────────────────────────────────────┐
      │  Prisma queries with where: { householdId }  (D-10)         │
      │  WateringLog/Note/Reminder use { plant: { householdId } }   │
      └─────────────────────────────────────────────────────────────┘

  ────────────────────────────────────────────────────────────────────

                              FORM SUBMISSION
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │  Server Action (D-04)                    │
                │  ┌────────────────────────────────────┐  │
                │  │ 1. await auth() — session check    │  │
                │  │ 2. demo-mode guard                 │  │
                │  │ 3. zod parse incl householdId      │  │
                │  │ 4. await requireHouseholdAccess()  │  │  ← LIVE DB,
                │  │     (cache does NOT cross from     │  │    NOT cached
                │  │      Server Component context)     │  │
                │  │ 5. findFirst { id, householdId }   │  │
                │  │ 6. db.X.update / .create / .delete │  │
                │  │ 7. revalidatePath(/h/[slug]/..,    │  │
                │  │     'page' \| 'layout')             │  │
                │  └────────────────────────────────────┘  │
                └──────────────────────────────────────────┘

  ────────────────────────────────────────────────────────────────────

                       LEGACY PATH (/dashboard, /plants, /rooms)
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │  Legacy redirect page.tsx                │
                │  • read session.user.activeHouseholdId   │
                │  • if null → redirect("/login")          │
                │  • lookup slug from id                   │
                │  • redirect("/h/[slug]/<suffix>")        │
                │  (one-shot bridge for bookmarks)         │
                └──────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   └── (main)/
│       ├── h/
│       │   └── [householdSlug]/
│       │       ├── layout.tsx           # NEW — D-03 chokepoint
│       │       ├── error.tsx            # NEW — catches ForbiddenError
│       │       ├── not-found.tsx        # NEW — for unknown slug
│       │       ├── dashboard/
│       │       │   ├── page.tsx         # MOVED from (main)/dashboard/
│       │       │   └── loading.tsx      # MOVED
│       │       ├── plants/
│       │       │   ├── page.tsx         # MOVED
│       │       │   ├── loading.tsx      # MOVED
│       │       │   └── [id]/
│       │       │       └── page.tsx     # MOVED
│       │       └── rooms/
│       │           ├── page.tsx         # MOVED
│       │           ├── loading.tsx      # MOVED
│       │           └── [id]/
│       │               └── page.tsx     # MOVED
│       ├── dashboard/
│       │   └── page.tsx                 # NEW — legacy redirect stub
│       ├── plants/
│       │   ├── page.tsx                 # NEW — legacy redirect stub
│       │   └── [id]/
│       │       └── page.tsx             # NEW — legacy redirect stub
│       ├── rooms/
│       │   ├── page.tsx                 # NEW — legacy redirect stub
│       │   └── [id]/
│       │       └── page.tsx             # NEW — legacy redirect stub
│       ├── preferences/                 # UNCHANGED — not household-scoped
│       └── layout.tsx                   # KEEP — top nav, NotificationBell, etc.
└── features/
    └── household/
        ├── guards.ts                    # EXISTING (Phase 1)
        ├── queries.ts                   # EXTEND — add getUserHouseholds
        ├── actions.ts                   # NEW — createHousehold
        ├── schema.ts                    # EXTEND — add createHouseholdSchema
        └── context.ts                   # NEW — getCurrentHousehold (cache wrapper)
```

**On the `(main)` group nesting:** Next.js 16 supports route groups containing dynamic segments [VERIFIED: Context7 `/vercel/next.js` `revalidatePath.mdx` shows `/(main)/blog/[slug]` as a valid path]. The `(main)` group means the URL is `/h/abc12345/dashboard`, NOT `/(main)/h/abc12345/dashboard` — route groups are URL-invisible.

### Pattern 1: React `cache()` Wrapper for Per-Request Memoization

**What:** Wrap a function with React's `cache()` so multiple call sites within the same request return the same result without re-executing.
**When to use:** D-03 — `getCurrentHousehold()` called from layout, dashboard page, plant page, etc., should hit the DB once per request.
**Source:** [VERIFIED: Context7 `/vercel/next.js` `06-fetching-data.mdx`]

```typescript
// src/features/household/context.ts
import { cache } from "react";
import { resolveHouseholdBySlug } from "./queries";
import { requireHouseholdAccess } from "./guards";
import { notFound } from "next/navigation";

/**
 * Per-request cached: resolves slug → householdId → membership context.
 * Called from layout (mandatory) and from any nested Server Component
 * that needs the household. React.cache() ensures the DB round-trips
 * happen at most once per request.
 *
 * Per D-03/D-18: this is per-request, NOT cross-request — a user
 * removed mid-session sees the change on their next page load.
 */
export const getCurrentHousehold = cache(async (slug: string) => {
  const summary = await resolveHouseholdBySlug(slug);
  if (!summary) notFound();          // 404 — unknown slug
  return await requireHouseholdAccess(summary.id);
  // Returns { household, member, role } or throws ForbiddenError
});
```

**Important caveats:**
- React `cache()` scope is the React render tree of one request. It does NOT span Server Components ↔ Server Actions. An Action that calls `requireHouseholdAccess` again will hit the DB again — this is the correct behavior per D-18 (live check on every mutation).
- `cache()` is for Server Components (and helpers Server Components call) — using it in a Server Action is harmless but provides no benefit because each Action invocation is a separate request from React's POV.
- Using `notFound()` inside the cached function is fine — it throws a Next.js navigation control-flow error that the framework handles.

### Pattern 2: Next.js 16 Layout with Async Dynamic Params + Chokepoint

**What:** Layout file owns the household resolution + authorization. Pages below it never re-resolve.
**When to use:** D-03.

```typescript
// src/app/(main)/h/[householdSlug]/layout.tsx
import { getCurrentHousehold } from "@/features/household/context";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdSlug: string }>;  // Next.js 16: async params
}) {
  const { householdSlug } = await params;
  // Force the chokepoint: resolves slug, checks membership, caches result
  await getCurrentHousehold(householdSlug);
  return <>{children}</>;  // No nav UI here — that's in (main)/layout.tsx
}
```

Pages below it consume the cache:

```typescript
// src/app/(main)/h/[householdSlug]/dashboard/page.tsx
import { getCurrentHousehold } from "@/features/household/context";
import { getDashboardPlants } from "@/features/watering/queries";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ householdSlug: string }>;
}) {
  const { householdSlug } = await params;
  const { household } = await getCurrentHousehold(householdSlug);  // CACHE HIT
  const groups = await getDashboardPlants(household.id, todayStart, todayEnd);
  return <DashboardClient groups={groups} />;
}
```

**Caveats:**
- Layout's `params` is `Promise<...>` per Next.js 16 [CITED: Context7 `/vercel/next.js` `layout.mdx`]
- Awaiting `cookies()` or `headers()` inside `cache()`-wrapped functions is fine but is itself an async dynamic boundary. Keep cookie/header reads in the page that needs them.
- The layout MUST call `getCurrentHousehold` even though it doesn't use the return — that's how nested pages get the cache pre-populated. (Alternative: skip the layout call and let pages populate the cache, but then 404/403 would only fire when a page asks; centralizing it in the layout is the contract D-03 wants.)

### Pattern 3: Server Action with `householdId` Hidden Field + Live Check

**What:** D-04/D-12 canonical pattern.

```typescript
// src/features/plants/actions.ts (post-migration)
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createPlantSchema } from "./schemas";
import { requireHouseholdAccess } from "@/features/household/guards";
import { addDays } from "date-fns";

export async function createPlant(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (unchanged from v1)
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  // Step 3: Zod parse (schema now requires householdId)
  const parsed = createPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: LIVE membership check — Pitfall 16
  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  // Step 5+6: write with audit columns
  const now = new Date();
  const plant = await db.plant.create({
    data: {
      nickname: parsed.data.nickname,
      species: parsed.data.species ?? null,
      roomId: parsed.data.roomId ?? null,
      wateringInterval: parsed.data.wateringInterval,
      careProfileId: parsed.data.careProfileId ?? null,
      householdId: household.id,                         // D-10
      createdByUserId: session.user.id,                  // D-11 audit (AUDT-02)
      lastWateredAt: now,
      nextWateringAt: addDays(now, parsed.data.wateringInterval),
      reminders: {
        create: { userId: session.user.id, enabled: true },  // D-13 (per-user pref)
      },
    },
  });

  // Step 7: revalidatePath with type param (Next.js 16)
  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true, plantId: plant.id };
}
```

Schema update:
```typescript
// src/features/plants/schemas.ts
export const createPlantSchema = z.object({
  householdId: z.string().min(1),  // NEW — accepted from hidden field
  nickname: z.string().min(1).max(40),
  species: z.string().optional(),
  // ... rest unchanged
});
```

Form binding (Server Component renders the hidden field):
```tsx
// in some Server Component
import { getCurrentHousehold } from "@/features/household/context";

export async function PlantForm({ householdSlug, ...props }: Props) {
  const { household } = await getCurrentHousehold(householdSlug);  // CACHE HIT
  return (
    <form action={createPlant}>
      <input type="hidden" name="householdId" value={household.id} />
      <input name="nickname" required />
      {/* ... */}
      <button type="submit">Add plant</button>
    </form>
  );
}
```

**Caveat for react-hook-form integration:** When using RHF, register the hidden field via `register("householdId")` with a `defaultValue` from the form's `defaultValues` prop. The hidden field still appears in the DOM. Existing `add-plant-dialog.tsx` likely uses RHF — confirm during planning that the dialog can accept `householdId` as a prop and pass it via `defaultValues` to RHF.

### Pattern 4: Prisma Nested-Relation Filter (D-10)

**What:** Filter by a column on a related table without an explicit join.
**Source:** [VERIFIED: Context7 `/prisma/prisma` "Filtering Data with Where Conditions"]

```typescript
// Direct relation filter — preferred (also matches existing v1 idiom)
await db.wateringLog.findMany({
  where: {
    plantId,                          // optional narrow
    plant: { householdId },           // ← relation filter; one-to-one nav
  },
});

// Equivalent verbose form (NOT necessary for one-to-one):
await db.wateringLog.findMany({
  where: { plant: { is: { householdId } } },
});
```

For one-to-many relations, use `some` / `every` / `none`:
```typescript
await db.plant.findMany({
  where: { reminders: { some: { userId, enabled: true } } },  // existing pattern
});
```

**Performance considerations for nested filters:**
- Prisma generates a JOIN under the hood. The composite index `@@index([householdId, archivedAt])` on Plant (already in schema, line 108) makes the JOIN's lookup on `plant.householdId` fast.
- WateringLog/Note have no `@@index([householdId])` because they don't carry the column — but they have FK indexes on `plantId` (auto-generated by Prisma). Combined with Plant's householdId index, the nested filter is efficient.
- `findFirst` with nested-relation filter returns `null` cleanly when the joined record doesn't match — same as direct `findFirst`. No null-pointer surprises.

### Pattern 5: Prisma `$transaction` Interactive Form (D-06)

**What:** Atomic multi-row insert for `createHousehold`.
**Source:** [VERIFIED: Context7 `/prisma/prisma` "Prisma Transactions"]

The existing pattern in `src/features/auth/actions.ts:44-86` is the current Prisma 7 best practice. `createHousehold` mirrors it:

```typescript
// src/features/household/actions.ts
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { generateHouseholdSlug } from "@/lib/slug";
import { createHouseholdSchema } from "./schema";

export async function createHousehold(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = createHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const household = await db.$transaction(async (tx) => {
    // Slug collision loop (mirror auth/actions.ts:54-66)
    let slug: string;
    let attempts = 0;
    do {
      slug = generateHouseholdSlug();
      const existing = await tx.household.findUnique({ where: { slug }, select: { id: true } });
      if (!existing) break;
      if (++attempts > 10) throw new Error("Slug generation failed after 10 attempts");
    } while (true);

    const created = await tx.household.create({
      data: {
        name: parsed.data.name,
        slug,
        timezone: parsed.data.timezone ?? "UTC",
        cycleDuration: 7,
        rotationStrategy: "sequential",
      },
    });

    await tx.householdMember.create({
      data: {
        userId: session.user.id,
        householdId: created.id,
        role: "OWNER",
        rotationOrder: 0,
        // isDefault: false  // explicit if column has no default; DB default false suffices otherwise
      },
    });

    return created;
  });

  return { success: true, household };
}
```

**Isolation level:** Default `READ COMMITTED` is fine — the unique constraint on `Household.slug` is the slug-race guard, not transaction isolation. The collision loop + unique constraint atomically reject concurrent collisions [CITED: PostgreSQL docs — unique constraint violations cause transaction rollback].

### Anti-Patterns to Avoid

- **Anti-pattern: Using `unstable_cache` for `getCurrentHousehold`.** Cross-request cache lets a removed user keep accessing data. Use React `cache()` only.
- **Anti-pattern: Skipping `requireHouseholdAccess` in a Server Action because the layout already called it.** The cache does not cross the boundary. Pitfall 16 / D-04 is binding.
- **Anti-pattern: Reading `session.user.activeHouseholdId` inside a Server Action to skip a hidden field.** D-04 is explicit — no JWT-read fallback. The hidden field is the auditable contract.
- **Anti-pattern: Trying to use `forbidden()` from `next/navigation`.** Requires `experimental.authInterrupts: true` in `next.config.ts`, which the project does not have. The custom `ForbiddenError` class with `error.tsx` boundary is the chosen pattern (Phase 1 D-19).
- **Anti-pattern: `revalidatePath('/h/' + slug + '/dashboard')` after a mutation.** Pass the literal route pattern with `'page'` type instead: `revalidatePath('/h/[householdSlug]/dashboard', 'page')`. Both work, but the literal pattern invalidates ALL households' cached pages (which is fine — it's a no-op for households not currently rendered).
- **Anti-pattern: Calling `revalidatePath('/dashboard')` (the legacy path) after migration.** Legacy paths are redirect stubs; revalidating them is meaningless. Use the `/h/[householdSlug]/...` pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request memoization across Server Components | A custom `Map` keyed by request-id (no good way to get one) | React `cache(fn)` | Built into React 19; correctly scoped to the request render tree |
| Per-request membership cache | `unstable_cache` with `revalidate: 0` | React `cache()` (right primitive) | `unstable_cache` is cross-request; defeats Pitfall 16 |
| 403 Forbidden response | A new error class for this phase | Phase 1's existing `ForbiddenError` (`src/features/household/guards.ts:10`) | Already shipped, has `Object.setPrototypeOf` for cross-module instanceof, has tests |
| Slug generation | Repeating the random-string code | `generateHouseholdSlug` from `src/lib/slug.ts` | Already exists, has rejection sampling + unambiguous alphabet, tested |
| Slug collision retry loop | New retry primitive | Mirror `src/features/auth/actions.ts:54-66` | Same pattern verified by Phase 1 tests |
| Form validation on `householdId` | Hand-rolled string check | `z.string().cuid()` from Zod v4 (`zod/v4` import) | Project standard; validates Prisma cuid format |
| Cookie reading for timezone | New util | Existing `cookies()` + `cookieStore.get("user_tz")?.value ?? "UTC"` (in `src/app/(main)/layout.tsx:30-37`) | Same code already in dashboard/plants pages — copy verbatim |
| Cross-module `instanceof` for `ForbiddenError` | New helper | Existing `Object.setPrototypeOf` in Phase 1's class | Already verified by `tests/household.test.ts:231-234` |
| `redirect()` from layout/page | Throwing a custom redirect error | `redirect()` from `next/navigation` (synchronously throws NEXT_REDIRECT) | Standard Next.js 16 idiom; works in layouts, pages, Server Actions |
| 404 from layout when slug unknown | Returning null + custom render | `notFound()` from `next/navigation` | Standard idiom; renders nearest `not-found.tsx` |

**Key insight:** Phase 2 introduces zero new abstractions beyond what Phase 1 already shipped. Every new function (`getCurrentHousehold`, `createHousehold`, `getUserHouseholds`) composes existing primitives (`requireHouseholdAccess`, `resolveHouseholdBySlug`, `generateHouseholdSlug`, `db.$transaction`).

## Common Pitfalls

### Pitfall 1: Missed `householdId` Filter (Phase 2's #1 risk — Pitfall #1 in PITFALLS.md)

**What goes wrong:** A query updated for the dashboard misses `getWateringHistory` or `getPlantReminder`. The query still works (or worse, silently returns wrong data) because v1 Plant.userId no longer exists, but the nested-relation filter compiles to `plant: { userId: undefined }` which Prisma silently treats as "no filter on plant.userId" — yielding cross-household leak.

Actually, in this codebase the worse problem hits first: TypeScript fails to compile because `plant.userId` and `room.userId` are no longer schema fields. **The build is currently broken** — confirmed via grep across `src/features/{plants,rooms,watering,notes,reminders}/`. So leaks will be caught at compile time for query files, but the test pass needs to confirm runtime behavior.

**Why it happens:** Search-and-replace catches obvious places, misses indirect ones (e.g., `plant: { userId }` in nested `where`).

**How to avoid:**
1. Use the migration checklist (see Open Question Q5 below — exhaustive list of every file touched).
2. Mocked-Prisma test (D-16) per query module asserting `db.X.findMany`/`findFirst` was called with the expected `where`.
3. After implementation, run `npm run build` (which runs `tsc --noEmit` via Next.js) and verify zero errors. Any leftover `userId` reference will surface.

**Warning signs:**
- TypeScript errors in feature modules referencing `userId` after Phase 2.
- A test assertion that doesn't include the `where: { householdId }` clause in the expected call.

### Pitfall 2: Layout's `getCurrentHousehold` Called Twice (Performance Cost vs Correctness)

**What goes wrong:** The layout calls `getCurrentHousehold(slug)`. The page below also calls it. If `cache()` isn't used, that's 2x DB hits per request.

**Why it happens:** Forgetting the `cache()` wrapper or accidentally importing the underlying function instead of the cached one.

**How to avoid:**
- Export ONLY the cached version from `src/features/household/context.ts`.
- Add a test: `tests/household-context.test.ts` mocks `requireHouseholdAccess` and asserts it's called once when `getCurrentHousehold` is invoked twice in the same render context.
- Note: Vitest's mock environment doesn't perfectly simulate React's cache (no React render context), so the test might be brittle. Acceptable alternative: code review checklist + integration smoke test.

**Warning signs:**
- Importing `requireHouseholdAccess` directly from `guards.ts` in pages (should go through `getCurrentHousehold`).
- Performance regression visible in dev-tools network panel (multiple `householdMember.findFirst` queries per render).

### Pitfall 3: `revalidatePath` Without Type Parameter on Dynamic Path

**What goes wrong:** After a mutation, `revalidatePath('/h/abc12345/dashboard')` silently does nothing — Next.js 16 requires the `'page' \| 'layout'` type parameter when the path contains a dynamic segment. The action returns success, but the next page load shows stale data.

**Why it happens:** v1 used literal paths (`/dashboard`, `/plants`) which didn't need the type param. Developers carry the same pattern forward.

**How to avoid:**
- Always pass the route pattern (`/h/[householdSlug]/dashboard`), NOT the resolved slug, AND pass the type parameter.
- Source: [VERIFIED: Context7 `/vercel/next.js` `revalidatePath.mdx`] — "If a path contains a dynamic segment (for example, /product/[slug]), this parameter is required."
- Code review checklist: every `revalidatePath` call in the new action files should include either `'page'` or `'layout'`.

**Warning signs:**
- `revalidatePath('/h/' + slug + '/dashboard')` without a second argument.
- Dashboard not refreshing after add-plant.

### Pitfall 4: Server Action Hits Layout's React Cache (False Confidence in Live Check)

**What goes wrong:** Developer thinks "the layout already called `requireHouseholdAccess`, so the action's call is just hitting the React cache — basically free." Wrong: Server Actions execute in a fresh React render tree (one per action invocation), so the cache is empty for them. Each action is a real DB hit, which is what D-18 wants.

If the action skipped the call thinking it was cached, Pitfall 16 would fire — stale JWT scenarios pass through.

**Why it happens:** Conceptual confusion between React `cache()` (per-render) and Next.js `unstable_cache` (cross-request).

**How to avoid:**
- Document this explicitly in the new `context.ts` JSDoc (already shown in Pattern 1).
- Code review: every Server Action must contain `await requireHouseholdAccess(householdId)` near the top — no exceptions, no shortcuts. The 13 Forbidden tests (D-17) catch any missing call by failing.

**Warning signs:**
- An action that imports `getCurrentHousehold` (Server-Component-only helper) instead of `requireHouseholdAccess`.
- A "performance optimization" comment removing the live check.

### Pitfall 5: Legacy Redirect Stub With Null `activeHouseholdId` (Phase 1 WR-01)

**What goes wrong:** Legacy `/dashboard/page.tsx` redirect reads `session.user.activeHouseholdId`. Per Phase 1 WR-01, the type is `string | undefined` but the runtime value can be `null`. A strict `=== undefined` check returns false, the code proceeds to `db.household.findUnique({ where: { id: null } })` which throws.

**Why it happens:** WR-01 was an advisory in Phase 1. Phase 2 is the first phase to consume `activeHouseholdId` from a non-test surface.

**How to avoid:**
- Normalize at consumer site: `const id = session.user.activeHouseholdId ?? null; if (!id) redirect("/login");`
- Better: opportunistically fix WR-01 in `auth.ts:39` to coerce `null` → `undefined` (or vice versa). Recommendation in Q19g below.

**Warning signs:**
- TypeScript error `Argument of type 'null' is not assignable to parameter of type 'string'` when querying with `activeHouseholdId`.
- Crashes in production logs from legacy bookmark hits.

### Pitfall 6: Missing `error.tsx` for Layout `ForbiddenError` (UX, Not Correctness)

**What goes wrong:** The layout throws `ForbiddenError` for non-members. Without a route-segment `error.tsx` at `src/app/(main)/h/[householdSlug]/error.tsx`, Next.js shows the global error page (or worse, a stack trace in production). Users see a confusing screen instead of a "you don't have access to this household" message.

**Why it happens:** New error class shipped in Phase 1 with no consuming UI yet — Phase 2 introduces the first real consumer.

**How to avoid:**
- Plan adds `error.tsx` as a Client Component that checks `error.name === "ForbiddenError"` (ForbiddenError is `class ForbiddenError extends Error { readonly name = "ForbiddenError" }`) and renders an appropriate message.
- Same file should provide a "Switch household" link or back-to-default-household redirect.

**Warning signs:**
- 500 error in production when accessing a household you're not in.
- Stack trace visible to users.

### Pitfall 7: `redirect()` Inside try/catch in Server Action (Existing Hazard, Carried Forward)

**What goes wrong:** A Server Action wraps DB calls + a `redirect()` in a try/catch. The `redirect()` throws NEXT_REDIRECT, which the catch block swallows, and the action returns an error instead of navigating.

**Why it happens:** Defensive programming instinct.

**How to avoid:**
- Never wrap `redirect()` inside try/catch.
- If you must, re-throw using `if (isRedirectError(error)) throw error;` (existing v1 pattern in `src/features/auth/actions.ts:97-99`).
- Note: `next/navigation` exports `unstable_rethrow()` for this purpose [CITED: nextjs.org/docs error-handling] — but the existing `isRedirectError` check from `next/dist/client/components/redirect-error` works (with the WR-02 caveat that it's a deep import).

**Warning signs:**
- Action wraps `redirect()` in try/catch without re-throwing redirect errors.
- E2E test: form submit succeeds but page doesn't navigate.

## Runtime State Inventory

> Phase 2 modifies code, schema (one column), and route file paths. No external runtime state to migrate beyond what Phase 1 already settled.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 1 D-06 flushed the DB; Plant/Room rows now require `householdId` (NOT NULL); existing rows already migrated | No data migration needed; new columns are additive |
| Live service config | None — no n8n / external service references the moved routes | No external coordination needed |
| OS-registered state | None — this is a web app; no Task Scheduler / launchd / pm2 registrations | None |
| Secrets/env vars | None — no env var renames in this phase | None |
| Build artifacts | `src/generated/prisma/` — regenerates via `postinstall`; already includes 5 household models post Phase 1; `isDefault` field addition (if needed) requires `npx prisma generate` after migration | Run `npx prisma generate` after `npx prisma migrate dev` for the `isDefault` migration |

**Verification:** Phase 1 verification doc records that Phase 1 DB schema is up to date and `npx prisma migrate status` returns "up to date". Phase 2's schema change (if any) is additive only — no destructive migration needed.

## Code Examples

### Cached household resolution from a layout

```typescript
// src/features/household/context.ts
// Source: pattern verified via Context7 `/vercel/next.js` 06-fetching-data.mdx
import { cache } from "react";
import { notFound } from "next/navigation";
import { resolveHouseholdBySlug } from "./queries";
import { requireHouseholdAccess } from "./guards";

export const getCurrentHousehold = cache(async (slug: string) => {
  const summary = await resolveHouseholdBySlug(slug);
  if (!summary) notFound();
  return await requireHouseholdAccess(summary.id);
});
```

### Layout chokepoint

```typescript
// src/app/(main)/h/[householdSlug]/layout.tsx
// Source: Next.js 16 layout.mdx (Context7) — async params, async layout
import { getCurrentHousehold } from "@/features/household/context";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdSlug: string }>;
}) {
  const { householdSlug } = await params;
  await getCurrentHousehold(householdSlug);  // throws or 404s
  return <>{children}</>;
}
```

### Error boundary for ForbiddenError

```typescript
// src/app/(main)/h/[householdSlug]/error.tsx
"use client";

import Link from "next/link";

export default function HouseholdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.name === "ForbiddenError") {
    return (
      <div className="space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold">You don't have access to this household</h1>
        <p className="text-muted-foreground">
          Ask the household owner to invite you, or switch to one of yours.
        </p>
        <Link href="/dashboard" className="text-accent underline">
          Go to my dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <button onClick={reset} className="text-accent underline">Try again</button>
    </div>
  );
}
```

### Legacy redirect stub

```typescript
// src/app/(main)/dashboard/page.tsx
// Source: pattern from existing v1 `redirect("/login")` calls in pages
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LegacyDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = session.user.activeHouseholdId;
  if (!id) redirect("/login");  // WR-01 defensive: handles null and undefined

  const household = await db.household.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!household) redirect("/login");  // membership lost between sign-in and now

  redirect(`/h/${household.slug}/dashboard`);
}
```

### Migrated query

```typescript
// src/features/plants/queries.ts (post-migration)
// Source: existing v1 with userId → householdId swap per D-10
import { db } from "@/lib/db";

export async function getPlants(
  householdId: string,                              // CHANGED from userId
  options: { /* ... unchanged ... */ } = {}
) {
  // ... unchanged options handling ...
  const where = {
    householdId,                                    // CHANGED from userId
    ...archivedFilter,
    // ... rest unchanged
  };
  // ... rest unchanged
}

export async function getPlant(plantId: string, householdId: string) {  // CHANGED
  return db.plant.findFirst({
    where: { id: plantId, householdId },            // CHANGED
    include: { room: true, careProfile: true },
  });
}
```

### Migrated nested-relation query

```typescript
// src/features/watering/queries.ts (getWateringHistory)
// Source: existing v1 with plant.userId → plant.householdId swap per D-10
export async function getWateringHistory(
  plantId: string,
  householdId: string,                              // CHANGED from userId
  skip = 0,
  take = 20
) {
  const [logs, total] = await Promise.all([
    db.wateringLog.findMany({
      where: {
        plantId,
        plant: { householdId },                     // CHANGED from { userId }
      },
      orderBy: { wateredAt: "desc" },
      skip,
      take,
    }),
    db.wateringLog.count({
      where: { plantId, plant: { householdId } },   // CHANGED
    }),
  ]);
  return { logs, total };
}
```

### Cross-household isolation test (D-16)

```typescript
// tests/plants-isolation.test.ts (or merged into existing tests/plants.test.ts)
// Source: pattern from existing tests/notes.test.ts mock setup
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { plant: { findMany: vi.fn(), count: vi.fn() } },
}));

beforeEach(() => vi.clearAllMocks());

describe("plants/queries.ts honors householdId scope (D-10, D-16)", () => {
  test("getPlants includes householdId in every query where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.plant.count).mockResolvedValueOnce(0);
    const { getPlants } = await import("@/features/plants/queries");
    await getPlants("hh_TEST");
    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
    expect(db.plant.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
  });
});
```

### ForbiddenError test on a Server Action (D-17)

```typescript
// tests/plants-authz.test.ts (per-feature) or tests/phase-02/cross-household-isolation.test.ts
// Pattern: mock requireHouseholdAccess to throw ForbiddenError, call action, expect throw
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { plant: { create: vi.fn() } } }));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/household/guards", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/guards")>(
    "@/features/household/guards"
  );
  return {
    ...actual,
    requireHouseholdAccess: vi.fn(),  // mocked
  };
});

beforeEach(() => vi.clearAllMocks());

describe("Forbidden coverage — mutating actions reject non-members (D-17, Pitfall 16)", () => {
  test.each([
    ["createPlant", { householdId: "hh_X", nickname: "x", wateringInterval: 7 }],
    ["updatePlant", { householdId: "hh_X", id: "p1", nickname: "x", wateringInterval: 7 }],
    ["archivePlant", { householdId: "hh_X", plantId: "p1" }],
    // ... all 13+ ...
  ])("%s throws ForbiddenError when user not a member", async (name, input) => {
    const { auth } = await import("../auth");
    const { ForbiddenError, requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user_X", isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(requireHouseholdAccess).mockRejectedValue(new ForbiddenError("Not a member"));
    const mod = await import("@/features/plants/actions");
    // Server Actions return error objects, not throw — so we assert the error path
    // BUT: if action lets ForbiddenError propagate (preferred), we use rejects.toThrow
    // The decision (return vs throw) is a planner question — see §Open Questions Q4-bis
    await expect((mod as any)[name](input)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

**Note on the throw-vs-return-error decision:** Server Actions in v1 return `{ error }` objects for user-facing failures (validation, demo mode, ownership). For `ForbiddenError`, the question is whether to (a) catch and convert to `{ error: "..." }` or (b) let it propagate to `error.tsx`. Recommendation: let it propagate — the layout's error boundary already handles it, and the user is forbidden from being on this URL anyway, so showing the error UI is the right outcome. Document the decision in plans.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for cross-route logic | `proxy.ts` (Next.js 16) | Next.js 16 (Oct 2025) | Already migrated by Phase 1; no change this phase |
| Sync `cookies()` / `headers()` / `params` | `await cookies()` / `await headers()` / `await params` | Next.js 15 (2025) | Layouts/pages already use this pattern in v1 |
| `unstable_cache` only for cross-request memoization | React `cache()` for per-request, `'use cache'` directive (with Cache Components) for cross-request | Next.js 16 (Oct 2025) | Phase 2 picks React `cache()` (correct for per-request scope) |
| `revalidateTag(tag)` (single arg) | `revalidateTag(tag, profile)` (two args) | Next.js 16 — soft deprecated single-arg | Not used in this phase, but if `cacheTag` is added later, use the two-arg form |
| `forbidden()` from `next/navigation` (experimental) | Custom `ForbiddenError` class with `error.tsx` boundary | Project decision Phase 1 | `forbidden()` requires `experimental.authInterrupts: true` — project chose stable custom class instead |

**Deprecated/outdated:**
- `next-auth@4.x` — v4 doesn't support App Router natively; project uses `next-auth@beta` (v5). Already settled by Phase 1.
- `Plant.userId`, `Room.userId` — dropped from schema in Phase 1. v1 query files still reference them — Phase 2 fixes this; build is broken until then.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest `vi.mock` with `vi.importActual` correctly produces a partial mock allowing `requireHouseholdAccess` to be replaced while keeping `ForbiddenError` real | Code Examples (D-17 pattern) | If wrong, ForbiddenError tests fail to instantiate; switch to importing `ForbiddenError` separately |
| A2 | React `cache()` works correctly when called from a layout that itself contains `await params` (an async dynamic boundary) | Pattern 1 / Layout chokepoint | If wrong, cache may silently bypass; mitigation = integration test with double-call assertion |
| A3 | `revalidatePath('/h/[householdSlug]/dashboard', 'page')` invalidates ALL households' cached `/h/<any>/dashboard` pages, which is acceptable (no privacy issue, and re-render is cheap) | Pattern 3 / Pitfall 3 | Confirmed by Next.js docs — pattern path matches all instances; behavior is correct |
| A4 | Next.js 16 layout receiving a route group + dynamic segment (`/(main)/h/[householdSlug]/...`) propagates params correctly to the layout | Pattern 2 | Confirmed by Context7 — explicit example `revalidatePath('/(main)/blog/[slug]', 'page')` shows the pattern is supported |
| A5 | `HouseholdMember.isDefault` does not yet exist in `prisma/schema.prisma` (verified via inline read) | Summary / D-08 | Verified inline at line 57-69 of schema.prisma — column is absent; Phase 2 must add it |
| A6 | Existing dialog components (e.g., `add-plant-dialog.tsx`) use react-hook-form and can accept `householdId` via `defaultValues` to RHF | Pattern 3 | Not directly verified; planner should inspect dialogs and confirm or propose alternative wiring |
| A7 | `next-auth@5.0.0-beta.30` `unstable_update` (mentioned in Pitfall 16) is not needed in Phase 2 — only Phase 4 (member removal) needs it | Don't Hand-Roll table | Verified — no membership-change action ships in Phase 2; deferred to Phase 4 |
| A8 | The current `Reminder` model (per-user-per-plant) does not need to gain a `householdId` column — its household scope is transitive through `plant.householdId` (D-13) | Pattern 4 / D-13 | Verified by schema inspection (Reminder has plantId + userId only, no householdId) — D-13 confirms transitive scope is intentional |
| A9 | `proxy.ts` matcher does not need adjustment — its current pattern excludes `api/auth`, `_next`, `favicon`, `login`, `register`, `demo`. Adding `/h/...` doesn't require an exclude (it's a protected route) | Architectural Map / D-05 | Verified — the matcher already covers `/h/*` via the catch-all negative-lookahead pattern |
| A10 | Next.js 16's `revalidatePath` invalidates the page cache that includes all data fetched in nested Server Components (incl. `getCurrentHousehold` cache, which is per-request anyway) | Pitfall 3 | Verified by Next.js docs — page revalidation invalidates the rendered output |

**If user confirmation is needed for any of A1–A10**, raise during planning's discuss-phase. A6 is the most likely to need verification — the dialog component file should be inspected before committing to the hidden-field approach.

## Open Questions (RESOLVED)

The numbered prompt questions (Q1–Q19) are answered here as **recommendations** the planner can adopt or revise.

### Q1 (RESOLVED): React `cache()` wrapping pattern — confirmed

`cache(async (slug) => { ... })` is canonical [VERIFIED: Context7]. Cache key is the function arg (the slug). Slug works fine as the key — internally Prisma's `findUnique({ where: { slug } })` is the same call regardless of how it was reached.

**Caveat about dynamic functions inside cached helpers:** Calling `cookies()` or `headers()` inside the cached function does NOT prevent caching — those just opt the cache scope into the dynamic phase of the request. But `auth()` (from NextAuth) inside the cached function works correctly because session lookup is itself memoizable. The Phase 1 `requireHouseholdAccess` already calls `auth()` internally, and wrapping the whole thing in `cache()` is fine.

**Recommendation:** Use the Pattern 1 example verbatim. `getCurrentHousehold` lives in `src/features/household/context.ts`. Layout calls it; pages re-call it (cache-hit).

### Q2 (RESOLVED): Next.js 16 route group + dynamic segment combination — confirmed

`src/app/(main)/h/[householdSlug]/layout.tsx` is correct. Route groups (`(main)`) don't appear in URL; dynamic segments (`[householdSlug]`) do. They nest correctly. The existing `src/app/(main)/layout.tsx` (top nav, NotificationBell, BottomTabBar) becomes the OUTER layout; the new layout becomes the INNER chokepoint.

`loading.tsx` and `not-found.tsx` placement: each at the level it should appear. Root level has no `not-found.tsx`; add one at `src/app/(main)/h/[householdSlug]/not-found.tsx` for the case `notFound()` is thrown by the layout (unknown slug).

**Async params signature:** `params: Promise<{ householdSlug: string }>` (Pattern 2 example).

**Recommendation:** Follow Pattern 2 verbatim. Plan should confirm the existing `(main)/layout.tsx` (which fetches reminder count) is moved into the household-scoped layout OR kept as outer with `getReminderCount` called using a different path (see Q11 below).

### Q3 (RESOLVED): Legacy-path redirect stubs

Each legacy `page.tsx` is a thin Server Component that:
1. Reads session
2. Reads `activeHouseholdId` (with WR-01 defensive null/undefined handling)
3. Looks up the slug via `db.household.findUnique({ where: { id }, select: { slug: true } })`
4. `redirect()` to `/h/${slug}/<suffix>`

For nested legacy paths like `/plants/[id]`, the stub awaits `params` first to get the plant id, then composes `/h/${slug}/plants/${id}`.

For ungated edge cases (no `activeHouseholdId`): redirect to `/login` (per Discretion item). This is safe — Phase 1 guarantees every authenticated user has a membership, so a null id implies session corruption.

**Recommendation:** Per-page `page.tsx` redirect stubs (not a single layout-level redirect). Reasons: (a) different suffix mappings per route, (b) legacy URLs may have specific dynamic segments to forward, (c) easier to grep + remove later. See Code Examples for the dashboard pattern.

### Q4 (RESOLVED): Login landing target

`auth.config.ts:22` `Response.redirect(new URL("/dashboard", nextUrl))` is in the `authorized` callback — runs on the EDGE runtime (proxy.ts). Edge can't query Prisma without `@prisma/adapter-pg` setup work, and even then would be a perf/edge-cold-start concern.

**Three options evaluated:**

(a) **Add slug to JWT at sign-in.** Already done partially (Phase 1 D-13 puts `activeHouseholdId` in JWT). Could extend to also include `activeHouseholdSlug`. Pros: edge can read it directly, redirect target becomes `/h/${slug}/dashboard`. Cons: slug duplication in JWT; re-issue needed when default household changes.

(b) **Server-side landing page.** Redirect to `/dashboard` (legacy path), let the legacy redirect stub do the slug lookup and re-redirect. Pros: zero edge-runtime DB; reuses the legacy-stub work. Cons: extra HTTP round trip on every login.

(c) **Redirect to `/dashboard` and let the legacy stub handle it.** Same as (b).

**Recommendation: option (b)/(c).** `auth.config.ts:22` stays as-is — `Response.redirect(new URL("/dashboard", nextUrl))`. The legacy `/dashboard` page.tsx (the one introduced for the redirect bridge in D-02) handles the slug lookup. Net cost: one extra redirect on login, no JWT changes, no edge-runtime Prisma. Minimal code, maximum reuse.

If perf becomes an issue post-launch, switch to option (a) — but that's a Phase 6 concern (when settings UI lets users change default household, the JWT slug field would need invalidation).

### Q5 (RESOLVED): Prisma nested-relation filter syntax

Direct nested `{ plant: { householdId } }` is correct and matches v1 idiom [VERIFIED: Context7 `/prisma/prisma`]. The verbose `{ plant: { is: { householdId } } }` form is for explicit one-to-one filtering (rarely needed). Both compile to the same SQL JOIN.

**Index implications:** Plant has `@@index([householdId, archivedAt])` → composite index covers the JOIN's lookup on `plant.householdId`. WateringLog/Note have FK index on `plantId` (Prisma auto). The chained lookup is two indexed seeks → fast.

**`findFirst` with nested filter returns null cleanly** when the join doesn't match — same as direct `findFirst`. No special handling needed.

**Recommendation:** Use direct nested syntax `plant: { householdId }`. Apply to:
- `getWateringHistory` (`watering/queries.ts:159`)
- `loadMoreWateringHistory` (`watering/queries.ts:177`)
- `getTimeline` (`notes/queries.ts:51-52`)
- `loadMoreTimeline` (`notes/queries.ts:63`)
- `editWateringLog` (`watering/actions.ts:86`)
- `deleteWateringLog` (`watering/actions.ts:134`)
- `updateNote` (`notes/actions.ts:48`)
- `deleteNote` (`notes/actions.ts:75`)
- All `db.plant.findFirst({ where: { id, userId } })` callsites in `reminders/actions.ts` (snooze*, togglePlantReminder)

### Q6 (RESOLVED): Prisma `$transaction` API in v7 — confirmed

Interactive form `db.$transaction(async (tx) => { ... })` is Prisma 7 best practice [VERIFIED: Context7 `/prisma/prisma` "Prisma Transactions"]. Already used in `src/features/auth/actions.ts:44-86` for the register flow.

**Isolation level for `createHousehold` slug race:** Default `READ COMMITTED` is fine. The unique constraint on `Household.slug` is the slug-collision guard. The collision-detection-then-insert loop is bounded at 10 attempts (mirroring `auth/actions.ts:54-66`) and the unique constraint is the final atomic guarantee.

**Recommendation:** Mirror `src/features/auth/actions.ts:44-86` verbatim — same `$transaction` pattern, same slug-loop pattern, same `tx.{user,household,householdMember}.create` ordering (except for `createHousehold`, no user.create — only household + member).

### Q7 (RESOLVED): `HouseholdMember.isDefault` column

**Verified inline:** Schema line 57-69 lists `id`, `householdId`, `household`, `userId`, `user`, `role`, `rotationOrder`, `createdAt`. **No `isDefault` field.**

**Migration plan:** Phase 2 adds `isDefault Boolean @default(false)` as an additive column.

```prisma
model HouseholdMember {
  // ... existing fields ...
  isDefault Boolean @default(false)
  // ... existing indexes ...
}
```

Migration command:
```bash
npx prisma migrate dev --name add_household_member_is_default
```

This produces a single SQL: `ALTER TABLE "HouseholdMember" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;` — non-destructive, instantly succeeds on populated tables.

**Backfill consideration:** The current Phase 1 register flow creates exactly one `HouseholdMember` per user (the auto-created solo household). Should that membership be marked `isDefault = true` at creation time? **Yes** — otherwise a user with two households (one auto-created, one created via `createHousehold`) has neither marked default, and `getUserHouseholds` returns `isDefault: false` for both, which breaks the future "land on your default household" flow (Phase 6 HSET-02).

**Recommendation:**
1. Add column with `@default(false)`.
2. Update `registerUser` in `src/features/auth/actions.ts:78-85` to set `isDefault: true` on the auto-created membership.
3. In `createHousehold` (D-06), the new HouseholdMember row gets `isDefault: false` (the user already has a default; this is a secondary household).
4. One-shot SQL to backfill existing rows from Phase 1 (only one row per user, all should become default):
   ```sql
   UPDATE "HouseholdMember" SET "isDefault" = true;
   ```
   This runs as a separate migration step (or in the same migration's `migration.sql` after the `ALTER TABLE`).

Per the live DB state from Phase 1 (which has the single membership per user already), this backfill is safe and idempotent.

### Q8 (RESOLVED): React `cache()` vs `unstable_cache` — confirmed

| Primitive | Scope | Use For |
|-----------|-------|---------|
| React `cache()` | Per-request render tree | `getCurrentHousehold` (D-03) |
| `unstable_cache` | Cross-request, key-based, with revalidation | Anything that survives across users — NOT a fit for per-membership data |
| `'use cache'` directive | Cross-request, requires Cache Components opt-in | Future consideration; not Phase 2 |

For `getCurrentHousehold`, React `cache()` is the correct choice. A user removed mid-session cannot bypass via stale cache (cache invalidates per request).

**Server Action behavior:** Each Server Action invocation is a separate React render scope. The cache from the calling page does NOT carry over. Calling `requireHouseholdAccess` inside an action is a fresh DB hit — exactly what D-04 / Pitfall 16 demands.

**Recommendation:** Document this contrast in the JSDoc on `getCurrentHousehold` to prevent future confusion.

### Q9 (RESOLVED): Server Action live check confirmed (no cache reuse)

Confirmed by Q8. Every Server Action MUST call `requireHouseholdAccess(householdId)` regardless of whether the rendering Server Component already did. The 13 ForbiddenError tests (D-17) enforce this.

### Q10 (RESOLVED): Hidden field for `householdId` (D-04) + RHF integration

**Plain HTML form:**
```html
<form action={createPlant}>
  <input type="hidden" name="householdId" value={household.id} />
  <input name="nickname" required />
  <button type="submit">Save</button>
</form>
```

**With react-hook-form (Server Component renders the wrapper, Client Component runs RHF):**
```tsx
"use client";
// inside RHF Form
<input type="hidden" {...register("householdId")} />
// AND in useForm({ defaultValues: { householdId: household.id, ... } })
```

The Server Component passes `householdId` as a prop to the Client form component, which uses it as a `defaultValues` to RHF. RHF's `register("householdId")` ensures the field is included in the submission payload.

**Why hidden field over `action={createPlant.bind(null, householdId)}`:** `bind` requires the action to accept `(householdId, formData)` signature. Works for plain forms but RHF's submit handler doesn't compose well with bound actions — it expects to call the action with its own typed payload object. Hidden field is cleaner and matches the "everything goes through Zod parse" pattern.

**Recommendation:** Hidden field via RHF `register` for forms that already use RHF (add-plant-dialog, edit-plant-dialog, create-room-dialog). Plain hidden `<input>` for forms that don't (most Server Component forms — log watering, snooze, archive).

### Q11 (RESOLVED): `revalidatePath` patterns for `/h/[slug]/...`

[VERIFIED: Context7 `/vercel/next.js` `revalidatePath.mdx`]

For paths with dynamic segments, the type parameter is REQUIRED:
```typescript
revalidatePath('/h/[householdSlug]/dashboard', 'page');     // page-level
revalidatePath('/h/[householdSlug]/plants/[id]', 'page');   // nested dynamic page
revalidatePath('/h/[householdSlug]', 'layout');             // invalidate the layout + all nested pages
```

The path is the LITERAL ROUTE PATTERN with `[householdSlug]` as a token, not the resolved slug. Next.js matches all rendered instances of that pattern.

**For Server Action rewrites:**
- After `createPlant`: `revalidatePath('/h/[householdSlug]/dashboard', 'page')` and `revalidatePath('/h/[householdSlug]/plants', 'page')`
- After `updatePlant`: same as above + `revalidatePath('/h/[householdSlug]/plants/[id]', 'page')`
- After `logWatering`: `revalidatePath('/h/[householdSlug]/dashboard', 'page')` + `revalidatePath('/h/[householdSlug]/plants/[id]', 'page')`

**Subtlety: revalidating the layout itself.** The household layout at `/h/[householdSlug]` — if a future action mutates household-level state (e.g., rename household), revalidate the layout: `revalidatePath('/h/[householdSlug]', 'layout')`. For Phase 2 mutations (which only touch plant/room/watering data), page-level revalidation suffices.

**Subtlety: NotificationBell sourced from outer `(main)/layout.tsx`.** The current `src/app/(main)/layout.tsx` calls `getReminderCount` and `getReminderItems`. After Phase 2:
- Option A: Move the reminder-count fetch INTO the household-scoped layout (it's now household-scoped data). Requires duplicating the chrome (NotificationBell etc.) into the inner layout.
- Option B: Keep the outer `(main)/layout.tsx` but have it derive `householdId` from the URL pattern (read params? layouts above the dynamic segment can't see it). Not viable.
- Option C: Keep outer `(main)/layout.tsx` as the chrome, but pass `getReminderCount(undefined)` returns 0 from outer layout, and have the inner household layout pass the real count down via props or a context.

**Recommendation: Option A** — move the chrome (NotificationBell, BottomTabBar, etc.) into the household-scoped layout. The outer `(main)/layout.tsx` becomes thinner (just session check, demo banner, TimezoneSync, FocusHeading). The inner `[householdSlug]/layout.tsx` calls `getCurrentHousehold` and renders the household-aware chrome (top nav with switcher placeholder, NotificationBell with household-scoped count, BottomTabBar). This is also the natural home for the future Phase 6 household switcher.

**Caveat:** The `/preferences` and `/dashboard` (legacy redirect) and `/plants` (legacy) etc. live UNDER `(main)` but OUTSIDE `[householdSlug]`. They'll lose the chrome unless we keep something at `(main)`. Options:
- (a) Duplicate the minimal chrome at `(main)/layout.tsx` for non-household routes (plus `/preferences`).
- (b) Move `/preferences` under `/h/[householdSlug]/preferences/` too.

**Recommendation:** (a) — keep `(main)/layout.tsx` lean (auth check, demo banner, top-nav skeleton without household-specific bits). The household layout extends it with household-aware UI. Legacy redirect stubs render briefly before redirecting; chrome is irrelevant.

### Q12 (RESOLVED): Phase 1 advisory bugs WR-01 and WR-03

**WR-01 (`session.user.activeHouseholdId` null vs undefined):** Phase 2's legacy redirect stubs and login flow both consume this value. Recommendation: **fix opportunistically** in `auth.ts:39`. Simple change:
```typescript
session.user.activeHouseholdId = token.activeHouseholdId ?? undefined;
// instead of: ... = token.activeHouseholdId as string | undefined;
```
Cost: 1-line change, eliminates a class of consumer bugs. Update `next-auth.d.ts` to reflect the cleaned-up type if needed.

**WR-03 (`HouseholdRole` cast without validation):** `member.role as "OWNER" | "MEMBER"` in `guards.ts:49`. Phase 2 introduces no new role values. Recommendation: **defer** to a future cleanup phase. The risk vector (someone adds "ADMIN" to the role string column without updating the cast) is contained — this single cast is the only place. A targeted Zod parse using the existing `householdRoleSchema` from `schema.ts` would fix it:
```typescript
import { householdRoleSchema } from "@/features/household/schema";
return {
  household: member.household,
  member,
  role: householdRoleSchema.parse(member.role),  // throws if value is unknown
};
```
Cost: 2-line change. Recommendation flips to **fix opportunistically** if planner has bandwidth — it's trivially small.

### Q13 (RESOLVED): Test strategy — mocked Prisma for cross-household isolation (D-16)

Confirmed via existing patterns in `tests/notes.test.ts` and `tests/watering.test.ts`. Vitest 4 syntax:
```typescript
vi.mock("@/lib/db", () => ({ db: { plant: { findMany: vi.fn(), count: vi.fn() } } }));
// In test:
const { db } = await import("@/lib/db");
vi.mocked(db.plant.findMany).mockResolvedValueOnce([...]);
expect(db.plant.findMany).toHaveBeenCalledWith({ where: { householdId: "hh_X", ... } });
```

**Established mock helpers in this codebase:** None — each test file declares its own `vi.mock` blocks. There's no shared `tests/test-helpers.ts` or `tests/mocks.ts`.

**Recommendation:** Add a minimal `tests/_mocks.ts` (note: prefixed with `_` to avoid being picked up as a test file) with a shared mock-builder for `db` (covering all 7 models) and `auth`. Saves repetition across the new authz/isolation tests. Alternatively, accept the duplication — each test file is self-contained, easy to grok.

Either is fine. Lean toward keeping current per-file pattern (less indirection) unless duplication burden becomes large.

### Q14 (RESOLVED): ForbiddenError tests (D-17) — concise pattern

The `test.each` parameterized pattern in Code Examples reduces the 13+ tests to ~30 lines. The decision point: **does the action throw `ForbiddenError`, or catch it and return `{ error: "..." }`?**

Looking at the migration template (Pattern 3 / D-12 step 4): `await requireHouseholdAccess(householdId)` is the first line after Zod parse. It throws on miss. The action does NOT wrap it in try/catch (per the v1 pattern, errors propagate to the layout's `error.tsx`).

**Recommendation:** Let `ForbiddenError` propagate — it's caught by `error.tsx` for Server Component renders, and by Next.js's Server Action error pipeline for action invocations. The test pattern uses `expect(...).rejects.toBeInstanceOf(ForbiddenError)`.

If the planner wants to convert it to `{ error: "..." }` for nicer UX (e.g., toast notification on the dashboard rather than full-page error), that's a separate decision. Current PITFALLS.md and CONTEXT.md don't take a position. Recommendation: **let it propagate** — the user being on this URL means the ForbiddenError UI is the right outcome (they're not authorized for the household at all).

### Q15 (RESOLVED): Integration tests for `createHousehold` and `getUserHouseholds` (D-18)

**RESOLVED:** CONTEXT.md D-18 is authoritative — ship **real-Prisma integration tests** against a test DB for `createHousehold` + `getUserHouseholds`. This is in addition to (not a replacement for) the mocked-Prisma unit tests in `tests/household-create.test.ts` / `tests/household-list.test.ts`. Plan 02-07 (added in the revision) owns this task.

**Pattern to establish:**
- New file `tests/household-integration.test.ts` with `beforeAll` / `afterAll` / `beforeEach` hooks that clean rows created under a test-prefixed email (e.g. `integration-test-${uuid}@test.local`) or use a transaction-rollback harness.
- Real `db` from `@/lib/db` — no mocking.
- Assertions match CONTEXT D-07: transactional atomicity (user-without-household never exists), unique-slug correctness, OWNER role assignment, rotationOrder default, isDefault=false on secondary households.
- `getUserHouseholds` assertion: a user with two memberships returns both with correct roles + isDefault flags sorted by joinedAt asc.

**Database connection:** use the existing dev DB (`DATABASE_URL`) — namespace rows with a predictable email prefix so `afterAll` cleanup is safe. Do NOT spin up a containerised DB in Phase 2 scope.

**Historical rationale (superseded):** earlier drafts considered mocked-Prisma only to match the Phase 1 pattern; user decision in CONTEXT D-18 overrides — integration tests are part of Phase 2 deliverables, even though they require minor new infra (cleanup hooks).

### Q16 (RESOLVED): Validation Architecture — see dedicated section below.

### Q17 (RESOLVED): Project skills check

`.claude/skills/nextjs/SKILL.md` exists and references:
- `data-patterns.md` — confirms Server Components call Prisma directly (matches D-10), Server Actions use `'use server'` + Zod + Prisma writes (matches D-12), preload pattern with `cache()` (matches D-03)
- `async-patterns.md` — confirms `params: Promise<...>` for Next.js 15+ (matches Pattern 2)
- `error-handling.md` — documents `error.tsx`, `redirect()` outside try/catch (matches Pitfall 7 + Code Examples), `notFound()` from `next/navigation` (matches Pattern 1), `forbidden()` requires `experimental.authInterrupts` (confirms our choice to use custom `ForbiddenError`)
- `file-conventions.md` — confirms route groups, dynamic segments, layout structure (matches Pattern 2 + Recommended Project Structure)
- `directives.md` — `'use cache'` requires `cacheComponents: true` (we don't enable it; `cache()` from React is sufficient)

**Conflicts with D-01 through D-18:** None. The skill reinforces every chosen pattern.

**Skill validate rules to be aware of:**
- The skill warns about `middleware.ts` (rename to `proxy.ts`) — already handled in Phase 1.
- It warns about non-async `cookies()` and `params` — already handled in v1.
- It warns about `next-auth` legacy patterns — but Phase 1 chose v5 beta; the warning is best-ignored for this project (CLAUDE.md explicitly mandates next-auth v5 beta).

### Q18 (RESOLVED): Scope audit

**CONTEXT.md decisions and their implementation paths:**

| Decision | Implementation Path | Status |
|----------|--------------------|--------|
| D-01 URL prefix | New routes under `src/app/(main)/h/[householdSlug]/` | Clear |
| D-02 Move + legacy stubs | File moves + new redirect page.tsx files | Clear |
| D-03 Layout chokepoint | `src/app/(main)/h/[householdSlug]/layout.tsx` + `src/features/household/context.ts` | Clear |
| D-04 Hidden-field | All forms updated; D-12 step 3 (Zod schema) extended | Clear |
| D-05 proxy.ts unchanged | No file changes | Clear |
| D-06 createHousehold | New `src/features/household/actions.ts` + `createHouseholdSchema` in `schema.ts` | Clear |
| D-07 No UI | Action callable from tests only | Clear |
| D-08 getUserHouseholds + isDefault | Extend `src/features/household/queries.ts` + Prisma migration | Clear |
| D-09 No UI | Query callable from tests only | Clear |
| D-10 Query migration | All `src/features/{plants,rooms,watering,notes,reminders}/queries.ts` rewritten | Clear |
| D-11 No shims | userId params removed; audit columns at write sites | Clear |
| D-12 Action migration | All `src/features/{plants,rooms,watering,notes,reminders}/actions.ts` rewritten | Clear |
| D-13 Reminder per-user | createPlant keeps `reminders: { create: { userId: ... } }` | Clear |
| D-14 Reminder signature stable | `getReminderCount(householdId)` / `getReminderItems(householdId)` | Clear |
| D-15 Temporary regression OK | Documentation in PR + REQUIREMENTS.md status note | Clear |
| D-16 Mocked-Prisma isolation tests | Per-feature or unified test file (Q19f below) | Clear |
| D-17 13 Forbidden tests | Same | Clear |
| D-18 Integration tests | See Q15 above for flavor question | Needs user clarification |

**Files not yet mentioned that will be touched:**
- `src/components/auth/user-menu.tsx` (top nav) — likely linked to legacy `/dashboard`. Update to `/h/[slug]/dashboard` or pass through props.
- `src/components/layout/bottom-tab-bar.tsx` — has hardcoded route paths likely.
- `src/components/plants/add-plant-dialog.tsx` — needs `householdId` prop wiring (RHF integration concern, A6 above).
- `src/components/plants/edit-plant-dialog.tsx` — same.
- `src/components/rooms/create-room-dialog.tsx` — same.
- `src/components/plants/plant-actions.tsx` (archive/unarchive/delete) — needs `householdId` prop.
- `src/components/watering/log-watering-button.tsx` (and similar) — needs `householdId` prop.
- `src/features/demo/actions.ts` (`startDemoSession`) — references `Plant.userId` (line 56) and `Room.userId` (lines 33, 36) — also currently broken; needs updating to create a Household + HouseholdMember for the demo user. **This is in scope for Phase 2** because `startDemoSession` is part of the broken-build set, NOT Phase 7 territory (Phase 7 is about *seeding more interesting demo data and the read-only guard*, but the demo user must exist with at least a basic household for any of v1's surfaces to work).

**Discretion item #5: `updateTimezone` (`src/features/auth/actions.ts:104-122`)**
- The function writes to `User.timezone` (per-user "home" timezone for travel detection).
- HSLD-05 says "Each household has configurable... timezone". Household.timezone is set from User.timezone at signup (Phase 1 D-12) but is now the source of truth for cycle math.
- Question: should `updateTimezone` mirror to `Household.timezone`?
- **Recommendation:** No. Keep them as orthogonal concepts. User.timezone tracks the user's own location for client-side display; Household.timezone is set once at household creation and edited via the (future) settings UI. Mixing them would create surprising effects (user updates their travel timezone → household cycle math shifts mid-cycle). Phase 6 will introduce a household settings page with explicit `updateHouseholdTimezone(householdId, tz)`. Phase 2 leaves `updateTimezone` (user-level) as-is.
- Plus: WR-04 (IANA validation for `updateTimezone`) is also out of scope. Defer to cleanup pass.

### Q19 (RESOLVED): Discretion item recommendations (consolidated)

**Q19a — Cache helper location:** `src/features/household/context.ts` (matches CONTEXT.md tentative name). Reasons: (1) `guards.ts` is the auth boundary (throws); `context.ts` is the consumption helper (returns cached data). Separation of concerns. (2) Future Phase 5 `getCurrentAssignee` and Phase 6 `getCurrentMembers` would naturally extend `context.ts`. (3) Consumer name `getCurrentHousehold` is the right grain — clear intent, no abbreviation.

**Q19b — Legacy redirect implementation:** Per-route `page.tsx` (recommended in Q3). Reasons: (1) different `<suffix>` mappings (e.g., `/plants/[id]` needs to forward the id), (2) Easier to grep + remove later, (3) Each is a 10-15 line file — not enough boilerplate to justify a clever shared abstraction.

**Q19c — Null/undefined `activeHouseholdId`:** Defensive `if (!id) redirect("/login")` in legacy stubs and login landing path. WR-01 fix in `auth.ts:39` is opportunistic and recommended (Q12 above).

**Q19d — Login landing target:** Option (b)/(c) — keep `auth.config.ts:22` redirecting to `/dashboard` (legacy), let the legacy stub do the slug lookup and re-redirect. Q4 above.

**Q19e — `updateTimezone` mirror:** No. Q18 above.

**Q19f — Test file organization:** Per-feature in the existing test file naming convention. New tests go INTO `tests/plants.test.ts`, `tests/rooms.test.ts`, etc. (filling in the existing `test.todo` stubs). Add ONE new file `tests/household-create.test.ts` for `createHousehold` + `getUserHouseholds`. Reasons: (1) keeps test runs co-located with related schema tests, (2) fills in the existing `test.todo` Phase 1 left as scaffolding, (3) avoids a `tests/phase-02/` directory that bleeds Phase boundaries into the file system.

**Q19g — Phase 1 advisory fixes:**
- WR-01 (JWT null/undefined) → fix this phase (1-line, eliminates legacy-redirect crash class)
- WR-03 (role cast) → fix this phase IF time permits (2-line). Marginal but free.
- WR-02 (deep import) → defer (Phase 1 issue; doesn't bite Phase 2 consumers)
- WR-04 (timezone IANA validation) → defer (out of scope; Phase 6 settings UI's natural home)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (for Vitest, Next.js dev) | Phase 2 build | (assumed) | per package.json `>=20` for Vitest 4 | — |
| PostgreSQL | Phase 1 schema; Phase 2 inherits | (assumed; verified by Phase 1 verification) | per CLAUDE.md PostgreSQL 17 | — |
| Prisma CLI (for migrate dev) | `isDefault` migration | yes (devDependency `prisma@^7.7.0`) | 7.7.0 | — |
| `npm run test` (Vitest) | All new test files | yes (devDependency `vitest@^4.1.4`) | 4.1.4 | — |
| `npm run build` (Next.js + tsc) | Validates query/action migration compiles | yes | next 16.2.x | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Phase 2 is a code-only refactor + one trivial Prisma migration. No new runtime services required.

## Validation Architecture

> Generated per `nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (via `vitest.config.mts`) |
| Config file | `vitest.config.mts` (existing, no changes needed) |
| Quick run command | `npm run test -- tests/<file>.test.ts` (single file) |
| Full suite command | `npm run test` (Vitest run mode, JSDOM environment) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| HSLD-02 | `createHousehold` creates Household + OWNER member atomically | unit (mocked Prisma) | `npm run test -- tests/household-create.test.ts` | ❌ Wave 0 |
| HSLD-02 | `createHousehold` rejects non-authenticated callers | unit (mocked auth) | same | ❌ Wave 0 |
| HSLD-02 | `createHousehold` slug-collision loop bounded at 10 | unit (mocked $transaction) | same | ❌ Wave 0 |
| HSLD-03 | `getUserHouseholds` returns membership list with role + isDefault | unit (mocked Prisma) | same | ❌ Wave 0 |
| HSLD-03 | `getUserHouseholds` sorts by joinedAt asc | unit | same | ❌ Wave 0 |
| HSLD-03 | `getUserHouseholds` returns empty array when user has none (edge) | unit | same | ❌ Wave 0 |
| Goal SC #1 | Plants/Rooms/Watering/Notes/Reminders queries scoped by householdId | unit (mocked Prisma; per-feature) | `npm run test -- tests/plants.test.ts tests/rooms.test.ts tests/watering.test.ts tests/notes.test.ts tests/reminders.test.ts` | ✅ (existing test files; new tests fill in todos) |
| Goal SC #4 | Each mutating Server Action throws `ForbiddenError` for non-member | unit (mocked guards) | same | ✅ (filled in via D-17 — 13+ tests) |
| Goal SC #2 | `createHousehold` produces a household appearing in `getUserHouseholds` for the creator | integration (or mocked compose) | `npm run test -- tests/household-create.test.ts` | ❌ Wave 0 |
| Goal SC #3 | `getUserHouseholds` for a user in two households returns both | integration (or mocked compose) | same | ❌ Wave 0 |
| `getCurrentHousehold` cache | Layout helper memoizes within request | unit (mocked guards, double-call) | `npm run test -- tests/household-context.test.ts` | ❌ Wave 0 (optional) |
| Layout chokepoint | Layout calls `getCurrentHousehold` | source-shape (file read) | `npm run test -- tests/phase-2-layout-chokepoint.test.ts` (or merge into household-create) | ❌ Wave 0 |
| `revalidatePath` patterns | Each migrated action revalidates `/h/[householdSlug]/...` not `/dashboard` | source-shape | per-feature test file | ❌ part of D-17 wave |
| Legacy redirect stubs | `/dashboard/page.tsx` exists and calls `redirect()` | source-shape | new test file or merged | ❌ Wave 0 |
| `HouseholdMember.isDefault` | Schema has `isDefault Boolean @default(false)` | source-shape (extending existing schema test pattern) | `npm run test -- tests/household.test.ts` | ✅ (extend existing) |

**Manual smoke tests (NOT automated):**
- Bookmark `/dashboard` after migration → confirm redirect to `/h/[slug]/dashboard` works.
- Sign in → confirm landing on `/h/[slug]/dashboard`.
- Add plant → confirm hidden field carries `householdId`.
- Visit `/h/<wrong-slug>/dashboard` → confirm 404 page.
- Visit `/h/<other-users-household-slug>/dashboard` → confirm 403 / Forbidden UI.
- (Multi-user) User A in 2 households can switch URLs without seeing wrong data — covered by Phase 6 E2E.

### Sampling Rate

- **Per task commit:** `npm run test -- tests/<feature>.test.ts` (Vitest; <5s per file in JSDOM)
- **Per wave merge:** `npm run test` (full suite; <30s currently per Phase 1 verification — should remain similar)
- **Phase gate (`/gsd-verify-work`):**
  1. `npm run test` (all green; minimum 13 new ForbiddenError tests + 5+ isolation tests + 6+ create/list tests)
  2. `npm run build` (Next.js + TypeScript; zero errors — confirms `userId` references purged)
  3. `npx prisma migrate status` (confirms `isDefault` migration applied)

### Wave 0 Gaps

- [ ] `tests/household-create.test.ts` — covers HSLD-02 + HSLD-03 (`createHousehold` + `getUserHouseholds`)
- [ ] `tests/household-context.test.ts` — verifies `getCurrentHousehold` cache (optional but small)
- [ ] Add new test cases into existing `tests/plants.test.ts`, `tests/rooms.test.ts`, `tests/watering.test.ts`, `tests/notes.test.ts`, `tests/reminders.test.ts` — replacing `test.todo` stubs with real D-16 isolation tests AND D-17 ForbiddenError tests
- [ ] Extend `tests/household.test.ts` — add `HouseholdMember.isDefault` schema-shape assertion (mirror existing schema-shape test pattern)
- [ ] (Optional) `tests/_mocks.ts` — shared mock builders for `db` and `auth` (Q13 above; pursue only if duplication burden becomes painful during implementation)

**Framework install:** None — Vitest 4.1.4 already present.

## Security Domain

> Required because `security_enforcement` is enabled (default — not explicitly false in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | NextAuth v5 — `auth()` call at top of every Server Action (existing pattern, unchanged) |
| V3 Session Management | yes | JWT cookie (NextAuth v5); `requireHouseholdAccess` is the live-session-bound authorization check |
| V4 Access Control | **CRITICAL — primary phase concern** | `requireHouseholdAccess(householdId)` live DB check on every Server Action (D-04, D-12, Pitfall 16); cross-household read isolation via mocked-Prisma tests (D-16); ForbiddenError tests on every mutating action (D-17) |
| V5 Input Validation | yes | Zod v4 schemas at every Server Action; `householdId: z.string().cuid()` validates the new field |
| V6 Cryptography | partial (no new crypto in this phase; slug uses existing `randomBytes` from Phase 1) | `generateHouseholdSlug` uses `crypto.randomBytes` with rejection sampling — no MD5/SHA-1, no `Math.random()` |

### Known Threat Patterns for {Next.js + NextAuth + Prisma stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Cross-household data leak via missed `householdId` filter** | I (Information Disclosure) | D-10 + D-16 (every query asserts `where: { householdId }`); compile-time check via TypeScript (Plant.userId removed by Phase 1, so missed filters fail to compile) |
| **Stale JWT after household removal** | E (Elevation of Privilege) | D-04 + D-18 (live `requireHouseholdAccess` check on every Server Action); React `cache()` is per-request, never cross-request |
| **URL-as-authorization-source bypass** | E | D-03 — slug resolves to id via DB lookup; id is then membership-checked. Cannot fabricate membership by URL manipulation |
| **Server Action bypassing membership check** | E | D-17 mandatory test on every mutating action (13+ tests) — any action that fails to call `requireHouseholdAccess` fails its dedicated Forbidden test |
| **Form parameter tampering (`householdId` swapped to attacker-controlled id)** | E | Zod parse + `requireHouseholdAccess` rejects unknown ids; even if Zod shape matches, the membership check rejects |
| **Mass assignment via Server Action `data` blob** | T (Tampering) | Each Server Action defines a Zod schema with explicit allowed fields; `parsed.data` is the only source for DB write payload, NOT raw input |
| **CSRF on Server Actions** | T | Next.js Server Actions have built-in same-origin protection via the action ID system [CITED: Next.js docs; not a new concern this phase] |
| **Demo user data exposure** | I | Existing demo-mode guard `if (session.user.isDemo) return { error: ... }` preserved verbatim in every action (D-12 step 2) |
| **Slug enumeration via `/h/<guess>` requests** | I | Slug is 8-char random base32url (54-char alphabet) → 54^8 ≈ 7.2 × 10^13 space; even if guessed, `requireHouseholdAccess` rejects non-members. 404 vs 403 distinction (D-19) does NOT leak existence to non-members because the layout calls `notFound()` BEFORE `requireHouseholdAccess` — pattern: known slug + non-member = 403 (information disclosure of "this slug exists"). Acceptable per Phase 1 D-19; revisit only if slug-existence is sensitive |
| **`unstable_update` not called when membership revoked** | E (future Phase 4 concern) | Not Phase 2 scope; `revokeMembership` is Phase 4. Pitfall 16 mitigation in Phase 2 is the live check (which makes JWT staleness moot for read/write authorization, even without JWT re-issue) |

**Phase 2 security verdict:** This is the highest-impact security phase in the milestone. The mocked-Prisma isolation tests (D-16) + ForbiddenError tests (D-17) form the test-driven safety net for V4 (Access Control) — by far the most important ASVS category for this codebase. If those tests are skipped or weakly written, cross-household leaks become possible despite the live check.

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/next.js` (v16.2.2) — `06-fetching-data.mdx` (React `cache()` pattern), `revalidatePath.mdx` (dynamic-segment + type parameter), `layout.mdx` (async `params: Promise<...>`), `forbidden.mdx` (auth interrupts experimental), `redirecting.mdx` (Server Action + redirect)
- Context7 `/prisma/prisma` (v7.7.0) — "Prisma Transactions" (`$transaction` interactive form), "Filtering Data with Where Conditions" (nested-relation filter syntax)
- Codebase inspection: `prisma/schema.prisma`, `src/features/household/{guards,queries,schema}.ts`, `src/features/auth/{actions,schemas}.ts`, `src/features/{plants,rooms,watering,notes,reminders}/{queries,actions,schemas}.ts`, `src/app/(main)/...`, `auth.ts`, `auth.config.ts`, `proxy.ts`, `tests/{household,plants,rooms,watering,notes,reminders}.test.ts`
- npm registry — `npm view next/prisma/next-auth/zod version` (current: next 16.2.4, prisma 7.7.0, next-auth-stable 4.24.14, zod 4.3.6)

### Secondary (MEDIUM confidence)
- nextjs.org/docs/app/api-reference/config/next-config-js/authInterrupts — confirmation that `forbidden()` is canary-only as of April 2026
- Phase 1 verification doc at `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-VERIFICATION.md` — confirmation of WR-01..WR-04 and phase completion state
- `.claude/skills/nextjs/references/{data-patterns,async-patterns,error-handling,file-conventions,directives}.md` — project skill alignment with chosen patterns

### Tertiary (LOW confidence)
- WebSearch finding "April 2026 Next.js 16 release" — used only for cross-confirmation of `revalidatePath` type param and `forbidden()` experimental status

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package/version verified against npm + Context7
- Architecture (layout chokepoint, React `cache()`, Server Action live check): HIGH — Context7 examples are direct match
- Pitfalls: HIGH — derived from PITFALLS.md (binding) plus Phase 1 review WR-01..WR-04 advisories that bite Phase 2 consumers
- Test strategy: MEDIUM — D-18 "real Prisma test DB" wording in CONTEXT.md doesn't match Phase 1's actual mocked-DB pattern; recommended Q15 clarification
- `HouseholdMember.isDefault`: HIGH — verified inline that the column is absent

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days; stable Next.js 16 / Prisma 7 / NextAuth v5 beta — no major releases expected)
