---
phase: "02-query-action-layer-update"
plan: "07"
subsystem: household
tags: [integration-test, real-prisma, d-18, household, test-infra, wave-3]
dependency_graph:
  requires:
    - "02-02-SUMMARY.md (createHousehold + getUserHouseholds shipped)"
    - "01-04-SUMMARY.md (generateHouseholdSlug, resolveHouseholdBySlug)"
    - "prisma/schema.prisma with HouseholdMember.isDefault (02-01)"
  provides:
    - "Real-Prisma integration suite for createHousehold + getUserHouseholds (D-18 closed)"
    - "Namespaced email-prefix cleanup idiom for future integration tests"
    - "test:integration npm script for targeted integration test execution"
  affects:
    - "tests/household-integration.test.ts (new file — 7 integration tests)"
    - "package.json (test:integration script added)"
tech_stack:
  added: []
  patterns:
    - "Real-Prisma integration tests: vi.mock(auth only) + real db client + afterAll cleanup"
    - "Namespaced email prefix isolation: integration-test-${runId}-${tag}@test.local"
    - "randomUUID() slugs for directly-created test households (bypasses slug generation)"
    - "householdId_userId compound key (@@unique([householdId, userId]) in schema)"
key_files:
  created:
    - "tests/household-integration.test.ts"
  modified:
    - "package.json (test:integration script)"
decisions:
  - "auth() mocked, db real: integration tests mock only the NextAuth session lookup; all Prisma code runs against real PostgreSQL (D-18 requirement)"
  - "Compound unique key is householdId_userId (not userId_householdId) — matches schema @@unique([householdId, userId]) field order"
  - "Test slugs use randomUUID().replace(/-/g,'').slice(0,12) for directly-created households — bypasses generateHouseholdSlug length requirement, prevents slug collision across re-runs"
  - "DATABASE_URL must be set at test runtime; vitest does not auto-load .env.local — run with env var exported or CI must inject it"
  - "Prisma client symlinked from main project (src/generated/prisma) into worktree for test execution — worktree setup lacks generated artifacts"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17"
  tasks_completed: 1
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 07: Real-Prisma Integration Tests (D-18) Summary

**One-liner:** Real-Prisma integration suite for createHousehold ($transaction atomicity, unique slug, demo guard, auth gate) and getUserHouseholds (sort order, role + isDefault) closing CONTEXT.md D-18 B-1 blocker.

## What Was Built

### Task 1 — tests/household-integration.test.ts (7 integration tests)

All 7 tests run against the real PostgreSQL database (`DATABASE_URL`). Only `auth()` is mocked; `db`, `createHousehold`, and `getUserHouseholds` execute against live Prisma.

**createHousehold integration tests (5 tests):**

| # | Test | Assertion |
|---|------|-----------|
| 1 | Happy path | Returns `{ success: true, household }` with 8-char slug; OWNER HouseholdMember row exists with `role: "OWNER"`, `rotationOrder: 0`, `isDefault: false` |
| 2 | Zod rejection (empty name) | Returns `{ error: "Invalid input." }`; zero HouseholdMember rows for that user (pre-transaction gate) |
| 3 | Unique-slug | Two back-to-back `createHousehold` calls return different slugs, both 8 chars |
| 4 | Unauthenticated | `auth()` returns null → `{ error: "Not authenticated." }` |
| 5 | Demo mode guard | `isDemo: true` → `{ error: "Demo mode..." }`, no DB rows created |

**getUserHouseholds integration tests (2 tests):**

| # | Test | Assertion |
|---|------|-----------|
| 6 | Two memberships, sorted | Returns 2 entries; first has `role: "OWNER", isDefault: true`; second has `role: "MEMBER", isDefault: false`; sorted by joinedAt asc; joinedAt is a Date instance |
| 7 | No memberships | Returns `[]` |

**Test isolation pattern (T-02-07-01):**

```typescript
const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const EMAIL_PREFIX = `integration-test-${RUN_ID}`;
const emailFor = (tag: string) => `${EMAIL_PREFIX}-${tag}@test.local`;
```

