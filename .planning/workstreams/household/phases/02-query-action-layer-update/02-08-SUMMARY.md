---
phase: 02-query-action-layer-update
plan: 08
subsystem: routing
tags: [ux, routing, household-slug, uat-4]
requires: [02-03a, 02-03c]
provides:
  - PlantCard accepts householdSlug; emits /h/{slug}/plants/{id}
  - DashboardPlantCard accepts householdSlug; emits /h/{slug}/plants/{id}
  - RoomCard accepts householdSlug; emits /h/{slug}/rooms/{id}
affects:
  - src/components/plants/plant-card.tsx
  - src/components/plants/plant-grid.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/rooms/room-card.tsx
  - src/app/(main)/h/[householdSlug]/plants/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
tech-stack:
  patterns:
    - "Pass household slug down as a prop from the route segment (via await params) instead of reading it at runtime"
key-files:
  created: []
  modified:
    - src/components/plants/plant-card.tsx
    - src/components/plants/plant-grid.tsx
    - src/components/watering/dashboard-plant-card.tsx
    - src/components/watering/dashboard-client.tsx
    - src/components/rooms/room-card.tsx
    - src/app/(main)/h/[householdSlug]/plants/page.tsx
    - src/app/(main)/h/[householdSlug]/rooms/page.tsx
    - src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx
    - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
key-decisions:
  - "Scope expansion approved: RoomCard fix folded into 02-08 as deviation (Rule 4) rather than a follow-up plan, because it was the same bug class as UAT-4 and trivial to apply the same pattern."
requirements-completed: [HSLD-02, HSLD-03]
duration: 20 min
completed: 2026-04-17
---

# Phase 02 Plan 08: PlantCard and RoomCard Household-Scoped Navigation Summary

UAT-4 fix — card components emitted legacy `/plants/{id}` and `/rooms/{id}` hrefs, relying on redirect stubs. Threaded `householdSlug` from the Server Component params down to PlantCard, DashboardPlantCard, and (via approved scope expansion) RoomCard, so every in-app card click navigates directly to `/h/{slug}/...` with no intermediate redirect flash.

**Duration:** 20 min | **Tasks:** 3 | **Files:** 9 modified (0 created)

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `8b91862` | Task 1 — PlantCard/PlantGrid thread householdSlug | plant-card, plant-grid, plants/page, rooms/[id]/page |
| `d8cc2c8` | Task 2 — DashboardPlantCard/DashboardClient thread householdSlug | dashboard-plant-card, dashboard-client, dashboard/page |
| `a2b403b` | Deviation — RoomCard thread householdSlug | room-card, rooms/page |

## Verification Performed

Automated (grep + tsc):
- `npx tsc --noEmit` stayed at 43-error baseline (no new errors in touched files)
- Zero `/plants/${plant.id}` (legacy) matches in plant-card.tsx and dashboard-plant-card.tsx
- Zero `/rooms/${room.id}` (legacy) matches in room-card.tsx
- `householdSlug` present in all 5 component files (prop signature + href + instantiation)

Browser (Chrome DevTools MCP, demo mode):
- `/h/bZQaXEE2/dashboard` — 8 DashboardPlantCard links all `/h/bZQaXEE2/plants/{id}`; click on "Fiddle" → direct RSC fetch for `/h/bZQaXEE2/plants/{id}` (no intermediate `/plants/{id}` hop)
- `/h/bZQaXEE2/plants` — 8 PlantCard links all use new URL
- `/h/bZQaXEE2/rooms/{id}` — 4 PlantCards in room use new URL
- `/h/bZQaXEE2/rooms` — 2 RoomCards now use `/h/bZQaXEE2/rooms/{id}` (post-deviation)
- Regression: typing legacy `/plants/{id}` still redirects to `/h/{slug}/plants/{id}` — bookmark bridge preserved
- Zero console errors

## Deviations from Plan

**[Rule 4 - Scope Expansion] Folded RoomCard fix into 02-08** — Found during: Task 3 (human-verify checkpoint).
- Issue: browser verification surfaced that `src/components/rooms/room-card.tsx` emits legacy `/rooms/{id}` hrefs on `/h/{slug}/rooms`. Same bug class as UAT-4 but RoomCard wasn't in the plan's `files_modified`.
- User decision: rather than spin a separate follow-up plan, apply the same `householdSlug`-threading pattern inline within 02-08.
- Fix: RoomCard accepts `householdSlug` prop; `rooms/page.tsx` passes `householdSlug` from `await params` alongside `householdId`.
- Files modified: `src/components/rooms/room-card.tsx`, `src/app/(main)/h/[householdSlug]/rooms/page.tsx`.
- Verification: both room cards now emit `/h/bZQaXEE2/rooms/{id}` in the browser snapshot; tsc still clean.
- Commit: `a2b403b`.

**Total deviations:** 1 scope-expansion (Rule 4, user-approved). **Impact:** broadened plan by 1 component + 1 page; no functional regression, no additional complexity. UAT-4's "no legacy Link hrefs in cards" intent is fully satisfied rather than partially.

## Issues Encountered

None related to plan execution. User reported an unrelated dev-server 404 that turned out to be a stale `.next` cache / zombie dev server on their machine — unrelated to the code change. During the verification session the user also re-surfaced a clean-cookie first-login "This page couldn't load" error, which is already scoped by plan 02-10 (first must-have) and not in 02-08's responsibility.

## Next Phase Readiness

Ready for 02-09 (/h/{bogus-slug} blank-page not-found boundary fix). All card-navigation hrefs now target `/h/{slug}/...` directly — no dependency on legacy redirect stubs for normal in-app navigation.
