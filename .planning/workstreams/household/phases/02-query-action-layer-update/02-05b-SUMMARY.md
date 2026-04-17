---
phase: "02-query-action-layer-update"
plan: "05b"
subsystem: server-actions
tags: [server-actions, d-04, d-12, d-13, pitfall-16, audit-columns, rhf, hidden-input, household-scope, watering, notes, reminders, demo]
dependency_graph:
  requires:
    - "02-01-SUMMARY.md (getCurrentHousehold, requireHouseholdAccess)"
    - "02-04-SUMMARY.md (householdId on all write schemas, query layer migrated)"
    - "02-05a-SUMMARY.md (plants + rooms actions migrated)"
  provides:
    - "logWatering/editWateringLog/deleteWateringLog/loadMoreWateringHistory migrated"
    - "createNote/updateNote/deleteNote/loadMoreTimeline migrated"
    - "snoozeReminder/snoozeCustomReminder/togglePlantReminder migrated"
    - "demo bootstrap creates Household + HouseholdMember atomically"
    - "9 client components thread householdId prop"
    - "Legacy redirect stubs: /dashboard, /plants, /plants/[id], /rooms, /rooms/[id]"
    - "npm run build exits 0 — Phase 2 code layer build-green"
  affects:
    - "02-06 (D-17 ForbiddenError tests now have migrated actions to test against)"
    - "02-07 (household-scoped pages can use the fully-migrated action set)"
tech_stack:
  added: []
  patterns:
    - "D-12 7-step Server Action shape: session → demo guard → Zod parse → requireHouseholdAccess → plant ownership filter → DB write with audit columns → revalidatePath"
    - "Nested-relation ownership: plant: { householdId } on WateringLog/Note find queries"
    - "D-13 compound-key upsert: plantId_userId: { plantId, userId: session.user.id } on all 3 reminder upserts"
    - "Signature flip: deleteWateringLog (positional string → data: unknown object) and loadMoreWateringHistory (positional pair → data: unknown object)"
    - "AUDT-01: performedByUserId: session.user.id on WateringLog.create and Note.create"
    - "Legacy redirect stubs: /dashboard, /plants, /plants/[id], /rooms, /rooms/[id] redirect to /h/[household.slug]/..."
key_files:
  created: []
  modified:
    - src/features/watering/actions.ts
    - src/features/watering/schemas.ts
    - src/features/notes/actions.ts
    - src/features/notes/schemas.ts
    - src/features/reminders/actions.ts
    - src/features/demo/actions.ts
    - prisma/seed.ts
    - src/components/watering/log-watering-dialog.tsx
    - src/components/watering/dashboard-client.tsx
    - src/components/watering/dashboard-plant-card.tsx
    - src/components/watering/watering-history.tsx
    - src/components/watering/watering-history-entry.tsx
    - src/components/timeline/timeline.tsx
    - src/components/timeline/timeline-entry.tsx
    - src/components/timeline/note-input.tsx
    - src/components/reminders/snooze-pills.tsx
    - src/components/reminders/plant-reminder-toggle.tsx
    - src/components/plants/plant-detail.tsx
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/plants/page.tsx
    - src/app/(main)/plants/[id]/page.tsx
    - src/app/(main)/rooms/page.tsx
    - src/app/(main)/rooms/[id]/page.tsx
decisions:
  - "toggleGlobalReminders intentionally NOT migrated — writes User.remindersEnabled (per-user global setting, not household-scoped); documented with JSDoc"
  - "loadMoreWateringHistory and loadMoreTimeline READ delegators do not call requireHouseholdAccess — query layer filters by plant.householdId, non-members get empty results"
  - "Legacy pages (/dashboard, /plants, /plants/[id], /rooms, /rooms/[id]) converted to redirect stubs (Rule 3 blocking fix) per PATTERNS.md Plan 03a pattern"
  - "prisma/seed.ts fixed alongside demo/actions.ts (both had same userId→householdId breakage)"
  - "seedStarterPlants signature extended with optional householdId param; falls back to session.user.activeHouseholdId"
metrics:
  duration: "~45 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 23
---

# Phase 02 Plan 05b: Watering + Notes + Reminders + Demo Action Migration Summary

