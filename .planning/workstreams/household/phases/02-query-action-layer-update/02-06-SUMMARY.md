---
phase: "02-query-action-layer-update"
plan: "06"
subsystem: authz-tests
tags: [forbidden-error, d-17, pitfall-16, authz-tests, tdd, security-verification]
dependency_graph:
  requires:
    - "02-05a-SUMMARY.md (plants + rooms actions migrated with requireHouseholdAccess)"
    - "02-05b-SUMMARY.md (watering + notes + reminders actions migrated)"
  provides:
    - "17 ForbiddenError tests — one per mutating Server Action — ASVS V4 audit trail"
    - "Zero Phase 2 test.todo entries remaining across 5 test files"
    - "guards partial mock (vi.importActual) pattern in all 5 feature test files"
  affects:
    - "02-07 (phase closure — test gate is now green for all 17 actions)"
tech_stack:
  added: []
  patterns:
    - "vi.mock + vi.importActual partial mock keeps ForbiddenError real, replaces only requireHouseholdAccess"
    - "mockRejectedValue(new ForbiddenError()) → rejects.toBeInstanceOf(ForbiddenError) propagation assertion"
    - "Schema-valid payloads constructed per-action so Zod parse passes before guard is reached"
key_files:
  created: []
  modified:
    - tests/plants.test.ts
    - tests/rooms.test.ts
    - tests/watering.test.ts
    - tests/notes.test.ts
    - tests/reminders.test.ts
decisions:
  - "All 17 actions use rejects.toBeInstanceOf(ForbiddenError) (propagation) — consistent with D-12/Q14 recommendation; no action wraps requireHouseholdAccess in try/catch"
  - "toggleGlobalReminders excluded — per-user action, no requireHouseholdAccess, documented in 02-05b"
  - "householdId payloads use z.string().min(1) schemas (plants/rooms use z.string().cuid() for plantTargetSchema/roomTargetSchema) — test fixtures use clxxxxxxxxxxxxxxxxxxxxxxxxx CUID string for those"
  - "reminders.test.ts db mock extended with plant.findFirst + reminder.upsert + user.update to support future non-ForbiddenError tests"
  - "household-integration.test.ts and npm run build failures are pre-existing worktree artifact issues (missing @/generated/prisma/client) — confirmed present on base commit before this plan's changes"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17"
  tasks_completed: 1
  files_created: 0
  files_modified: 5
---

# Phase 02 Plan 06: D-17 ForbiddenError Test Safety Net Summary

**One-liner:** Converted all 17 Phase 2 ForbiddenError test.todo scaffolds to real passing tests using vi.importActual partial mock pattern — ASVS V4 access control audit trail complete across all mutating Server Actions.

## D-17 Action Coverage Table

