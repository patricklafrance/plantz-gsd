---
phase: 02-query-action-layer-update
verified: 2026-04-16T00:00:00Z
status: gaps_found
score: 3/4
overrides_applied: 0
gaps:
  - truth: "All Server Actions enforce live household membership check (requireHouseholdAccess) — stale JWT cannot access a household the user was removed from"
    status: failed
    reason: "seedStarterPlants in src/features/demo/actions.ts accepts a caller-supplied householdId parameter and creates plants in it without calling requireHouseholdAccess. An authenticated non-demo user can inject plants into any household by supplying an arbitrary householdId."
    artifacts:
      - path: "src/features/demo/actions.ts"
        issue: "Line 147: export async function seedStarterPlants(plantCountRange?: string, householdId?: string) — no requireHouseholdAccess call anywhere in the function. targetHouseholdId is resolved from the caller-supplied param or JWT (const targetHouseholdId = householdId ?? session.user.activeHouseholdId) with no live membership check."
    missing:
      - "Add `await requireHouseholdAccess(targetHouseholdId)` after the targetHouseholdId null-check (after line 162)"
      - "Add `import { requireHouseholdAccess } from '@/features/household/guards'` at top of file"
deferred:
  - truth: "Owner can create a new household from settings (becomes owner; household appears in their membership list)"
    addressed_in: "Phase 6"
    evidence: "Phase 6 success criteria include HSET-02 and HSET-03 (household settings page, member management). Plans 02-02 and 02-07 explicitly state 'HSLD-02 is data-layer satisfied; UI deferred to Phase 6 per D-07/D-09'. The createHousehold Server Action and $transaction atomicity are complete and tested in integration tests (household-integration.test.ts)."
  - truth: "User can view a list of all households they belong to with their role shown for each"
    addressed_in: "Phase 6"
    evidence: "Phase 6 HSET-01 addresses household switcher UI in the top nav. Plans 02-02 and 02-07 explicitly state 'HSLD-03 is data-layer satisfied; UI deferred to Phase 6 per D-07/D-09'. The getUserHouseholds query exists and is covered by real-Prisma integration tests."
---

# Phase 02: Query + Action Layer Update — Verification Report

**Phase Goal:** All data queries and Server Actions are household-scoped. The household data layer is complete: create household, list memberships, scope all reads to the active household. The `/h/[householdSlug]/` route tree acts as a single auth + membership chokepoint.
**Verified:** 2026-04-16T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard, plants list, rooms, watering history, notes, and reminders display only data belonging to the current household | VERIFIED | All queries use `where: { householdId }` (direct) or `where: { plant: { householdId } }` (nested) per D-10. Layout calls `getCurrentHousehold(householdSlug)` which runs `requireHouseholdAccess`. D-16 unit tests assert householdId in every findMany/findFirst call. Reminder queries use `householdId` directly (queries.ts lines 18, 27, 40, 68, 84, 94). |
| 2 | Owner can create a new household from settings (becomes owner; household appears in their membership list) | DEFERRED | Data layer complete (createHousehold $transaction, isDefault semantics, getUserHouseholds return shape). UI deferred to Phase 6. See Deferred Items. |
| 3 | User can view a list of all households they belong to with their role shown for each | DEFERRED | Data layer complete (getUserHouseholds query returns `{ id, name, slug, role, isDefault }`). UI deferred to Phase 6. See Deferred Items. |
| 4 | All Server Actions enforce live household membership check (requireHouseholdAccess) — stale JWT cannot access a household the user was removed from | FAILED | `seedStarterPlants` in `src/features/demo/actions.ts` accepts a caller-supplied `householdId` and writes plants to it without calling `requireHouseholdAccess`. All other mutating actions (plants: 5, rooms: 3, watering: 2, notes: 2, reminders: 2) verified to call `requireHouseholdAccess`. |

**Score:** 1/2 non-deferred truths verified (3/4 total counting deferred as acknowledged)

---

### Deferred Items

