---
phase: 03-rotation-engine-availability
plan: 03
subsystem: rotation-engine
tags: [rotation, cycle-engine, tzdate, transition, notifications, for-update-skip-locked, integration-tests]

# Dependency graph
requires:
  - phase: 03-rotation-engine-availability
    provides: "Wave 0 scaffolding — @date-fns/tz installed, test stubs, fixtures; Wave 1 schema — Cycle.transitionReason column + HouseholdNotification model + back-relations"
provides:
  - "src/features/household/constants.ts — TRANSITION_REASONS / NOTIFICATION_TYPES string-union constants and types"
  - "src/features/household/schema.ts — createAvailabilitySchema, deleteAvailabilitySchema, skipCurrentCycleSchema, transitionReasonSchema, notificationTypeSchema"
  - "src/features/household/availability.ts — findOverlappingPeriod (D-06 closed-interval) + isMemberUnavailableOn predicate"
  - "src/features/household/cycle.ts — TransitionResult type + computeAssigneeIndex + computeInitialCycleBoundaries + computeNextCycleBoundaries + findNextAssignee + mapReasonToNotificationType + isUniqueViolation + transitionCycle (the single write path, with FOR UPDATE SKIP LOCKED + same-tx notification)"
  - "7 populated test files in tests/phase-03/ (cycle-boundaries, rotation-formula, find-next-assignee, transition-cycle, transition-concurrency, all-unavailable-fallback, household-notification) — 23 passing tests"
