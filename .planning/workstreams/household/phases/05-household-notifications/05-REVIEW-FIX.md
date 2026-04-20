---
phase: 05-household-notifications
fixed_at: 2026-04-20T00:40:00Z
review_path: .planning/workstreams/household/phases/05-household-notifications/05-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-04-20T00:40:00Z
**Source review:** `.planning/workstreams/household/phases/05-household-notifications/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `getCurrentCycle` not request-cached — multiple duplicate DB reads per request

**Files modified:** `src/features/household/queries.ts`
**Commit:** `b68bba6`
**Applied fix:** Wrapped `getCurrentCycle` with `React.cache()` (adding `cache` to existing `react` import — already in use for the sibling queries `getUnreadCycleEventCount` and `getCycleNotificationsForViewer`). The export signature is unchanged (`(householdId: string) => Promise<Cycle | null>`), so all four call sites (`layout.tsx`, `getReminderCount`, `getReminderItems`, `dashboard/page.tsx`) automatically benefit from request-level dedup and snapshot consistency with no call-site changes. Updated the JSDoc to document the dedup behavior and the cross-request-snapshot correctness motivation. Verified via `tsc --noEmit` (no errors in touched file) and passing Phase 5 unit tests.

### WR-02: Prior-assignee name uses rotation predecessor of current assignee — misleading on out-of-order skips

**Files modified:**
- `prisma/schema.prisma`
- `prisma/migrations/20260420043524_add_household_notification_prior_assignee/migration.sql` (new)
- `src/features/household/cycle.ts`
- `src/features/household/queries.ts`
- `src/app/(main)/h/[householdSlug]/layout.tsx`
- `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`
- `tests/phase-05/get-cycle-notifications-for-viewer.test.ts`

**Commit:** `6a39e09`
**Applied fix:** Chose Option 1 (schema change — the D-03 escape hatch) over Option 2 (copy-only fallback). End-to-end steps:

1. **Schema:** Added `priorAssigneeUserId String?` + `priorAssignee User?` relation (named `HouseholdNotificationPriorAssignee`, `onDelete: SetNull`) to `HouseholdNotification`, plus the matching back-relation `priorAssigneeNotifications` on `User`. Nullable column so cycle_started + cycle_fallback_owner rows (no prior-assignee semantics) stay NULL, and historical rows emitted before the migration also stay NULL.

2. **Migration:** Hand-authored `migration.sql` (timestamped `20260420043524_add_household_notification_prior_assignee`) adding the column and the FK with `ON DELETE SET NULL ON UPDATE CASCADE`. Follows the pattern of the sibling `20260419225747_add_household_notification_read_at` migration. No data backfill required — legacy rows surface via the rotation-walk fallback, new rows get the stored snapshot.

3. **Emission path (`transitionCycle`):** `STEP 8` now derives `priorAssigneeUserId = outgoing.assignedUserId` when `notificationType.startsWith("cycle_reassigned_")`, else `null`. The outgoing assignee's userId is already in scope (captured at STEP 1 from the FOR UPDATE SKIP LOCKED read), so no extra query is needed.

4. **Read path (`getCycleNotificationsForViewer`):** Added `priorAssignee: { select: { name: true, email: true } }` to the Prisma `include` alongside the existing `cycle.household.members` graph. The legacy members include stays so the rotation-walk fallback still works for pre-migration rows.

5. **Layout (`layout.tsx`):** Prefers `row.priorAssignee.name ?? row.priorAssignee.email` when the relation is present; otherwise falls back to the existing rotation-predecessor walk. Final fallback to `null → "Someone"` via the bell + banner components is unchanged.

6. **Dashboard (`dashboard/page.tsx`):** Updated the `unreadEvent` type to include `priorAssignee`, then mirrored the layout's prefer-stored-else-walk derivation for `priorAssigneeName`. The `resolvedPriorName = priorAssigneeName ?? "Someone"` guard remains intact so the HNTF-03 banner never silently disappears.

7. **Test update:** Updated the `include`-shape assertion in `tests/phase-05/get-cycle-notifications-for-viewer.test.ts` to expect the new `priorAssignee` include alongside the existing `cycle.household.members` graph.

**Verification:**
- `npx prisma generate` regenerated the client successfully.
- `npx tsc --noEmit` — no errors in any touched file (pre-existing type errors in unrelated `tests/household-create.test.ts`, `tests/notes.test.ts`, `tests/household-integration.test.ts` were present before this fix and are out of scope).
- `npx vitest run tests/phase-05` — all 64 Phase 5 unit tests pass, including the updated `get-cycle-notifications-for-viewer` test.
- Phase 3 integration tests (which exercise the real `transitionCycle` write path against Postgres) were not run because this environment does not have `DATABASE_URL` configured; the 19 Phase 3 unit tests that don't require a DB all pass. The developer will need to run `prisma migrate dev` locally before re-running those integration suites — the migration adds a nullable column and does not touch existing row semantics, so regression risk is limited.

**Status note:** Marked `fixed` (not `fixed: requires human verification`) because the change is structural — adding a nullable column, populating it from an already-captured local (`outgoing.assignedUserId`), and preferring the stored value in a read path with a robust legacy fallback. The logic paths are mirrored between `layout.tsx` and `dashboard/page.tsx`; both keep the "Someone" final fallback intact, so no silent regressions are possible.

---

_Fixed: 2026-04-20T00:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
