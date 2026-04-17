---
phase: 02-query-action-layer-update
plan: "04"
subsystem: query-layer
tags: [query-migration, schema-update, household-scope, d-10, d-14, d-15, d-16, pitfall-1]
dependency_graph:
  requires: ["02-01"]
  provides: ["householdId-scoped queries in plants/rooms/watering/notes/reminders", "D-14 reminder signatures", "householdId on all write schemas"]
  affects: ["02-05", "02-06", "02-07"]
tech_stack:
  added: []
  patterns:
    - "Direct householdId filter: where: { householdId } on Plant and Room queries"
    - "Nested relation filter: plant: { householdId } on WateringLog, Note, and Reminder queries"
    - "D-14 stable function signatures: getReminderCount/getReminderItems accept householdId not userId"
    - "D-15 deliberate regression: no assignee gate in reminder queries (Phase 5 re-adds it)"
    - "Zod v4 write schemas: householdId: z.string().min(1) prepended to all 5 feature modules"
key_files:
  created: []
  modified:
    - src/features/plants/queries.ts
    - src/features/plants/schemas.ts
    - src/features/rooms/queries.ts
    - src/features/rooms/schemas.ts
    - src/features/watering/queries.ts
    - src/features/watering/schemas.ts
    - src/features/notes/queries.ts
    - src/features/notes/schemas.ts
    - src/features/reminders/queries.ts
    - src/features/reminders/schemas.ts
    - tests/plants.test.ts
    - tests/rooms.test.ts
    - tests/watering.test.ts
    - tests/notes.test.ts
    - tests/reminders.test.ts
decisions:
  - "D-15 regression accepted: reminder queries have no userId assignee gate in Phase 2; Phase 5 re-adds it"
  - "getRoomsForSelect migrated in rooms/queries.ts (it lives there, not plants/queries.ts)"
  - "getPlantReminder(plantId, userId) left unchanged — per-user-per-plant preference, not household-scoped"
  - "actions.ts compile errors (userId refs) deferred to Plan 05 — they are pre-existing Phase 1 cascade"
  - "Existing schema/action tests updated to include required householdId field"
metrics:
  duration: "~30 minutes"
  completed_date: "2026-04-16"
  tasks_completed: 3
  files_modified: 15
---

# Phase 02 Plan 04: Query + Schema Layer householdId Migration Summary

**One-liner:** Migrated all 5 feature query modules from `userId`-scoped to `householdId`-scoped filtering, added `householdId` to all write schemas, and converted 13 D-16 isolation `test.todo` stubs into real passing tests — closing Pitfall 1 across the query layer.

## Tasks Completed

### Task 1: plants/queries.ts + plants/schemas.ts + D-16 tests

**Commit:** `6dc60f3`

**Signatures migrated:**
- `getPlants(userId, options)` → `getPlants(householdId, options)` — `where: { householdId, ...archivedFilter }` 
- `getPlant(plantId, userId)` → `getPlant(plantId, householdId)` — `where: { id: plantId, householdId }`
- `getCatalog()` — unchanged (not scoped)
- `getRoomsForSelect(userId)` → `getRoomsForSelect(householdId)` — migrated in rooms/queries.ts (where it lives)

**Schemas extended:** `createPlantSchema`, `editPlantSchema` — both gain `householdId: z.string().min(1)` as first field.

**D-16 tests added:** 4 tests (getPlants findMany, getPlants count, getPlant findFirst, getRoomsForSelect)

**Deviation:** Existing schema test `createPlantSchema accepts valid plant data` updated to include required `householdId` field.

---

### Task 2: rooms + watering + notes queries/schemas + D-16 tests

**Commit:** `7a314c2`

**Rooms — direct filter:**
- `getRooms(userId)` → `getRooms(householdId)`: `where: { householdId }`
- `getRoom(roomId, userId)` → `getRoom(roomId, householdId)`: `where: { id: roomId, householdId }`
- `getRoomsForSelect(userId)` → `getRoomsForSelect(householdId)`: `where: { householdId }`

