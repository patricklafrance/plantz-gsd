---
phase: 03-plant-collection-and-rooms
plan: "02"
subsystem: api
tags: [prisma, nextauth, zod, date-fns, server-actions, plants, rooms]

# Dependency graph
requires:
  - phase: 03-00
    provides: Zod schemas for plants and rooms, shared types
  - phase: 02-authentication-and-onboarding
    provides: auth() session check pattern from src/features/auth/actions.ts
provides:
  - Plant Server Actions: createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant
  - Plant query functions: getPlants, getPlant, getCatalog
  - Room Server Actions: createRoom, updateRoom, deleteRoom
  - Room query functions: getRooms, getRoom, getRoomsForSelect
affects: [03-03, 03-04, 03-05, dashboard, plants-ui, rooms-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action pattern: use server + auth() session check + Zod safeParse + explicit field assignment + revalidatePath"
    - "IDOR prevention: findFirst with userId in every mutation where clause"
    - "Query pattern: plain async functions (not Server Actions) for Server Component read operations"
    - "Archive pattern: soft-delete via archivedAt timestamp; archivedAt:null excludes from active queries"
    - "Watering interval change: recalculate nextWateringAt from lastWateredAt when wateringInterval changes"
    - "Room delete: returns hadPlants boolean for contextual UI feedback"

key-files:
  created:
    - src/features/plants/actions.ts
    - src/features/plants/queries.ts
    - src/features/rooms/actions.ts
    - src/features/rooms/queries.ts
  modified: []

key-decisions:
  - "Query functions are plain async functions, not Server Actions — called directly from Server Components"
  - "getPlants excludes archived plants by default (archivedAt:null) with optional roomId filter parameter"
  - "deleteRoom returns hadPlants boolean so UI can show 'N plants were unassigned' feedback"
  - "nextWateringAt only recalculated on updatePlant when wateringInterval actually changes"
  - "getCatalog has no userId filter — CareProfile data is intentionally shared across all users"

patterns-established:
  - "Server Action: 'use server' + auth() check + Zod safeParse + ownership verify + Prisma mutation + revalidatePath"
  - "IDOR guard: always use findFirst({where: {id, userId}}) not findUnique({where: {id}}) alone"
  - "Never spread raw input into Prisma data — explicit field-by-field assignment only"
  - "Revalidate both /plants AND /dashboard on every plant/room mutation"

requirements-completed: [PLNT-01, PLNT-02, PLNT-03, PLNT-04, PLNT-08, ROOM-01, ROOM-03]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 03 Plan 02: Plant and Room Data Layer Summary

**Complete CRUD Server Actions and query functions for plants and rooms with IDOR prevention, Zod validation, and watering interval arithmetic**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T15:35:03Z
- **Completed:** 2026-04-14T15:37:14Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments

- 5 plant Server Actions with auth checks, Zod validation, and userId ownership enforcement on every mutation
- 3 plant query functions: getPlants (archivedAt filter + roomId filter), getPlant (compound userId+id ownership), getCatalog (shared)
- 3 room Server Actions with auth, Zod, ownership checks; deleteRoom returns hadPlants for UI feedback
- 3 room query functions: getRooms (with _count.plants), getRoom (with active plants), getRoomsForSelect (id+name only for dropdowns)
- All threat model mitigations applied: IDOR prevention via findFirst+userId, no raw input spread, /plants and /dashboard revalidated on every mutation

## Task Commits

Each task was committed atomically:

1. **Task 1: Plant Server Actions and query functions** - `aaf87a1` (feat)
2. **Task 2: Room Server Actions and query functions** - `cd09363` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/features/plants/actions.ts` - 5 Server Actions: createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant
- `src/features/plants/queries.ts` - 3 query functions: getPlants, getPlant, getCatalog
- `src/features/rooms/actions.ts` - 3 Server Actions: createRoom, updateRoom, deleteRoom
- `src/features/rooms/queries.ts` - 3 query functions: getRooms, getRoom, getRoomsForSelect

## Decisions Made

- Query functions are plain `async` functions, not Server Actions — they are called directly from Server Components using the userId from the session, not from client actions
- `getPlants` accepts optional `roomId` parameter to support room-filtered plant lists without a separate query function
- `deleteRoom` returns `hadPlants: boolean` so the UI can show contextual feedback ("N plants were unassigned")
- `nextWateringAt` is only recalculated in `updatePlant` when `wateringInterval` actually changes, preserving the existing countdown otherwise
- `getCatalog` intentionally has no userId filter — CareProfile is shared catalog data with no PII (threat T-03-02-05 accepted)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete data layer is available for Phase 3 UI components (plans 03-03, 03-04, 03-05)
- Plant and room forms can import actions directly; Server Components can call query functions with session userId
- Established patterns (IDOR guard, Server Action shape, archive filter) should be maintained in all future plant/room code

---
*Phase: 03-plant-collection-and-rooms*
*Completed: 2026-04-14*
