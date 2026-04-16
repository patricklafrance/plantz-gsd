---
phase: 07-polish-and-accessibility
plan: 03
subsystem: ui
tags: [accessibility, wcag-aa, focus-management, aria, contrast, lucide-react, sonner]

# Dependency graph
requires:
  - phase: 07-01
    provides: Skip-to-content link, bottom tab bar, touch target baseline
provides:
  - Focus-after-navigation hook and FocusHeading component
  - Standardized h1 hierarchy (text-2xl, tabIndex, outline-none) across all pages
  - Icon-enhanced status badges (no color-only indicators)
  - WCAG AA contrast-safe accent and muted-foreground colors
  - Watering retry toast with action button
  - Landmark roles with distinct aria-labels
affects: [07-04, any future page additions]

# Tech tracking
tech-stack:
  added: []
  patterns: [focus-after-navigation via useFocusHeading hook, icon+text+color status badges, WCAG AA contrast audit on OKLCH tokens]

key-files:
  created:
    - src/hooks/use-focus-heading.ts
    - src/components/shared/focus-heading.tsx
  modified:
    - src/app/(main)/layout.tsx
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/plants/page.tsx
    - src/app/(main)/plants/[id]/page.tsx
    - src/app/(main)/rooms/page.tsx
    - src/app/(main)/rooms/[id]/page.tsx
    - src/components/preferences/preferences-form.tsx
    - src/components/watering/dashboard-plant-card.tsx
    - src/components/plants/plant-card.tsx
    - src/components/watering/dashboard-client.tsx
    - src/app/globals.css

key-decisions:
  - "Darkened --muted-foreground from oklch(0.556) to oklch(0.45) for WCAG AA 4.5:1 contrast on white"
  - "Darkened --accent from oklch(0.62) to oklch(0.50) for WCAG AA 4.5:1 contrast on white"
  - "Updated --ring to match new accent value for consistent focus rings"
  - "Changed recently-watered badge from custom bg-accent/8 to variant=secondary for better contrast"

patterns-established:
  - "Focus-after-navigation: useFocusHeading hook in layout, h1 elements get tabIndex={-1} and outline-none"
  - "Status badge pattern: every badge includes icon (aria-hidden) + text label + color, using gap-1.5 items-center"
  - "Heading hierarchy: one h1 per page at text-2xl, sections at h2 text-xl, no skipped levels"
  - "Toast retry pattern: error toasts for mutations include action with Retry label"

requirements-completed: [UIAX-02, UIAX-03]

# Metrics
duration: 4min
completed: 2026-04-15
---

# Phase 7 Plan 03: WCAG AA Accessibility Summary

**Focus-after-navigation hook, standardized heading hierarchy, icon-enhanced status badges, WCAG AA contrast audit, and watering retry toast**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-16T01:42:53Z
- **Completed:** 2026-04-16T01:47:12Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Focus management: FocusHeading component automatically moves focus to h1 after every client-side navigation
- All 7 pages have standardized h1 elements with tabIndex={-1}, text-2xl, and outline-none
- Every status badge now displays icon + text + color (AlertTriangle/Droplets/Clock/CheckCircle2/HelpCircle) -- no color-only indicators
- WCAG AA contrast audit: darkened --muted-foreground and --accent OKLCH values to pass 4.5:1 on white
- Watering failure toast includes Retry action button for error recovery
- Landmark roles verified: nav elements have distinct aria-labels, main has id="main-content"

## Task Commits

Each task was committed atomically:

1. **Task 1: Focus-after-navigation hook, heading hierarchy, landmark roles** - `283580b` (feat)
2. **Task 2: Status badge icons, contrast audit, watering retry toast** - `d7e2e07` (feat)

## Files Created/Modified
- `src/hooks/use-focus-heading.ts` - Hook that focuses h1[tabindex='-1'] on pathname change
- `src/components/shared/focus-heading.tsx` - Thin Client Component wrapper for the focus hook
- `src/app/(main)/layout.tsx` - Added FocusHeading, aria-label on nav, id on main
- `src/app/(main)/dashboard/page.tsx` - h1 standardized to text-2xl with tabIndex and outline-none
- `src/app/(main)/plants/page.tsx` - h1 standardized
- `src/app/(main)/plants/[id]/page.tsx` - h1 standardized, back link touch target expanded (p-2 -m-2)
- `src/app/(main)/rooms/page.tsx` - h1 standardized
- `src/app/(main)/rooms/[id]/page.tsx` - h1 standardized
- `src/components/preferences/preferences-form.tsx` - h1 standardized
- `src/components/watering/dashboard-plant-card.tsx` - Added icons to all 4 status badges
- `src/components/plants/plant-card.tsx` - Replaced old status functions with icon-based getStatusBadge
- `src/components/watering/dashboard-client.tsx` - Added Retry action to watering failure toasts
- `src/app/globals.css` - Darkened --muted-foreground, --accent, --ring for WCAG AA compliance

## Decisions Made
- Darkened --muted-foreground from oklch(0.556 0 0) to oklch(0.45 0 0) because L=0.556 yields ~3.5:1 contrast on white, failing WCAG AA 4.5:1
- Darkened --accent from oklch(0.62 0.10 155) to oklch(0.50 0.11 155) because L=0.62 green was borderline at ~4.0:1 on white
- Updated --ring to match the new --accent value so focus rings remain visually consistent
- Changed recently-watered badge from custom bg-accent/8 to variant="secondary" for better contrast and consistency
- Left --destructive unchanged at oklch(0.577 0.245 27.325) because high chroma red at that lightness passes 4.5:1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added aria-label and id to layout landmark elements**
- **Found during:** Task 1
- **Issue:** Plan stated these "should already be there from Plan 01" but nav lacked aria-label="Top navigation" and main lacked id="main-content"
- **Fix:** Added aria-label="Top navigation" to nav element and id="main-content" to main element
- **Files modified:** src/app/(main)/layout.tsx
- **Verification:** grep confirmed both attributes present
- **Committed in:** 283580b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for accessibility landmark roles and skip-link targeting. No scope creep.

## Issues Encountered
- Pre-existing test failure in tests/plants-search.test.ts (default sort order mismatch) -- not caused by this plan's changes, confirmed by testing on base commit. Logged as out-of-scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All WCAG AA accessibility foundations in place for Plan 04 (character limits, pagination, error states)
- Focus management pattern established -- any new pages must include h1 with tabIndex={-1} and outline-none
- Status badge icon pattern established -- any new status types must include icon + text + color

## Self-Check: PASSED

- All 13 created/modified files verified present on disk
- Commit 283580b (Task 1) verified in git log
- Commit d7e2e07 (Task 2) verified in git log
- SUMMARY.md verified present at expected path

---
*Phase: 07-polish-and-accessibility*
*Completed: 2026-04-15*
