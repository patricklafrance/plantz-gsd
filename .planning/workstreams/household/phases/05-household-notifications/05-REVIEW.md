---
phase: 05-household-notifications
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - prisma/migrations/20260419225747_add_household_notification_read_at/migration.sql
  - prisma/schema.prisma
  - scripts/check-notif-state.ts
  - scripts/seed-phase-05-uat.ts
  - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
  - src/app/(main)/h/[householdSlug]/layout.tsx
  - src/components/household/cycle-start-banner.tsx
  - src/components/household/fallback-banner.tsx
  - src/components/household/passive-status-banner.tsx
  - src/components/household/reassignment-banner.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/reminders/notification-bell.tsx
  - src/features/household/actions.ts
  - src/features/household/queries.ts
  - src/features/household/schema.ts
  - src/features/reminders/queries.ts
  - src/features/reminders/types.ts
  - tests/phase-05/cycle-start-banner.test.tsx
  - tests/phase-05/fallback-banner.test.tsx
  - tests/phase-05/fixtures.ts
  - tests/phase-05/get-cycle-notifications-for-viewer.test.ts
  - tests/phase-05/get-unread-cycle-event-count.test.ts
  - tests/phase-05/mark-notifications-read.test.ts
  - tests/phase-05/notification-bell-variant.test.tsx
  - tests/phase-05/passive-status-banner.test.tsx
  - tests/phase-05/reassignment-banner.test.tsx
  - tests/phase-05/reminder-gate.test.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 5 implementation is well-documented, security-conscious, and consistent with prior phases. The Server Action (`markNotificationsRead`) follows the 7-step template and correctly scopes updates to `recipientUserId = session.user.id`, which is the right boundary. Zod schemas are tight (no mass-assignment surface), and the read/unread-badge query is request-cached via `React.cache()`. Banner components are props-only and carry careful a11y (role, aria-hidden, font-semibold names). Tests cover happy path + gate + authz + idempotency paths.

Two correctness-adjacent concerns stand out:

1. `getCurrentCycle` is NOT wrapped with `React.cache()` while its siblings (`getUnreadCycleEventCount`, `getCycleNotificationsForViewer`) are — leading to 3-4 identical DB reads per dashboard request AND a latent inconsistency window where different call sites could observe different cycle rows if the cycle transitions mid-request.
2. The prior-assignee derivation in `dashboard/page.tsx` and `layout.tsx` assumes strict sequential rotation and uses the current assignee's rotation predecessor — this is correct for most real cases but will show the wrong name on manual out-of-order skips. The fallback to "Someone" prevents empty UI, but the derived name can be misleading. Documented as a D-03 tradeoff; flagging because it affects what users see.

No critical or security issues. A handful of info-level items are noted for future cleanup.

## Warnings

### WR-01: `getCurrentCycle` not request-cached — multiple duplicate DB reads per request

**File:** `src/features/household/queries.ts:54`
**Issue:** `getCurrentCycle(householdId)` is a plain async function, not wrapped with `React.cache()`. Within a single dashboard request it is called:
- Once in `src/app/(main)/h/[householdSlug]/layout.tsx:66` (inside the 4-way `Promise.all`)
- Once inside `getReminderCount(...)` at `src/features/reminders/queries.ts:23`
- Once inside `getReminderItems(...)` at `src/features/reminders/queries.ts:77`
- Once in `src/app/(main)/h/[householdSlug]/dashboard/page.tsx:154`

That is up to 4 identical `SELECT` statements per dashboard load. Its sibling queries in the same file (`getUnreadCycleEventCount`, `getCycleNotificationsForViewer`) are already wrapped with `cache()` for exactly this reason. Beyond the duplicated work, this also opens a correctness window: if a Server Action transitions the cycle between calls (e.g., `skipCurrentCycle` invoked from another tab with revalidatePath in-flight), different call sites in the same render pass could observe different cycle rows — the badge count derived from one cycle and the banner from another.

**Fix:** Wrap `getCurrentCycle` with `React.cache()` for request-level dedup and snapshot consistency:

```ts
import { cache } from "react";
// ...
export const getCurrentCycle = cache(
  async (householdId: string): Promise<Cycle | null> => {
    return db.cycle.findFirst({
      where: {
        householdId,
        status: { in: ["active", "paused"] },
      },
      orderBy: { cycleNumber: "desc" },
    });
  },
);
```

### WR-02: Prior-assignee name uses rotation predecessor of current assignee — misleading on out-of-order skips

**File:** `src/app/(main)/h/[householdSlug]/dashboard/page.tsx:215-223` and `src/app/(main)/h/[householdSlug]/layout.tsx:91-104`
**Issue:** For `cycle_reassigned_*` notifications, both sites derive "prior assignee" by taking the rotation predecessor of the *current* assignee. This works when skips follow sequential rotation order, but fails when an OWNER manually skips an out-of-order member or when multiple skips chain in one cycle. In those cases, the derived name is a real member but not the member who actually skipped — the user sees "Alice skipped" when Bob was the one who skipped. Because the banner and bell row both use this value, both surfaces will agree with each other but disagree with reality.

The fallback to `"Someone"` (line 228 and line 223 of `notification-bell.tsx`) only fires when the rotation predecessor cannot be derived at all (single-member, impossible edge case) — not when the derivation produces a wrong-but-plausible name. The schema deliberately omits a payload snapshot on `HouseholdNotification` (D-03), so the fix cannot be purely client-side.

