---
phase: 02-query-action-layer-update
plan: 09
subsystem: routing
tags: [ux, routing, not-found, error-handling, uat-9]
requires: [02-03a]
provides:
  - Parent (main)/not-found.tsx boundary catches layout-level notFound() throws from the household segment
affects:
  - src/app/(main)/not-found.tsx
tech-stack:
  patterns:
    - "App Router not-found hierarchy: same-segment layout.tsx notFound() throws require a PARENT-segment not-found.tsx to catch them (same-segment not-found.tsx cannot catch its own layout's throw)"
key-files:
  created:
    - src/app/(main)/not-found.tsx
  modified: []
key-decisions:
  - "Root cause classified as Cause A1 after live reproduction: notFound() thrown from household layout escalates past the same-segment not-found.tsx because the layout has not yet committed to rendering its children. The 'closest not-found' resolution walks up to (main)/, finds no boundary, falls through to Next.js built-in default 404."
  - "Fix adds the parent boundary rather than restructuring the throw site. The notFound() call in src/features/household/context.ts line 22 is correct; the problem was missing infrastructure above it."
requirements-completed: [HSLD-02, HSLD-03]
duration: 15 min
completed: 2026-04-17
---

# Phase 02 Plan 09: Parent Not-Found Boundary for Bogus Household Slugs Summary

UAT-9 fix — visiting `/h/{bogus-slug}/dashboard` returned HTTP 404 but rendered Next.js's built-in default 404 page (not the app's custom "Household not found" UI). Cause was a missing `not-found.tsx` boundary at `src/app/(main)/`. Added the file mirroring the existing household-scoped not-found so bogus slugs now render the in-app not-found screen.

**Duration:** 15 min | **Tasks:** 3 | **Files:** 1 created, 0 modified

## Before / After

**Before** (bogus slug):
- HTTP 200? NO — HTTP 404 (correct status).
- Response body (first 200 chars): Next.js built-in error shell with `<h1>404</h1><h2>This page could not be found.</h2>`, no app chrome, no app copy.
- UX perception: "the site is broken".

**After** (bogus slug):
- HTTP 404 (preserved).
- Response body (first 200 chars): custom `Household not found` heading, `SearchX` icon, body copy "This household doesn't exist, or it may have been deleted. Go back to see the households you're part of.", `Go to dashboard` CTA button.
- UX perception: "I typed a bad URL".

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `9589341` | Task 1 — diagnosis | 02-09-DIAGNOSIS.md |
| `f71ff85` | Task 2 — parent not-found | src/app/(main)/not-found.tsx |

## Verification Performed

Automated:
- `npx tsc --noEmit` stayed at 43-error baseline (no new errors).
- `grep -c "Household not found" src/app/(main)/not-found.tsx` → 1.
- `grep -c "Household not found" src/app/(main)/h/[householdSlug]/not-found.tsx` → 1 (preserved, not deleted).
- `grep -c "notFound()" src/features/household/context.ts` → 2 (throw site unmoved).
- Diagnosis file contains exactly 1 line matching `^- Cause (A0|A1|B|C)\b`.

Browser (Chrome DevTools MCP):
- `/h/this-household-does-not-exist/dashboard` → HTTP 404 + rendered heading `Household not found`, icon, body copy, CTA button.
- `/h/bZQaXEE2/dashboard` (valid slug) → normal dashboard with full chrome (top nav, Notification bell, 8 plants grouped by status) — no regression.
- `/h/bZQaXEE2/plants/this-plant-does-not-exist` (valid household + unknown plant) → household-scoped `not-found.tsx` still catches (household chrome intact, "Household not found" rendered inside household layout).
- Zero console errors during verification session.

Plant-level not-found copy note: the household-scoped not-found.tsx currently says "Household not found" even for unknown-plant-id cases (it was never specialized to distinguish). This is a pre-existing UX quirk, out of 02-09 scope, does not regress the plan's acceptance criteria.

## Deviations from Plan

None — executed exactly as written. Diagnosis matched the default expected Cause A1. Task 2 fix stayed within the plan's `files_modified`. No escape-hatch STOP triggered.

## Issues Encountered

None. UAT-9's "blank page" description was slightly imprecise — actual pre-fix rendering was Next.js's built-in default 404 page (not truly blank). Either way the user experience was broken and the fix addresses both descriptions.

## Next Phase Readiness

Ready for 02-10 (clean-cookie first-login "This page couldn't load" + onboarding seed error surface + post-login landing). 02-10 depends on 02-08 — that dependency is satisfied.
