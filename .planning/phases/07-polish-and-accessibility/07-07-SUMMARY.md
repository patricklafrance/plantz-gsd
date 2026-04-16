---
phase: 07-polish-and-accessibility
plan: 07
subsystem: ui
tags: [gap-closure, auth, forms, optimistic-ui, onboarding, seed-data]

# Dependency graph
requires:
  - phase: 07-06
    provides: UAT gap closure for drawer, focus, timezone
provides:
  - Vertically centered show/hide password buttons on login and register forms
  - Flicker-free optimistic watering update for recently watered plants
  - Range-aware starter plant seeding matching onboarding plantCountRange selection
  - Break-all overflow protection on plant nicknames in both card types
affects:
  - src/components/auth/login-form.tsx
  - src/components/auth/register-form.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/components/plants/plant-card.tsx
  - src/features/demo/actions.ts
  - src/components/onboarding/onboarding-banner.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "top-1/2 -translate-y-1/2 for vertically centering absolute-positioned icon buttons inside inputs"
    - "truncate break-all for long plant names that lack natural word breaks"
    - "movePlantToRecentlyWatered optimistic reducer: keeps plant in recentlyWatered if already there, moves from active groups otherwise"
    - "TARGET_COUNTS Record lookup with fallback for safe plantCountRange param handling"

key-files:
  created: []
  modified:
    - src/components/auth/login-form.tsx
    - src/components/auth/register-form.tsx
    - src/components/watering/dashboard-client.tsx
    - src/components/watering/dashboard-plant-card.tsx
    - src/components/plants/plant-card.tsx
    - src/features/demo/actions.ts
    - src/components/onboarding/onboarding-banner.tsx

key-decisions:
  - "movePlantToRecentlyWatered checks alreadyInRecent before prepending — plants already in recentlyWatered stay in place, preventing flicker on repeated watering"
  - "TARGET_COUNTS lookup with ?? 5 fallback ensures invalid plantCountRange strings default safely to 5 plants"
  - "Additional profiles fetched by notIn existing names + orderBy name asc for deterministic ordering"

requirements-completed: [UIAX-01, UIAX-02, UIAX-03, UIAX-04]

# Metrics
duration: 2min
completed: 2026-04-16
---

# Phase 07 Plan 07: UAT Gap Closure (Round 2) Summary

**4 UAT gaps resolved: password button vertical centering, flicker-free optimistic watering, range-aware seed count, and long plant name overflow**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-16T04:17:34Z
- **Completed:** 2026-04-16T04:19:46Z
- **Tasks:** 3
- **Files created:** 0
- **Files modified:** 7

## Accomplishments

- Fixed show/hide password toggle buttons on login and register forms — now vertically centered within the input using `top-1/2 -translate-y-1/2` (3 buttons across 2 files)
- Replaced `removePlantFromGroups` optimistic reducer with `movePlantToRecentlyWatered` — plants already in recentlyWatered stay in place instead of flickering out and back in; plants from other groups move optimistically to recentlyWatered
- Updated `seedStarterPlants()` to accept optional `plantCountRange` parameter mapped to target counts (5/10/20/35); fetches additional CareProfile entries from catalog when target exceeds the 5-plant STARTER_PLANTS baseline
- Updated `OnboardingBanner` to pass selected range to `seedStarterPlants(range)`
- Added `break-all` to plant nickname paragraphs in both DashboardPlantCard and PlantCard to prevent long unbroken strings from overflowing their containers

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix password toggle centering and long plant name overflow** — `bb23006` (fix)
2. **Task 2: Fix dashboard watering flicker on recently watered plants** — `1a66860` (fix)
3. **Task 3: Fix seed starter plants to respect plantCountRange selection** — `fa7001c` (fix)

## Files Modified

- `src/components/auth/login-form.tsx` — Changed `top-0` to `top-1/2 -translate-y-1/2` on show password Button
- `src/components/auth/register-form.tsx` — Changed `top-0` to `top-1/2 -translate-y-1/2` on both show password Buttons
- `src/components/watering/dashboard-client.tsx` — Replaced `removePlantFromGroups` with `movePlantToRecentlyWatered`; updated `useOptimistic` and `handleWater`
- `src/components/watering/dashboard-plant-card.tsx` — Added `break-all` to plant nickname paragraph
- `src/components/plants/plant-card.tsx` — Added `break-all` to plant nickname paragraph
- `src/features/demo/actions.ts` — Added `plantCountRange` param, `TARGET_COUNTS` mapping, additional profile fetching logic
- `src/components/onboarding/onboarding-banner.tsx` — Passes `range` to `seedStarterPlants(range)`

## Decisions Made

- `movePlantToRecentlyWatered` checks whether the plant is already in `recentlyWatered` before prepending — this is the key insight that eliminates flicker: the optimistic state matches what the server will return, so React sees no difference after revalidation
- `TARGET_COUNTS` uses a fallback of `?? 5` so that any invalid or missing range string defaults safely to 5 plants without throwing
- Additional profiles are fetched with `notIn: existingNames` and `orderBy: { name: "asc" }` for deterministic ordering independent of DB insertion order

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are wired to real data sources.

## Threat Flags

No new security surface introduced. The `plantCountRange` parameter in `seedStarterPlants` is consumed only as a `Record<string, number>` key lookup with a safe numeric fallback — no injection risk. Auth check and demo guard remain in place (inherited from pre-existing function).

## Self-Check: PASSED

- `src/components/auth/login-form.tsx` — FOUND: `top-1/2 -translate-y-1/2` (1 match)
- `src/components/auth/register-form.tsx` — FOUND: `top-1/2 -translate-y-1/2` (2 matches)
- `src/components/watering/dashboard-client.tsx` — FOUND: `movePlantToRecentlyWatered` (2 matches), `removeFromGroups`/`removePlantFromGroups` (0 matches)
- `src/components/watering/dashboard-plant-card.tsx` — FOUND: `truncate break-all`
- `src/components/plants/plant-card.tsx` — FOUND: `truncate break-all`
- `src/features/demo/actions.ts` — FOUND: `plantCountRange`, `TARGET_COUNTS`, `additionalProfiles`
- `src/components/onboarding/onboarding-banner.tsx` — FOUND: `seedStarterPlants(range)`
- `bb23006` — EXISTS in git log
- `1a66860` — EXISTS in git log
- `fa7001c` — EXISTS in git log
- All 77 tests pass (0 failures)

---
*Phase: 07-polish-and-accessibility*
*Completed: 2026-04-16*