**Watering — nested relation filter:**
- `getDashboardPlants(userId, ...)` → `getDashboardPlants(householdId, ...)`: `where: { householdId, archivedAt: null }`
- `getWateringHistory(plantId, userId, ...)` → `getWateringHistory(plantId, householdId, ...)`: both `findMany` and `count` use `where: { plantId, plant: { householdId } }`

**Notes — nested relation filter:**
- `getTimeline(plantId, userId, ...)` → `getTimeline(plantId, householdId, ...)`: both `db.wateringLog.findMany` and `db.note.findMany` use `where: { plantId, plant: { householdId } }`
- `loadMoreTimeline(plantId, userId, ...)` → `loadMoreTimeline(plantId, householdId, ...)`: delegates to migrated `getTimeline`

**Schemas extended:**
- `rooms/schemas.ts`: `createRoomSchema`, `editRoomSchema` + new `deleteRoomSchema` — all with `householdId: z.string().min(1)`
- `watering/schemas.ts`: `logWateringSchema`, `editWateringLogSchema` + new `deleteWateringLogSchema` — all with `householdId: z.string().min(1)`
- `notes/schemas.ts`: `createNoteSchema`, `updateNoteSchema`, `deleteNoteSchema` — all with `householdId: z.string().min(1)`

**D-16 tests added:** 6 tests (getRooms, getRoom, getWateringHistory findMany, getWateringHistory count, getTimeline notes filter, loadMoreTimeline delegation)

**Deviation:** Multiple existing schema + action tests updated to include required `householdId` in test data after schemas changed. `logWatering`, `editWateringLog`, `createNote`, `updateNote`, `deleteNote` action tests all updated.

---

### Task 3: reminders/queries.ts with D-14/D-15 + D-16 tests

**Commit:** `b737f67`

**Signatures migrated (D-14 stable):**
- `getReminderCount(userId, todayStart, todayEnd)` → `getReminderCount(householdId, todayStart, todayEnd)`
- `getReminderItems(userId, todayStart, todayEnd)` → `getReminderItems(householdId, todayStart, todayEnd)`

**D-15 regression body:** Both functions use `where: { householdId, archivedAt: null, reminders: { some: { enabled: true, OR: [snooze] } } }` — the `userId` filter inside `reminders.some` is **removed**. Every household member sees the same count until Phase 5 adds the assignee gate.

**JSDoc contract:** Both functions have JSDoc documenting D-14 stability guarantee and D-15 deliberate regression.

**Unchanged:** `getPlantReminder(plantId, userId)` — per-user-per-plant preference read, not household-scoped.

**Global check removed:** The `db.user.findUnique({ where: { id: userId }, select: { remindersEnabled } })` fast-exit check was removed — this was a per-user global toggle. In Phase 2, every household member sees reminders. Phase 5 restores per-member filtering via assignee gate.

**Schemas extended:** `snoozeSchema`, `snoozeCustomSchema`, `toggleReminderSchema` — all gain `householdId: z.string().min(1)`. `toggleGlobalRemindersSchema` unchanged (per-user setting).

**D-16 tests added:** 3 tests (getReminderCount householdId assertion, getReminderItems householdId assertion, D-15 regression documentation test)

---

## Per-Module Migration Summary

| Module | Functions Migrated | Nested Filter | Schema Fields Added | D-16 Tests |
|--------|-------------------|---------------|--------------------|-----------:|
| plants | getPlants, getPlant | No (direct) | 2 schemas | 4 |
| rooms | getRooms, getRoom, getRoomsForSelect | No (direct) | 2 schemas + 1 new | 2 |
| watering | getDashboardPlants, getWateringHistory | Yes (wateringLog) | 2 schemas + 1 new | 2 |
| notes | getTimeline, loadMoreTimeline | Yes (note + wateringLog) | 3 schemas | 2 |
| reminders | getReminderCount, getReminderItems | Via plant.householdId | 3 schemas | 3 |
| **Total** | **10 functions** | | **13 schemas** | **13** |

## D-14 JSDoc Contract Confirmed

