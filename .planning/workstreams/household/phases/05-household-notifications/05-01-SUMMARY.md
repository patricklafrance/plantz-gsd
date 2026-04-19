---
phase: 05-household-notifications
plan: 01
subsystem: database
tags: [prisma, postgres, schema-migration, test-scaffold, vitest, phase-05]

# Dependency graph
requires:
  - phase: 03-rotation-engine-availability
    provides: HouseholdNotification base model + cycleId unique constraint pattern
  - phase: 04-invitation-system
    provides: tests/phase-04/fixtures.ts RUN_ID/EMAIL_PREFIX/lazy-db pattern copied into phase-05
provides:
  - HouseholdNotification.readAt Timestamptz(3) nullable column on live DB (D-01)
  - Composite index (recipientUserId, readAt) backing badge-count query (D-02)
  - Regenerated Prisma client with readAt typed as Date | null across all HouseholdNotification input/output shapes
  - CycleEventItem sibling type for D-18 merged feed (ReminderItem unchanged for backwards-compat)
  - tests/phase-05/fixtures.ts with RUN_ID, EMAIL_PREFIX, emailFor, lazy getDb
  - Nine scaffold test files under tests/phase-05/ with vi.mock headers + it.todo/test.todo stubs covering HNTF-01..HNTF-04 and AVLB-05 fallback
