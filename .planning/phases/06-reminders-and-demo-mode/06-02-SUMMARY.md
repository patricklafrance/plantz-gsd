---
phase: 06-reminders-and-demo-mode
plan: 02
subsystem: reminders, demo-mode, auth
tags: [reminders, demo, auth, server-actions, seed]
dependency_graph:
  requires: ["06-01"]
  provides: ["reminder-queries", "reminder-actions", "demo-infrastructure", "mutation-guards"]
  affects: ["06-03", "06-04"]
tech_stack:
  added: []
  patterns:
    - "isDemo JWT/session flag propagated from DEMO_EMAIL email match at sign-in"
    - "Reminder filter pattern: OR [snoozedUntil null, snoozedUntil lt now] for active reminders"
    - "Upsert pattern for reminder mutations (plantId_userId unique constraint)"
    - "Demo guard added immediately after auth check in all mutation Server Actions"
key_files:
  created:
    - src/features/reminders/queries.ts
    - src/features/reminders/actions.ts
    - src/features/demo/actions.ts
  modified:
    - auth.ts
    - auth.config.ts
    - proxy.ts
    - prisma/seed.ts
    - src/features/plants/actions.ts
    - src/features/watering/actions.ts
    - src/features/notes/actions.ts
    - src/features/rooms/actions.ts
    - src/features/auth/actions.ts
decisions:
  - "Demo guard placed server-side in every mutation (not just UI disabling) — T-06-03 mitigation"
  - "isDemo set at JWT creation time via DB email lookup, not from client — T-06-07 mitigated"
  - "Seed script uses idempotent pattern (findUnique before create) for safe re-runs"
  - "startDemoSession re-throws NEXT_REDIRECT — same pattern as registerUser in auth/actions.ts"
metrics:
  duration_minutes: 35
  completed_date: "2026-04-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 9
---

# Phase 6 Plan 2: Reminder Data Layer and Demo Mode Infrastructure Summary

**One-liner:** Reminder badge/dropdown queries with snooze-aware filters, four reminder mutation actions with ownership checks, isDemo JWT flag from DEMO_EMAIL match, demo user seed script with 8 diverse-urgency plants, and demo guards on all 15 mutation Server Actions.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create reminder queries and actions | 275d327 | src/features/reminders/queries.ts, src/features/reminders/actions.ts |
| 2 | Demo mode infrastructure (auth, proxy, seed, guards) | 6c23c0d | auth.ts, auth.config.ts, proxy.ts, prisma/seed.ts, src/features/demo/actions.ts, 5 action files |

## What Was Built

### Reminder Queries (src/features/reminders/queries.ts)

Three exported query functions for Server Component use:

- **getReminderCount**: Lightweight badge count checking global `remindersEnabled` first, then counting overdue + due-today plants with non-snoozed, enabled reminders via parallel `db.plant.count` calls.
- **getReminderItems**: Full dropdown payload returning `ReminderItem[]` sorted overdue-first (most days overdue ascending) then due-today (alphabetical). Applies the same reminder filter with snooze awareness.
- **getPlantReminder**: Single reminder lookup by `plantId_userId` unique index for the plant detail page toggle.

All three respect the global `remindersEnabled` toggle on User and the per-reminder `snoozedUntil` field.

### Reminder Actions (src/features/reminders/actions.ts)

Four Server Actions following the established pattern (`"use server"`, auth check, isDemo guard, Zod parse, ownership verify, Prisma upsert/update, revalidatePath):

- **snoozeReminder**: Upserts `snoozedUntil = addDays(now, days)` on the Reminder record.
- **snoozeCustomReminder**: Upserts a caller-supplied `snoozedUntil` date (Zod-validated future date).
- **togglePlantReminder**: Upserts `enabled` boolean on the per-plant Reminder record.
- **toggleGlobalReminders**: Updates `User.remindersEnabled`.

All actions use `db.reminder.upsert` against the `@@unique([plantId, userId])` constraint.

### Auth Integration (auth.ts, auth.config.ts, proxy.ts)

- **auth.ts**: JWT callback now DB-looks up the signing user's email and sets `token.isDemo = email === DEMO_EMAIL`. Session callback propagates `session.user.isDemo = token.isDemo === true`.
- **auth.config.ts**: Added `"/demo"` to `publicPaths` so the authorized callback allows unauthenticated access to `/demo`.
- **proxy.ts**: Matcher regex updated to exclude `demo` path from protection.

### Demo Seed Script (prisma/seed.ts)

Extended the existing `main()` with idempotent demo user seeding:
- Creates demo user with `remindersEnabled: true`, `onboardingCompleted: true`
- Creates two rooms (Living Room, Bedroom)
- Creates all 8 `DEMO_PLANTS` with diverse urgency states: some overdue (Monty 8 days, Fiddle 2 days over 10-day interval), due today (Lily watered 0 days ago on 5-day interval), recently watered (Snakey, Ziggy), upcoming (Goldie, Spidey, Stretch)
- Each plant gets a nested `Reminder` record and a `WateringLog` entry for the initial watering

### Demo Actions (src/features/demo/actions.ts)

- **startDemoSession**: Calls `signIn("credentials", { email: DEMO_EMAIL, password: DEMO_PASSWORD, redirectTo: "/dashboard" })` and re-throws `NEXT_REDIRECT` (same pattern as `registerUser`).
- **seedStarterPlants**: Looks up CareProfile entries for the 5 STARTER_PLANTS, creates plants with reminders, rejects demo users.

### Mutation Guards (15 Server Actions)

Demo guard line `if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." }` added immediately after the auth check in:

- **plants/actions.ts**: createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant (5)
- **watering/actions.ts**: logWatering, editWateringLog, deleteWateringLog (3)
- **notes/actions.ts**: createNote, updateNote, deleteNote (3)
- **rooms/actions.ts**: createRoom, updateRoom, deleteRoom (3)
- **auth/actions.ts**: completeOnboarding (1)

`loadMoreWateringHistory`, `loadMoreTimeline`, and `registerUser` excluded as read-only or pre-auth.

## Decisions Made

- Demo guard is server-side in every action body — UI disabling alone is insufficient for T-06-03 (tampering via direct Server Action calls).
- `isDemo` is set at sign-in time from a DB email lookup in the JWT callback, not from any client-supplied value — cannot be forged (T-06-07).
- Seed script uses `findUnique` before `create` to be safely re-runnable in CI.
- `startDemoSession` re-throws `NEXT_REDIRECT` to let Next.js handle the redirect, matching the existing `registerUser` pattern in `auth/actions.ts`.

## Deviations from Plan

None — plan executed exactly as written. The plan counted "16 mutation Server Actions" in one place but listed 15 distinct functions; all 15 listed functions received the guard.

## Known Stubs

None — all exports are fully wired. The seed script creates real DB records. The demo user credentials match what `startDemoSession` uses.

## Threat Flags

None — no new network endpoints or trust boundaries introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

Files confirmed created:
- src/features/reminders/queries.ts: FOUND
- src/features/reminders/actions.ts: FOUND
- src/features/demo/actions.ts: FOUND

Commits confirmed:
- 275d327: FOUND (feat(06-02): add reminder queries and actions)
- 6c23c0d: FOUND (feat(06-02): add demo mode infrastructure and mutation guards)
