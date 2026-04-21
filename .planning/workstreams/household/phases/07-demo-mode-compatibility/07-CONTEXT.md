# Phase 7: Demo Mode Compatibility - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the demo seed so a visitor arriving at `/demo` lands on a multi-member household with an active mid-window cycle and a future availability period — making rotation, assignee countdown, and availability-driven skip UI visible without authentication barriers. Ensure every mutating Server Action refuses writes in demo mode via the existing `session.user.isDemo` read-only guard, and lock that in with a regression test so future phases (Phase 8 snooze, onward) cannot ship a mutating action without the guard.

**Explicitly NOT in scope:**
- New "demo admin" / reset-on-visit UX (manual re-seed only)
- Disabling/greying out UI controls in demo mode (server-side guard is sufficient; informative error toast is kept)
- Signed-out viewing of demo data without the demo sign-in hop (demo still signs in as demo user)
- Email or real credential attachment to fake sample members (seed-only User rows with unusable passwords)

</domain>

<decisions>
## Implementation Decisions

### Members + cycle + availability seeding
- **D-01:** Demo household = 3 members: the existing demo user plus **two** newly seeded real `User` rows with fake emails (e.g. `alice@demo.plantminder.app`, `bob@demo.plantminder.app`). Real `User` + `HouseholdMember` rows are required so rotation math, availability auto-skip, and assignee-gated notifications all function naturally against the seeded data — fake stubs would break cycle engine and notification queries.
- **D-02:** Sample members' credentials must be unusable as login targets. Their `passwordHash` must be a known-invalid sentinel (e.g. bcrypt hash of a random 64-byte CSPRNG value that is never stored elsewhere) so no one can accidentally log in as them even if the email is guessed. They exist as data, not accounts.
- **D-03:** Sample members are never marked `isDemo` (the `isDemo` token flag in `auth.ts` is strictly derived from `email === DEMO_EMAIL`). If the unusable-password invariant is ever broken, logging in as a sample member would *not* pick up the demo guard — so keeping passwords unusable is load-bearing.
- **D-04:** Demo household starts **mid-cycle**: `Cycle.startDate = now - 3 days`, `endDate = now + 4 days` (7-day duration). Demo user is the active assignee (so `CycleCountdownBanner`, skip control, and cycle-start / reassignment banners all render with meaningful state for the demo user).
- **D-05:** Rotation order: demo user at `rotationOrder: 0` (assignee per the mid-window anchor math), sample members at `rotationOrder: 1` and `rotationOrder: 2`. Exact member names are Claude's discretion.
- **D-06:** Sample availability period: seeded on a **sample member** (not the demo user) in a **future window** (e.g. `startDate = now + 10 days`, `endDate = now + 17 days`). This shows the availability list UI and preview of future auto-skip behavior without interfering with the seeded "demo user is current assignee" state.
- **D-07:** Demo household's `Cycle` row MUST be created during seed. Current `startDemoSession` + `prisma/seed.ts` use raw `tx.household.create` + `tx.householdMember.create` and bypass the Phase 3 Cycle #1 bootstrap baked into `createHousehold`. Seed must either (a) route through `createHousehold` for bootstrap + then manually walk the cycle back 3 days, or (b) inline `tx.cycle.create` using `computeInitialCycleBoundaries` from the cycle engine. Planner picks; both must produce a valid active `Cycle` row.

### Guard semantics — silently blocked
- **D-08:** Interpret HDMO-02's "silently blocked" loosely: no DB write, no crash, no redirect, no broken UI. Keep the **existing** `{ error: "Demo mode — sign up to save your changes." }` return shape on all 15 household mutating actions (and any Phase 8+ additions). The toast is educational and nudges sign-up; it satisfies "no new code path" literally — zero guard changes required.
- **D-09:** Do **not** introduce `isDemo` wiring into member/invitation/settings UI components to pre-disable buttons. Server-side short-circuit is the single enforcement point.

