# Phase 2: Query + Action Layer Update - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Workstream:** `household`

<domain>
## Phase Boundary

Migrate every v1 query and Server Action in `src/features/{plants,rooms,watering,notes,reminders}/` from `userId`-scoped ownership to `householdId`-scoped ownership; ship the `/h/[householdSlug]/` URL prefix and a single cross-request household chokepoint in the route layout; deliver `createHousehold` and `getUserHouseholds` so Phase 6's settings surface only has to wire the UI. Every authenticated route moves under `/h/[slug]/` this phase; legacy paths keep a redirect bridge.

**Explicitly not in this phase:** household settings UI, switcher component, member-reorder controls, invite-link flows, rotation engine, Cycle-based assignee gating for reminders, demo-household seeding. Those are Phases 3–7. The Invitation and Cycle Prisma tables already exist (Phase 1), but neither gets behavior here.

</domain>

<decisions>
## Implementation Decisions

### Household plumbing & URL layer

- **D-01:** Ship the `/h/[householdSlug]/` URL prefix in Phase 2. This is a deliberate elevation from ROADMAP (Phase 6 HSET-01 territory) — doing it now prevents a double move of both queries/actions and routes in Phase 6, and keeps D-14's "`activeHouseholdId` is not a permission source" clean. Pitfall 17's intent ("URL-scoped routing decision established early") is honored in spirit.
- **D-02:** All `src/app/(main)/...` routes move under `src/app/(main)/h/[householdSlug]/...` in one cut-over. Scope: `dashboard/`, `plants/`, `plants/[id]/`, `rooms/`, `rooms/[id]/`, and any nested pages reachable from authenticated navigation. Legacy paths (`/dashboard`, `/plants`, `/rooms`, etc.) each keep a thin redirect stub that resolves `session.user.activeHouseholdId` → `household.slug` and `redirect()`s to `/h/[slug]/<suffix>`. One-shot bridge; removable in a future cleanup.
- **D-03:** The household authorization chokepoint is `src/app/(main)/h/[householdSlug]/layout.tsx`. The layout resolves the slug via `resolveHouseholdBySlug`, calls `requireHouseholdAccess(household.id)`, and stores the result behind a React `cache()`-wrapped helper (tentatively `getCurrentHousehold()` exported from `src/features/household/context.ts`). Nested Server Components and pages read the cached `{ household, member, role }` without repeating the DB round-trip. 404 when slug is unknown; 403 (`ForbiddenError`) when user is not a member.
- **D-04:** Server Actions receive `householdId` as an explicit argument, threaded via `<input type="hidden" name="householdId">` rendered by server-component forms. The first line of every mutating action is `await requireHouseholdAccess(householdId)` — live DB check on every invocation (Pitfall 16; D-18 enforced). No derive-from-entity, no JWT-read fallback, no implicit context.
- **D-05:** Middleware (`proxy.ts`) stays as-is: edge session check only. It cannot replace the guard because (a) it cannot return the rich `{ household, member, role }` object downstream code needs, (b) a DB-backed membership check from edge would either require `@prisma/adapter-pg` retooling or JWT-cached memberships (latter violates D-14/D-18), and (c) Auth.js v5 guidance explicitly recommends middleware for optimistic session checks and delegating real authorization to Server Components/Actions.

### HSLD-02: create household

- **D-06:** `createHousehold(data)` Server Action ships in `src/features/household/actions.ts`. Uses `db.$transaction` to insert `Household` + `HouseholdMember(role='OWNER', rotationOrder=0)`. Slug via `generateHouseholdSlug` from `src/lib/slug.ts` (same helper as Phase 1 signup flow). Default timezone = caller's browser-detected timezone (same pattern as register-form); default cycleDuration = 7; rotationStrategy = `sequential`. Returns `{ household }` or `{ error }`.
- **D-07:** No UI in Phase 2. The action is reachable only from tests until Phase 6 builds the settings form that consumes it. Integration test asserts: transaction atomicity (user-without-household never exists), unique-slug correctness, OWNER role assignment, rotationOrder default.

### HSLD-03: list my households

- **D-08:** `getUserHouseholds(userId)` query ships in `src/features/household/queries.ts`. Returns `Array<{ household: Household, role: 'OWNER' | 'MEMBER', isDefault: boolean, joinedAt: Date }>`, sorted by `joinedAt` ascending so the auto-created solo household appears first. `isDefault` reads the forthcoming `HouseholdMember.isDefault` column — if the column does not already exist from Phase 1 shape-complete schema, Phase 2 adds it as a nullable Boolean with default `false`.
- **D-09:** No UI in Phase 2 for this either. Phase 6's household switcher and settings page are the consumers.

### Query-layer migration

