---
phase: 04-invitation-system
plan: "06"
subsystem: testing
tags: [vitest, postgres, real-db, concurrency, cascade, jwt, nextauth, prisma]

# Dependency graph
requires:
  - phase: 04-03
    provides: acceptInvitation and leaveHousehold server actions under test
  - phase: 04-04
    provides: leaveHousehold membership-mutation action with transitionCycle wiring

provides:
  - tests/phase-04/accept-invitation-concurrency.test.ts (D-23 real-DB atomicity proof)
  - tests/phase-04/leave-household-sole.test.ts (D-14 real-DB cascade delete proof)
  - tests/phase-04/assignee-leaves.test.ts (D-27 real-DB transitionCycle integration proof)
  - tests/phase-04/jwt-refresh.test.ts (D-26 unstable_update call-shape proof)

affects: [phase-05-ui, phase-06-household-settings, join-flow-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-DB integration test pattern: vi.mock('../../auth') + dynamic await import('@/lib/db') at module scope with DATABASE_URL required"
    - "afterAll cleanup via EMAIL_PREFIX prefix match — cascading FK deletes wipe all fixture rows"
    - "Promise.all concurrent Server Action invocation for race-condition acceptance gate testing"
    - "Prisma client generation required in worktree before real-DB tests can resolve @/generated/prisma/client"

key-files:
  created: []
  modified:
    - tests/phase-04/accept-invitation-concurrency.test.ts
    - tests/phase-04/leave-household-sole.test.ts
    - tests/phase-04/assignee-leaves.test.ts
    - tests/phase-04/jwt-refresh.test.ts

key-decisions:
  - "unstable_update call shape is { user: { activeHouseholdId: ... } } not { activeHouseholdId: ... } — plan spec was imprecise; actual implementation and existing unit tests use the nested 'user' envelope"
  - "unstable_update receives undefined (not null) when no remaining household exists — actions.ts uses remaining?.householdId ?? undefined"
  - "Real-DB tests require DATABASE_URL to be set in environment; vitest config does not auto-load .env.local; run with DATABASE_URL=... npx vitest"
  - "Prisma client must be generated in the worktree (npx prisma generate) before the @/generated/prisma/client import resolves"

patterns-established:
  - "Phase 4 real-DB test files use the same mock block as Phase 3 transition-concurrency.test.ts: vi.mock at top level, dynamic await import at module scope"
  - "jwt-refresh leaveHousehold test: rebind hh2's sole member to hh1's owner via db.householdMember.update to simulate multi-household membership without inline tx complexity"

requirements-completed: [INVT-04, INVT-05]

# Metrics
duration: ~20min
completed: 2026-04-19
---

# Phase 04 Plan 06: Real-DB Integration Tests (D-23, D-14, D-27, D-26) Summary

**Four real-Postgres integration test files closing the acceptance gates for concurrent atomic acceptance (D-23), sole-member cascade delete (D-14), assignee-leaves cycle transition (D-27), and JWT refresh call shape (D-26) — replacing all remaining test.todo stubs to reach 60 passing tests across 14 Phase 4 files**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-19T03:00:00Z
- **Completed:** 2026-04-19T03:21:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `accept-invitation-concurrency.test.ts`: 2 tests — `Promise.all` concurrent accept proves Pitfall 10 §2 atomicity: exactly one success + one "already used" error with no duplicate HouseholdMember rows (D-23 gate closed)
- `leave-household-sole.test.ts`: 1 test — sole-member last-OWNER `leaveHousehold` deletes Household row and cascade-wipes plants, rooms, cycles, availabilities, invitations, memberships (D-14 gate closed)
- `assignee-leaves.test.ts`: 1 test — active assignee `leaveHousehold` triggers `transitionCycle('member_left')` producing outgoing cycle with `transitionReason='member_left'` and new active cycle with different assignee (D-27 gate closed)
- `jwt-refresh.test.ts`: 2 tests — `acceptInvitation` calls `unstable_update({ user: { activeHouseholdId: joinedId } })` and `leaveHousehold` (with remaining membership) calls `unstable_update({ user: { activeHouseholdId: otherHouseholdId } })` (D-26 gate closed)
- Zero `test.todo` remaining in tests/phase-04/ — all 14 stub files replaced with 60 passing real tests

## Task Commits

1. **Task 1: Real-DB concurrency test for acceptInvitation (D-23) + sole-member cascade test (D-14)** — `096630a` (test)
2. **Task 2: Real-DB assignee-transition test (D-27) + JWT refresh test (D-26)** — `749a540` (test)

## Files Created/Modified

- `tests/phase-04/accept-invitation-concurrency.test.ts` — 2 tests replacing stubs; D-23 concurrent atomicity via `Promise.all` + stress variant across 3 invitations
- `tests/phase-04/leave-household-sole.test.ts` — 1 test replacing stub; D-14 cascade delete with seeded plant/room/availability/invitation rows
- `tests/phase-04/assignee-leaves.test.ts` — 1 test replacing stub; D-27 `transitionCycle` wiring with 3-member household + promoted co-owner to bypass last-OWNER block
- `tests/phase-04/jwt-refresh.test.ts` — 2 tests replacing stubs; D-26 `unstable_update` call-shape assertions for accept and leave paths

## Decisions Made

- **unstable_update envelope shape:** The plan spec described assertions as `expect(unstable_update).toHaveBeenCalledWith({ activeHouseholdId: ... })` but the actual `actions.ts` implementation (and Plan 03/04's existing unit tests) uses `{ user: { activeHouseholdId: ... } }`. Tests were written to match the real implementation. This is a plan-spec inaccuracy, not a deviation from the SUT.
- **undefined vs null for sole-member leave:** `actions.ts` calls `unstable_update({ user: { activeHouseholdId: remaining?.householdId ?? undefined } })` when no remaining membership exists — `undefined`, not `null`. The sole-member test asserts the correct `undefined` value.
- **D-27 test setup:** Used a 3-member household with `memberIds[1]` promoted to OWNER so the active assignee (ownerId) could leave without triggering the last-OWNER block (D-13). This was the most straightforward real-DB setup for the assignee-leaves scenario.
- **jwt-refresh leaveHousehold setup:** Rebound hh2's sole member to hh1's owner via `db.householdMember.update` to create a two-household membership without replicating the full `createHouseholdWithMembers` inline transaction logic. Added a second OWNER to hh1 to satisfy the last-OWNER pre-check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected unstable_update assertion envelope shape**
- **Found during:** Task 1 (leave-household-sole.test.ts)
- **Issue:** Plan spec showed `{ activeHouseholdId: null }` but actions.ts calls `unstable_update({ user: { activeHouseholdId: undefined } })`. The plan was imprecise; the SUT is correct.
- **Fix:** Used `{ user: { activeHouseholdId: undefined } }` in the sole-member test and `{ user: { activeHouseholdId: ... } }` in both jwt-refresh tests — matching the real implementation and existing Plan 03/04 unit test assertions
- **Files modified:** tests/phase-04/leave-household-sole.test.ts, tests/phase-04/jwt-refresh.test.ts
- **Verification:** Tests pass green against real DB; grep on accept-invitation.test.ts line 93 confirms `{ user: { activeHouseholdId: HOUSEHOLD_ID } }` is the established pattern

---

**Total deviations:** 1 auto-corrected (Rule 1 — plan-spec inaccuracy in assertion shape)
**Impact on plan:** The correction was required for test correctness. No scope creep; no new SUT changes.

## Issues Encountered

- **Prisma client not generated in worktree:** The worktree's `src/generated/prisma/` directory was absent, causing `Failed to resolve import "@/generated/prisma/client"` at test startup. Fixed by running `npx prisma generate` in the worktree. This is a worktree-setup concern, not a code issue.
- **DATABASE_URL not loaded from .env.local:** vitest.config.mts does not auto-load `.env.local`. Tests were run with `DATABASE_URL=...` set explicitly in the environment. Project convention for real-DB tests (same as Phase 3).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All four files are test-only code exercising existing Server Actions against the test database. Mitigations from the plan's threat register:

- **T-04-06-01 (afterAll cleanup):** All four test files implement the `EMAIL_PREFIX` prefix-match cleanup pattern matching `transition-concurrency.test.ts`. Users/households/related rows are deleted after each test file runs.
- **T-04-06-02 (flaky concurrent test):** Test uses `Promise.all` against real Postgres row-level locking. A flake indicates a regression in the action's transaction shape — by design.
- **T-04-06-04 (nested transaction D-27):** The assignee-leaves test verifies the CORRECT post-state (new active cycle + outgoing `transitionReason='member_left'`), confirming the two writes (transitionCycle + member delete) both land correctly.

## Self-Check

| Item | Status |
|------|--------|
| tests/phase-04/accept-invitation-concurrency.test.ts exists | FOUND |
| tests/phase-04/leave-household-sole.test.ts exists | FOUND |
| tests/phase-04/assignee-leaves.test.ts exists | FOUND |
| tests/phase-04/jwt-refresh.test.ts exists | FOUND |
| Commit 096630a (Task 1) exists | FOUND |
| Commit 749a540 (Task 2) exists | FOUND |
| Zero test.todo in tests/phase-04/ | CONFIRMED |
| 14 Phase 4 test files pass (60 tests) | CONFIRMED |
| No TS errors in phase-04 files | CONFIRMED |

## Self-Check: PASSED

## Next Phase Readiness

- All four acceptance gates (D-23, D-14, D-26, D-27) are verified against real Postgres — Phase 4's test contract is complete
- Zero `test.todo` remaining across all 14 Phase 4 test files
- Phase 6 (household settings UI) can consume invitation/membership actions with full integration test coverage behind them

---
*Phase: 04-invitation-system*
*Completed: 2026-04-19*
