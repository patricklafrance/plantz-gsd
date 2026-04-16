---
phase: 03-plant-collection-and-rooms
plan: "00"
subsystem: ui
tags: [shadcn, zod, typescript, base-ui, vitest, plants, rooms]

# Dependency graph
requires:
  - phase: 02-authentication-and-onboarding
    provides: Established Zod v4 schema pattern (src/features/auth/schemas.ts), shadcn base-nova component style with @base-ui/react primitives

provides:
  - shadcn Dialog component (src/components/ui/dialog.tsx) backed by @base-ui/react
  - shadcn AlertDialog component (src/components/ui/alert-dialog.tsx) for delete confirmations
  - shadcn Select component (src/components/ui/select.tsx) for room dropdowns
  - Zod v4 schemas for plant CRUD validation (createPlantSchema, editPlantSchema) with UI-SPEC-matched error messages
  - Zod v4 schemas for room CRUD validation (createRoomSchema, editRoomSchema)
  - Shared TypeScript types for plant/room data shapes (PlantWithRelations, RoomWithPlants, RoomWithPlantCount, CareProfileEntry)
  - Test stubs for all plant Server Action behaviors (PLNT-01 through PLNT-08)
  - Test stubs for all room Server Action behaviors (ROOM-01 through ROOM-05)
  - Nyquist Wave 0 compliance: 8 schema validation tests passing

affects:
  - 03-01 (plant collection page — uses schemas, types, dialog/alert-dialog/select components)
  - 03-02 (Server Actions — imports createPlantSchema and createRoomSchema for validation)
  - All Phase 3 plans (depend on shared types from src/types/plants.ts)

# Tech tracking
tech-stack:
  added:
    - shadcn Dialog (base-nova style, @base-ui/react/dialog primitive)
    - shadcn AlertDialog (@base-ui/react/alert-dialog primitive)
    - shadcn Select (@base-ui/react/select primitive)
  patterns:
    - Zod v4 schemas use `import { z } from "zod/v4"` import path
    - Shared TypeScript types import from `@/generated/prisma` (not @prisma/client)
    - shadcn components use `render` prop pattern (not `asChild`) per base-nova style
    - Feature schemas live in `src/features/{feature}/schemas.ts` alongside actions

key-files:
  created:
    - src/components/ui/dialog.tsx
    - src/components/ui/alert-dialog.tsx
    - src/components/ui/select.tsx
    - src/features/plants/schemas.ts
    - src/features/rooms/schemas.ts
    - src/types/plants.ts
    - tests/plants.test.ts
    - tests/rooms.test.ts
  modified: []

key-decisions:
  - "Shared types import from @/generated/prisma (project convention from Phase 1: Prisma output in src/generated/)"
  - "Error messages in schemas match UI-SPEC copywriting contract exactly (Nickname is required., Watering interval must be between 1 and 365 days.)"
  - "RoomWithPlantCount type added alongside RoomWithPlants to support count queries without full plant hydration"

patterns-established:
  - "Zod v4 schema pattern: import from zod/v4, export schema + inferred type from same file"
  - "shadcn base-nova: components use render prop instead of asChild (established in Phase 1 with button.tsx)"
  - "Shared domain types: src/types/{domain}.ts for cross-feature type shapes with Prisma relations"

requirements-completed: [PLNT-01, PLNT-02, PLNT-06, ROOM-01]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 03 Plan 00: Foundations (shadcn components, Zod schemas, shared types) Summary