affects: [phase-03-04-actions, phase-03-05-cron, phase-04-invitations, phase-05-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-write-path cycle transition: tx.\\$queryRaw FOR UPDATE SKIP LOCKED as the first statement inside db.\\$transaction; loses-the-lock path returns {skipped:true} with zero side effects"
    - "Notification emission inside the same $transaction as the Cycle writes; P2002 swallowed via isUniqueViolation for idempotent retries"
    - "Hint-reason upgrade ladder: cycle_end can become paused_resumed (if outgoing.status==='paused'), all_unavailable_fallback (owner-fallback or null), or auto_skip_unavailable (walker stepped past unavailable member)"
    - "findNextAssignee walks (n-1) OTHER positions so owner-fallback remains a DISTINCT state — normal rotation returns fallback:false; only owner-available-while-everyone-else-unavailable returns fallback:true"
    - "Pitfall 8 single-member short-circuit in findNextAssignee: sole member is normal rotation (fallback:false), not AVLB-05 owner-fallback"
    - "Prisma imported from @/generated/prisma/client (custom generator output path) — NOT @prisma/client"

key-files:
  created:
    - src/features/household/constants.ts
    - src/features/household/availability.ts
    - src/features/household/cycle.ts
  modified:
    - src/features/household/schema.ts
    - tests/phase-03/fixtures.ts
    - tests/phase-03/cycle-boundaries.test.ts
    - tests/phase-03/rotation-formula.test.ts
    - tests/phase-03/find-next-assignee.test.ts
    - tests/phase-03/transition-cycle.test.ts
    - tests/phase-03/transition-concurrency.test.ts
    - tests/phase-03/all-unavailable-fallback.test.ts
    - tests/phase-03/household-notification.test.ts

key-decisions:
  - "findNextAssignee walker visits n-1 positions (not n) so the outgoing assignee is not re-visited as the 'last-resort' candidate; owner-fallback becomes a meaningfully distinct state (D-18 cycle_fallback_owner notification is only emitted when non-outgoing members are unavailable)."
  - "Single-member household is treated as a normal rotation (fallback:false) per Pitfall 8, not as owner-fallback. A 1-member household's sole member remains assignee across transitions unless they are unavailable (then null → paused)."
  - "Prisma namespace is imported from the repo's generated client (`@/generated/prisma/client`) — the plan's template path `@prisma/client` doesn't apply because this project uses a custom Prisma generator output dir."
  - "fixtures.createHouseholdWithMembers now injects a per-invocation UUID suffix into member emails — prevents User.email unique-constraint collisions when the same test file calls it more than once."

patterns-established:
  - "transitionCycle contract: one lock, one next-cycle write, one outgoing-cycle close, one notification — all inside one db.\\$transaction. Callers (cron, skipCurrentCycle, Phase 4 leaveHousehold) go through this function; no alternate cycle-mutation path."
  - "TransitionReason hint ladder lives inside transitionCycle — callers pass the caller-local 'why' (e.g., cron passes cycle_end; skip action passes manual_skip; member-leave passes member_left). The engine upgrades when rotation state warrants it."
  - "Integration-test scaffold for phase-03: vi.mock('../../auth') + dynamic imports after mock setup + EMAIL_PREFIX-scoped afterAll cleanup + createHouseholdWithMembers helper"
  - "Tests split cleanly: pure-function suites require no DB (cycle-boundaries, rotation-formula); walker + transitionCycle suites use real Postgres for FOR UPDATE SKIP LOCKED semantics (pg-mem is unsupported)."

requirements-completed: [ROTA-02, ROTA-03, ROTA-05, ROTA-06, ROTA-07, AVLB-03, AVLB-05]

# Metrics
duration: ~35 min
completed: 2026-04-17
---

# Phase 03 Plan 03: Rotation Engine (Wave 2) Summary

**Built the rotation engine's pure + transactional core: constants + Zod schemas + availability predicates + cycle.ts (computeAssigneeIndex, TZDate boundaries, findNextAssignee walker with owner fallback, transitionCycle with FOR UPDATE SKIP LOCKED and same-transaction HouseholdNotification emission). 7 test files fully populated — 23 tests green; zero new TypeScript errors.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (Task 1 pure-function foundation + unit tests; Task 2 transitionCycle + integration tests)
- **Files created:** 3 source files (constants.ts, availability.ts, cycle.ts)
- **Files modified:** 1 source (schema.ts) + 1 fixture (fixtures.ts) + 7 populated test files
- **Lines of production code:** cycle.ts 363, availability.ts 52, constants.ts 27, schema.ts 83 — 525 total

## Accomplishments

- `transitionCycle(householdId, hintReason)` is live and green — single write path, lock-first, notification-inside-tx, idempotent-safe.
- `findNextAssignee` walks (n-1) OTHER positions and falls back to owner with fallback=true when no non-outgoing member is available; returns null if owner is also unavailable (caller creates a paused cycle).
- DST-safe `computeInitialCycleBoundaries` / `computeNextCycleBoundaries` via `@date-fns/tz` TZDate — verified against NY (EDT), Tokyo (JST+9), UTC.
- Two-row race (Promise.all on same household) yields exactly one transitioned + one skipped; DB backstop confirms exactly one Cycle #2 row and one notification.
- All-unavailable fallback: owner-available scenario emits `cycle_fallback_owner` notification; owner-unavailable scenario creates a paused cycle with NO notification. Both outgoing cycles close with `transitionReason: 'all_unavailable_fallback'`.
- Notification dedupe path exercised end-to-end: manual_skip + member_left type mapping correct, and a direct duplicate INSERT round-trips through `isUniqueViolation(err)` correctly.

## Task Commits

1. **Task 1: constants + schema + availability + cycle.ts pure functions + 3 unit tests** — `782f859` (feat)
2. **Task 2: transitionCycle (tx.\\$queryRaw FOR UPDATE SKIP LOCKED) + 4 integration tests** — `b8656ba` (feat)

## Files Created/Modified

- `src/features/household/constants.ts` (new, 27 lines) — TRANSITION_REASONS [6] + NOTIFICATION_TYPES [5] string-union arrays + types
- `src/features/household/schema.ts` (modified, +54 lines → 83 total) — appended transitionReasonSchema, notificationTypeSchema, createAvailabilitySchema (with endDate>startDate + startDate>=startOfDay(today) refinements per D-06 + Pitfall 12), deleteAvailabilitySchema, skipCurrentCycleSchema
- `src/features/household/availability.ts` (new, 52 lines) — findOverlappingPeriod (closed-interval lte/gte literal per D-06) + isMemberUnavailableOn predicate
- `src/features/household/cycle.ts` (new, 363 lines) — full engine: computeAssigneeIndex (Pitfall 8 single-member safe), computeInitialCycleBoundaries + computeNextCycleBoundaries (DST-safe), findNextAssignee (walker + owner fallback + null path + Pitfall 8 single-member short-circuit), mapReasonToNotificationType, isUniqueViolation, transitionCycle (the single write path) + isSequentialNext helper
- `tests/phase-03/fixtures.ts` (modified) — per-invocation UUID suffix for member emails (bug fix, see Deviation #1)
- `tests/phase-03/cycle-boundaries.test.ts` — 5 tests: anchor===start; NY EDT wall-clock preservation; Tokyo JST; UTC; contiguous next cycle
- `tests/phase-03/rotation-formula.test.ts` — 6 tests: anchor returns 0; single-member Pitfall 8; 1-cycleDuration; full wrap; 3-day/3-member wrap; 1-day/2-member alternation
- `tests/phase-03/find-next-assignee.test.ts` — 4 integration scenarios: all-available; skip-next; owner-fallback; null path
- `tests/phase-03/transition-cycle.test.ts` — 1 test covering return shape + new Cycle + outgoing state + single notification + no-stray end-state (5 assertion blocks)
- `tests/phase-03/transition-concurrency.test.ts` — 1 test with Promise.all + DB backstop (ROTA-06 binding)
- `tests/phase-03/all-unavailable-fallback.test.ts` — 2 tests (owner available → active+fallback_owner notification; owner unavailable → paused+zero notifications)
- `tests/phase-03/household-notification.test.ts` — 4 tests: manual_skip type; member_left type; per-cycle single notification; direct P2002 isUniqueViolation round-trip

**Test totals:** 7 files, 23 passing tests. 7 of the original 14 test stubs remain as `test.todo` reservations for Wave 3 (actions) and Wave 4 (cron) — dst-boundary.test.ts, availability-overlap/past-date, auto-skip-unavailable, paused-resume, skip-current-cycle, cron-route.

## Decisions Made

1. **Walker visits n-1 positions, not n.** The plan's `<behavior>` contract says normal rotation returns `fallback:false` and owner-fallback (fallback:true) is a distinct state — but the verbatim RESEARCH.md code (lines 914-920) visits all n positions, meaning a 3-member household where only non-owner members are unavailable would return the owner via normal rotation with `fallback:false` (since the walker wraps back to the outgoing assignee). Followed the `<behavior>` contract: the walker visits (n-1) OTHER positions; only the post-loop branch returns the owner with `fallback:true`. This makes AVLB-05's "cycle_fallback_owner" notification only fire in the genuine all-others-unavailable scenario.

2. **Single-member household short-circuit.** With walker-visits-n-1, a 1-member household would have `walkLen = 0`, so the loop wouldn't execute, and the sole member would be returned via the post-loop branch as `{fallback:true}` — which is wrong per Pitfall 8 (the sole member is the normal rotation, not a fallback). Added an explicit `sorted.length === 1` short-circuit that returns `{fallback:false}` (or null if the sole member is unavailable).

3. **Prisma namespace import path.** Plan template uses `import { Prisma } from "@prisma/client"`. This repo uses a custom Prisma generator output dir (`src/generated/prisma`) and does NOT have a direct `@prisma/client` export. Imported `Prisma` from `@/generated/prisma/client` instead. This is a path correction, not a behavioral change — `Prisma.TransactionClient` and `Prisma.PrismaClientKnownRequestError` are both re-exported through the namespace.

4. **TransitionResult declared at module top.** The plan described it as "declared in Task 1" but included it in Task 2's transitionCycle block with a "do NOT re-declare" note. Declared once in Task 1 to match the plan's stated intent; Task 2's transitionCycle references the already-exported type.

5. **Walker startIdx when currentIdx === -1.** If the outgoing assignee isn't in the live member list (member was removed since the cycle started), walk starts at rotation-order 0 and visits all n positions. This is the Phase 4 `member_left` case — the walker treats the leaver's prior position as "already skipped" and finds the next available member. No special plan instruction here; implemented the intuitive behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Email collision in `createHouseholdWithMembers` fixture helper**
- **Found during:** Task 1 verification (find-next-assignee.test.ts integration run)
- **Issue:** The helper used `emailFor(\`m${i}\`)` as the member email template. When the test file's second integration test called `createHouseholdWithMembers` again, emails `m0`/`m1`/`m2` collided with the ones inserted by the first test, yielding `Unique constraint failed on the fields: (email)`.
- **Fix:** Inject `randomUUID().slice(0, 6)` per invocation: `emailFor(\`${invocationId}-m${i}\`)`. The RUN_ID-namespaced afterAll cleanup still handles them via `startsWith(EMAIL_PREFIX)`.
- **Files modified:** `tests/phase-03/fixtures.ts`
- **Verification:** All 4 find-next-assignee scenarios + 8 Task 2 integration tests pass.
- **Committed in:** `782f859` (alongside Task 1 source + tests).

**2. [Rule 2 - Missing critical functionality] Single-member household owner-fallback misclassification**
- **Found during:** Task 2 verification (transition-cycle.test.ts)
- **Issue:** After making the walker visit (n-1) positions to preserve the owner-fallback as a distinct state, a 1-member household's sole member began returning `{fallback:true}`, which upgraded the transition reason to `all_unavailable_fallback` instead of staying `cycle_end`. That made every single-member transition incorrectly emit `cycle_fallback_owner` notifications.
- **Fix:** Special-case `sorted.length === 1` in `findNextAssignee`: return the sole member with `fallback:false` (or null if they're unavailable). Documented as Decision #2 above.
- **Files modified:** `src/features/household/cycle.ts`
- **Verification:** transition-cycle.test.ts happy path passes; returns `reason: "cycle_end"` and `assignedUserId: ownerId`.
- **Committed in:** `b8656ba` (Task 2 commit).

**3. [Rule 3 - Blocking precondition] Plan's `@prisma/client` import path unavailable**
- **Found during:** Task 1 cycle.ts authoring
- **Issue:** Plan template imports `Prisma` from `@prisma/client`. The project uses a custom generator output (`src/generated/prisma`); there is no `@prisma/client` resolvable path that re-exports the namespace.
- **Fix:** Imported from `@/generated/prisma/client` (the project's canonical Prisma namespace path, alongside `db` from `@/lib/db`).
- **Files modified:** `src/features/household/cycle.ts`
- **Verification:** `npx tsc --noEmit` shows zero new errors (baseline 92 lines maintained).
- **Committed in:** `782f859` (Task 1 commit).

---

**Total deviations:** 3 auto-fixed (1 bug fix, 1 Pitfall 8 correctness, 1 blocking path correction). No architectural changes; no user input needed.

## Issues Encountered

- **Test file `find-next-assignee.test.ts` requires DATABASE_URL.** The integration tests use real Postgres; running without `DATABASE_URL` set yields an intentional module-load failure from `src/lib/db.ts:11` (Rule 1 fixture fix from Phase 03-01 moved stub-file module-load away from this dependency; integration files still need the env). Documented in CLAUDE.md's test prerequisites. Not a plan issue — just a dev-environment reminder.
- **pg-connection-string SSL-mode deprecation warnings** continue to appear on every real-DB test run. Cosmetic, pre-existing from Phase 02/03-02. Not addressed here.

## Deferred Issues

- Pre-existing 92 lines of TS errors in Phase 02 test files (tests/household-create.test.ts, tests/household-integration.test.ts, tests/notes.test.ts) remain unchanged — same count with and without Plan 03-03 changes. Tracked in `deferred-items.md`.
- 7 remaining `test.todo` test files (dst-boundary, availability-overlap, availability-past-date, auto-skip-unavailable, paused-resume, skip-current-cycle, cron-route). These belong to Wave 3 (03-04 actions) and Wave 4 (03-05 cron), not this wave.

## Threat Flags

None — no new network endpoints, no new auth paths, no schema changes. Threat register mitigations from 03-03-PLAN.md §threat_model are all implemented:
- T-3-IDEMPOTENCY — mitigated via `FOR UPDATE SKIP LOCKED` inside `$transaction`; concurrency integration test verifies.
- T-3-NOTIF-DEDUPE — mitigated via `@@unique(cycleId, recipientUserId, type)` (from 03-02 schema) + `isUniqueViolation` catch. household-notification test verifies.
- T-3-NOTIF-INJECT — `transitionCycle` never takes `recipientUserId` or `type` from caller input; both derived from engine state.
- T-3-DST-SKEW — `computeNextCycleBoundaries` uses `new TZDate + addDays`. cycle-boundaries test verifies multi-zone behavior.
- T-3-LOCK-ESCAPE — `tx.$queryRaw` is the first statement inside the `$transaction` callback; no `db.$queryRaw FOR UPDATE` outside any transaction (grep confirmed).

## User Setup Required

None. Wave 3 (03-04) and Wave 4 (03-05) can proceed without any env changes beyond what 03-01/03-02 already documented.

## Next Phase Readiness

- **Wave 3 (03-04) — Actions + bootstrap:** unblocked. `transitionCycle`, `findOverlappingPeriod`, `createAvailabilitySchema`, `skipCurrentCycleSchema`, `deleteAvailabilitySchema`, `computeInitialCycleBoundaries` are all exported and green.
- **Wave 4 (03-05) — Cron route:** unblocked. `transitionCycle(householdId, 'cycle_end')` is the only call the cron orchestrator needs. The lock-loss path (`{skipped:true}`) is already tested; cron retries are safe.
- **Phase 4 (invitations → leaveHousehold):** also unblocked — same `transitionCycle(householdId, 'member_left')` signature. Notification type mapping verified in household-notification test.
- **Phase 5 (notification rendering):** schema is ready; `cycle_started` / `cycle_reassigned_*` / `cycle_fallback_owner` row shapes are now populated at transition time.

## Self-Check

Verification of claims:

- `src/features/household/constants.ts` exists, exports `TRANSITION_REASONS` (6 entries), `NOTIFICATION_TYPES` (5 entries): FOUND
- `src/features/household/availability.ts` exists with `findOverlappingPeriod` + `isMemberUnavailableOn`: FOUND
- `src/features/household/cycle.ts` exists with `transitionCycle`, `computeAssigneeIndex`, `computeInitialCycleBoundaries`, `computeNextCycleBoundaries`, `findNextAssignee`, `mapReasonToNotificationType`, `isUniqueViolation`, `TransitionResult`: FOUND
- `src/features/household/schema.ts` now exports `createAvailabilitySchema`, `deleteAvailabilitySchema`, `skipCurrentCycleSchema`, `transitionReasonSchema`, `notificationTypeSchema`: FOUND
- `grep "FOR UPDATE SKIP LOCKED" src/features/household/cycle.ts`: 2 matches (SQL + JSDoc)
- `grep "tx\\.\\$queryRaw" src/features/household/cycle.ts`: 1 match (inside $transaction)
- `grep "tx\\.householdNotification\\.create" src/features/household/cycle.ts`: 1 match (inside $transaction)
- `grep "isUniqueViolation" src/features/household/cycle.ts`: 3 matches (export + usage + JSDoc mention)
- `grep "new TZDate" src/features/household/cycle.ts`: 2 matches (initial + next boundaries)
- `grep '"use server"' src/features/household/cycle.ts`: 1 match — ONLY in JSDoc comment ("This file does NOT have the \\"use server\\" directive"), zero actual directives
- Commits `782f859` + `b8656ba` present in git log: FOUND
- `npm run test -- tests/phase-03/ --run`: 7 test files passed (23 tests), 7 skipped (24 todos remaining for Wave 3/4), exit code 0
- `npx tsc --noEmit` line count: 92 (same as pre-plan baseline — zero new errors)

## Self-Check: PASSED

---
*Phase: 03-rotation-engine-availability*
*Plan: 03 (Wave 2 — Cycle engine)*
*Completed: 2026-04-17*