### Seed placement + idempotency
- **D-10:** `prisma/seed.ts` is the **single source of truth** for the expanded demo seed (demo user + 2 sample members + household + 2 rooms + 8 plants + Cycle #1 mid-window + 1 future availability). Developers run `npx prisma db seed` to get the full demo state.
- **D-11:** `startDemoSession` (`src/features/demo/actions.ts`) drops its lazy creation branch. It becomes: `findUnique` demo user → sign in → redirect. If the demo user is missing, return an error directing the dev to run the seed. This is the "one source of truth" narrative — the lazy path drifted from the canonical seed over v1 and this milestone, and keeping two code paths has been a consistent risk.
- **D-12:** No automated reset (no cron, no per-visit wipe). If guard regressions or manual DB edits corrupt demo state, devs re-run `prisma db seed`. With all 15 guards in place plus the Phase 7 regression test (D-13), visible mutation is expected to be a bug to fix rather than state to scrub.

### Audit / enforcement test
- **D-13:** Add a static test file (e.g. `src/features/__tests__/demo-guard-audit.test.ts`) that:
  1. Globs every `src/features/**/actions.ts` file.
  2. Parses each `export async function <name>(...)` block.
  3. Asserts each function body contains the literal `session.user.isDemo`.
  Failure lists the offending action(s) with file path + function name. Runs in the standard Vitest suite — no runtime deps, no Prisma needed.
- **D-14:** Scope = every exported function in any `features/**/actions.ts`. File-name convention is the contract. Read-only helpers mis-placed in an `actions.ts` file should either be moved out or get the guard (negligible cost — `session.user.isDemo` is a one-liner).
- **D-15:** Known allowed exception: the `/api/cron/advance-cycles` route handler (not a Server Action, not in `features/**/actions.ts`) is out of scope for the audit — cron is authenticated via `CRON_SECRET` header, not via `auth()` session, and there is no `session.user.isDemo` to check.

### Claude's Discretion
- Sample member names and email local-parts (keep them obviously fake: `alice`, `bob`, `chris`, etc.)
- Exact bcrypt unusable-password construction — whatever reliably fails `signIn`
- Whether to seed a few `HouseholdNotification` rows for the demo assignee so the bell dropdown has content, or leave bell empty (cycle-start banner already renders from Cycle data)
- The exact date math for the mid-window cycle — use `date-fns` + household timezone ("UTC" per the current demo household config); don't introduce a third mechanism
- Whether `reorderRotation` / invitation seed needs sample invitation tokens in the Demo Household or can leave the InvitationsCard empty (empty is fine for v1; owner can still click "Generate link" to see the generated-token UX fire... and be blocked by the demo guard, demonstrating HDMO-02 in-situ)
- Whether to also seed an `Availability` row on the demo user for the "delete my availability" flow, or leave that flow unseeded (neither is required by HDMO-01)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/workstreams/household/ROADMAP.md` §"Phase 7: Demo Mode Compatibility" — goal + the two success criteria (pre-seeded demo household; all household-mutating actions silently blocked)
- `.planning/workstreams/household/REQUIREMENTS.md` §"Demo mode compatibility" — HDMO-01, HDMO-02

### Existing demo implementation to extend
- `src/features/demo/actions.ts` — `startDemoSession` (currently self-bootstraps user + household + rooms + 8 plants; lazy path removed per D-11) and `seedStarterPlants` (already guarded)
- `src/features/demo/seed-data.ts` — `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_PLANTS`, `STARTER_PLANTS`
- `prisma/seed.ts` — current seed flow; this is where the expanded demo seed lands (D-10)
- `src/app/(auth)/demo/route.ts` — `GET /demo` handler that calls `startDemoSession`
- `auth.ts` (project root) — JWT callback at line 21 deriving `token.isDemo = dbUser?.email === DEMO_EMAIL`; session callback at line 38 propagating to `session.user.isDemo`. Sample members MUST NOT satisfy this equality (D-03).

### Patterns to reuse (prior phase decisions)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` — household schema, `requireHouseholdAccess`, `HouseholdMember` with `rotationOrder` + `isDefault`
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` — Cycle #1 bootstrap via `computeInitialCycleBoundaries`, `transitionCycle` single-write-path, `@date-fns/tz` TZDate; relevant for D-07 seed-cycle construction
- `.planning/workstreams/household/phases/04-invitation-system/04-CONTEXT.md` — membership mutation guards; same pattern must hold when seed adds sample members
- `.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-CONTEXT.md` — settings actions (`updateHouseholdSettings`, `reorderRotation`, `setDefaultHousehold`) already have `isDemo` guards; audit test (D-13) verifies

### Guard pattern to preserve
- `src/features/household/actions.ts` — 15 actions (`createHousehold`, `skipCurrentCycle`, `createAvailability`, `deleteAvailability`, `createInvitation`, `revokeInvitation`, `acceptInvitation`, `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember`, `markNotificationsRead`, `setDefaultHousehold`, `updateHouseholdSettings`, `reorderRotation`) all implement the canonical guard at Step 2 after `auth()`. Reference implementation: `createHousehold` at lines 44–52.
- `src/features/plants/actions.ts`, `src/features/rooms/actions.ts`, `src/features/watering/actions.ts`, `src/features/notes/actions.ts`, `src/features/reminders/actions.ts`, `src/features/auth/actions.ts`, `src/features/demo/actions.ts` — already-guarded action surfaces audited by D-13.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/demo/actions.ts::startDemoSession` — existing entry point; strips down to sign-in-only (D-11)
- `src/features/demo/seed-data.ts` — home for the new `DEMO_SAMPLE_MEMBERS` constant (emails, display names, rotation orders)
- `prisma/seed.ts` — expands to call a new `seedDemoHousehold` helper
- `src/features/household/actions.ts::createHousehold` (lines 44–52) — canonical isDemo guard (Step 2 of the 7-step Server Action template)
- `src/features/rotation/` engine module (per Phase 3) — `computeInitialCycleBoundaries`, `transitionCycle`; used to manufacture the mid-window cycle (D-04, D-07)
- `src/lib/slug.ts::generateHouseholdSlug` — already used by both `createHousehold` and current demo seed; reuse for the Demo Household slug
- `auth.ts` (project root) — JWT `isDemo` derivation; do not extend this logic

### Established Patterns
- **7-step Server Action template** (session → demo guard → Zod → `requireHouseholdAccess` → business check → `$transaction` write → `revalidatePath`) is the enforced shape for every mutating action. Demo guard is Step 2; regression test (D-13) locks this.
- **Slug collision loop, bounded at 10 attempts** — used by `registerUser`, `createHousehold`, and demo seed. Sample members don't need slugs (they're users), but the Demo Household itself does.
- **Transactional user+household+member creation** — mirrored in `registerUser` (Phase 1) and current `startDemoSession`. Sample members added either in the same `$transaction` or via separate `tx.user.create` calls; either shape matches existing convention.
- **`@date-fns/tz` TZDate is the only timezone arithmetic primitive.** The demo household's timezone is `"UTC"` (per current seed); don't introduce a new date helper for the mid-window computation.