| Action | File | Schema Used | Payload | Assertion Style | Guard Call Pattern |
|--------|------|-------------|---------|-----------------|-------------------|
| `createPlant` | plants/actions.ts | `createPlantSchema` | `{ householdId: "clx...", nickname: "Test", wateringInterval: 7 }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates (no try/catch) |
| `updatePlant` | plants/actions.ts | `editPlantSchema` | `{ householdId: "clx...", id: "p1", nickname: "Test", wateringInterval: 7 }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `archivePlant` | plants/actions.ts | `plantTargetSchema` | `{ householdId: "clx...", plantId: "p1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `unarchivePlant` | plants/actions.ts | `plantTargetSchema` | `{ householdId: "clx...", plantId: "p1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `deletePlant` | plants/actions.ts | `plantTargetSchema` | `{ householdId: "clx...", plantId: "p1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `createRoom` | rooms/actions.ts | `createRoomSchema` | `{ householdId: "clx...", name: "Living Room" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `updateRoom` | rooms/actions.ts | `editRoomSchema` | `{ householdId: "clx...", id: "r1", name: "Kitchen" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `deleteRoom` | rooms/actions.ts | `roomTargetSchema` | `{ householdId: "clx...", roomId: "r1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `logWatering` | watering/actions.ts | `logWateringSchema` | `{ householdId: "clx...", plantId: "p1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `editWateringLog` | watering/actions.ts | `editWateringLogSchema` | `{ householdId: "clx...", logId: "wl1", wateredAt: new Date().toISOString() }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `deleteWateringLog` | watering/actions.ts | `deleteWateringLogSchema` | `{ householdId: "clx...", logId: "wl1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `createNote` | notes/actions.ts | `createNoteSchema` | `{ householdId: "clx...", plantId: "p1", content: "Test note" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `updateNote` | notes/actions.ts | `updateNoteSchema` | `{ householdId: "clx...", noteId: "n1", content: "Updated" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `deleteNote` | notes/actions.ts | `deleteNoteSchema` | `{ householdId: "clx...", noteId: "n1" }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `snoozeReminder` | reminders/actions.ts | `snoozeSchema` | `{ householdId: "clx...", plantId: "p1", days: 1 }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `snoozeCustomReminder` | reminders/actions.ts | `snoozeCustomSchema` | `{ householdId: "clx...", plantId: "p1", snoozedUntil: new Date(+86400000) }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |
| `togglePlantReminder` | reminders/actions.ts | `toggleReminderSchema` | `{ householdId: "clx...", plantId: "p1", enabled: false }` | `rejects.toBeInstanceOf(ForbiddenError)` | propagates |

## Excluded Actions (with rationale)

| Action | Reason |
|--------|--------|
| `toggleGlobalReminders` | Per-user action — writes `User.remindersEnabled`, no `requireHouseholdAccess` call. Documented exemption in 02-05b. D-17 does not apply. |
| `loadMoreWateringHistory` | Read delegation — no `requireHouseholdAccess`. Filters by `plant.householdId` via query layer. Covered by D-16 isolation tests in 02-04. |
| `loadMoreTimeline` | Read delegation — same rationale as `loadMoreWateringHistory`. |

## Throw-vs-Return Decision (Q14)

All 17 actions call `await requireHouseholdAccess(parsed.data.householdId)` **without** a surrounding try/catch block. This means ForbiddenError **propagates** from the action to the Next.js error boundary (`error.tsx`). The Q14 recommendation (propagation preferred) is confirmed — all 17 tests use `rejects.toBeInstanceOf(ForbiddenError)`.

## Test Count Per File (Phase 2 ForbiddenError describe block)

| File | Tests Added | Previous Todos | Todos Remaining |
|------|-------------|----------------|-----------------|
| `tests/plants.test.ts` | 5 | 5 | 0 |
| `tests/rooms.test.ts` | 3 | 3 | 0 |
| `tests/watering.test.ts` | 3 | 3 | 0 |
| `tests/notes.test.ts` | 3 | 3 | 0 |
| `tests/reminders.test.ts` | 3 | 3 | 0 |
| **Total** | **17** | **17** | **0** |

## Guards Mock Pattern Applied (5 files)

All 5 files now have the D-17 canonical partial mock:
```typescript
vi.mock("@/features/household/guards", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/guards")>(
    "@/features/household/guards"
  );
  return {
    ...actual,                       // keeps ForbiddenError real (cross-module instanceof)
    requireHouseholdAccess: vi.fn(), // replaced with throwable mock
  };
});
```

`plants.test.ts`, `rooms.test.ts`, `watering.test.ts`, `notes.test.ts` already had this mock from prior wave commits. `reminders.test.ts` had it added in this plan along with an extended db mock (`plant.findFirst`, `reminder.upsert`, `user.update`).

## Verification Results

| Check | Result |
|-------|--------|
| `vi.mock("@/features/household/guards")` with `vi.importActual` | 5 matches (one per file) |
| `rejects.toBeInstanceOf(ForbiddenError)` assertions | 17 total |
| `test.todo` in Phase 2 ForbiddenError describe blocks | 0 |
| `npx vitest run tests/plants.test.ts tests/rooms.test.ts tests/watering.test.ts tests/notes.test.ts tests/reminders.test.ts` | 95 passed, 48 todo, 0 failed |
| Full test suite (`npx vitest run` — 5 feature files) | 95 passed, 48 todo, 0 failed |
| `npm run build` | Pre-existing failure (missing `@/generated/prisma/client` — worktree artifact, confirmed present on base commit before this plan) |

**Note on build gate:** The `npm run build` failure is a worktree environment artifact — `@/generated/prisma/client` is generated by `prisma generate` and is gitignored. It was failing identically before this plan's changes (confirmed by stashing and re-running). The 02-05b SUMMARY confirms the build was green on the main branch (`exit 0`). This plan modifies only test files, which do not affect the build output.

## Phase 2 Closure Notes for REQUIREMENTS.md

**HSLD-02 and HSLD-03 — DATA-LAYER satisfied; UI deferred to Phase 6.**

- HSLD-02 (household-scoped data isolation): Phase 2 data layer complete. All 17 mutating actions enforce household membership via `requireHouseholdAccess`. All queries filter by `householdId`. D-16 isolation + D-17 ForbiddenError tests provide executable evidence.
- HSLD-03 (access control): Phase 2 guard implementation complete. `requireHouseholdAccess` is the live membership check in every action. ForbiddenError propagates to `error.tsx` (Plan 03). ASVS V4 coverage: 17 per-action tests.
- UI layer (household switcher, member management) deferred to Phase 6 per D-07/D-09.

The REQUIREMENTS.md traceability should record: "Phase 2 data layer complete; Phase 6 UI pending."

## Deviations from Plan

None. The plan executed exactly as written:
- All 5 files already had the guards mock from prior wave commits (plants, rooms, watering, notes) or received it in this plan (reminders)
- All actions propagate ForbiddenError (no try/catch wrapping found in any action)
- All schema payloads pass Zod parse before reaching the guard (verified by tests passing)
- `toggleGlobalReminders` correctly excluded (no guard call)
- No actions exist that were missing from the D-17 coverage table

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | dc5e90b | test(02-06): convert all Phase 2 ForbiddenError test.todos to real tests (D-17) |

## Self-Check: PASSED

Files verified:
- `tests/plants.test.ts` — FOUND, contains 5 ForbiddenError tests
- `tests/rooms.test.ts` — FOUND, contains 3 ForbiddenError tests
- `tests/watering.test.ts` — FOUND, contains 3 ForbiddenError tests
- `tests/notes.test.ts` — FOUND, contains 3 ForbiddenError tests
- `tests/reminders.test.ts` — FOUND, contains 3 ForbiddenError tests

Commit `dc5e90b` — verified in git log.

Test suite: 95 passed, 48 todo, 0 failed across the 5 feature test files.