- **D-10:** Every `where: { userId }` clause in `src/features/{plants,rooms,watering,notes,reminders}/queries.ts` swaps to `where: { householdId }` (direct for Plant/Room; nested `plant: { householdId }` for WateringLog/Note/Reminder which reach household via their plant relation). Query function signatures change from `(userId: string, ...)` to `(householdId: string, ...)`. Callers (pages) supply `householdId` from `getCurrentHousehold().household.id`.
- **D-11:** No backward-compatibility shims. `userId` parameters are removed outright. The register-user-created column (`createdByUserId` / `performedByUserId`) is populated at write sites from `session.user.id` — pure audit, never used in query filters.

### Action-layer migration

- **D-12:** Every mutating Server Action in `src/features/{plants,rooms,watering,notes,reminders}/actions.ts` is rewritten to:
  1. `auth()` → reject if no session
  2. Demo-mode guard: `if (session.user.isDemo) return { error: "..." }` — unchanged from v1
  3. Zod parse — now accepting `householdId: z.string().cuid()` in the schema
  4. `await requireHouseholdAccess(householdId)` — throws `ForbiddenError` on miss
  5. For mutations on existing entities: `db.X.findFirst({ where: { id, householdId } })` before update/delete — householdId replaces userId in the ownership filter
  6. Write — populate `createdByUserId` / `performedByUserId` from `session.user.id` (audit columns shipped in Phase 1 D-05)
  7. `revalidatePath` as before, but paths now `/h/[slug]/<suffix>`
- **D-13:** The `createPlant` action also updates the nested `reminders: { create: { userId: ..., enabled: true } }` pattern — the Reminder row still carries the creator's userId (not householdId) because a Reminder is per-user-per-plant preference, not a household-level state. Reminder's relationship to household is transitively via `plant.householdId`.

### Reminders interface (Phase 5 coordination)

- **D-14:** `getReminderCount(householdId)` and `getReminderItems(householdId)` signatures are **stable across Phase 2 → Phase 5**. Phase 2 body: `{ where: { plant: { householdId }, enabled: true } }`. Phase 5 modifies the same function body to add the active Cycle join and `assignedUserId === session.user.id` gate. Callers (dashboard Server Components, NotificationBell) do not change when Phase 5 lands. Satisfies Pitfall 13.
- **D-15:** Phase 2 UX behavior: every member of a household sees the same (household-level) reminder count and overdue/due lists. This is a **deliberate temporary regression** — roommates get false-positive "due today" banners until Phase 5 delivers the assignee gate. Time-boxed to Phase 5 completion; acceptable per the ROADMAP phase ordering.

### Test strategy

- **D-16:** Cross-household read isolation is proved via **unit tests with mocked Prisma**. For each of the 5 feature query modules, tests assert that `db.X.findMany`/`findFirst` was called with `where: { householdId: <expected> }` (or nested-relation equivalent). Trust Prisma to honor the filter — no real-DB integration test for reads this phase. Mock via `vi.mock('@/lib/db')` as the existing test suite does.
- **D-17:** Every mutating Server Action gets a **dedicated Forbidden test** that asserts a non-member user attempting the action triggers `ForbiddenError` (thrown by `requireHouseholdAccess` inside the action). Minimum coverage set (13 tests, parameterized where sensible): `createPlant`, `updatePlant`, `archivePlant`, `unarchivePlant`, `deletePlant`, `logWatering`, `editWateringLog`, `deleteWateringLog`, `createRoom`, `updateRoom`, `deleteRoom`, `createNote`, `deleteNote`. Add `snoozeReminder` if that action exists in v1. This is the core enforcement test for Pitfall 16.
- **D-18:** `createHousehold` and `getUserHouseholds` get integration tests (real Prisma test DB, same pattern as Phase 1 `tests/household.test.ts`). Create asserts transactional invariants; list asserts a user with two memberships returns both with correct roles.

### Claude's Discretion

