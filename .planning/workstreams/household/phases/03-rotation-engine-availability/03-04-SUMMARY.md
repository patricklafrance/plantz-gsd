---
phase: 03-rotation-engine-availability
plan: 04
subsystem: server-actions
tags: [server-actions, queries, cycle-1-bootstrap, availability, skip, transitionCycle]

# Dependency graph
requires:
  - phase: 03-rotation-engine-availability
    provides: "Wave 0 scaffolding (HOUSEHOLD_PATHS.settings, fixtures, test stubs); Wave 1 schema (HouseholdNotification + Cycle.transitionReason); Wave 2 engine (transitionCycle, findOverlappingPeriod, computeInitialCycleBoundaries)"
  - phase: 02-query-action-layer-update
    provides: "7-step Server Action template + requireHouseholdAccess guard + createHouseholdSchema"
provides:
  - "Cycle #1 eager creation inside registerUser + createHousehold $transactions (D-01)"
  - "skipCurrentCycle(data) — active-assignee-only manual skip, routes through transitionCycle('manual_skip')"
  - "createAvailability(data) — Zod refinements + D-06 overlap precheck + findOverlappingPeriod"
  - "deleteAvailability(data) — D-09 dual-auth (owning member OR household OWNER)"
  - "getCurrentCycle(householdId) — active-or-paused latest Cycle"
  - "getHouseholdAvailabilities(householdId) — all rows joined with user.name + email (D-08)"
  - "4 target test files green: availability-overlap (3), availability-past-date (3), skip-current-cycle (6), auto-skip-unavailable (1)"