**One-liner:** Migrated 11 mutating Server Actions across watering/notes/reminders/demo to householdId ownership with D-12 shape, D-13 reminder compound-key preserved, AUDT-01 wired, 9+ client components thread householdId, legacy pages converted to redirect stubs, and `npm run build` exits 0.

## Per-Action Migration Confirmation

### Watering Actions (src/features/watering/actions.ts)

| Action | Schema Used | Guard | Signature Shape | Notes |
|--------|-------------|-------|-----------------|-------|
| `logWatering` | `logWateringSchema` | `requireHouseholdAccess` | `data: unknown` | Plant lookup: `{ id, householdId, archivedAt: null }`. AUDT-01: `performedByUserId: session.user.id` |
| `editWateringLog` | `editWateringLogSchema` | `requireHouseholdAccess` | `data: unknown` | Nested ownership: `plant: { householdId }` |
| `deleteWateringLog` | `deleteWateringLogSchema` (NEW) | `requireHouseholdAccess` | `data: unknown` (FLIPPED from `logId: string`) | Nested ownership: `plant: { householdId }` |
| `loadMoreWateringHistory` | `loadMoreWateringHistorySchema` (NEW) | None (read delegation) | `data: unknown` (FLIPPED from positional pair) | Delegates to `getWateringHistory(plantId, householdId, skip, 20)` |

### Notes Actions (src/features/notes/actions.ts)

| Action | Schema Used | Guard | Signature Shape | Notes |
|--------|-------------|-------|-----------------|-------|
| `createNote` | `createNoteSchema` | `requireHouseholdAccess` | `data: unknown` | Plant lookup: `{ id, householdId }`. AUDT-01: `performedByUserId: session.user.id` |
| `updateNote` | `updateNoteSchema` | `requireHouseholdAccess` | `data: unknown` | Nested ownership: `plant: { householdId }` |
| `deleteNote` | `deleteNoteSchema` | `requireHouseholdAccess` | `data: unknown` | Nested ownership: `plant: { householdId }` |
| `loadMoreTimeline` | `loadMoreTimelineSchema` (MOVED from inline) | None (read delegation) | `data: unknown` | `loadMoreTimelineSchema` moved from inline definition in actions.ts to notes/schemas.ts |

### Reminders Actions (src/features/reminders/actions.ts)

| Action | Schema Used | Guard | Signature Shape | Notes |
|--------|-------------|-------|-----------------|-------|
| `snoozeReminder` | `snoozeSchema` | `requireHouseholdAccess` | `data: unknown` | Plant lookup: `{ id, householdId }`. D-13 compound-key preserved |
| `snoozeCustomReminder` | `snoozeCustomSchema` | `requireHouseholdAccess` | `data: unknown` | Plant lookup: `{ id, householdId }`. D-13 compound-key preserved |
| `togglePlantReminder` | `toggleReminderSchema` | `requireHouseholdAccess` | `data: unknown` | Plant lookup: `{ id, householdId }`. D-13 compound-key preserved |
| `toggleGlobalReminders` | `toggleGlobalRemindersSchema` | **NONE — per-user** | `data: unknown` | Writes `User.remindersEnabled`. NOT migrated. Revalidates `/h/[householdSlug]/dashboard` pattern |

## D-13 Reminder Compound-Key Verbatim Text

All 3 plant-scoped reminder upserts use identical where-clause:

```typescript
await db.reminder.upsert({
  where: { plantId_userId: { plantId, userId: session.user.id } },
  update: { /* action-specific fields */ },
  create: { plantId, userId: session.user.id, enabled: true, /* action-specific fields */ },
});
```

The `plantId_userId` key is the Prisma-generated identifier for `@@unique([plantId, userId])` on the `Reminder` model. `userId` is session-derived, never client-derived. D-13 compliance confirmed in all 3 upserts: `snoozeReminder`, `snoozeCustomReminder`, `togglePlantReminder`.

## toggleGlobalReminders — Per-User Exemption Confirmed

`toggleGlobalReminders` has NO `requireHouseholdAccess` call. It writes `User.remindersEnabled` which is a per-user global preference, not household-scoped. This is the single exemption from the Phase 2 migration (T-02-05b-07). A JSDoc comment documents the exemption inline.

## Demo Bootstrap Before/After

**Before (broken):**
- Sequential: `user.create` → `room.create({ userId })` → `plant.create({ userId })`
- `userId` column dropped in Phase 1 → build broken