Items not yet surfaced to the user but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Owner can create a new household from settings | Phase 6 | Phase 6 HSET-02/HSET-03: household settings page with member management. Data layer (createHousehold + $transaction) complete and integration-tested. |
| 2 | User can view list of households with role | Phase 6 | Phase 6 HSET-01: household switcher UI in top nav. Data layer (getUserHouseholds) complete and integration-tested. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/household/context.ts` | getCurrentHousehold using react cache + requireHouseholdAccess | VERIFIED | `cache()` wraps async resolver; calls `resolveHouseholdBySlug` then `requireHouseholdAccess(summary.id)`. ForbiddenError/notFound propagate to error.tsx/not-found.tsx. |
| `src/app/(main)/h/[householdSlug]/layout.tsx` | D-03 chokepoint: calls getCurrentHousehold, threads household.id to reminder queries | VERIFIED | `getCurrentHousehold(householdSlug)` on line 32. `getReminderCount(household.id, ...)` and `getReminderItems(household.id, ...)` on lines 53-56. Full chrome rendered. |
| `src/app/(main)/h/[householdSlug]/error.tsx` | Discriminates ForbiddenError vs generic errors | VERIFIED | `if (error.name === "ForbiddenError")` on line 14. Renders household-specific forbidden message. |
| `src/features/plants/actions.ts` | requireHouseholdAccess on all 5 plant actions (D-12 shape) | VERIFIED | requireHouseholdAccess calls on lines 18, 54, 99, 125, 151. All 5 actions (createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant) follow D-12 7-step shape. |
| `src/features/rooms/actions.ts` | requireHouseholdAccess on all 3 room actions (D-12 shape) | VERIFIED | createRoom, updateRoom, deleteRoom all confirmed by ForbiddenError tests passing in rooms.test.ts Phase 2 describe blocks. |
| `src/features/household/actions.ts` | createHousehold with $transaction atomicity; getUserHouseholds | VERIFIED | Plans 02-02 and 02-07 confirm $transaction for Household + HouseholdMember creation. Integration tests in household-integration.test.ts (279 lines, real Prisma, afterAll cleanup). |
| `src/features/demo/actions.ts` | seedStarterPlants should call requireHouseholdAccess | FAILED | No requireHouseholdAccess call in entire file. Accepts caller-supplied householdId on line 147. CR-01 from code review confirmed. |
| `auth.ts` | WR-01: JWT narrowing for activeHouseholdId (null → undefined) | VERIFIED | Line 40: `typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined` |
| `src/features/plants/schemas.ts` | plantTargetSchema for archive/unarchive/delete payloads | VERIFIED | Tests in plants.test.ts confirm plantTargetSchema accepts valid `{ householdId, plantId }` and rejects missing fields. |
| `src/features/rooms/schemas.ts` | roomTargetSchema for deleteRoom payload (D-12 blob) | VERIFIED | Tests in rooms.test.ts (lines 167-191) confirm roomTargetSchema validates `{ householdId, roomId }`. |
| `tests/plants.test.ts` | D-16 isolation + D-17 ForbiddenError tests; zero Phase 2 todos | VERIFIED | 17 remaining test.todos are in pre-Phase-2 "Phase 3 Plan 02 will implement" blocks (lines 89-123). All Phase 2 describe blocks have 0 todos and have passing implementations. |
| `tests/rooms.test.ts` | D-16 isolation + D-17 ForbiddenError tests; zero Phase 2 todos | VERIFIED | 10 remaining test.todos are in pre-Phase-2 "Server Action stubs" blocks (lines 63-83). All Phase 2 describe blocks (lines 85-251) have 0 todos. |
| `tests/household-integration.test.ts` | Real-Prisma integration tests for createHousehold + getUserHouseholds; afterAll cleanup | VERIFIED | 279 lines, real Prisma, afterAll cleanup confirmed per 02-07-SUMMARY. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `layout.tsx` | `getCurrentHousehold` | import from `@/features/household/context` | WIRED | Called on request entry; result threads household.id to child queries |
| `getCurrentHousehold` | `requireHouseholdAccess` | called inside cache() wrapper | WIRED | context.ts line: `return await requireHouseholdAccess(summary.id)` |
| `plants/actions.ts` | `requireHouseholdAccess` | import from `@/features/household/guards` | WIRED | 5/5 actions confirmed |
| `rooms/actions.ts` | `requireHouseholdAccess` | import from `@/features/household/guards` | WIRED | 3/3 actions confirmed via ForbiddenError test coverage |
| `demo/actions.ts` | `requireHouseholdAccess` | should import from `@/features/household/guards` | NOT_WIRED | Zero calls in file — CR-01 gap |
| `error.tsx` | `ForbiddenError` | name discrimination `error.name === "ForbiddenError"` | WIRED | line 14 confirmed |
| `plants/queries.ts` | `householdId` scope | `where: { householdId }` | WIRED | D-16 unit test asserts findMany called with `{ where: { householdId: "hh_TEST" } }` |
| `rooms/queries.ts` | `householdId` scope | `where: { householdId }` | WIRED | D-16 unit test asserts findMany and findFirst called with householdId in where clause |
| `reminders/queries.ts` | `householdId` scope | direct where clause | WIRED | lines 18, 27, 40, 68, 84, 94 confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `layout.tsx` reminder bell | `reminderCount`, `reminderItems` | `getReminderCount(household.id, ...)` / `getReminderItems(household.id, ...)` | Yes — DB queries using real household.id from getCurrentHousehold | FLOWING |
| `plants/queries.ts` | plant list | `db.plant.findMany({ where: { householdId } })` | Yes — householdId from getCurrentHousehold result | FLOWING |
| `rooms/queries.ts` | room list | `db.room.findMany({ where: { householdId } })` | Yes — householdId from action payload validated by requireHouseholdAccess | FLOWING |
| `household/actions.ts` createHousehold | new Household + HouseholdMember | `db.$transaction([...])` | Yes — atomic write with real Prisma | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| Plants query scopes by householdId | `tests/plants.test.ts` D-16 test: `expect(db.plant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ householdId: "hh_TEST" }) }))` — no test.todos in Phase 2 blocks | PASS |
| Rooms query scopes by householdId | `tests/rooms.test.ts` D-16 test: `expect(db.room.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ householdId: "hh_TEST" }) }))` | PASS |
| createRoom rejects non-member with ForbiddenError | `tests/rooms.test.ts` line 112-128: mocks requireHouseholdAccess to throw ForbiddenError, asserts rejects.toBeInstanceOf(ForbiddenError) | PASS |
| seedStarterPlants enforces household membership | No requireHouseholdAccess call in `src/features/demo/actions.ts` — grep returns 0 hits | FAIL |
| JWT narrowing prevents null activeHouseholdId | `auth.ts` line 40: `typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined` | PASS |
| household-integration real DB tests run with cleanup | `tests/household-integration.test.ts` 279 lines with afterAll cleanup | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HSLD-02 | 02-02, 02-07 | User can create additional households | SATISFIED (data layer) | createHousehold action + $transaction + integration tests. UI deferred to Phase 6. |
| HSLD-03 | 02-02, 02-07 | User can view household membership list | SATISFIED (data layer) | getUserHouseholds query returns `{ id, name, slug, role, isDefault }`. Integration tests confirm. UI deferred to Phase 6. |
| D-10 | 02-04 | All queries scoped to householdId | SATISFIED | plants, rooms, watering, notes, reminders queries all use householdId in where clause |
| D-12 | 02-05a, 02-05b | Canonical 7-step Server Action shape | PARTIALLY SATISFIED | All actions except seedStarterPlants follow D-12. seedStarterPlants skips step 4 (requireHouseholdAccess). |
| D-16 | 02-04, 02-06 | Unit tests assert householdId in every query where clause | SATISFIED | D-16 describe blocks in plants.test.ts and rooms.test.ts — 0 todos, all passing |
| D-17 | 02-06 | ForbiddenError tests — one per mutating action | SATISFIED | 17 ForbiddenError tests across 5 test files, confirmed by 02-06-SUMMARY |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/features/demo/actions.ts` | `seedStarterPlants` accepts caller-supplied `householdId` with no `requireHouseholdAccess` call | Blocker | Any authenticated non-demo user can inject plants into any household by ID — authorization bypass |
| `src/features/household/actions.ts` | WR-02: slug generation loop attempts 11 iterations vs "10 attempts" comment (off-by-one) | Warning | Cosmetic mismatch between comment and code; no functional impact |
| Multiple action files | WR-04: `revalidatePath("/h/[householdSlug]/rooms")` with literal bracket — may not invalidate dynamic segments correctly | Warning | Potential stale cache on dynamic routes; non-blocking for correctness |

---

### Human Verification Required

None identified — all truths with deferred items are documented per plan, and the single gap (CR-01) is mechanically verifiable.

---

### Gaps Summary

**One blocker gap preventing full goal achievement:**

**Goal #4 ("All Server Actions enforce live household membership check") is FAILED** because `seedStarterPlants` in `src/features/demo/actions.ts` does not call `requireHouseholdAccess`. The function accepts an optional `householdId` parameter from the caller and resolves `targetHouseholdId = householdId ?? session.user.activeHouseholdId` — then proceeds to create plants in that household without verifying the caller is a member. This was flagged as CR-01 in the code review (02-REVIEW.md) and confirmed by live codebase inspection (0 `requireHouseholdAccess` calls in demo/actions.ts).

**Fix is mechanical:** Add `await requireHouseholdAccess(targetHouseholdId)` after the null-check on line 162, and add the import from `@/features/household/guards`.

**Goals #2 and #3 are deferred, not failed:** The data primitives (`createHousehold`, `getUserHouseholds`) are complete and tested. Phase 6 explicitly addresses the settings UI (HSET-01/HSET-02/HSET-03) where these will be surfaced.

---

_Verified: 2026-04-16T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