affects: [phase-03-05-cron, phase-04-invitations, phase-05-notifications, phase-06-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cycle #1 bootstrap inside existing $transaction via tx.cycle.create (D-01) — rollback semantics guarantee all-or-nothing with User/Household/HouseholdMember writes"
    - "skipCurrentCycle routes through transitionCycle — no alternate cycle-mutation path introduced"
    - "D-09 dual-auth in deleteAvailability: owning member OR household OWNER; ForbiddenError otherwise"
    - "Double-cast `as unknown as Awaited<ReturnType<typeof auth>>` for NextMiddleware-confused session mocks (matches pre-existing baseline)"

key-files:
  created:
    - .planning/workstreams/household/phases/03-rotation-engine-availability/03-04-SUMMARY.md
  modified:
    - src/features/auth/actions.ts
    - src/features/household/actions.ts
    - src/features/household/queries.ts
    - tests/household-create.test.ts
    - tests/phase-03/availability-overlap.test.ts
    - tests/phase-03/availability-past-date.test.ts
    - tests/phase-03/skip-current-cycle.test.ts
    - tests/phase-03/auto-skip-unavailable.test.ts

key-decisions:
  - "Cycle #1 bootstrap uses tx.cycle.create INSIDE the existing $transaction (per tech note) — not a post-commit follow-up"
  - "skipCurrentCycle is a thin wrapper that locks the current cycle, asserts caller = assignee, then delegates to transitionCycle(_, 'manual_skip')"
  - "createAvailability surfaces the first Zod issue's message directly to the user (refinement errors like 'Availability cannot start in the past.' become the user-visible error)"
  - "Prisma model types imported from @/generated/prisma/client, not @prisma/client (project-wide convention)"
  - "Mocked-Prisma test for skipCurrentCycle mocks @/features/household/guards to control requireHouseholdAccess + ForbiddenError instantiation without a live DB round-trip"

patterns-established:
  - "Cycle #1 creation pattern: compute boundaries via computeInitialCycleBoundaries(now, timezone, cycleDuration), write via tx.cycle.create with cycleNumber=1, status='active', assignedUserId=creator, memberOrderSnapshot=[{userId, rotationOrder:0}]"
  - "7-step template for D-14/D-06/D-07/D-09 actions: session → demo → Zod → requireHouseholdAccess → domain logic (overlap/ownership check) → DB write → revalidatePath"
  - "Mocked-Prisma unit test pattern for auth()-calling actions: `vi.mocked(auth).mockResolvedValue(...)` (not Once) since requireHouseholdAccess calls auth() again internally"

requirements-completed: [AVLB-01, AVLB-02, AVLB-03, AVLB-04]

# Metrics
duration: ~11 min
completed: 2026-04-18
---

# Phase 03 Plan 04: Actions + Cycle #1 Bootstrap Summary

**Cycle #1 is now written inside the same `$transaction` as User/Household/HouseholdMember for both registerUser and createHousehold (D-01). Three new Server Actions — skipCurrentCycle, createAvailability, deleteAvailability — + two new queries — getCurrentCycle, getHouseholdAvailabilities — shipped behind the 7-step template with the exact authz and validation per CONTEXT §D-06..D-09/D-14. Four Phase 3 test stubs filled with real assertions (13 new tests across 4 files); TS baseline preserved at 92 lines.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-18T03:50:33Z
- **Completed:** 2026-04-18T04:01:37Z
- **Tasks:** 3
- **Files modified:** 3 source + 5 test files
- **New tests:** 13 (3 past-date + 3 overlap + 6 skip + 1 auto-skip integration)

## Accomplishments

- Every new household (signup OR explicit `createHousehold`) has Cycle #1 written atomically with membership. Transaction rollback semantics guarantee no orphan User/Household/HouseholdMember rows if Cycle #1 fails.
- `skipCurrentCycle` enforces assignee-only skip via explicit `session.user.id === currentCycle.assignedUserId` check. Delegates to `transitionCycle(_, "manual_skip")` — no alternate cycle-mutation path.
- `createAvailability` rejects past-dated `startDate` (Pitfall 12), `endDate < startDate`, and overlapping periods (D-06 with verbatim message including existing period's formatted dates). D-06 operator check (lte/gte, NOT lt/gt) is asserted in the unit test.
- `deleteAvailability` honors D-09 dual-auth: owning member OR household OWNER; any other caller receives ForbiddenError → user-facing error.
- `getCurrentCycle` + `getHouseholdAvailabilities` queries exposed with the exact interface the Wave 4 cron orchestrator and Phase 6 dashboard banner will consume.
- Integration test `auto-skip-unavailable.test.ts` exercises the full engine path against real Postgres: member1 blocked by Availability → walker lands on member2 → outgoing `transitionReason='auto_skip_unavailable'` → notification type `cycle_reassigned_auto_skip` for member2 (not the owner, not the skipped member1).

## Task Commits

1. **Task 1: D-01 Cycle #1 bootstrap in registerUser + createHousehold $transactions** — `324cdab` (feat)
2. **Task 2: skipCurrentCycle + createAvailability + deleteAvailability actions + getCurrentCycle + getHouseholdAvailabilities queries** — `a7dfa5c` (feat)
3. **Task 3: Populate 4 target test files with real assertions** — `433439f` (test)

## Files Created/Modified

- `src/features/auth/actions.ts` — import `computeInitialCycleBoundaries`; append `tx.cycle.create` inside the `$transaction` after the HouseholdMember insert.
- `src/features/household/actions.ts` — import engine/guards/schema/paths additions; append `tx.cycle.create` inside `createHousehold`'s `$transaction`; append three new exports: `skipCurrentCycle`, `createAvailability`, `deleteAvailability`.
- `src/features/household/queries.ts` — import `Cycle`, `Availability` types from `@/generated/prisma/client`; append `getCurrentCycle` + `getHouseholdAvailabilities` exports.
- `tests/household-create.test.ts` — augment two `txMock` objects with `cycle: { create: vi.fn() }` (the action now writes Cycle #1 in the same transaction) + assertion on the new call.
- `tests/phase-03/availability-past-date.test.ts` — 3 new unit tests on `createAvailabilitySchema` Zod refinements.
- `tests/phase-03/availability-overlap.test.ts` — 3 new mocked-Prisma unit tests covering D-06 overlap precheck (reject + success + operator check).
- `tests/phase-03/skip-current-cycle.test.ts` — 6 new unit tests (no-session, demo, invalid Zod, ForbiddenError, non-assignee, happy path with transitionCycle call shape + revalidatePath assertion).
- `tests/phase-03/auto-skip-unavailable.test.ts` — 1 new integration test exercising the full walker + transitionCycle path against real Postgres.

## Decisions Made

1. **Cycle #1 bootstrap is written via `tx.cycle.create`** inside the existing transaction callback (per tech note and D-01). Never a post-commit follow-up — rollback must include the Cycle #1 row.
2. **skipCurrentCycle delegates to `transitionCycle`** rather than mutating `Cycle` rows directly. This preserves the "single write path" invariant established in Wave 2 and keeps concurrency semantics (FOR UPDATE SKIP LOCKED + same-tx notification) automatic for future callers.
3. **createAvailability surfaces the first Zod issue's message** via `parsed.error.issues[0]?.message` so the user-facing error for a past `startDate` reads "Availability cannot start in the past." and for inverted dates reads "End date must be after start date." This matches Pitfall 12's explicit error-message requirement.
4. **Prisma model types imported from `@/generated/prisma/client`** (not `@prisma/client`) — this project uses a custom generator output dir; Wave 2 established the convention.
5. **Mocked-Prisma tests use `mockResolvedValue` (not `mockResolvedValueOnce`)** for `auth()` because `requireHouseholdAccess` calls `auth()` a SECOND time internally. `mockResolvedValueOnce` would leave the second call returning undefined and the action would return `{ error: "Not authenticated" }` unexpectedly.
6. **Double-cast `as unknown as Awaited<ReturnType<typeof auth>>`** applied to session mocks. The single-cast pattern (matching pre-existing style in `tests/household-create.test.ts`) produces TS2352 "NextMiddleware" confusion because `auth` imported from the relative path resolves to an overload the compiler picks incorrectly. Double cast silences it cleanly — see Deviation #1 below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Single-cast pattern `as Awaited<ReturnType<typeof auth>>` on session mocks introduces new TS2352 errors**
- **Found during:** Task 3 verification (`npx tsc --noEmit` went 92 → 109, +17 new error lines).
- **Issue:** The plan's `<read_first>` references `tests/household-create.test.ts:1-62` as scaffold. That scaffold uses the single-cast pattern. It compiles for household-create because those errors already contribute to the 92-line baseline. Adding the SAME pattern in new files increases the error count, violating the "no new TS errors" success criterion.
- **Fix:** Changed all session-mock casts in the new phase-03 files to the double-cast `} as unknown as Awaited<ReturnType<typeof auth>>);` — this is what the TS error message itself suggests ("If this was intentional, convert the expression to 'unknown' first.").
- **Files modified:** `tests/phase-03/availability-overlap.test.ts`, `tests/phase-03/skip-current-cycle.test.ts`
- **Verification:** `npx tsc --noEmit | wc -l` → 92 (same as pre-plan baseline).
- **Committed in:** `433439f` (Task 3 commit).

**2. [Rule 1 - Bug] `txMock` in `tests/household-create.test.ts` missing `cycle.create` after Task 1's transaction extension**
- **Found during:** Task 1 design review — `createHousehold` now calls `tx.cycle.create`, but the mocked `txMock` only has `household` + `householdMember` properties. The action would throw `TypeError: tx.cycle is undefined` on the mocked path.
- **Issue:** Plan Task 1 `<behavior>` requires "existing tests in `tests/household-create.test.ts` continue to pass (no regressions)." Without extending the mock, the mocked test breaks. The plan's `<action>` block says "Do NOT modify anything else" for the action file — but the tests are a separate file and must be updated to match the new surface.
- **Fix:** Augmented two `txMock` objects in `tests/household-create.test.ts` with `cycle: { create: vi.fn().mockResolvedValue({}) }` and added an assertion verifying the new Cycle #1 write (D-01 invariant).
- **Files modified:** `tests/household-create.test.ts`
- **Verification:** `npm run test tests/household-create.test.ts --run` → 5/5 pass; integration test suite 7/7 pass.
- **Committed in:** `324cdab` (Task 1 commit).

---

**Total deviations:** 2 auto-fixed (1 blocking precondition, 1 bug prevention). No architectural changes; no user input needed.

## Issues Encountered

- **Phase-03 integration tests require `DATABASE_URL`.** Running `npm run test` without the env var produces intentional module-load failure from `src/lib/db.ts:11` (Phase 03-01 Deviation #1 split fixtures from db lazy-load; integration test files still need the env). Not a plan issue. Every test in this plan was run with `DATABASE_URL` exported manually in the shell.
- **pg-connection-string SSL-mode deprecation warnings** continue on real-DB runs (pre-existing from Phase 02/03-02, cosmetic only).

## Deferred Issues

- Pre-existing 92 lines of TS errors in `tests/household-create.test.ts`, `tests/household-integration.test.ts`, `tests/notes.test.ts` remain unchanged. Same count pre- and post-plan. Tracked in `deferred-items.md`.
- 3 remaining Wave 4 test stubs: `dst-boundary.test.ts`, `paused-resume.test.ts`, `cron-route.test.ts` (10 test.todo reservations). Plan 03-05 will fill these.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. All mitigations from the plan's `<threat_model>` are implemented:
- T-3-AUTHZ-SKIP — explicit `currentCycle.assignedUserId !== session.user.id` check in `skipCurrentCycle`; verified by skip-current-cycle test case 5.
- T-3-AUTHZ-DELETE-AVAIL — D-09 dual-auth clause in `deleteAvailability`; grep-verified `role !== "OWNER"` appears in actions.ts.
- T-3-DEMO-BYPASS — exact verbatim `"Demo mode — sign up to save your changes."` string in all 3 new actions.
- T-3-PAST-AVAIL — Zod refinement on `createAvailabilitySchema.startDate`; past-date test case 1 verifies rejection.
- T-3-OVERLAP — `findOverlappingPeriod` precheck with D-06 verbatim message; overlap test case 1 verifies.
- T-3-CYCLE-BOOTSTRAP — D-01 `tx.cycle.create` inside the existing `$transaction` for both paths; mocked-Prisma test asserts the new write; integration tests continue to pass because they rely on the action's return shape + DB state, not mock internals.

## User Setup Required

None.

## Next Phase Readiness

- **Wave 4 (03-05) — Cron orchestrator + route handler:** unblocked. `transitionCycle(householdId, 'cycle_end')` is the only call the orchestrator needs; `getCurrentCycle(householdId)` can be used as a pre-check if the planner chooses. `CRON_SECRET` env placeholder documented in Phase 03-01.
- **Phase 4 (invitations → leaveHousehold):** unblocked. `transitionCycle(_, 'member_left')` signature is live; the mapping to `cycle_reassigned_member_left` was verified in Wave 2's household-notification test.
- **Phase 5 (notification consumer + dashboard banner):** unblocked. `getCurrentCycle` and `getHouseholdAvailabilities` are the read surface; notification rows with the correct `type` + `recipientUserId` are now being written inside every transition.
- **Phase 6 (settings UI + availability form):** unblocked. `createAvailability` + `deleteAvailability` are live with the exact D-06/D-09 behavior; `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` ensures the settings page re-renders on mutation.

## Self-Check

Verification of claims:

- `grep -c "tx\\.cycle\\.create" src/features/auth/actions.ts src/features/household/actions.ts`: 1 + 1 = 2 → FOUND
- `grep -q "computeInitialCycleBoundaries" src/features/auth/actions.ts`: FOUND
- `grep -q "computeInitialCycleBoundaries" src/features/household/actions.ts`: FOUND
- `grep -q "export async function skipCurrentCycle" src/features/household/actions.ts`: FOUND
- `grep -q "export async function createAvailability" src/features/household/actions.ts`: FOUND
- `grep -q "export async function deleteAvailability" src/features/household/actions.ts`: FOUND
- `grep -q "export async function getCurrentCycle" src/features/household/queries.ts`: FOUND
- `grep -q "export async function getHouseholdAvailabilities" src/features/household/queries.ts`: FOUND
- `grep -q 'transitionCycle.*"manual_skip"' src/features/household/actions.ts`: FOUND
- `grep -q "findOverlappingPeriod" src/features/household/actions.ts`: FOUND
- `grep -q 'role !== "OWNER"' src/features/household/actions.ts`: FOUND
- `grep -c "test\\.todo" tests/phase-03/availability-overlap.test.ts tests/phase-03/availability-past-date.test.ts tests/phase-03/skip-current-cycle.test.ts tests/phase-03/auto-skip-unavailable.test.ts`: 0+0+0+0 → zero todos in target files
- `npx tsc --noEmit | wc -l`: 92 (matches pre-plan baseline)
- `npm run test -- tests/phase-03/ --run`: 11 test files passed, 3 skipped (todos for Wave 4), 36 tests passed, 10 todos remaining. Exit code 0.
- `npm run test -- tests/household-create.test.ts tests/household-integration.test.ts --run` (with DATABASE_URL): 12/12 passed, no regression
- Commits `324cdab` (Task 1), `a7dfa5c` (Task 2), `433439f` (Task 3) all present in git log: FOUND

## Self-Check: PASSED

---
*Phase: 03-rotation-engine-availability*
*Plan: 04 (Wave 3 — Actions + bootstrap)*
*Completed: 2026-04-18*