- Exact file layout for the React `cache()` helper (`src/features/household/context.ts` vs extending `guards.ts`) and the consumer function name (`getCurrentHousehold()` is a placeholder).
- Legacy-path redirect implementation: single `src/app/(main)/layout.tsx` redirect vs one redirect `page.tsx` per legacy route segment. Either works.
- Null/undefined `session.user.activeHouseholdId` edge case handling at the legacy-path redirect and at login landing — probably redirect to `/login` since Phase 1 guarantees every authenticated user has a membership, but document the fallback.
- Login post-authentication landing target: `auth.config.ts:22` currently hardcodes `/dashboard`. This probably needs to become `/h/[activeSlug]/dashboard`; the slug lookup path (redirect page vs `redirect` callback vs post-login client navigation) is a planning-time call.
- Whether `updateTimezone` (`src/features/auth/actions.ts:110`) needs to move to or mirror in `src/features/household/actions.ts` as `updateHouseholdTimezone` — since household now owns the timezone, the user-level timezone column may be redundant. Planner to audit.
- Test-file organization: one `tests/phase-02/cross-household-isolation.test.ts` or per-feature `tests/<feature>-authz.test.ts`. Pick whatever keeps runs fast.
- Whether to address the advisory warnings from Phase 1 review (WR-01 JWT null/undefined, WR-03 role cast) opportunistically in this phase since consumers now materialize, or defer to a cleanup phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/workstreams/household/ROADMAP.md` §Phase 2 — Goal, success criteria, pitfall flags (1, 13, 16, 17)
- `.planning/workstreams/household/REQUIREMENTS.md` §Household — HSLD-02, HSLD-03 (in scope); AUDT-01, AUDT-02 (columns exist; wired at write sites here)
- `.planning/workstreams/household/STATE.md` §Accumulated Context §Decisions

### Phase 1 binding decisions (the foundation this phase builds on)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §decisions — D-10/D-11 slug shape, D-13/D-14 JWT & activeHouseholdId semantics, D-16/D-17/D-18/D-20 guard contract, D-19 ForbiddenError, D-05 audit columns
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-VERIFICATION.md` — what Phase 1 actually delivered; the WR-01/WR-03 advisories may surface as consumer-facing bugs this phase

### Pitfalls (binding)
- `.planning/research/PITFALLS.md` §Pitfall 1 — Missed `householdId` filter risk; drives D-10 and D-16 test strategy
- `.planning/research/PITFALLS.md` §Pitfall 13 — Reminder interface coordination; drives D-14/D-15
- `.planning/research/PITFALLS.md` §Pitfall 16 — Live membership check in Server Actions; drives D-04/D-12/D-17
- `.planning/research/PITFALLS.md` §Pitfall 17 — URL-scoped household routing; elevated from Phase 6 to this phase by D-01

### Project & tech stack
- `.planning/PROJECT.md` §Current Milestone — Household and Rotation goals
- `CLAUDE.md` §Technology Stack — Next.js 16 App Router, Prisma 7, NextAuth v5 beta, Zod v4
- `CLAUDE.md` §Stack Patterns — Server Actions + Zod + Prisma writes; layouts + React `cache()`; `proxy.ts` (edge) vs route-tree (Node runtime)

### Auth.js v5 & Next.js 16 runtime guidance
- Auth.js v5 migration guide — `authorized` callback for proxy.ts: session checks only, real authz belongs in route handlers. Binds D-05.
- Next.js 16 App Router layout nesting + React `cache()` — binds D-03.