**Fix:** Two options, in order of preference:

1. Persist the prior assignee on the notification row at emission time. Add `priorAssigneeUserId String?` to the `HouseholdNotification` schema and populate it from `transitionCycle` when emitting `cycle_reassigned_*` types. Then `getCycleNotificationsForViewer` can join on that user and return the name directly. This is the D-03 escape hatch already anticipated by the schema comment on lines 228-233.
2. If the schema change is deferred to a later phase, at minimum change the fallback copy for reassignment rows to favor the generic "Someone" whenever the rotation predecessor cannot be *proven* to be the skipper — e.g., skip the predecessor derivation entirely and always use "Someone skipped — you're covering this cycle." Less precise, but never wrong.

```prisma
// Option 1 schema change:
model HouseholdNotification {
  // ... existing fields
  priorAssigneeUserId String?
  priorAssignee       User?   @relation("HouseholdNotificationPriorAssignee", fields: [priorAssigneeUserId], references: [id], onDelete: SetNull)
}
```

## Info

### IN-01: Redundant `cycleId` filter in dashboard unread-event find

**File:** `src/app/(main)/h/[householdSlug]/dashboard/page.tsx:175`
**Issue:** `cycleNotifications.find((n) => n.readAt === null && n.cycleId === currentCycle.id)` — the `cycleId === currentCycle.id` clause is dead, because `getCycleNotificationsForViewer` already filters by the exact `cycleId` passed in. Keeping it doesn't break anything, but it signals "this value might be something else" to future readers.
**Fix:** `cycleNotifications.find((n) => n.readAt === null) ?? null`

### IN-02: `markNotificationsRead` errors silently swallowed on client

**File:** `src/components/reminders/notification-bell.tsx:69-75`
**Issue:** `startTransition(async () => { await markNotificationsRead(...) })` ignores the returned `{ error }` shape from the Server Action. The JSDoc describes this as "fire-and-forget per UI contract", which is a deliberate design choice, but if the server throws (e.g., DB outage), the user sees no feedback and unread badge counts persist until next navigation.
**Fix:** Optional — catch and log for debug visibility without surfacing to UI:
```ts
startTransition(async () => {
  const result = await markNotificationsRead({ ... });
  if ("error" in result) {
    console.warn("markNotificationsRead failed:", result.error);
  }
});
```

### IN-03: `CycleEventRow` dropdown items have no click handler / no navigation target

**File:** `src/components/reminders/notification-bell.tsx:200-252`
**Issue:** Reminder rows (lines 163-178) use `router.push(...)` to navigate to the plant detail page on click. `CycleEventRow` items render as `DropdownMenuItem` with `cursor-pointer` styling (line 228) but no `onClick` — clicking does nothing. Users who see a cursor-pointer row will expect some action on click.
**Fix:** Either remove `cursor-pointer` from the cycle event row className, or add a click handler (e.g., scroll to dashboard banner, or `router.push` to a cycle history view if one exists).

### IN-04: `check-notif-state.ts` has no error handling and non-null asserts `DATABASE_URL`

**File:** `scripts/check-notif-state.ts:4,15`
**Issue:** The debug script uses `process.env["DATABASE_URL"]!` — if `DATABASE_URL` is unset, the resulting error is unhelpful (adapter construction throws an opaque message). The companion `seed-phase-05-uat.ts` (lines 32-36) validates the env var and exits cleanly; this script should match for consistency. Additionally, `main()` has no `.catch(...)` — an unhandled rejection will exit with a non-zero code but print no context beyond the raw error.
**Fix:**
```ts
const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
// ...
main().catch((err) => { console.error(err); process.exit(1); });
```

### IN-05: `seed-phase-05-uat.ts` sets `transitionReason` even for `paused` cycles in fallback states

**File:** `scripts/seed-phase-05-uat.ts:177-178`
**Issue:** For both `fallback` and `fallback-partner` states, the cycle is created with `status: "paused"` AND `transitionReason: "all_unavailable_fallback"`. Per the Phase 3 schema comment (prisma/schema.prisma:183), `transitionReason` is nullable "on active cycles" — the semantics for paused cycles are not explicitly documented, but production `transitionCycle` writes `transitionReason` only on transitions, not on pause. This seed may produce a row shape that `transitionCycle` would never emit, which could mask bugs in banner logic that assumes the combination.
**Fix:** Cross-check production `transitionCycle` behavior for paused cycles; either align the seed to match production or add a comment documenting that this is a UAT-only synthetic shape.

### IN-06: Non-null assertion `session!.user!` in layout

**File:** `src/app/(main)/h/[householdSlug]/layout.tsx:43`
**Issue:** `const sessionUser = session!.user!;` relies on the outer `(main)/layout.tsx` having redirected unauthenticated requests. The comment is clear, but the assertion is a correctness dependency across two files; a refactor that reorders layouts could silently violate the invariant.
**Fix:** Defensive early-return instead of assertion — costs one extra if-branch but removes the cross-file coupling:
```ts
const session = await auth();
if (!session?.user?.id) {
  // Outer layout should have redirected; defensive safety net.
  redirect("/login");
}
const sessionUser = session.user;
```

---

_Reviewed: 2026-04-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