**After (fixed):**
```
db.$transaction:
  ├─ user.create (demoUser)
  ├─ slug collision loop → household.create (name: "Demo Plants")
  └─ householdMember.create (OWNER, rotationOrder: 0, isDefault: true)

After transaction:
  ├─ room.create (householdId: household.id, createdByUserId: demoUser.id) ×2
  └─ plant.create (householdId: household.id, createdByUserId: demoUser.id) ×8
       └─ reminders.create (userId: demoUser.id, D-13)
  └─ wateringLog.create (performedByUserId: demoUser.id, AUDT-01) ×8
```

**Row counts created:** 1 User + 1 Household + 1 HouseholdMember + 2 Rooms + 8 Plants + 8 Reminders + 8 WateringLogs = 29 rows

`prisma/seed.ts` received the identical fix (Rule 3 blocking issue).

## Client Component Table

| Component | Previous Call | New Call | Prop Added |
|-----------|--------------|----------|------------|
| `log-watering-dialog.tsx` | `editWateringLog({ logId, ... })` | `editWateringLog({ householdId, logId, ... })` | `householdId: string` |
| `log-watering-dialog.tsx` | `logWatering({ plantId, ... })` | `logWatering({ householdId, plantId, ... })` | (same prop) |
| `dashboard-client.tsx` | `logWatering({ plantId: plant.id })` | `logWatering({ householdId, plantId: plant.id })` | `householdId: string` |
| `dashboard-plant-card.tsx` | `InlineSnoozePills({ plantId })` | `InlineSnoozePills({ householdId, plantId })` | `householdId: string` |
| `dashboard-plant-card.tsx` | `snoozeReminder({ plantId, days })` | `snoozeReminder({ householdId, plantId, days })` | (same prop) |
| `watering-history.tsx` | `loadMoreWateringHistory(plantId, logs.length)` | `loadMoreWateringHistory({ householdId, plantId, skip: logs.length })` | `householdId: string` |
| `watering-history-entry.tsx` | `deleteWateringLog(log.id)` | `deleteWateringLog({ householdId, logId: log.id })` | `householdId: string` |
| `timeline.tsx` | `loadMoreTimeline({ plantId, skip })` | `loadMoreTimeline({ householdId, plantId, skip })` | `householdId: string` |
| `timeline-entry.tsx` | `updateNote({ noteId, content })` | `updateNote({ householdId, noteId, content })` | `householdId: string` |
| `timeline-entry.tsx` | `deleteNote({ noteId })` | `deleteNote({ householdId, noteId })` | (same prop) |
| `timeline-entry.tsx` | `deleteWateringLog(entry.id)` | `deleteWateringLog({ householdId, logId: entry.id })` | (same prop) |
| `note-input.tsx` | `createNote({ plantId, content })` | `createNote({ householdId, plantId, content })` | `householdId: string` |
| `snooze-pills.tsx` | `snoozeReminder({ plantId, days })` | `snoozeReminder({ householdId, plantId, days })` | `householdId: string` |
| `snooze-pills.tsx` | `snoozeCustomReminder({ plantId, snoozedUntil })` | `snoozeCustomReminder({ householdId, plantId, snoozedUntil })` | (same prop) |
| `plant-reminder-toggle.tsx` | `togglePlantReminder({ plantId, enabled })` | `togglePlantReminder({ householdId, plantId, enabled })` | `householdId: string` |
| `plant-detail.tsx` | (aggregate — no direct action calls) | Threads `householdId` to SnoozePills, PlantReminderToggle, LogWateringDialog, Timeline | `householdId: string` |

## npm run build Result

Exit code: **0** — build clean.

```
✓ Compiled successfully in 4.2s
✓ Finished TypeScript in 4.7s
✓ Generating static pages (11/11)
```

Route table shows all 11 routes (including redirect stubs) rendering correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] prisma/seed.ts had same userId→householdId breakage as demo/actions.ts**
- **Found during:** Task 2 — `npm run build` failed with `userId does not exist in type RoomCreateInput`
- **Issue:** `prisma/seed.ts` still used `userId: demoUser.id` on Room.create and Plant.create (columns dropped Phase 1). This file was not listed in plan scope but blocked build.
- **Fix:** Applied identical bootstrap fix: `$transaction` creating User + Household + HouseholdMember, then Room/Plant creates with `householdId + createdByUserId`
- **Files modified:** `prisma/seed.ts`
- **Commit:** 02bdb49