### Existing codebase anchor points
- `src/features/household/guards.ts` — `requireHouseholdAccess`, `ForbiddenError` (Phase 1)
- `src/features/household/queries.ts` — `resolveHouseholdBySlug` (Phase 1); `getUserHouseholds` added this phase
- `src/features/household/schema.ts` — Zod v4 enums (Phase 1); extended this phase with `createHouseholdSchema`
- `src/lib/slug.ts` — `generateHouseholdSlug` (Phase 1) consumed by D-06 `createHousehold`
- `src/features/{plants,rooms,watering,notes,reminders}/queries.ts` — migrated under D-10
- `src/features/{plants,rooms,watering,notes,reminders}/actions.ts` — migrated under D-12
- `src/app/(main)/{dashboard,plants,rooms}/...` — moved under `src/app/(main)/h/[householdSlug]/...` per D-02
- `src/app/(main)/h/[householdSlug]/layout.tsx` — new file; the chokepoint for D-03
- `auth.ts`, `auth.config.ts`, `proxy.ts` — login redirect target update (Discretion #4); `proxy.ts` matcher possibly adjusted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 1 guard (`src/features/household/guards.ts`)** — `requireHouseholdAccess` returns `{ household, member, role }`; consumed in the layout and every Server Action.
- **Phase 1 slug resolver (`src/features/household/queries.ts`)** — `resolveHouseholdBySlug` consumed by the new `/h/[slug]/layout.tsx`.
- **Phase 1 slug generator (`src/lib/slug.ts`)** — `generateHouseholdSlug` reused by `createHousehold`.
- **Zod v4 schemas (`src/features/household/schema.ts`)** — pattern to extend with `createHouseholdSchema` and any Phase-2 shapes.
- **Existing `src/features/*/schemas.ts` files** — each gets `householdId: z.string().cuid()` added.
- **`db.$transaction` pattern** — already used in `src/features/auth/actions.ts:44-86` for the register flow; Phase 2's `createHousehold` mirrors it.
- **`revalidatePath` pattern** — already used throughout; only the paths change to `/h/[slug]/...`.

### Established Patterns
- **Server Components call Prisma directly**, Server Actions use `"use server"` + Zod + Prisma, and both use the central `db` singleton from `src/lib/db.ts` — unchanged.
- **JWT session strategy with callback-based enrichment** — unchanged; `activeHouseholdId` continues to be set at sign-in only (Phase 1 D-13).
- **Demo-mode guard** — every action has `if (session.user.isDemo) return { error }`; carry forward verbatim until Phase 7 restructures.
- **Feature-folder pattern** — `src/features/{domain}/{actions,queries,schema,guards}.ts` is the established layout.

### Integration Points
- **Layout chokepoint** — `src/app/(main)/h/[householdSlug]/layout.tsx` is the new authorization entry point. React `cache()` is the mechanism that gives it the "called once per request" property.
- **Legacy-path redirects** — from `src/app/(main)/dashboard/page.tsx` etc. (pre-move) to a redirect page that reads `session.user.activeHouseholdId` and `redirect()`s.
- **Login landing target** — `auth.config.ts:22` `Response.redirect(new URL("/dashboard", nextUrl))` becomes slug-aware; how depends on where `activeHouseholdId` → slug happens (discretion).
- **Phase 6 consumer interface:** `getUserHouseholds` (D-08) is consumed by the switcher; `createHousehold` (D-06) is consumed by the settings form.
- **Phase 5 consumer interface:** `getReminderCount(householdId)` / `getReminderItems(householdId)` keep Phase 2's signatures; Phase 5 only modifies the body (D-14).
- **Phase 7 consumer interface:** demo-household seeding will use `createHousehold` + seed script; Phase 2 needs no awareness beyond leaving the `isDemo` guard intact.
- **`prisma/schema.prisma`** — likely one additive migration this phase: `HouseholdMember.isDefault Boolean @default(false)` if not shape-complete from Phase 1. Confirm during planning.

</code_context>

<specifics>
## Specific Ideas

- **"Isn't there a middleware or something that could be leverage for this guard?"** — The clarifying exchange on this question drove D-03 and D-05. Decision rationale is binding: `proxy.ts` remains edge session-check-only; the real per-request chokepoint is the route-tree layout with React `cache()`. Document the reasoning so Phase 3+ doesn't re-litigate.
- The URL prefix (`/h/[householdSlug]/`) ships **this phase**, not Phase 6, even though ROADMAP originally placed route-scoping under Phase 6 (HSET-01). The user's direct instruction was to ship URL-scoping alongside the query/action migration. Planner must treat Phase 6 HSET-01 scope as shrunk: switcher + settings page land in Phase 6; route tree moves land here.
- The layout-based guard with `cache()` is chosen specifically to match the user's request for a "middleware-like" single chokepoint without sacrificing D-18 (live DB check) or D-20 (rich return object). No re-querying inside nested Server Components.
- Server Actions receive `householdId` via hidden form field rather than deriving from entity — chosen for auditability (grep `name="householdId"` finds every form that submits a household-scoped action).

</specifics>

<deferred>
## Deferred Ideas

- **Household switcher UI and settings page** — Phase 6 (HSET-01, HSET-03). Phase 2 ships the data layer; Phase 6 ships the surface.
- **Default-household selection UI (HSET-02)** — Phase 6. Phase 2 surfaces `isDefault` on `getUserHouseholds` but has no write path for it.
- **Assignee-scoped reminder gating** — Phase 5. Phase 2 leaves reminder surface fully household-scoped; roommates will see the same counts until Phase 5 lands.
- **Demo-household seeding** — Phase 7. Demo-mode isDemo checks stay verbatim this phase.
- **Real-DB integration tests for cross-household read isolation** — considered, rejected in Area 4 in favor of mocked-Prisma unit tests + real `ForbiddenError` tests on every mutating action. Revisit if audit finds gaps.
- **Integration test for `updateTimezone`** — Phase 1 review flagged WR-04 (IANA validation missing). Adjacent to this phase's scope but not in it; planner may opportunistically fix, or flag for a cleanup pass.
- **JWT `activeHouseholdId` null/undefined normalization** (WR-01 from Phase 1 review) — may bite once legacy-path redirects consume it; planner should decide whether to normalize at the callback or at consumer sites.
- **Legacy path cleanup** — the `/dashboard`, `/plants`, etc. redirect stubs stay indefinitely for bookmark compatibility. Removal is not scheduled.
- **Entity-derive action contract** (where action learns `householdId` by fetching the entity) — considered, rejected in Area 1 in favor of explicit hidden-field arg. Keep in mind only if some future action naturally receives an entity id without a household context.

</deferred>

---

*Phase: 02-query-action-layer-update*
*Workstream: household*
*Context gathered: 2026-04-16*
