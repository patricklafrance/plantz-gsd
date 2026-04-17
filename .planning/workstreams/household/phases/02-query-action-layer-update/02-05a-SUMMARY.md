---
phase: "02-query-action-layer-update"
plan: "05a"
subsystem: plants-rooms-actions
tags: [server-actions, d-12, d-13, pitfall-16, audit-columns, household-scope, plants, rooms, rhf, hidden-input]
dependency_graph:
  requires:
    - "02-01-SUMMARY.md (getCurrentHousehold, requireHouseholdAccess)"
    - "02-04-SUMMARY.md (householdId on all write schemas)"
  provides:
    - "createPlant/updatePlant/archivePlant/unarchivePlant/deletePlant — D-12 shape with requireHouseholdAccess"
    - "createRoom/updateRoom/deleteRoom — D-12 shape with requireHouseholdAccess"
    - "plantTargetSchema + roomTargetSchema (blob payloads for archive/unarchive/delete)"
    - "plants + rooms client components thread householdId prop"
  affects:
    - "02-05b (assumes this plan's signature changes landed)"
    - "02-06 (ForbiddenError tests target actions migrated here)"
    - "02-03a (page components pass householdId to these dialogs)"
tech_stack:
  added: []
  patterns:
    - "D-12 7-step canonical Server Action shape applied to all 8 mutating actions"
    - "data: unknown blob signature for archive/unarchive/delete (Zod parse validates both householdId + entity id)"
    - "requireHouseholdAccess called post-Zod-parse in every action (Pitfall 16 closed)"
    - "AUDT-02 createdByUserId wired at create sites"
    - "D-13 per-user-per-plant reminder nested create preserved"
    - "revalidatePath with literal [householdSlug] token + page type (Pitfall 3)"
    - "RHF defaultValues + hidden input threading for householdId in dialogs"
key_files:
  created: []
  modified:
    - src/features/plants/actions.ts
    - src/features/plants/schemas.ts
    - src/features/rooms/actions.ts
    - src/features/rooms/schemas.ts
    - src/components/plants/add-plant-dialog.tsx
    - src/components/plants/edit-plant-dialog.tsx
    - src/components/plants/plant-actions.tsx
    - src/components/rooms/create-room-dialog.tsx
    - src/components/rooms/quick-create-presets.tsx
    - src/components/rooms/room-card.tsx
    - tests/plants.test.ts
    - tests/rooms.test.ts
decisions:
  - "plantTargetSchema and roomTargetSchema use z.string().cuid() (not z.string().min(1)) — tighter validation per plan interface spec; requireHouseholdAccess provides the live authz check"
  - "router.push('/plants') navigation calls in plant-actions.tsx left unchanged — Plan 03b updates these paths to /h/[householdSlug]/plants as part of legacy-route cleanup"
  - "Link href='/rooms/${room.id}' in room-card.tsx left unchanged — Plan 03a/03b handles path rewire"
  - "Pre-existing notes/watering test failures are out-of-scope (Plan 05b scope); logged as deferred"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_created: 0
  files_modified: 12
---

# Phase 02 Plan 05a: Plants + Rooms Action Migration Summary

**One-liner:** Migrated all 8 mutating Server Actions in plants and rooms from userId-based ownership to householdId-scoped D-12 shape — archive/unarchive/delete-plant + delete-room signatures flipped to data-blob, AUDT-02 wired, Pitfall 16 closed.

## What Was Built

### Task 1 — plants/actions.ts (5 actions) + plants/schemas.ts + 3 plant components

**Commit:** `3213b4d`

#### Per-action migration confirmation

