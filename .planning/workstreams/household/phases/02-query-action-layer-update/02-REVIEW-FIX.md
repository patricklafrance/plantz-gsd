---
phase: 02-query-action-layer-update
fixed_at: 2026-04-26T00:00:00Z
review_path: .planning/workstreams/household/phases/02-query-action-layer-update/02-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-26T00:00:00Z
**Source review:** .planning/workstreams/household/phases/02-query-action-layer-update/02-REVIEW.md
**Iteration:** 1 (this fix run; REVIEW.md is at iteration 3)

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

Note: REVIEW.md (iteration 3) reports 0 Critical and 0 Warning findings. Only the 2 Info-level findings (IN-06, IN-07) were in scope. `fix_scope=all` was applied; both were addressed.

## Fixed Issues

### IN-06: `src/app/(main)/not-found.tsx` duplicates `src/app/(main)/h/[householdSlug]/not-found.tsx` byte-for-byte

**Files modified:** `src/app/(main)/not-found.tsx`
**Commit:** c8bfde4
**Applied fix:** Replaced the household-specific copy ("Household not found" + body referencing missing/deleted households) on the root `(main)` segment's not-found page with generic page-not-found copy ("Page not found" + "We couldn't find what you're looking for. Head back to your dashboard."). The inner `/h/[householdSlug]/not-found.tsx` retains its household-scoped copy. Resolves the semantic mismatch where the root-segment 404 spoke about households for non-household routes (e.g. `/settings`) and removes the byte-for-byte duplicate that risked silent drift. Followed Option A from the review.

### IN-07: `userId` prop on `OnboardingBanner` is unused

**Files modified:** `src/components/onboarding/onboarding-banner.tsx`, `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`
**Commit:** 5091abd
**Applied fix:** Removed the unused `userId` field from `OnboardingBannerProps`, dropped it from the function signature, and removed it from the single call site in `dashboard/page.tsx` (line 263). `householdId` remains as the load-bearing landing-target hint per D-14. The server actions (`completeOnboarding`, `seedStarterPlants`) already re-authenticate via `auth()` server-side, so removing the redundant client-passed `userId` has no behavioral impact and eliminates dead surface area that would trip strict `@typescript-eslint/no-unused-vars`. Repo-wide search confirmed `dashboard/page.tsx` was the only production call site (test file `tests/onboarding-banner.test.tsx` contains no `userId` references).

## Skipped Issues

None — all in-scope findings were fixed in this iteration.

## Validation

- Tier 1 (re-read) passed for both fixes — modified regions verified intact, replacement text present, surrounding code unchanged.
- Tier 2 (syntax check via `npx tsc --noEmit`) reported no errors referencing the modified files (`not-found.tsx`, `onboarding-banner.tsx`, `dashboard/page.tsx`).

---

_Fixed: 2026-04-26T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