Both `getReminderCount` and `getReminderItems` in `src/features/reminders/queries.ts` have JSDoc comments explicitly documenting:
- D-14: signature stable across Phase 2 → Phase 5; callers do not change when Phase 5 modifies body
- D-15: Phase 2 body has no assignee gate; deliberate regression until Phase 5

## D-15 Regression Test Present

`tests/reminders.test.ts` contains the documentation-style test "D-15 regression notice: getReminderCount body has NO assignee-gate — every member sees the same count". This test is marked for deletion and replacement when Phase 5 ships the assignee gate.

## Plan 05 Interface Contract

All 5 feature modules now have `householdId: z.string().min(1)` as the first field on every write schema. Plan 05 actions can `safeParse(data)` and extract `parsed.data.householdId` to pass to `requireHouseholdAccess`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing schema tests broken by required householdId field**
- **Found during:** Tasks 1, 2, 3
- **Issue:** After adding `householdId: z.string().min(1)` to schemas, existing "accepts valid input" tests that didn't include `householdId` failed with `result.success === false`
- **Fix:** Updated all existing schema acceptance tests to include a valid `householdId` value
- **Files modified:** tests/plants.test.ts, tests/rooms.test.ts, tests/watering.test.ts, tests/notes.test.ts, tests/reminders.test.ts
- **Commits:** `6dc60f3`, `7a314c2`, `b737f67`

**2. [Rule 1 - Bug] Existing watering and notes action tests broken by schema change**
- **Found during:** Task 2
- **Issue:** `logWatering`, `editWateringLog`, `createNote`, `updateNote`, `deleteNote` action tests called actions with data missing `householdId`, causing Zod parse failure before reaching the test's intended assertion point
- **Fix:** Added `householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx"` to all action test data objects
- **Files modified:** tests/watering.test.ts, tests/notes.test.ts
- **Commit:** `7a314c2`

**3. [Rule 1 - Scope] getRoomsForSelect migrated in rooms/queries.ts not plants/queries.ts**
- **Found during:** Task 1 (reading source files)
- **Issue:** Plan assumed `getRoomsForSelect` might be in plants/queries.ts; it lives in rooms/queries.ts
- **Fix:** Migrated it in rooms/queries.ts as part of Task 1 (rooms migration was needed for plants D-16 test for `getRoomsForSelect`)
- **Files modified:** src/features/rooms/queries.ts
- **Commit:** `6dc60f3`

**4. [Deferred - Pre-existing] actions.ts compile errors**
- **Found during:** TypeScript verification
- **Issue:** `rooms/actions.ts`, `watering/actions.ts`, `notes/actions.ts`, `reminders/actions.ts` still reference `userId` in Prisma where clauses — these are Phase 1 cascade errors
- **Decision:** These are Plan 05 scope. Query and schema files in this plan have zero TypeScript errors.
- **Tracked:** Deferred to Plan 05

## Known Stubs

None. All 10 migrated query functions are fully wired to the correct `householdId` filter.

## Threat Flags

None beyond what the plan's threat model already covers. All new surface is householdId-scoped Prisma queries — no new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

Files verified to exist:
- src/features/plants/queries.ts — FOUND
- src/features/plants/schemas.ts — FOUND
- src/features/rooms/queries.ts — FOUND
- src/features/rooms/schemas.ts — FOUND
- src/features/watering/queries.ts — FOUND
- src/features/watering/schemas.ts — FOUND
- src/features/notes/queries.ts — FOUND
- src/features/notes/schemas.ts — FOUND
- src/features/reminders/queries.ts — FOUND
- src/features/reminders/schemas.ts — FOUND
- tests/plants.test.ts — FOUND
- tests/rooms.test.ts — FOUND
- tests/watering.test.ts — FOUND
- tests/notes.test.ts — FOUND
- tests/reminders.test.ts — FOUND

Commits verified:
- 6dc60f3 (Task 1) — FOUND
- 7a314c2 (Task 2) — FOUND
- b737f67 (Task 3) — FOUND

Tests: 68 passed, 65 todo across 5 test files — all green.
