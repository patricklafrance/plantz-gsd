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

## 2026-04-20 (Plan 06-08 execution)

Plan 06-08 (BUG-01 gap closure) ran `npx vitest run tests/phase-06/` without
`DATABASE_URL` set. One additional file-level failure surfaced:

| File                                                 | Failure Count | Notes                                                    |
| ---------------------------------------------------- | ------------- | -------------------------------------------------------- |
| tests/phase-06/reorder-rotation-concurrency.test.ts  | (file-level)  | Real-DB integration test; imports `@/features/household/actions` which transitively creates a Prisma client at module load. Requires `DATABASE_URL` — reproduces identically on pre-Plan-06-08 commit. Not caused by this plan. |

Plan 06-08 touched files (`general-form.tsx`, `schema.ts`, new
`settings-general-form-utc.test.tsx`) — zero new failures in files modified
by this plan. All three targeted test files pass:

- `tests/phase-06/settings-general-form.test.tsx` — 5/5 pass
- `tests/phase-06/update-household-settings.test.ts` — 8/8 pass (1 test
  updated to reflect new schema refine semantics — see Plan 06-08 SUMMARY)
- `tests/phase-06/settings-general-form-utc.test.tsx` — 7/7 pass (new)

TypeScript baseline: pre-existing `TS2352` errors in
`tests/reminders.test.ts`, `tests/rooms.test.ts`, `tests/watering.test.ts`
are unrelated to Plan 06-08 (NextMiddleware cast pattern predates this plan).