- Every user email is globally unique per test-run
- `afterAll` deletes users (HouseholdMember rows cascade), then explicitly deletes orphaned Household rows
- Safe to run against dev DB; rows are visually distinguishable (`integration-test-*@test.local`)

**D-18 requirement fulfilled:**

CONTEXT.md D-18: *"createHousehold and getUserHouseholds get integration tests (real Prisma test DB, same pattern as Phase 1 tests/household.test.ts)"*

This plan honors that verbatim: real Prisma client, real PostgreSQL transactions, real unique-constraint enforcement, real cascade behavior verified in afterAll.

## Test Infrastructure Notes

| Property | Value |
|----------|-------|
| Runtime (7 tests, real DB) | ~3.7 seconds |
| Cleanup verified | afterAll deletes all `integration-test-*` users and their households |
| DATABASE_URL | Required at test runtime — vitest does not auto-load `.env.local` |
| Run command | `npx vitest run tests/household-integration.test.ts` (or `npm run test:integration`) |
| Full suite impact | All 16 test files pass; 159 tests green, 105 todos (no regressions) |

## DATABASE_URL Configuration Note

Integration tests require `DATABASE_URL` to be set in the environment. Vitest does not automatically load `.env.local`. In CI, the environment variable must be injected by the CI runner (e.g., GitHub Actions `env:` block or Vercel environment settings). A future phase should configure the CI pipeline with a dedicated test database.

**Local dev:** `source .env.local && export DATABASE_URL && npm run test:integration`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Compound unique key name was wrong**
- **Found during:** Task 1 — first test run (real DB validation error)
- **Issue:** Plan template used `userId_householdId` as the Prisma compound key name. The schema has `@@unique([householdId, userId])` — field order in the `@@unique` decorator determines the key name. Correct name: `householdId_userId`.
- **Fix:** Updated `db.householdMember.findUnique({ where: { householdId_userId: {...} } })` in test 1
- **Files modified:** `tests/household-integration.test.ts`

**2. [Rule 1 - Bug] Direct-insert test slugs collided**
- **Found during:** Task 1 — second test run failure in getUserHouseholds test
- **Issue:** Template used `${RUN_ID.slice(-6)}u5A/u5B` truncated to 8 chars — both slugs resolved identically after slicing (the A/B differentiator was cut off)
- **Fix:** Switched to `randomUUID().replace(/-/g, "").slice(0, 12)` — globally unique hex string per household, collision-proof
- **Files modified:** `tests/household-integration.test.ts`

**3. [Rule 3 - Blocking] Prisma generated client missing in worktree**
- **Found during:** Task 1 — vitest could not resolve `@/generated/prisma/client` in the worktree
- **Issue:** Git worktrees do not include generated artifacts; `src/generated/prisma/` was absent
- **Fix:** Symlinked `src/generated/prisma` → main project's generated client (`ln -s /c/Dev/poc/plantz-gsd/src/generated/prisma ./src/generated/prisma`)
- **Note:** Symlink is not committed to git (generated artifacts are gitignored); this is a worktree-local workaround. The main project's node_modules and generated client are shared.

**4. [Rule 3 - Blocking] DATABASE_URL not loaded by vitest**
- **Found during:** Task 1 — Prisma client threw "DATABASE_URL not set"
- **Issue:** Vitest does not auto-load `.env.local`; copied the file to the worktree
- **Fix:** Run tests with `source .env.local && export DATABASE_URL && npx vitest run ...`; added this to the SUMMARY for CI documentation

## Known Stubs

None — all 7 tests exercise real code paths and assert real DB state.

## Self-Check: PASSED

- `tests/household-integration.test.ts` — EXISTS (279 lines, ≥80 minimum)
- `package.json` — EXISTS with `test:integration` script
- Commit 371806b — PRESENT in git log
- `npx vitest run tests/household-integration.test.ts` — 7/7 PASSED (real DB)
- `npx vitest run` full suite — 159/159 PASSED, 0 regressions
- `vi.mock("../auth")` count = 1; `vi.mock("@/lib/db")` count = 0 (db not mocked)
- `afterAll` present with user + household cleanup
- `$disconnect` called in afterAll finally block
- `integration-test-` email prefix present
- D-18 blocker closed
