---
phase: 07-demo-mode-compatibility
verified: 2026-04-20T23:15:00Z
status: passed
score: 2/2 must-haves verified
overrides_applied: 0
---

# Phase 7: Demo Mode Compatibility Verification Report

**Phase Goal:** The demo user experience works correctly with household data; all household-mutating actions are blocked in demo mode using the existing read-only guard pattern
**Verified:** 2026-04-20T23:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                   | Status     | Evidence                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Demo mode starts with a pre-seeded "Demo Household" containing sample members, an active cycle, and a sample availability period — all visible without authentication | ✓ VERIFIED | `prisma/seed.ts` creates Demo User + Alice + Bob (3 `tx.user.create`) + 3 `tx.householdMember.create` rows + `tx.cycle.create` (status="active", startDate=now-3d, endDate=now+4d, assignedUserId=demoUser.id) + `tx.availability.create` (Alice, now+10d/now+17d), all in a single `$transaction`; `DEMO_SAMPLE_MEMBERS` exported from `seed-data.ts` as source of truth; idempotency gate preserved; 26/26 seed-structure tests pass |
| 2   | All household-mutating actions (invite, skip, reorder, settings changes, member removal) are silently blocked in demo mode; the existing read-only guard pattern is used without a new code path | ✓ VERIFIED | 15 `session.user.isDemo` guard instances across `src/features/household/actions.ts` covering every exported async function (`skipCurrentCycle`, `createInvitation`, `revokeInvitation`, `acceptInvitation`, `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember`, `reorderRotation`, `updateHouseholdSettings`, plus 5 more); static audit test `tests/phase-07/demo-guard-audit.test.ts` walks all 8 `src/features/**/actions.ts` files and passes 1/1 — 0 HDMO-02 violations |