affects: [05-02-server-layer, 05-03-banners, 05-04-notification-bell, 05-05-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mocked-Prisma test header with ForbiddenError class stub (copied from Phase 4 create-invitation.test.ts)"
    - "Phase 5 test scaffolds use it.todo/test.todo with requirement-ID prefix for grep-and-replace in Waves 2/3"
    - "CycleEventItem as sibling type (not discriminated union) to keep ReminderItem call sites untouched"

key-files:
  created:
    - prisma/migrations/20260419225747_add_household_notification_read_at/migration.sql
    - tests/phase-05/fixtures.ts
    - tests/phase-05/reminder-gate.test.ts
    - tests/phase-05/get-unread-cycle-event-count.test.ts
    - tests/phase-05/get-cycle-notifications-for-viewer.test.ts
    - tests/phase-05/mark-notifications-read.test.ts
    - tests/phase-05/cycle-start-banner.test.tsx
    - tests/phase-05/reassignment-banner.test.tsx
    - tests/phase-05/passive-status-banner.test.tsx
    - tests/phase-05/fallback-banner.test.tsx
    - tests/phase-05/notification-bell-variant.test.tsx
  modified:
    - prisma/schema.prisma
    - src/features/reminders/types.ts

key-decisions:
  - "CycleEventItem added as sibling type to ReminderItem (not a discriminated union) — downstream Plans 03/04 render merged feed with two typed arrays; no existing ReminderItem consumer changes"
  - "Phase 5 fixtures file stays minimal (RUN_ID, EMAIL_PREFIX, emailFor, getDb) because D-26 rejected real-Prisma integration tests for this phase; fixtures exist for consistency with Phase 4 patterns but downstream tests are all mocked"
  - "Task 3 split into 3a (types + fixtures, 2 files) and 3b (9 test scaffolds) to respect per-task file budget; neither sub-task is independently consumable but the split keeps each task's context cost bounded"

patterns-established:
  - "Phase 5 test scaffold pattern: vi.mock('@/generated/prisma/client'), vi.mock('@prisma/adapter-pg'), vi.mock('@/lib/db') with per-test model mocks, vi.mock('../../auth'), vi.mock('next/cache'), vi.mock('@/features/household/guards') with ForbiddenError class stub"
  - "Additive nullable migration with no DEFAULT: safest form — cannot data-loss existing rows, single-step apply (no three-step ritual needed because no backfill required)"
  - "Composite index naming: {Model}_{field1}_{field2}_idx (Prisma default) — HouseholdNotification_recipientUserId_readAt_idx"

requirements-completed: [HNTF-01, HNTF-02, HNTF-03, HNTF-04]

# Metrics
duration: ~7 min
completed: 2026-04-19
---

# Phase 05 Plan 01: Household Notifications Schema + Test Scaffolds Summary

**HouseholdNotification.readAt nullable column + composite index on live Neon DB, CycleEventItem sibling type for D-18 merged feed, and 64 it.todo stubs across 9 vi.mock-backed test files ready for Waves 2/3 to grep-and-replace with real assertions.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-19T22:56:29Z
- **Completed:** 2026-04-19T23:03:17Z
- **Tasks:** 4 (Task 1, Task 2, Task 3a, Task 3b)
- **Files modified:** 12 (2 modified, 10 created — excluding the Prisma migration folder itself)

## Accomplishments

- `prisma/schema.prisma` extended with `readAt DateTime? @db.Timestamptz(3)` and `@@index([recipientUserId, readAt])` on `HouseholdNotification`; `prisma validate` passes; diff is scoped to the single model.
- Live Neon DB migration `20260419225747_add_household_notification_read_at` applied: `ALTER TABLE ... ADD COLUMN "readAt" TIMESTAMPTZ(3);` and `CREATE INDEX "HouseholdNotification_recipientUserId_readAt_idx" ON "HouseholdNotification"("recipientUserId", "readAt");` — exactly the two expected statements, no DEFAULT clause.
- Prisma client regenerated (7.7.0) — `readAt: Date | null` surfaces on HouseholdNotification input, output, scalar, and filter types under `src/generated/prisma/models/HouseholdNotification.ts`.
- `src/features/reminders/types.ts` gains `CycleEventItem` sibling interface; `ReminderItem` shape unchanged (backwards-compat preserved for Phase 2 dashboard consumers).
- `tests/phase-05/fixtures.ts` created with `RUN_ID`, `EMAIL_PREFIX = phase05-test-<RUN_ID>`, `emailFor()`, and lazy `getDb()` — mirrors Phase 4 fixtures exactly for pattern continuity.
- Nine test scaffolds under `tests/phase-05/` covering HNTF-01..HNTF-04 + AVLB-05: 64 total `it.todo`/`test.todo` descriptions. `npx vitest run tests/phase-05` reports all 64 as todo; `npx tsc --noEmit` introduces no new errors.

## Task Commits

1. **Task 1: Extend prisma/schema.prisma with readAt column + index** — `6861c03` (feat)
2. **Task 2: Run prisma migrate dev + regenerate client** — `de28e3b` (feat)
3. **Task 3a: Extend types.ts with CycleEventItem + create fixtures.ts** — `af6d579` (feat)
4. **Task 3b: Scaffold nine phase-05 test files** — `e6fa814` (test)

**Plan metadata commit:** pending (created after STATE/ROADMAP update)

## Files Created/Modified

- `prisma/schema.prisma` — Added `readAt` nullable column and composite `(recipientUserId, readAt)` index on `HouseholdNotification`
- `prisma/migrations/20260419225747_add_household_notification_read_at/migration.sql` — ALTER TABLE + CREATE INDEX generated by prisma migrate dev
- `src/features/reminders/types.ts` — Appended `CycleEventItem` sibling interface for merged-feed rendering
- `tests/phase-05/fixtures.ts` — Minimal fixtures (RUN_ID, EMAIL_PREFIX, emailFor, getDb) mirroring Phase 4 conventions
- `tests/phase-05/reminder-gate.test.ts` — Eight it.todo stubs: four for `getReminderCount`, four for `getReminderItems` (HNTF-01, D-08/09/10)
- `tests/phase-05/get-unread-cycle-event-count.test.ts` — Two it.todo stubs for D-28 badge-count query
- `tests/phase-05/get-cycle-notifications-for-viewer.test.ts` — Three it.todo stubs for D-29 merged feed query
- `tests/phase-05/mark-notifications-read.test.ts` — Eight test.todo stubs for D-20/D-24 (authz branches + idempotency)
- `tests/phase-05/cycle-start-banner.test.tsx` — Seven it.todo stubs for HNTF-02 render contract (D-25)
- `tests/phase-05/reassignment-banner.test.tsx` — Nine it.todo stubs for HNTF-03 (three reassignType branches + D-06 doc-only marker)
- `tests/phase-05/passive-status-banner.test.tsx` — Eight it.todo stubs for HNTF-04 non-assignee variants
- `tests/phase-05/fallback-banner.test.tsx` — Eight it.todo stubs for AVLB-05 fallback branches (viewerIsOwner × isPaused)
- `tests/phase-05/notification-bell-variant.test.tsx` — Eleven it.todo stubs for D-17/D-18/D-20/D-22 (variant + merged feed + mark-read trigger)

## Decisions Made

- **CycleEventItem as sibling type (not discriminated union):** Keeps `ReminderItem` consumers in Phase 2 (dashboard, reminder banner) untouched. Downstream bell dropdown renders two typed arrays side-by-side instead of collapsing through a union tag. Cheaper to change later than to migrate every call site now.
- **Fixtures file stays minimal despite Phase 4 having a much larger helper set:** D-26 rejected real-Prisma integration tests for Phase 5, so the helpers Phase 4 needs (createHouseholdWithMembers, createHouseholdWithInvitation) would be dead code here. If a downstream plan decides it needs a real-DB helper, it adds it inline in that plan.
- **Task 3 split (3a/3b) respects the 5-8 file per-task threshold:** 3a extends 1 type file + creates 1 fixtures file; 3b creates 9 test scaffolds. Split keeps each task's context cost ~10-15% while preserving atomicity of the overall scaffold delivery for Wave 2 consumers.

## Deviations from Plan

None — plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Acceptance criteria met exactly. Every grep check passed; `prisma validate`, `prisma migrate status`, `vitest run tests/phase-05`, and `tsc --noEmit` all clean. No auto-fixes required and no architectural surprises.

## Issues Encountered

- **Minor environment friction:** `DATABASE_URL` was not set in the shell; Prisma requires it for `migrate dev` and `migrate status`. Resolved in-session by sourcing `.env.local` (leading whitespace in the file required `sed 's/^[[:space:]]*//'` to export cleanly). No code change required — this is a terminal-session concern, not a project concern.
- **Prisma v7 client layout:** Acceptance criteria referenced `src/generated/prisma/client/index.d.ts`, but Prisma v7 generates per-model files under `src/generated/prisma/models/` instead. Verified `readAt: Date | null` appears in `models/HouseholdNotification.ts` — same assurance the original criterion intended. Worth flagging for future plans: update grep paths to `src/generated/prisma/models/*.ts`.

## User Setup Required

None — no external service configuration required. The live-DB migration was applied with the existing `DATABASE_URL` from `.env.local` (Neon hosted Postgres). Teammates need only `npm install && npx prisma generate` after pulling this branch.

## Next Phase Readiness

- **Plan 05-02 (server layer)** unblocked: can import `readAt` from the typed Prisma client, author `markNotificationsRead`, `getUnreadCycleEventCount`, `getCycleNotificationsForViewer` against the new column, and fill `tests/phase-05/reminder-gate.test.ts`, `mark-notifications-read.test.ts`, `get-unread-cycle-event-count.test.ts`, and `get-cycle-notifications-for-viewer.test.ts` with real assertions.
- **Plan 05-03 (banners)** unblocked: can import `CycleEventItem` from `src/features/reminders/types.ts` and fill `cycle-start-banner.test.tsx`, `reassignment-banner.test.tsx`, `passive-status-banner.test.tsx`, and `fallback-banner.test.tsx` in parallel with Plan 05-02.
- Plan 05-04 (notification bell) and Plan 05-05 (dashboard integration) remain downstream of Plan 05-02's server layer.

## Self-Check: PASSED

- [x] `prisma/schema.prisma` contains readAt field and composite index (confirmed via git diff)
- [x] `prisma/migrations/20260419225747_add_household_notification_read_at/migration.sql` exists with ALTER TABLE + CREATE INDEX
- [x] `src/features/reminders/types.ts` exports both `ReminderItem` and `CycleEventItem`
- [x] `tests/phase-05/fixtures.ts` exists with RUN_ID, EMAIL_PREFIX, emailFor, getDb
- [x] All nine phase-05 test files present; every file contains `.todo(` stubs
- [x] All HNTF-01..HNTF-04 ids appear in at least one todo
- [x] `npx prisma validate` exits 0; `npx prisma migrate status` reports in sync
- [x] `npx vitest run tests/phase-05` exits 0 with 64 todo and 0 failures
- [x] Commit hashes 6861c03, de28e3b, af6d579, e6fa814 all present in `git log`

---
*Phase: 05-household-notifications*
*Completed: 2026-04-19*
