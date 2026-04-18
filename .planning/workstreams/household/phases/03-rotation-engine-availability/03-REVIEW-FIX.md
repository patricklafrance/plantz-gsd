---
phase: 03-rotation-engine-availability
fixed_at: 2026-04-18T00:00:00Z
review_path: .planning/workstreams/household/phases/03-rotation-engine-availability/03-REVIEW.md
iteration: 2
findings_in_scope: 12
fixed: 11
skipped: 1
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-18
**Source review:** `.planning/workstreams/household/phases/03-rotation-engine-availability/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Iteration 1 (critical + warning): 6 in scope, 6 fixed
- Iteration 2 (info, user-requested): 6 in scope, 5 fixed, 1 folded into WR-01
- Total: 12 in scope, 11 distinct fixes, 1 already resolved upstream

All fixes verified by re-reading the affected source, running `tsc --noEmit`
scoped to the modified files (clean), and executing the phase-03 Vitest
suites (52 tests passing — including 3 new DST assertions and 2 new CR-01
regression tests).

## Fixed Issues

### CR-01: Cron auth bypass when CRON_SECRET is unset or empty

**Files modified:**
- `src/app/api/cron/advance-cycles/route.ts`
- `tests/phase-03/cron-route.test.ts`

**Commit:** `a8aff42`

**Applied fix:** Added a fail-closed guard at the top of the POST handler
that short-circuits to 401 when `process.env.CRON_SECRET` is unset or
empty, before any expected-header interpolation. Also added two
regression tests: one that deletes `CRON_SECRET` and sends
`Authorization: Bearer undefined`, and one that sets `CRON_SECRET=""` and
sends `Authorization: Bearer `. Both assert 401 and that
`advanceAllHouseholds` was not called.

### WR-01: `cycleDuration: 7` hard-coded in two places per action

**Files modified:**
- `src/features/auth/actions.ts`
- `src/features/household/actions.ts`

**Commit:** `02259d9`

**Applied fix:** Extracted `const cycleDuration = 7` (and `cycleTimezone`
in `createHousehold`) as single-source locals inside each $transaction,
then threaded them through both `tx.household.create({ cycleDuration, ... })`
and `computeInitialCycleBoundaries(..., cycleDuration)`. Removes the
drift risk called out in the review where an edit to one literal could
silently desync Cycle #1's boundaries from the household row.

### WR-02: Binding DST acceptance gate is `test.todo`

**Files modified:**
- `tests/phase-03/dst-boundary.test.ts`

**Commit:** `6fb39c8`

**Applied fix:** Replaced the three `test.todo` stubs with real
assertions against `computeNextCycleBoundaries` using the concrete 2026
DST dates named in the titles.
- Spring-forward (`2026-03-08T05:00:00Z` + 7d NY) asserts
  `endDate === 2026-03-15T04:00:00.000Z` and a delta of `7d - 1h`.
- Fall-back (`2026-11-01T04:00:00Z` + 7d NY) asserts
  `endDate === 2026-11-08T05:00:00.000Z` and a delta of `7d + 1h`.
- Non-DST zones (UTC, Asia/Tokyo) assert an exact `7 * 86_400_000` delta.

A regression that replaced the `TZDate` addition with raw-millisecond
arithmetic would now fail these three tests instead of passing silently.

### WR-03: `createAvailability` returns raw Zod message as user-facing error

**Files modified:**
- `src/features/household/actions.ts`

**Commit:** `a0d9b26`

**Applied fix:** Only surface Zod messages when the first issue's path is
`startDate` or `endDate` (the two refinements this action authors
explicitly). For base parse errors (cuid format, min-length, etc.) the
action now returns the generic `"Invalid input."` — matching the
convention used by `createHousehold`, `skipCurrentCycle`, and
`deleteAvailability`.

### WR-04: `computeAssigneeIndex` appears unused by the transition path

**Files modified:**
- `src/features/household/cycle.ts`

**Commit:** `08d21db`

**Applied fix:** Chose option (a) — documented the consumer in the JSDoc.
The comment now explicitly notes that the live transition path uses
`findNextAssignee` (availability-aware), while `computeAssigneeIndex` is
the pure deterministic formula consumed by
`tests/phase-03/rotation-formula.test.ts` and reserved for the Phase 6+
dashboard rotation preview. Prevents a future reader from mistaking it
for dead code.

### WR-05: Stale line-number reference in `actions.ts` JSDoc

**Files modified:**
- `src/features/household/actions.ts`
- `src/features/auth/actions.ts`
- `tests/household-create.test.ts`

**Commit:** `643e2fe`

**Applied fix:** Replaced the `src/features/auth/actions.ts:54-66`
cross-reference in `createHousehold`'s JSDoc with a stable function-name
anchor ("the collision loop in `registerUser`"). Dropped the `WR-02` /
"previously ran 11 iterations" comments from both slug loops and the
test, and reworded them to explain the `>= 9` bound + post-increment
arithmetic directly. Did NOT extract a shared helper
(`generateUniqueSlug`) — that duplicates only 8 lines across two
transactions with different tx-types; option (a) from the review
(stable anchors) was sufficient.

## Iteration 2: Info Findings

User opted to apply all info findings after reviewing them. Commits land on
`feat/household` directly; verified by re-running phase-03 Vitest (52
passing in isolation) and `tsc --noEmit` on touched files (clean).

### IN-01: `HouseholdNotification` NULL cycleId unique-constraint risk

**Files modified:**
- `.planning/workstreams/household/ROADMAP.md`

**Commit:** `f2ce528`

**Applied fix:** Added a Phase 3 carry-over pitfall flag to the Phase 5
section in the household-workstream roadmap. Flags the Postgres default
"NULLs are distinct" behavior and prescribes `NULLS NOT DISTINCT`
(Postgres 15+) or a partial unique index if Phase 5 introduces
notification types with nullable `cycleId`. No schema change now —
Phase 3 always writes non-null.

### IN-02: `z.string().cuid()` deprecated in Zod v4

**Files modified:**
- `src/features/household/schema.ts`

**Commit:** `f2e9205`

**Applied fix:** Swapped three call sites (`createAvailabilitySchema`,
`deleteAvailabilitySchema`, `skipCurrentCycleSchema`) from
`z.string().cuid()` to top-level `z.cuid()`. Behavior identical; silences
the upcoming Zod lint warning.

### IN-03: `updateTimezone` has no IANA-format validation

**Files modified:**
- `src/features/auth/actions.ts`

**Commit:** `59d2e0c`

**Applied fix:** Added a `try { new Intl.DateTimeFormat("en", { timeZone }) }`
check after the length/type guard. Rejects bogus timezone strings before
they flow into `createHousehold` -> `computeInitialCycleBoundaries`,
where `TZDate` would have silently fallen back to UTC. Kept the existing
early returns intact.

### IN-04: Duplicate `parsed.data.timezone ?? "UTC"` in `createHousehold`

**Status:** Already folded into WR-01 (iteration 1, commit `02259d9`).

No additional commit — the `cycleTimezone` local extracted during WR-01
eliminated the duplication as a side effect.

### IN-05: `advanceAllHouseholds` sequential-loop scaling ceiling

**Files modified:**
- `src/features/household/cron.ts`

**Commit:** `53adcf4`

**Applied fix:** Appended a JSDoc block with concrete operator-planning
numbers: ~200 households in Vercel's 10s hobby timeout, ~1200 in the 60s
Pro cap, at ~50ms per household. Documents the crossover where the
sequential loop must move to batching or parallelization. No code change.

### IN-06: Server-local "today" in `createAvailabilitySchema` past-date check

**Files modified:**
- `src/features/household/schema.ts`

**Commit:** `956bc0b`

**Applied fix:** Added a 4-line comment above the past-date refinement
noting the server-timezone semantics (typically UTC on serverless), the
±12h no-op band for most users, the one-day-off edge for far-east users
at wall-clock midnight, and the Phase 6 follow-up where household
timezone will be threaded through. No code change — acceptable for v1.

---

_Fixed: 2026-04-18_
_Fixer: Claude (gsd-code-fixer) + manual info-pass_
_Iterations: 2_