**Score:** 2/2 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/features/demo/seed-data.ts` | `DEMO_SAMPLE_MEMBERS` constant | ✓ VERIFIED | Exports `DEMO_SAMPLE_MEMBERS` as `const` tuple with alice@demo.plantminder.app (rotationOrder 1) and bob@demo.plantminder.app (rotationOrder 2); security invariant T-07-02 satisfied (emails distinct from DEMO_EMAIL) |
| `prisma/seed.ts` | Expanded demo seed with 3 members + Cycle + Availability | ✓ VERIFIED | Contains `tx.cycle.create` (×1), `tx.availability.create` (×1), `tx.householdMember.create` (×3), `tx.user.create` (×3); imports `computeInitialCycleBoundaries`, `DEMO_SAMPLE_MEMBERS`, `crypto` from `node:crypto`; CSPRNG unusable-password pattern implemented for sample members (T-07-01); idempotency gate `if (!existingDemo)` preserved |
| `src/features/demo/actions.ts` | Simplified `startDemoSession` (findUnique → signIn → redirect) | ✓ VERIFIED | 138 lines (down from 232); lazy bootstrap block removed; no `tx.household.create`, no `await import("bcryptjs")`, no `generateHouseholdSlug`, no `DEMO_PLANTS`; `startDemoSession` is `findUnique → error-if-missing → signIn → catch(rethrow NEXT_REDIRECT)`; `seedStarterPlants` with `session.user.isDemo` guard unchanged |
| `tests/phase-07/demo-guard-audit.test.ts` | HDMO-02 static regression gate | ✓ VERIFIED | Walks all 8 `src/features/**/actions.ts` files; `SKIP_FUNCTIONS` Set with exactly 4 entries (startDemoSession, registerUser, loadMoreWateringHistory, loadMoreTimeline); paren-depth body extraction; passes 1/1 test with 0 offenders |
| `tests/phase-07/seed-structure.test.ts` | Source-grep assertions for Plan 01 seed expansion | ✓ VERIFIED | 33 assertions across 3 describe blocks (seed-data.ts, seed.ts, actions.ts); passes 33/33 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `prisma/seed.ts` | `src/features/demo/seed-data.ts` | `import { DEMO_SAMPLE_MEMBERS }` | ✓ WIRED | Import present at line 11; `DEMO_SAMPLE_MEMBERS` destructured as `[aliceSpec, bobSpec]` inside transaction |
| `prisma/seed.ts` | `src/features/household/cycle.ts` | `import { computeInitialCycleBoundaries }` | ✓ WIRED | Import present at line 14; called at line 159 inside transaction to derive `anchorDate` |
| `prisma/seed.ts` | `node:crypto` | `import crypto` | ✓ WIRED | `crypto.randomBytes(32).toString("hex")` at line 60 — CSPRNG source for unusable bcrypt hash |
| `src/features/demo/actions.ts` | `auth.ts` (signIn) | `signIn("credentials", ...)` | ✓ WIRED | `signIn("credentials", { email: DEMO_EMAIL, password: DEMO_PASSWORD, redirectTo: "/dashboard" })` at line 33; NEXT_REDIRECT re-thrown in catch |
| `src/features/demo/actions.ts` | `src/features/demo/seed-data.ts` | `DEMO_EMAIL + DEMO_PASSWORD import` | ✓ WIRED | Both imported at line 6; used in `startDemoSession` (findUnique + signIn) and indirectly via `seedStarterPlants` |
| `tests/phase-07/demo-guard-audit.test.ts` | `src/features/**/actions.ts` | `readFileSync + regex walk` | ✓ WIRED | `walk("src/features")` finds all files ending in `/actions.ts`; `extractFunctionBodies` uses paren-depth tracking to correctly parse TypeScript inline type literals |

### Data-Flow Trace (Level 4)

Not applicable — phase 07 produces seed infrastructure and a regression test gate, not UI components that render dynamic data. The seed populates data for consumption by existing Phase 3–6 UI components; their data flow was already verified in those phases.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All 33 seed-structure + actions simplification assertions | `npx vitest run tests/phase-07/seed-structure.test.ts` | 33/33 passed, 2.55s | ✓ PASS |
| HDMO-02 guard audit across 8 actions.ts files | `npx vitest run tests/phase-07/demo-guard-audit.test.ts` | 1/1 passed, 9ms | ✓ PASS |
| Full phase-07 suite timing | `npx vitest run tests/phase-07/` | 33 tests, 2.55s | ✓ PASS (under 30s target) |
| TypeScript compilation | `npx tsc --noEmit` | 0 errors in modified files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| HDMO-01 | 07-01-PLAN.md | Demo user is a member of a pre-seeded "Demo Household" with sample members, an active cycle, and a sample availability period | ✓ SATISFIED | `prisma/seed.ts` creates Demo User + Alice + Bob + Demo Household + 3 HouseholdMember rows + Cycle #1 (mid-window, demo user as assignee) + 1 Availability on Alice; `DEMO_SAMPLE_MEMBERS` in `seed-data.ts` as source of truth; all 26 seed-structure.test.ts assertions pass |
| HDMO-02 | 07-02-PLAN.md | All household-mutating actions (invite, skip, reorder, settings, member removal) are blocked in demo mode using the existing read-only guard pattern | ✓ SATISFIED | 15 `session.user.isDemo` guard instances in `household/actions.ts`; guards present in all 8 `features/**/actions.ts` files for every non-skipped function; static audit test passes 1/1 with 0 violations; no new code path introduced — all guards use the existing pattern |

### Anti-Patterns Found

No anti-patterns found in modified files (`prisma/seed.ts`, `src/features/demo/seed-data.ts`, `src/features/demo/actions.ts`, `tests/phase-07/demo-guard-audit.test.ts`, `tests/phase-07/seed-structure.test.ts`).

Key negative checks verified:
- No TODO/FIXME/PLACEHOLDER comments in modified files
- No lazy bootstrap artifacts remaining in `demo/actions.ts` (no `tx.household.create`, no `await import("bcryptjs")`, no `generateHouseholdSlug`, no `DEMO_PLANTS`)
- No `tx.cycle.update` in seed (Option B preserved — single create, no patch)
- No hardcoded empty arrays or placeholder data in seed data flow

### Human Verification Required

No items require human verification. All must-haves are verifiable programmatically:
- Seed structure verified via source-grep (33 assertions)
- Guard coverage verified via static AST-level audit (reads all function bodies)
- Both test suites pass green

The only functional check not covered by tests is visiting `/demo` in a running app — but this is an unchanged user-facing flow (the route handler and redirect behavior are pre-existing from v1; the phase only changed what the seed produces before `startDemoSession` runs). The manual verification steps in `07-02-PLAN.md` §Verification (steps 6 and 7) are optional smoke tests, not blockers.

### Gaps Summary

No gaps. Both must-haves are fully satisfied:

1. **HDMO-01 (Demo Household seeded):** `prisma/seed.ts` now produces a complete Demo Household in a single atomic `$transaction`: Demo User (OWNER, rotationOrder 0), Alice (MEMBER, rotationOrder 1), Bob (MEMBER, rotationOrder 2), Cycle #1 (active, now-3d/now+4d, demo user as assignee, `memberOrderSnapshot` JSON array), and one future Availability on Alice (now+10d/now+17d). CSPRNG unusable-password invariant (T-07-01) and email-domain separation invariant (T-07-02) both implemented and verified.

2. **HDMO-02 (Guard coverage locked):** `startDemoSession` simplified to `findUnique → signIn → redirect` with no lazy bootstrap; a static Vitest regression gate (`demo-guard-audit.test.ts`) locks the `session.user.isDemo` guard requirement across all 8 `src/features/**/actions.ts` files for every future phase.

---

_Verified: 2026-04-20T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
