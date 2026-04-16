---
phase: 04-dashboard-and-watering-core-loop
plan: "01"
subsystem: testing
tags: [vitest, watering, prisma, server-actions, zod, date-fns, classification]

# Dependency graph
requires:
  - phase: 03-plant-management
    provides: Plant/Room/WateringLog data model and Prisma schema

provides:
  - Verified data layer for all watering requirements (DASH-01, WATR-01..07)
  - 29-test suite covering schema validation, urgency classification, Server Actions, and edge cases

affects:
  - 04-02 (dashboard UI integration — depends on verified data layer contracts)
  - 04-03 (end-to-end dashboard flow — depends on same)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "classifyAndSort is a pure function — no DB access, fully testable with mock data"
    - "Retroactive log handling: create log first, then re-query most-recent via orderBy wateredAt desc"
    - "Duplicate detection uses setUTCHours(0,0,0,0) for UTC day boundary — no timezone dependency"
    - "recentlyWatered override applies only when urgency would be 'upcoming' AND lastWateredAt >= 48h ago"

key-files:
  created: []
  modified:
    - tests/watering.test.ts

key-decisions:
  - "No code gaps found — all WATR/DASH requirements verified present in existing implementation"
  - "TDD gap-closure: tests pass immediately because implementation pre-exists; RED phase not applicable for verification plan"

patterns-established:
  - "Audit task pattern: read all layer files, check each requirement AC, document per-requirement checklist"
  - "Gap-closure tests target edge cases not covered by happy-path tests: retroactive ordering and 48h override boundary"

requirements-completed:
  - DASH-01
  - WATR-01
  - WATR-02
  - WATR-03
  - WATR-05
  - WATR-06
  - WATR-07

# Metrics
duration: 8min
completed: "2026-04-16"
---

# Phase 04 Plan 01: Watering Data Layer Audit and Gap-Closure Tests Summary

**Verified all DASH-01 and WATR-01..07 data layer requirements in existing code; added 2 edge-case tests growing suite from 27 to 29 passing tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-16T15:55:00Z
- **Completed:** 2026-04-16T16:03:38Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Audited `schemas.ts`, `actions.ts`, `queries.ts`, `types/plants.ts`, and `prisma/schema.prisma` against all 7 requirements — no gaps found
- Added WATR-03 edge-case test: retroactive log (3 days ago) does not displace a newer log (yesterday) in `nextWateringAt` calculation
- Added DASH-01 edge-case test: plant with `nextWateringAt` 5 days out but `lastWateredAt` within 48h is classified as `recentlyWatered`, not `upcoming`
- All 29 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit data layer against requirement acceptance criteria** - `1951286` (chore)
2. **Task 2: Add gap-closure tests for retroactive log and recentlyWatered** - `9b726c4` (test)

## Files Created/Modified

- `tests/watering.test.ts` — Added 2 gap-closure tests (51 lines inserted); no existing tests modified

## Decisions Made

None — followed plan as specified. All requirements verified present; no code changes needed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Requirement Audit Checklist

| Requirement | Component | Verified |
|-------------|-----------|---------|
| DASH-01 | `classifyAndSort` 4-group classification with `recentlyWatered` 48h override at lines 75-83 | Yes |
| WATR-01 | `DashboardPlant.urgency: UrgencyGroup`, `DashboardPlant.daysUntil: number`; `Plant.nextWateringAt @db.Timestamptz(3)` | Yes |
| WATR-02 | All 3 actions recalculate via `addDays(mostRecent.wateredAt, plant.wateringInterval)` | Yes |
| WATR-03 | `logWatering` creates log then re-queries `orderBy: { wateredAt: "desc" }` for `mostRecent` | Yes |
| WATR-05 | `editWateringLog` and `deleteWateringLog` use `plant: { userId: session.user.id }` ownership check | Yes |
| WATR-06 | Duplicate check uses `setUTCHours(0,0,0,0)`, returns `{ error: "DUPLICATE" }` | Yes |
| WATR-07 | `WateringLog.wateredAt @db.Timestamptz(3)`; `Plant.nextWateringAt @db.Timestamptz(3)`; `getDashboardPlants` takes `todayStart`/`todayEnd` | Yes |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan added tests only.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Data layer contracts verified and test-covered — ready for dashboard UI integration (Plan 02)
- `classifyAndSort` returns `DashboardResult` with `overdue`, `dueToday`, `upcoming`, `recentlyWatered` arrays of `DashboardPlant` — UI can consume directly
- No blockers

---
*Phase: 04-dashboard-and-watering-core-loop*
*Completed: 2026-04-16*
