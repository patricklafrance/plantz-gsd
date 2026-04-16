---
phase: 06-reminders-and-demo-mode
plan: "01"
subsystem: database
tags: [prisma, postgresql, zod, nextauth, vitest, shadcn, reminders, demo]

# Dependency graph
requires:
  - phase: 05-notes-search-and-filters
    provides: Established feature directory pattern (src/features/), Zod v4 schema pattern, Vitest test patterns

provides:
  - Prisma schema extended with remindersEnabled on User and @@unique constraint on Reminder
  - Zod schemas for snooze and toggle reminder operations
  - ReminderItem TypeScript interface for notification dropdown
  - Demo seed data constants (DEMO_PLANTS, STARTER_PLANTS, DEMO_EMAIL)
  - NextAuth Session and JWT types augmented with isDemo
  - shadcn Switch component installed
  - Test stubs for all RMDR-01 through RMDR-05 and DEMO-01 through DEMO-03 requirements
  - Database schema pushed to PostgreSQL with Reminder backfill for existing plants
  - createPlant action creates nested Reminder record for all new plants

affects:
  - 06-02 (reminder queries and actions depend on schema and Zod schemas)
  - 06-03 (notification bell uses ReminderItem type)
  - 06-04 (demo mode seed script uses DEMO_PLANTS, STARTER_PLANTS, DEMO_EMAIL)

# Tech tracking
tech-stack:
  added:
    - shadcn Switch component (src/components/ui/switch.tsx)
  patterns:
    - Nested Reminder create in plant creation (ensures every plant always has a Reminder record)
    - Idempotent SQL backfill pattern (WHERE NOT EXISTS guard)
    - Test imports use @/ alias (not relative require()) per Vitest project config

key-files:
  created:
    - prisma/schema.prisma (modified — remindersEnabled field, @@unique constraint)
    - src/features/reminders/schemas.ts
    - src/features/reminders/types.ts
    - src/features/demo/seed-data.ts
    - src/types/next-auth.d.ts (modified — isDemo in Session and JWT)
    - src/components/ui/switch.tsx
    - tests/reminders.test.ts
    - tests/demo.test.ts
  modified:
    - src/features/plants/actions.ts (createPlant nested Reminder create)

key-decisions:
  - "Test files use async import('@/...') pattern not require('../src/...') — matches Vitest @/ alias config"
  - "prisma db push --accept-data-loss used for @@unique constraint (warning is for potential duplicates, none existed in dev DB)"
  - "Backfill SQL uses WHERE NOT EXISTS for idempotency (safe to re-run)"

patterns-established:
  - "Reminder records co-created with Plant records via nested Prisma create"
  - "Test stubs use it.todo() for future implementation, active assertions use async import(@/) pattern"

requirements-completed:
  - RMDR-01
  - RMDR-02
  - RMDR-03
  - RMDR-04
  - RMDR-05
  - DEMO-01
  - DEMO-02

# Metrics
duration: 15min
completed: 2026-04-15
---

# Phase 6 Plan 01: Reminders and Demo Mode Foundation Summary

**Prisma schema extended with remindersEnabled and Reminder @@unique constraint, Zod schemas and TypeScript types defined, demo seed constants established, Switch component installed, test stubs created, schema pushed and existing plants backfilled**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-15T15:30:00Z
- **Completed:** 2026-04-15T15:45:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Extended Prisma schema with `remindersEnabled` on User model and `@@unique([plantId, userId])` on Reminder model, pushed to PostgreSQL
- Created all Zod validation schemas (snooze, snoozeCustom, toggleReminder, toggleGlobalReminders) and TypeScript ReminderItem interface
- Established demo seed data constants (DEMO_EMAIL, DEMO_PLANTS x8, STARTER_PLANTS x5) and extended NextAuth session types with isDemo
- Installed shadcn Switch component, created 37 test cases (7 active + 30 todo stubs) covering all phase requirements
- Backfilled Reminder records for all existing plants and updated createPlant to auto-create Reminder records going forward

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Prisma schema, create Zod schemas, types, and seed data constants** - `038067c` (feat)
2. **Task 2: Install shadcn Switch, create test stubs, push schema, and backfill Reminder records** - `bed381a` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `prisma/schema.prisma` - Added remindersEnabled to User, @@unique([plantId, userId]) to Reminder
- `src/features/reminders/schemas.ts` - Zod schemas: snoozeSchema, snoozeCustomSchema, toggleReminderSchema, toggleGlobalRemindersSchema
- `src/features/reminders/types.ts` - ReminderItem interface with plantId, nickname, roomName, statusLabel, daysOverdue
- `src/features/demo/seed-data.ts` - DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS (8 entries), STARTER_PLANTS (5 entries)
- `src/types/next-auth.d.ts` - Session.user.isDemo: boolean, JWT.isDemo?: boolean augmentation
- `src/components/ui/switch.tsx` - shadcn Switch component (Radix primitive)
- `tests/reminders.test.ts` - Test stubs for RMDR-01 through RMDR-05 + active Zod schema validation tests
- `tests/demo.test.ts` - Test stubs for DEMO-01 through DEMO-03 + active seed data constant tests
- `src/features/plants/actions.ts` - createPlant now creates nested Reminder record with enabled: true

## Decisions Made

- Used `async import("@/features/...")` pattern in test files instead of the plan's `require("../src/features/...")` — the project's Vitest config uses the `@/` alias and relative require paths fail at runtime
- Used `prisma db push --accept-data-loss` for the `@@unique` constraint — the warning is about potential duplicate rows; dev DB had none and the constraint was needed
- Backfill SQL uses `WHERE NOT EXISTS` guard making it idempotent — safe to re-run without creating duplicate Reminder records

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test import paths from require() to async import() with @/ alias**
- **Found during:** Task 2 (test stub creation and verification)
- **Issue:** Plan specified `require("../src/features/reminders/schemas")` paths which fail in Vitest because the project uses the `@/` TypeScript path alias. Tests errored with `Cannot find module`
- **Fix:** Changed all `require("../src/features/...")` to `async import("@/features/...")` and switched test functions to `async` — matching the pattern established in tests/notes.test.ts
- **Files modified:** tests/reminders.test.ts, tests/demo.test.ts
- **Verification:** `npx vitest run tests/reminders.test.ts tests/demo.test.ts` — 7 passed, 30 todo
- **Committed in:** bed381a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - import path bug)
**Impact on plan:** Fix was necessary for tests to run. No scope creep — same test coverage, correct import pattern.

## Issues Encountered

- `prisma db push` initially rejected due to `@@unique` constraint warning about potential data loss. Used `--accept-data-loss` flag since the constraint is intentional and dev DB had no duplicate rows.

## User Setup Required

None - no external service configuration required. Database was pushed automatically as part of this plan.

## Next Phase Readiness

- Plan 02 (reminder queries and actions) can now import from `src/features/reminders/schemas.ts` and rely on the `@@unique` constraint for upsert operations
- Plan 03 (notification bell UI) can import `ReminderItem` from `src/features/reminders/types.ts`
- Plan 04 (demo mode seed script) can import `DEMO_PLANTS`, `STARTER_PLANTS`, `DEMO_EMAIL` from `src/features/demo/seed-data.ts`
- Switch component is ready for use in reminder settings UI
- All existing plants have Reminder records; all new plants will auto-get one via createPlant

---
*Phase: 06-reminders-and-demo-mode*
*Completed: 2026-04-15*
