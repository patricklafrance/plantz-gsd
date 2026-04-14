---
phase: 04-dashboard-and-watering-core-loop
plan: 02
subsystem: ui
tags: [react, nextjs, useOptimistic, suspense, dashboard, tailwind, date-fns, sonner]

# Dependency graph
requires:
  - phase: 04-dashboard-and-watering-core-loop/01
    provides: "Watering data layer (queries, actions, schemas, types)"
  - phase: 03-plant-collection-and-rooms
    provides: "Plant CRUD, AddPlantDialog, PlantCard, room queries"
provides:
  - "Dashboard urgency-grouped plant display (overdue, due today, upcoming, recently watered)"
  - "One-tap water button with optimistic UI via React 19 useOptimistic"
  - "DashboardClient wrapper managing optimistic state for watering"
  - "DashboardSection reusable component for urgency sections"
  - "DashboardPlantCard with status badges per urgency type"
  - "WaterButton with 44px touch target and loading state"
  - "TimezoneSync cookie in main layout"
  - "Suspense loading skeleton for dashboard"
  - "All caught up empty state"
affects: [04-dashboard-and-watering-core-loop/03, plant-detail-page, watering-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useOptimistic with setTimeout for animated optimistic removal"
    - "Timezone-safe date boundaries via toLocaleDateString with IANA timezone"
    - "Server Component with async DashboardContent inside Suspense"
    - "Urgency badge color coding: destructive/10 overdue, accent/15 due-today, outline upcoming, accent/8 recently-watered"

key-files:
  created:
    - src/components/watering/dashboard-section.tsx
    - src/components/watering/dashboard-plant-card.tsx
    - src/components/watering/water-button.tsx
    - src/components/watering/dashboard-client.tsx
  modified:
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/layout.tsx

key-decisions:
  - "Separated DashboardContent as async Server Component inside Suspense for streaming"
  - "Used 300ms setTimeout before optimistic removal for fade-out animation"
  - "stopPropagation in both WaterButton onClick and card wrapper div to prevent Link navigation"
  - "All caught up state triggers when no overdue/dueToday/upcoming plants remain"

patterns-established:
  - "Optimistic removal pattern: removingIds Set -> CSS fade -> setTimeout -> useOptimistic reducer"
  - "Dashboard section pattern: server-rendered groups passed to client wrapper for interaction"
  - "Badge urgency color system: destructive for overdue, accent for active, outline for future, muted for done"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, UIAX-05]

# Metrics
duration: 3min
completed: 2026-04-14
---

# Phase 4 Plan 02: Dashboard UI Summary

**Urgency-grouped dashboard with one-tap watering via React 19 useOptimistic, responsive card grid, and timezone-aware date boundaries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-14T21:19:01Z
- **Completed:** 2026-04-14T21:22:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Rewrote dashboard page with urgency-grouped sections (Overdue, Due Today, Upcoming, Recently Watered) using getDashboardPlants query
- Built one-tap water button with optimistic UI: card fades out, success toast shows nickname + next date, duplicate detection
- Added Suspense loading skeleton, "No plants yet" and "All caught up!" empty states
- Responsive layout: 1-column mobile, 2-column desktop grid
- TimezoneSync cookie integrated into main layout for timezone-safe date computation

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard page rewrite with urgency sections and Suspense** - `07cfbce` (feat)
2. **Task 2: Optimistic water button with useOptimistic and toast feedback** - `81b7d32` (feat)

## Files Created/Modified
- `src/app/(main)/dashboard/page.tsx` - Rewritten: Server Component with Suspense, timezone-aware getDashboardPlants query, empty states
- `src/app/(main)/layout.tsx` - Added TimezoneSync component for timezone cookie
- `src/components/watering/dashboard-section.tsx` - Urgency section with header, count, and card grid
- `src/components/watering/dashboard-plant-card.tsx` - Plant card with status badges, water button, fade-out animation
- `src/components/watering/water-button.tsx` - Droplet icon button with 44px touch target, loading spinner, aria-label
- `src/components/watering/dashboard-client.tsx` - Client wrapper with useOptimistic for optimistic watering removal and toast feedback

## Decisions Made
- Separated DashboardContent as an async Server Component inside Suspense rather than wrapping the entire page, so the header and AddPlantDialog render immediately
- Used 300ms setTimeout before the useOptimistic reducer fires, giving CSS transition time to animate the card fade-out
- Applied stopPropagation in both the WaterButton onClick handler and a parent div wrapper to robustly prevent Link navigation on water tap
- "All caught up" state shown when user has plants but all urgency groups except recentlyWatered are empty

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard UI is complete and wired to Plan 01's data layer
- Plan 03 (watering history and log management) can now build on the detail page knowing dashboard interaction is functional
- All urgency badge colors and copy text follow UI-SPEC contracts for consistency in Plan 03

## Self-Check: PASSED

All 7 files verified present. Both task commits (07cfbce, 81b7d32) verified in git log.

---
*Phase: 04-dashboard-and-watering-core-loop*
*Completed: 2026-04-14*