**2. [Rule 3 - Blocking] Legacy page files blocked build via cascade errors from component prop changes**
- **Found during:** Task 2 — `npm run build` failed with missing `householdId` props on `AddPlantDialog`, `EditPlantDialog`, `PlantActions`, `CreateRoomDialog`, `RoomCard`, `QuickCreatePresets`, `DashboardClient`
- **Issue:** Old `/dashboard`, `/plants`, `/plants/[id]`, `/rooms`, `/rooms/[id]` pages used query functions and components that now require `householdId`. These pages are Plan 03a scope but blocked the build today.
- **Fix:** Converted all 5 legacy pages to redirect stubs per PATTERNS.md §"Legacy redirect stub" pattern (mirrors `auth/actions.ts` slug resolution). Stubs redirect to `/h/${household.slug}/[path]`.
- **Files modified:** `src/app/(main)/dashboard/page.tsx`, `src/app/(main)/plants/page.tsx`, `src/app/(main)/plants/[id]/page.tsx`, `src/app/(main)/rooms/page.tsx`, `src/app/(main)/rooms/[id]/page.tsx`
- **Commit:** 02bdb49

**3. [Rule 2 - Missing] plant-detail.tsx required householdId threading**
- **Found during:** Task 2 — TypeScript errors on `SnoozePills`, `PlantReminderToggle`, `LogWateringDialog`, `Timeline` props in `plant-detail.tsx` after those components gained required `householdId` prop
- **Fix:** Added `householdId: string` to `PlantDetailProps` and threaded to all 4 child components
- **Files modified:** `src/components/plants/plant-detail.tsx`
- **Commit:** 02bdb49

**4. [Rule 2 - Scope extension] seedStarterPlants gained optional householdId parameter**
- **Found during:** Task 2 — reading `demo/actions.ts` to understand full scope; `seedStarterPlants` still used `userId: session.user.id` on Plant.create
- **Fix:** Added optional `householdId` param, falls back to `session.user.activeHouseholdId`. Replaced `userId` with `householdId + createdByUserId` on Plant.create.
- **Files modified:** `src/features/demo/actions.ts`
- **Commit:** 02bdb49

## Known Stubs

None. All migrated actions are fully wired to household-scoped data.

## Threat Flags

None beyond the plan's threat model. The legacy redirect stubs are pure redirect handlers with no new data surface — they read `session.user.activeHouseholdId` (JWT, already validated) and perform a DB lookup on `household.slug` before redirecting.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 39fe56f | feat(02-05b): migrate watering+notes actions to householdId + wire 7 client components |
| Task 2 | 02bdb49 | feat(02-05b): migrate reminders actions + fix demo bootstrap + wire components + legacy redirect stubs |

## Self-Check: PASSED

Files verified to exist:
- src/features/watering/actions.ts — FOUND
- src/features/watering/schemas.ts — FOUND
- src/features/notes/actions.ts — FOUND
- src/features/notes/schemas.ts — FOUND
- src/features/reminders/actions.ts — FOUND
- src/features/demo/actions.ts — FOUND
- prisma/seed.ts — FOUND
- src/components/watering/log-watering-dialog.tsx — FOUND
- src/components/watering/dashboard-client.tsx — FOUND
- src/components/watering/dashboard-plant-card.tsx — FOUND
- src/components/watering/watering-history.tsx — FOUND
- src/components/watering/watering-history-entry.tsx — FOUND
- src/components/timeline/timeline.tsx — FOUND
- src/components/timeline/timeline-entry.tsx — FOUND
- src/components/timeline/note-input.tsx — FOUND
- src/components/reminders/snooze-pills.tsx — FOUND
- src/components/reminders/plant-reminder-toggle.tsx — FOUND
- src/components/plants/plant-detail.tsx — FOUND
- src/app/(main)/dashboard/page.tsx — FOUND
- src/app/(main)/plants/page.tsx — FOUND
- src/app/(main)/plants/[id]/page.tsx — FOUND
- src/app/(main)/rooms/page.tsx — FOUND
- src/app/(main)/rooms/[id]/page.tsx — FOUND

Commits verified:
- 39fe56f (Task 1) — FOUND
- 02bdb49 (Task 2) — FOUND

Build verified: npm run build exit 0