**Zod v4 validation schemas and TypeScript types for plant/room CRUD, plus Dialog/AlertDialog/Select shadcn components and Nyquist-compliant test stubs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-14T16:10:26Z
- **Completed:** 2026-04-14T16:12:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Installed Dialog, AlertDialog, and Select shadcn components using base-nova style backed by @base-ui/react primitives
- Created Zod v4 schemas for plant CRUD (createPlantSchema, editPlantSchema) and room CRUD (createRoomSchema, editRoomSchema) with UI-SPEC-matched error messages
- Created shared TypeScript types (PlantWithRelations, RoomWithPlants, RoomWithPlantCount, CareProfileEntry) importing from @/generated/prisma
- Created test stubs satisfying Nyquist Wave 0 compliance: 8 schema validation tests passing, 27 todo stubs for Phase 3 Server Actions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components and create Zod schemas + shared types** - `221db40` (feat)
2. **Task 2: Create test stubs for plant and room Server Actions** - `d7f1561` (test)

## Files Created/Modified

- `src/components/ui/dialog.tsx` - shadcn Dialog component (base-nova, @base-ui/react/dialog)
- `src/components/ui/alert-dialog.tsx` - shadcn AlertDialog for delete confirmations (@base-ui/react/alert-dialog)
- `src/components/ui/select.tsx` - shadcn Select for room dropdown (@base-ui/react/select)
- `src/features/plants/schemas.ts` - Zod v4 schemas: createPlantSchema, editPlantSchema + inferred types
- `src/features/rooms/schemas.ts` - Zod v4 schemas: createRoomSchema, editRoomSchema + inferred types
- `src/types/plants.ts` - Shared types: PlantWithRelations, RoomWithPlants, RoomWithPlantCount, CareProfileEntry
- `tests/plants.test.ts` - 4 passing schema tests + 17 todo stubs for plant Server Actions
- `tests/rooms.test.ts` - 4 passing schema tests + 10 todo stubs for room Server Actions

## Decisions Made

- Shared types import from `@/generated/prisma` per the project convention established in Phase 1 (Prisma output dir is `src/generated/prisma/`, not the default `node_modules/@prisma/client`)
- Error messages in schemas match the UI-SPEC copywriting contract exactly: "Nickname is required." and "Watering interval must be between 1 and 365 days."
- Added `RoomWithPlantCount` type (not in original plan spec) to support queries that need count without full plant hydration — a common pattern for room list views

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added RoomWithPlantCount type**
- **Found during:** Task 1 (shared types creation)
- **Issue:** Plan specified RoomWithPlants but room list views commonly need plant counts without loading full plant objects; omitting this would cause N+1 or over-fetching in Plan 01
- **Fix:** Added `RoomWithPlantCount = Room & { _count: { plants: number } }` type alongside RoomWithPlants
- **Files modified:** src/types/plants.ts
- **Verification:** TypeScript type exports correctly, downstream plans can use either shape
- **Committed in:** 221db40 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor additive type, no scope creep. Enables efficient room list queries without extra migration.

## Issues Encountered

None - shadcn CLI installed all three components cleanly. Zod v4 schema pattern established in Phase 2 applied without issue.

## Known Stubs

None - this plan creates foundational types and schemas, not UI rendering components. The shadcn components are fully generated (no placeholder content). Test stubs are intentional Wave 0 scaffolding, not data stubs.

## Threat Flags

None - this plan creates schemas, types, and test stubs only. No runtime code processes user input. Zod schema constraints address T-03-00-01 and T-03-00-02 from the threat register.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 3 plans can now import from `@/features/plants/schemas`, `@/features/rooms/schemas`, and `@/types/plants`
- shadcn Dialog/AlertDialog/Select available for plant add/edit/delete modals
- Wave 0 Nyquist compliance satisfied: test stubs exist for all Server Action behaviors
- Plan 01 (plant collection page) and Plan 02 (Server Actions) are unblocked

---
*Phase: 03-plant-collection-and-rooms*
*Completed: 2026-04-14*

## Self-Check: PASSED

- All 9 files exist (3 shadcn components, 2 Zod schemas, 1 types file, 2 test files, 1 SUMMARY)
- Both commits found: 221db40 (feat), d7f1561 (test)
- Test suite: 8 passed, 27 todo, 0 failed
