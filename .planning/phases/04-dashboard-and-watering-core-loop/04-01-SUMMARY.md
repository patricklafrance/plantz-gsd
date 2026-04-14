---
phase: 04-dashboard-and-watering-core-loop
plan: 01
subsystem: watering
tags: [zod, date-fns, prisma, server-actions, typescript, timezone]

# Dependency graph
requires:
  - phase: 03-plant-collection-and-rooms
    provides: Plant CRUD actions pattern, PlantWithRelations type, feature-based folder structure
provides:
  - Zod schemas for watering log/edit validation (logWateringSchema, editWateringLogSchema)
  - Dashboard query with urgency classification (getDashboardPlants, classifyAndSort)
  - Watering history pagination query (getWateringHistory)
  - Server Actions for watering CRUD (logWatering, editWateringLog, deleteWateringLog)
  - DashboardPlant, UrgencyGroup, PlantWithWateringLogs types
  - TimezoneSync client component for user timezone cookie
  - shadcn dropdown-menu, calendar, popover components
affects: [04-02-dashboard-ui, 04-03-plant-detail-watering-history]

# Tech tracking
tech-stack:
  added: [shadcn dropdown-menu, shadcn calendar, shadcn popover]
  patterns: [urgency classification pure function, timezone cookie sync, 60s duplicate prevention, atomic transaction for cross-entity mutation]

key-files:
  created:
    - src/features/watering/schemas.ts
    - src/features/watering/queries.ts
    - src/features/watering/actions.ts
    - src/components/watering/timezone-sync.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/calendar.tsx
    - src/components/ui/popover.tsx
    - tests/watering.test.ts
  modified:
    - src/types/plants.ts
    - package.json
    - package-lock.json

key-decisions:
  - "classifyAndSort exported as pure function for direct unit testing without DB mocks"
  - "Timezone passed as todayStart/todayEnd Date boundaries (UTC) to queries, derived from client cookie"
  - "recentlyWatered classification: plants watered within 48 hours that are not overdue or dueToday"
  - "vi.mock paths resolved relative to test file location (../auth) not source file location"

patterns-established:
  - "Pure function classification: classifyAndSort takes plants + date boundaries, returns grouped DashboardResult"
  - "Watering Server Action pattern: auth -> Zod safeParse -> ownership check -> duplicate check -> atomic transaction -> revalidatePath"
  - "Cross-entity recalculation: after any watering log change, recalculate plant nextWateringAt from most recent log"
  - "Timezone sync: client component sets cookie, server reads todayStart/todayEnd from cookie-derived timezone"

requirements-completed: [DASH-01, DASH-03, WATR-01, WATR-02, WATR-03, WATR-05, WATR-06, WATR-07]

# Metrics
duration: 7min
completed: 2026-04-14
---

# Phase 4 Plan 01: Watering Data Layer Summary

**Watering Zod schemas, urgency classification engine, and CRUD Server Actions with 60s duplicate prevention, timezone-aware grouping, and atomic cross-entity transactions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-14T21:07:44Z
- **Completed:** 2026-04-14T21:14:31Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Watering validation schemas (logWatering, editWateringLog) with future-date rejection and 280-char note limit
- Pure function classifyAndSort grouping plants into overdue/dueToday/upcoming/recentlyWatered with correct sort order per D-03
- Three Server Actions (log, edit, delete) with auth, ownership checks, Zod validation, atomic transactions, and revalidatePath
- Timezone boundary support via todayStart/todayEnd parameters enabling correct classification across timezones
- 27 passing tests covering schema validation, urgency classification, sort order, timezone boundary, and all Server Action behavioral paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Schemas, types, queries, timezone sync, shadcn installs, and test stubs** - `db4ec6e` (feat)
2. **Task 2: Watering Server Actions (log, edit, delete)** - `27b75ab` (feat)

## Files Created/Modified
- `src/features/watering/schemas.ts` - Zod schemas for logWatering and editWateringLog with validation rules
- `src/features/watering/queries.ts` - getDashboardPlants, getWateringHistory, classifyAndSort pure function
- `src/features/watering/actions.ts` - logWatering, editWateringLog, deleteWateringLog Server Actions
- `src/types/plants.ts` - Extended with DashboardPlant, UrgencyGroup, PlantWithWateringLogs types
- `src/components/watering/timezone-sync.tsx` - Client component setting user_tz cookie via Intl API
- `src/components/ui/dropdown-menu.tsx` - shadcn DropdownMenu for watering history kebab menus
- `src/components/ui/calendar.tsx` - shadcn Calendar for date picker in log watering dialog
- `src/components/ui/popover.tsx` - shadcn Popover for calendar date picker container
- `tests/watering.test.ts` - 27 tests covering schemas, classification, sorting, timezone, and Server Actions
- `package.json` - Updated dependencies from shadcn component installs
- `package-lock.json` - Lock file updated

## Decisions Made
- Exported `classifyAndSort` as a pure function (no DB dependency) to enable direct unit testing with mock data without needing Prisma mocks
- Timezone implementation uses todayStart/todayEnd Date boundaries in UTC, derived from a client-set cookie (user_tz) -- server reads the cookie and computes day boundaries
- "recentlyWatered" classification applies to plants watered within 48 hours that are not overdue or dueToday (upcoming plants that were recently watered)
- vi.mock paths for auth resolved relative to the test file (`../auth`) rather than relative to the source file (`../../../auth`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Prisma client and adapter mocks to test file**
- **Found during:** Task 1 (test execution)
- **Issue:** Tests importing from `@/features/watering/queries` caused Vitest to resolve `@/lib/db` which imports `@/generated/prisma/client` -- Prisma client not generated in worktree
- **Fix:** Added `vi.mock("@/generated/prisma/client")` and `vi.mock("@prisma/adapter-pg")` at top of test file
- **Files modified:** tests/watering.test.ts
- **Verification:** All tests pass
- **Committed in:** db4ec6e (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed auth mock path resolution for Server Action tests**
- **Found during:** Task 2 (test execution)
- **Issue:** `vi.mock("../../../auth")` resolved relative to test file (tests/watering.test.ts) not source file, causing "Failed to resolve import" error
- **Fix:** Changed mock path to `"../auth"` which correctly resolves from tests/ to root auth.ts
- **Files modified:** tests/watering.test.ts
- **Verification:** All 27 tests pass
- **Committed in:** 27b75ab (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to make tests runnable in the worktree environment. No scope creep.

## Issues Encountered
None beyond the auto-fixed blocking issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Watering data layer is complete and tested, ready for Plan 02 (Dashboard UI) to consume
- `getDashboardPlants` returns grouped DashboardResult that dashboard page can render directly
- `logWatering` Server Action ready for one-tap water button
- `getWateringHistory` ready for plant detail watering history list
- `TimezoneSync` component ready to be placed in (main)/layout.tsx
- shadcn dropdown-menu, calendar, popover installed for UI plans

---
*Phase: 04-dashboard-and-watering-core-loop*
*Completed: 2026-04-14*
