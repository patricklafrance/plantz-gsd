---
phase: 02-authentication-and-onboarding
plan: "00"
subsystem: testing
tags: [wave-0, test-stubs, vitest, playwright, auth, onboarding]
dependency_graph:
  requires: []
  provides: [auth-test-stubs, register-form-test-stubs, onboarding-banner-test-stubs, e2e-auth-spec-stubs]
  affects: [02-01, 02-02, 02-03]
tech_stack:
  added: []
  patterns: [test.todo() for Vitest stubs, test.fixme() for Playwright stubs]
key_files:
  created:
    - tests/register-form.test.tsx
    - tests/onboarding-banner.test.tsx
    - e2e/auth.spec.ts
  modified:
    - tests/auth.test.ts
decisions:
  - "Used test.todo() for Vitest stubs — suite stays green while documenting Phase 2 contract"
  - "Used test.fixme() for Playwright stubs — consistent with Playwright's skip-without-fail pattern"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 2 Plan 00: Wave 0 Test Stubs Summary

Wave 0 Nyquist compliance plan: 4 test files with descriptive behavior stubs establish the Phase 2 verification contract before any implementation begins.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend auth.test.ts + create component test stubs | ba1e96d | tests/auth.test.ts, tests/register-form.test.tsx, tests/onboarding-banner.test.tsx |
| 2 | Create E2E auth spec stubs | 657f673 | e2e/auth.spec.ts |

## What Was Built

**tests/auth.test.ts** (extended): Added 4 new `describe` blocks with 15 `test.todo()` stubs covering Phase 2 behaviors — session JWT callbacks, registration server action, onboarding server action, and Zod schema validation. All 3 existing Phase 1 tests preserved and passing.

**tests/register-form.test.tsx** (created): 8 `test.todo()` stubs documenting RegisterForm component behavior — field rendering, inline validation errors, loading state, cross-link to login, server action invocation, toast notifications on error.

**tests/onboarding-banner.test.tsx** (created): 8 `test.todo()` stubs documenting OnboardingBanner component behavior — welcome message, range buttons (1-5, 6-15, 16-30, 30+), selection highlighting, server action call, completion confirmation, dismiss button with accessibility.

**e2e/auth.spec.ts** (created): 8 `test.fixme()` stubs covering end-to-end auth flow — route protection (AUTH-05), registration and redirect (AUTH-01), login (AUTH-02), logout (AUTH-03), onboarding banner display and completion (AUTH-04), error handling for both forms.

## Verification Results

- Vitest: 5 passed | 31 todo (36 total) — all existing tests green, all new stubs reported as todo
- Playwright: 10 specs listed (8 new auth stubs + 2 existing smoke tests) — no errors

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

All stubs in this plan are intentional — Wave 0 stubs are the deliverable. They will be filled in by:
- Plans 02-01, 02-02, 02-03 (unit test implementations)
- Plan 02-03 or 02-04 (E2E test implementations)

## Self-Check: PASSED

Files verified:
- tests/auth.test.ts: FOUND (modified, 4 new describe blocks added)
- tests/register-form.test.tsx: FOUND (created)
- tests/onboarding-banner.test.tsx: FOUND (created)
- e2e/auth.spec.ts: FOUND (created)

Commits verified:
- ba1e96d: FOUND (test(02-00): add Phase 2 unit test stubs)
- 657f673: FOUND (test(02-00): add E2E auth flow spec stubs)
