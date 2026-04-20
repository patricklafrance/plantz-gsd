# Deferred Items — Phase 06

Out-of-scope test failures surfaced during Plan 06-07 full-suite run.
These predate Plan 07 and are NOT caused by the composition work. They
are logged here per the SCOPE BOUNDARY rule and must be addressed by a
future phase (likely as a Phase 7 stabilization plan or targeted hotfix).

## 2026-04-20 (Plan 06-07 execution)

Full-suite run: `npx vitest run` (with DATABASE_URL from .env.local).
Result: 460 passed / 10 failed / 88 todo across 70 files.

All 10 failures sit in files NOT modified by this plan:

| File                                              | Failure Count | Notes                                            |
| ------------------------------------------------- | ------------- | ------------------------------------------------ |
| tests/phase-03/all-unavailable-fallback.test.ts   | (file-level)  | Real-DB test; likely env / schema drift          |
| tests/phase-03/find-next-assignee.test.ts         | (file-level)  | Real-DB test; likely env / schema drift          |
| tests/phase-03/paused-resume.test.ts              | 1             | Cron paused → active transition, pre-existing    |
| tests/household.test.ts                           | 1             | registerUser cycleDuration default; pre-existing |
| tests/reminders.test.ts                           | 3             | Phase 2 reminder query scoping; pre-existing     |
| (2 other file-level errors)                       | —             | Pre-existing real-DB setup failures              |

These failures reproduce on `main` prior to Plan 07's commits (4de1476,
74a27e7, dd1b39c) — none of the affected files were touched by this plan.

## Phase 6 test suite — ALL GREEN

`npx vitest run tests/phase-06/` passes 14/14 files, 81/81 tests, 0 todos
on the same environment. Plan 07 introduces zero regressions.
