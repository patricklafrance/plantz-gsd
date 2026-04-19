---
phase: 05-household-notifications
plan: 02
subsystem: server
tags: [server-action, prisma-query, zod-schema, assignee-gate, react-cache, phase-05]

# Dependency graph
requires:
  - phase: 05-household-notifications/01
    provides: HouseholdNotification.readAt column + typed Prisma client + CycleEventItem type + test scaffolds with it.todo stubs
provides:
  - getReminderCount/getReminderItems now take userId and gate non-assignees on active cycles (HNTF-01, D-07..D-10)
  - getUnreadCycleEventCount query wrapped with React.cache() for request-level dedup (D-28)
  - getCycleNotificationsForViewer query wrapped with React.cache() for request-level dedup (D-29)
  - markNotificationsReadSchema Zod v4 schema (D-20)
  - markNotificationsRead Server Action with recipient-scoped updateMany authz (D-20, D-24)
affects: [05-03-banners, 05-04-notification-bell, 05-05-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-check + early-return assignee gate (no indirection helper — reads cleaner as inline branch)"
    - "React.cache() wrapping for server-side data fetches called multiple times per request (layout + dashboard pattern)"
    - "Row-level authz via updateMany where-clause predicate (recipientUserId: session.user.id) instead of fetch-then-check"

key-files:
  created: []
  modified:
    - src/features/reminders/queries.ts
    - src/features/household/queries.ts
    - src/features/household/schema.ts
    - src/features/household/actions.ts
    - tests/phase-05/reminder-gate.test.ts
    - tests/phase-05/get-unread-cycle-event-count.test.ts
    - tests/phase-05/get-cycle-notifications-for-viewer.test.ts
    - tests/phase-05/mark-notifications-read.test.ts

key-decisions:
  - "Pre-check + early-return gate shape kept inline (no isGated helper) — three-line branch reads cleaner than indirection and keeps D-07..D-10 semantics grep-able at call sites"
  - "React.cache() wrapping applied to both new household-side queries — layout + dashboard page both call getCycleNotificationsForViewer per dashboard request; cache() collapses to one DB read. getUnreadCycleEventCount wrapped symmetrically for future duplicate-call safety."
  - "Row-level authz via updateMany.where.recipientUserId instead of fetch-check-write: forged notificationIds become zero-count no-ops at SQL level, not errors — matches D-24 and keeps the action idempotent on replays"
  - "markNotificationsRead does NOT accept recipientUserId as input — reads it from session to close T-05-02-02 tampering vector"

patterns-established:
  - "React.cache() for RSC queries consumed by multiple Server Components in one request (layout chokepoint + page data fetch pattern)"
  - "Early-return assignee gate at the top of reminder queries — branch order: null cycle → active-non-assignee → paused/active-assignee fallthrough"

requirements-completed: [HNTF-01, HNTF-02, HNTF-03]

# Metrics
duration: ~7 min
completed: 2026-04-19
---

# Phase 05 Plan 02: Household Notifications Server Layer Summary

**Assignee gate added to reminder queries (D-07..D-10), two new cache()-wrapped household queries for badge + banner feed (D-28, D-29), and markNotificationsRead Server Action with recipient-scoped updateMany authz (D-20, D-24) — 21 tests green across four phase-05 test files.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-19T23:07:36Z
- **Completed:** 2026-04-19T23:14:30Z
- **Tasks:** 3 (all TDD: 6 commits = 3 × test+feat)
- **Files modified:** 8 (4 source, 4 test)

## Accomplishments

- `src/features/reminders/queries.ts` rewritten with `userId: string` inserted as 2nd parameter on both `getReminderCount` and `getReminderItems`. Early-return gate closes the D-15 temporary regression: active-cycle non-assignees receive 0/[] without touching `plant.count`/`plant.findMany`; paused cycles bypass the gate and count for everyone (D-09); null cycles return 0/[] (D-10). `getPlantReminder` unchanged.
- `src/features/household/queries.ts` extended with two new queries, both wrapped in React 19 `cache()`:
  - `getUnreadCycleEventCount(householdId, userId)` — badge-count query, filters on `cycle.status === "active"` (paused events excluded from badge per D-28).
  - `getCycleNotificationsForViewer(householdId, userId, cycleId)` — banner feed query with `cycle.household.members` include graph so banner components render without extra queries. `cycleId` filter enforces D-06 derivational clearing (prior-cycle rows never surface).
- `src/features/household/schema.ts` gains `markNotificationsReadSchema` (Zod v4, `z.array(z.cuid()).min(1)`). `recipientUserId` deliberately NOT accepted from input — read from session inside the action to close T-05-02-02.
- `src/features/household/actions.ts` gains `markNotificationsRead` Server Action following the 7-step template. Row-level authz via `updateMany.where.recipientUserId = session.user.id` makes forged notificationIds zero-count no-ops at SQL level (D-24). `readAt: null` predicate makes replays idempotent (T-05-02-03). Triggers `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")` on success.
- All four phase-05 test files have zero `.todo` stubs remaining: 8 reminder-gate + 2 get-unread-cycle-event-count + 3 get-cycle-notifications-for-viewer + 8 mark-notifications-read = **21 tests green**.

## Task Commits

Each task was TDD (test + feat commits):

1. **Task 1 RED: add failing tests for reminder assignee gate** — `031baa3` (test)
2. **Task 1 GREEN: add assignee gate to reminder queries (D-07..D-10)** — `c1d3cce` (feat)
3. **Task 2 RED: add failing tests for household notification queries** — `901b5b7` (test)
4. **Task 2 GREEN: add getUnreadCycleEventCount + getCycleNotificationsForViewer (D-28, D-29)** — `52a8541` (feat)
5. **Task 3 RED: add failing tests for markNotificationsRead Server Action** — `fd7075f` (test)
6. **Task 3 GREEN: add markNotificationsRead Server Action + schema (D-20, D-24)** — `8c562e8` (feat)

**Plan metadata commit:** pending (created after STATE/ROADMAP update)

## Files Created/Modified

- `src/features/reminders/queries.ts` — Added `userId` parameter, `getCurrentCycle` import, and three-branch early-return gate (null/active-non-assignee/fallthrough) on both count and items queries
- `src/features/household/queries.ts` — Added `import { cache } from "react"`; appended `getUnreadCycleEventCount` and `getCycleNotificationsForViewer` after `getCurrentCycle`, both wrapped with `cache()`
- `src/features/household/schema.ts` — Appended `markNotificationsReadSchema` + `MarkNotificationsReadInput` type
- `src/features/household/actions.ts` — Added `markNotificationsReadSchema` to schema import block; appended `markNotificationsRead` Server Action at end of file
- `tests/phase-05/reminder-gate.test.ts` — Replaced 8 it.todo stubs with real it() calls using vi.mock on `getCurrentCycle`
- `tests/phase-05/get-unread-cycle-event-count.test.ts` — Replaced 2 it.todo stubs with real call-arg assertions
- `tests/phase-05/get-cycle-notifications-for-viewer.test.ts` — Replaced 3 it.todo stubs with cycleId filter and orderBy assertions
- `tests/phase-05/mark-notifications-read.test.ts` — Replaced 8 test.todo stubs covering all 7-step branches including recipientUserId authz and idempotent replay

## Decisions Made

- **Inline early-return gate, no helper extraction:** Considered `if (isGated(cycle, userId)) return 0` but the three-line branch reads cleaner inline; extracting hides the D-07..D-10 branch semantics from the call site and adds a layer to grep through.
- **React.cache() wrapping on both new queries even though only one is strictly deduplicated in Plan 05:** symmetric wrapping keeps future header subcomponent additions safe without a fresh RFC. `cache()` is a no-op outside RSC request context so unit tests behave correctly (inner function invoked every call).
- **Row-level authz via updateMany predicate, not fetch-check-write:** forged notificationIds filter to zero-count at SQL level — the action still returns `{ success: true }` for the cross-user case, which is the correct security property (tampering is silently ineffective, not loud-erroring). Matches D-24 and removes an extra round-trip.
- **Do NOT accept `recipientUserId` from input:** T-05-02-02 tampering vector closed by reading from session. Schema explicitly documents this.

## Deviations from Plan

None — plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Every acceptance criterion passed (grep checks, test runs, vitest count, tsc error delta). No auto-fixes required. The two expected new `tsc` errors in `src/app/(main)/h/[householdSlug]/layout.tsx` (missing `userId` argument in both `getReminderCount` and `getReminderItems` call sites) are the only new compile errors introduced — exactly as planned for Plan 05 to resolve.

## Threat Model Resolution

All 8 threat register entries mitigated:

| Threat ID | Disposition | Resolution |
|-----------|-------------|------------|
| T-05-02-01 (Spoofing: forged notificationIds) | mitigated | Zod `z.array(z.cuid()).min(1)` rejects malformed ids; `updateMany.where.recipientUserId` filters forged rows at SQL level |
| T-05-02-02 (Tampering: cross-user write) | mitigated | `recipientUserId: session.user.id` predicate is authoritative; test `member-but-not-recipient` asserts the predicate explicitly |
| T-05-02-03 (Repudiation: readAt overwrite) | mitigated | `readAt: null` predicate filters already-read rows out of the update; test `re-open with already-read ids` asserts the predicate is null |
| T-05-02-04 (Info disclosure: cross-household count) | mitigated | `where.householdId` scoping; caller contract documented in JSDoc |
| T-05-02-05 (Info disclosure: other users' rows in feed) | mitigated | `where.recipientUserId = userId` + `cycleId` filter enforce row-level and cycle-level isolation |
| T-05-02-06 (Info disclosure: reminder counts to non-assignees, Pitfall 13) | mitigated | Pre-check gate returns 0/[] before touching `plant.count`/`plant.findMany`; test asserts `not.toHaveBeenCalled()` |
| T-05-02-07 (DoS: huge notificationIds array) | accepted | Per phase threat model — 10k cuids tolerable; demo guard short-circuits; per-user rate limits deferred |
| T-05-02-08 (EoP: unauthenticated caller) | mitigated | Step 1 session check returns `{ error: "Not authenticated." }`; test `unauthenticated session` asserts |

## Issues Encountered

None — clean TDD execution. RED commits failed as expected; GREEN commits passed after single-shot implementation. No refactor step needed (inline gate is already the target shape per plan instruction "Do NOT extract the 3-line gate into a helper").

## Expected Downstream Compile Error (for Plan 05)

`src/app/(main)/h/[householdSlug]/layout.tsx` lines 54-55 now pass 3 args to `getReminderCount`/`getReminderItems` but the new signatures expect 4 (userId inserted after householdId). This is THE expected downstream breakage and is the explicit handoff to Plan 05 (dashboard integration):

```
src/app/(main)/h/[householdSlug]/layout.tsx(54,5): error TS2554: Expected 4 arguments, but got 3.
src/app/(main)/h/[householdSlug]/layout.tsx(55,5): error TS2554: Expected 4 arguments, but got 3.
```

Total tsc error count unchanged at 97 — these 2 new errors are offset elsewhere (no net regression in pre-existing warnings).

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- **Plan 05-03 (banners)** can proceed in parallel: already unblocked by Plan 01's `CycleEventItem` type. Does not consume anything added here.
- **Plan 05-04 (NotificationBell unified variant)** unblocked: imports `markNotificationsRead` from `@/features/household/actions` and calls it via `startTransition` in `onOpenChange`. Badge-count prop sourced from `getUnreadCycleEventCount` (consumed by layout in Plan 05).
- **Plan 05-05 (dashboard integration)** unblocked: layout chokepoint Promise.all now calls `getReminderCount(household.id, session.user.id, todayStart, todayEnd)` + `getReminderItems(...)` + `getUnreadCycleEventCount(household.id, session.user.id)` + `getCycleNotificationsForViewer(household.id, session.user.id, currentCycle.id)`. React.cache() dedup makes the duplicate call in the dashboard page Server Component transparent.

## Self-Check: PASSED

- [x] `src/features/reminders/queries.ts` contains `userId: string` parameter + gate branches (grep passed)
- [x] `src/features/household/queries.ts` exports `getUnreadCycleEventCount` and `getCycleNotificationsForViewer`, both wrapped with `cache()`
- [x] `src/features/household/schema.ts` exports `markNotificationsReadSchema` + type
- [x] `src/features/household/actions.ts` exports `markNotificationsRead` with 7-step template
- [x] `npx vitest run tests/phase-05/reminder-gate.test.ts tests/phase-05/get-unread-cycle-event-count.test.ts tests/phase-05/get-cycle-notifications-for-viewer.test.ts tests/phase-05/mark-notifications-read.test.ts` → 21/21 green
- [x] `npx tsc --noEmit` → only new errors are the 2 expected layout.tsx argument-count errors (plan-sanctioned handoff to Plan 05)
- [x] All 6 task commits present in `git log --oneline`: 031baa3, c1d3cce, 901b5b7, 52a8541, fd7075f, 8c562e8
- [x] Zero `.todo(` or `test.todo(` entries remaining across the four phase-05 test files

---
*Phase: 05-household-notifications*
*Completed: 2026-04-19*