| Action | Guard Call | Signature | AUDT-02 |
|--------|-----------|-----------|---------|
| `createPlant(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | already blob | `createdByUserId: session.user.id` |
| `updatePlant(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | already blob | — |
| `archivePlant(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | **flipped** from `plantId: string` | — |
| `unarchivePlant(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | **flipped** from `plantId: string` | — |
| `deletePlant(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | **flipped** from `plantId: string` | — |

**Schema addition (`src/features/plants/schemas.ts`):**
```typescript
export const plantTargetSchema = z.object({
  householdId: z.string().cuid(),
  plantId: z.string().min(1, "Plant ID is required."),
});
export type PlantTargetInput = z.infer<typeof plantTargetSchema>;
```

**D-13 preserved in createPlant:**
```typescript
reminders: {
  create: { userId: session.user.id, enabled: true },
},
```

**revalidatePath counts in plants/actions.ts:** 11 calls, all using `/h/[householdSlug]/...` pattern with `"page"` type. Zero legacy `/plants` or `/dashboard` paths remain.

#### Client component call-site updates

| File | Change |
|------|--------|
| `src/components/plants/plant-actions.tsx` | Added `householdId: string` prop; `archivePlant(plant.id)` → `archivePlant({ householdId, plantId: plant.id })`; `unarchivePlant(plant.id)` → `unarchivePlant({ householdId, plantId: plant.id })`; `deletePlant(plant.id)` → `deletePlant({ householdId, plantId: plant.id })` |
| `src/components/plants/add-plant-dialog.tsx` | Added `householdId: string` prop; added to RHF `defaultValues`; added `<input type="hidden" {...form.register("householdId")} />`; reset includes `householdId` |
| `src/components/plants/edit-plant-dialog.tsx` | Added `householdId: string` prop; added to RHF `defaultValues`; added `<input type="hidden" {...form.register("householdId")} />`; reset includes `householdId` |

---

### Task 2 — rooms/actions.ts (3 actions) + rooms/schemas.ts + 3 room components

**Commit:** `d92e26c`

#### Per-action migration confirmation

| Action | Guard Call | Signature | AUDT-02 |
|--------|-----------|-----------|---------|
| `createRoom(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | already blob | `createdByUserId: session.user.id` |
| `updateRoom(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | already blob | — |
| `deleteRoom(data: unknown)` | `requireHouseholdAccess(parsed.data.householdId)` | **flipped** from `roomId: string` | — |

**Schema addition (`src/features/rooms/schemas.ts`):**
```typescript
export const roomTargetSchema = z.object({
  householdId: z.string().cuid(),
  roomId: z.string().min(1, "Room ID is required."),
});
export type RoomTargetInput = z.infer<typeof roomTargetSchema>;
```

**revalidatePath counts in rooms/actions.ts:** 8 calls, all using `/h/[householdSlug]/...` pattern with `"page"` type. Zero legacy `/rooms`, `/plants`, or `/dashboard` paths remain.

#### Client component call-site updates

| File | Change |
|------|--------|
| `src/components/rooms/create-room-dialog.tsx` | Added `householdId: string` prop; `createRoom({ name })` → `createRoom({ householdId, name })`; `updateRoom({ id, name })` → `updateRoom({ householdId, id, name })` |
| `src/components/rooms/quick-create-presets.tsx` | Added `householdId: string` prop; `createRoom({ name })` → `createRoom({ householdId, name })` |
| `src/components/rooms/room-card.tsx` | Added `householdId: string` prop; `deleteRoom(room.id)` → `deleteRoom({ householdId, roomId: room.id })`; passes `householdId` to embedded `<CreateRoomDialog>` for edit mode |

---

## Overall Verification Results

| Check | Result |
|-------|--------|
| `requireHouseholdAccess(parsed.data.householdId)` in plants+rooms actions | 8 matches (≥8 required) |
| `createdByUserId: session.user.id` in plants+rooms actions | 2 matches (≥2 required) |
| `revalidatePath("/h/[householdSlug]` in plants+rooms actions | 19 matches (≥10 required) |
| `data: unknown` signatures across 8 actions | 8 matches |
| Legacy `/plants`, `/rooms`, `/dashboard` revalidatePath | 0 matches |
| `where: { ..., userId }` ownership filters | 0 matches |
| `plantTargetSchema` exported from plants/schemas.ts | 1 match |
| `roomTargetSchema` exported from rooms/schemas.ts | 1 match |
| `npx tsc --noEmit` errors in 10 modified files | 0 new errors |
| `npx vitest run tests/plants.test.ts tests/rooms.test.ts` | 24 passed, 35 todo |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] room-card.tsx CreateRoomDialog missing householdId prop**
- **Found during:** Task 2 — TypeScript compile check
- **Issue:** `RoomCard` embeds `<CreateRoomDialog>` for edit mode. After `CreateRoomDialog` gained the required `householdId` prop, `RoomCard` needed to forward it — this wasn't explicitly listed in the plan step for room-card.tsx
- **Fix:** Added `householdId={householdId}` to the `<CreateRoomDialog>` inside `RoomCard`
- **Files modified:** `src/components/rooms/room-card.tsx`
- **Commit:** `d92e26c`

**2. [Rule 1 - Bug] Test data used non-CUID householdId "hh_test"**
- **Found during:** Task 1 TDD GREEN phase — test failed with "Invalid input." instead of expected assertion
- **Issue:** `plantTargetSchema` uses `z.string().cuid()` — test data `"hh_test"` failed Zod parse before reaching the mocked DB call, causing actions to return `{ error: "Invalid input." }` instead of `{ error: "Plant not found." }`
- **Fix:** Updated test data to use `"clxxxxxxxxxxxxxxxxxxxxxxxxx"` (existing project convention for CUID test values)
- **Files modified:** `tests/plants.test.ts`
- **Commit:** `3213b4d`

### Pre-existing Issues (Out of Scope — Deferred to Plan 05b)

**notes.test.ts + watering.test.ts failures (16 tests)**
- `notes/actions.ts` and `watering/actions.ts` already call `requireHouseholdAccess` (migrated in a prior worktree wave) but their test files lack the `vi.mock("@/features/household/guards")` setup
- These are Plan 05b scope — that plan is responsible for migrating notes/watering actions and their tests
- This plan's files (plants, rooms) are fully clean

---

## Known Stubs

None. All 8 migrated actions are fully wired to `requireHouseholdAccess` + household-scoped Prisma queries. All client components pass `householdId` to their action calls. No placeholder data flows to UI.

## Threat Flags

None. The threat model in the plan covers all security surface introduced here:
- T-02-05a-01: stale-JWT bypass mitigated by live `requireHouseholdAccess` per action
- T-02-05a-02: hidden-field tampering mitigated by live DB membership check
- T-02-05a-03: entity-level ownership escape mitigated by double-scoped `findFirst({ id, householdId })`
- T-02-05a-04: AUDT-02 `createdByUserId` wired at both create sites
- T-02-05a-05: no `...parsed.data` spreading — explicit field lists in all `db.X.create` calls

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 3213b4d | feat(02-05a): migrate plants actions to D-12 shape + wire householdId in components |
| Task 2 | d92e26c | feat(02-05a): migrate rooms actions to D-12 shape + wire householdId in components |

## Self-Check: PASSED

- `src/features/plants/actions.ts` — FOUND
- `src/features/plants/schemas.ts` — FOUND
- `src/features/rooms/actions.ts` — FOUND
- `src/features/rooms/schemas.ts` — FOUND
- `src/components/plants/add-plant-dialog.tsx` — FOUND
- `src/components/plants/edit-plant-dialog.tsx` — FOUND
- `src/components/plants/plant-actions.tsx` — FOUND
- `src/components/rooms/create-room-dialog.tsx` — FOUND
- `src/components/rooms/quick-create-presets.tsx` — FOUND
- `src/components/rooms/room-card.tsx` — FOUND
- Commit `3213b4d` — FOUND in git log
- Commit `d92e26c` — FOUND in git log
- `npx vitest run tests/plants.test.ts tests/rooms.test.ts` — 24 passed, 35 todo, 0 failed
