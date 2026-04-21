---
phase: 07-demo-mode-compatibility
plan: "01"
subsystem: seed / demo
tags:
  - seed
  - demo
  - prisma
  - cycle
  - availability
dependency_graph:
  requires:
    - Phase 03 (cycle engine — computeInitialCycleBoundaries)
    - Phase 01 (schema — HouseholdMember, Cycle, Availability models)
  provides:
    - DEMO_SAMPLE_MEMBERS constant (seed-data.ts)
    - 3-member Demo Household with mid-window Cycle #1 and future Availability row
  affects:
    - prisma/seed.ts (expanded demo seed)
    - src/features/demo/seed-data.ts (DEMO_SAMPLE_MEMBERS)
    - tests/phase-07/seed-structure.test.ts (source-grep assertions)
tech_stack:
  added: []
  patterns:
    - CSPRNG unusable password (bcryptjs.hash + crypto.randomBytes)
    - Option B inline tx.cycle.create with computeInitialCycleBoundaries anchor
    - Single $transaction wrapping all demo User + Household + Member + Cycle + Availability creates
key_files:
  created:
    - tests/phase-07/seed-structure.test.ts
  modified:
    - src/features/demo/seed-data.ts
    - prisma/seed.ts
decisions:
  - DEMO_SAMPLE_MEMBERS placed in seed-data.ts as the single source of truth for sample roster
  - Option B cycle seeding (inline tx.cycle.create) preserves single-write-path invariant
  - anchorDate kept as computeInitialCycleBoundaries output (tomorrow UTC) — only startDate/endDate shifted to -3/+4 days
  - aliceUser gets the Availability row (rotationOrder 1 = "next in rotation" makes it more meaningful for demo visitors)
metrics:
  duration: "~6 minutes"
  completed: "2026-04-21"
  tasks: 2
  files: 3
---

# Phase 07 Plan 01: Expanded Demo Seed (3 Members + Cycle + Availability) Summary

**One-liner:** CSPRNG-hashed sample members (Alice, Bob) seeded into Demo Household alongside mid-window Cycle #1 and future Availability row via single Prisma `$transaction`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add DEMO_SAMPLE_MEMBERS to seed-data.ts | 67d3778 | src/features/demo/seed-data.ts |
| 2 | Expand prisma/seed.ts with seedDemoHousehold (3 members + Cycle + Availability) | 775aae5 | prisma/seed.ts |
| RED | Failing tests for both tasks | 258b0f7 | tests/phase-07/seed-structure.test.ts |

## What Was Built

### Task 1: DEMO_SAMPLE_MEMBERS constant

Added `export const DEMO_SAMPLE_MEMBERS` to `src/features/demo/seed-data.ts` with two entries:
- `alice@demo.plantminder.app` at `rotationOrder: 1`
- `bob@demo.plantminder.app` at `rotationOrder: 2`

Both use distinct sub-domains from `DEMO_EMAIL` (`demo@plantminder.app`) so the JWT `isDemo` derivation (`email === DEMO_EMAIL`) never fires for sample members (T-07-02 security invariant).

### Task 2: Expanded prisma/seed.ts

Inside the existing `if (!existingDemo)` idempotency gate:

1. **Imports added:** `crypto from "node:crypto"`, `DEMO_SAMPLE_MEMBERS`, `computeInitialCycleBoundaries`
2. **Unusable password:** `bcryptjs.hash(crypto.randomBytes(32).toString("hex"), 12)` — CSPRNG source never stored, `bcryptjs.compare` always returns false (T-07-01)
3. **Single `$transaction`** creates:
   - Demo user + Alice + Bob (3 `tx.user.create` calls)
   - Demo Household (with slug collision loop)
   - 3 `tx.householdMember.create` rows (demo=OWNER/0, alice=MEMBER/1, bob=MEMBER/2)
   - Cycle #1: `anchorDate` from `computeInitialCycleBoundaries`, `startDate=now-3d`, `endDate=now+4d`, `assignedUserId=demoUser.id`, `memberOrderSnapshot` JSON array
   - Availability on Alice: `startDate=now+10d`, `endDate=now+17d`, `reason="Out of town"`
4. **Rooms + plants loop unchanged** — runs outside the transaction as before

## Test Results

- 25 / 26 tests passing in `tests/phase-07/seed-structure.test.ts`
- 1 remaining failing test (`startDemoSession no longer contains lazy-creation inline bcryptjs import`) covers Plan 02 work (D-11: `startDemoSession` simplification) — expected to fail until Plan 02 runs
- `npx tsc --noEmit` emits no errors referencing modified files

## Deviations from Plan

None — plan executed exactly as written. The plan's action blocks were followed verbatim.

## Known Stubs

None — all seeded data is concrete (no hardcoded empty arrays or placeholder strings in the data flow).

## Security Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-07-01 | `bcryptjs.hash(crypto.randomBytes(32).toString("hex"), 12)` — source secret never stored | Implemented |
| T-07-02 | Sample emails use `@demo.plantminder.app` subdomain; `DEMO_EMAIL` is `demo@plantminder.app` — literal equality never matches | Implemented |

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Seed script only runs against `DATABASE_URL`-targeted DB.

## Self-Check: PASSED

Files exist:
- FOUND: src/features/demo/seed-data.ts (modified)
- FOUND: prisma/seed.ts (modified)
- FOUND: tests/phase-07/seed-structure.test.ts (created)

Commits exist:
- FOUND: 258b0f7 (test RED phase)
- FOUND: 67d3778 (feat Task 1 GREEN)
- FOUND: 775aae5 (feat Task 2 GREEN)