### Integration Points
- `prisma/seed.ts` end-to-end orchestration — the expanded seed slots into the existing `if (!existingDemo) { ... }` block, replacing the current inline 2-step (household + single member) with full 3-member + cycle + availability construction.
- `src/app/(auth)/demo/route.ts` — behavior unchanged on the happy path; error branch now fires more often (when `prisma db seed` wasn't run).
- Notification queries (Phase 5) — `getUnreadCycleEventCount`, `getCycleNotificationsForViewer` naturally pick up the demo cycle; no wiring needed.
- Settings page (Phase 6) — `/h/<demo-slug>/settings` renders the demo household's members/invitations/availability; all mutation buttons hit demo guards.
- The audit test (D-13) lives in the test tree for `src/features/` — naturally co-located with what it enforces.

</code_context>

<specifics>
## Specific Ideas

- The mid-window + demo-user-as-assignee choice is driven by "make the countdown banner do something on first visit." Freshly-started cycle (day 0 of 7) was the alternative — rejected because "4 days left" reads more interesting than "7 days left" and reliably exercises urgency styling once the window crosses `daysLeft <= 1`.
- The sample availability period being future-dated (not currently overlapping) is intentional — HDMO-01 asks for a *visible* sample, not a currently-firing auto-skip. A currently-firing skip would force the assignee to be a non-available member, which contradicts D-04.
- The static grep test pattern (D-13) mirrors the Phase 6-07 "links-audit" test (ALLOWED_PREFIXES grep) and Phase 6-05b source-grep regression tests (checking for the literal "leave household" substring) already in the codebase. Same mechanism, new invariant.

</specifics>

<deferred>
## Deferred Ideas

- **Per-visit demo reset** — deferred; only pursue if demo regressions become visible in production staging.
- **Disabled-button UX in demo mode** — deferred; server-side guard is sufficient for v1. Revisit if visitor confusion from click-then-toast UX is reported.
- **Seeding cycle history** (past cycles to show what `AUDT-01` / `AUDT-02` look like over time) — out of scope; the single active Cycle + member attribution on WateringLogs is enough for v1 demo.
- **Signed-out pass-through view of demo data** — ROADMAP.md SC phrasing ("visible without authentication") is looser than HDMO-01 ("demo user is a member…"). Interpretation: visitor still signs in as the demo user; "without authentication" means "without the visitor creating their own account." No signed-out data access path introduced.
- **Observer role for sample members** — deferred to `MEMBX-01` (future milestone). Sample members are regular `MEMBER`s in the rotation.
- **Sample invitation tokens seeded into the Demo Household** — Claude's discretion per decisions; default is to seed none (owner clicks "Generate link" → demo guard fires → demonstrates HDMO-02 in-situ).

</deferred>

---

*Phase: 07-demo-mode-compatibility*
*Context gathered: 2026-04-20*
