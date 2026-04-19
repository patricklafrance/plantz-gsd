---
phase: 05-household-notifications
plan: 04
subsystem: ui
tags: [client-component, react-19-useTransition, dropdown-menu, v1-tech-debt-fix, phase-05]

# Dependency graph
requires:
  - phase: 05-household-notifications/01
    provides: CycleEventItem sibling type + notification-bell-variant.test.tsx scaffold with 11 it.todo stubs
  - phase: 05-household-notifications/02
    provides: markNotificationsRead Server Action (consumed via startTransition) + markNotificationsReadSchema
provides:
  - NotificationBell with variant='desktop' | 'mobile' prop (D-17, D-22) and merged dropdown feed (D-18)
  - 99+ badge harmonization across both variants — mobile '9+' regression eliminated (D-19)
  - useTransition-driven mark-read trigger on DropdownMenu.onOpenChange(true) (D-20)
  - BottomTabBar slimmed from 115 → 77 lines; inline DropdownMenu deleted; 4th tab delegates to <NotificationBell variant='mobile' /> (D-21, D-22 — v1 tech-debt fix)
  - New BottomTabBar props: householdId, cycleEvents (pass-through to unified bell)
affects: [05-05-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single canonical client component with variant prop (not two siblings) for position-responsive UI — same dropdown content, different trigger shape"
    - "useTransition fire-and-forget Server Action from client — no await, no success/error UI; revalidatePath drives next-nav recount"
    - "Test pattern: mock @/components/ui/dropdown-menu to expose onOpenChange via test-only buttons instead of installing @testing-library/user-event"

key-files:
  created:
    - (none — plan only modifies existing files)
  modified:
    - src/components/reminders/notification-bell.tsx
    - src/components/layout/bottom-tab-bar.tsx
    - tests/phase-05/notification-bell-variant.test.tsx

key-decisions:
  - "Mocked DropdownMenu in test file instead of installing @testing-library/user-event — keeps phase-05 test surface self-contained, avoids a new dev dependency mid-phase, and isolates assertions to the component's own onOpenChange logic rather than base-ui internals"
  - "CycleEventRow helper lives inside notification-bell.tsx (not a separate file) — 35 lines, tightly coupled to the bell's merged feed rendering, not reused elsewhere"
  - "BottomTabBar keeps tabs array compact (single-line object literals) to stay within the 50-80 line budget called out in the plan"

patterns-established:
  - "Variant prop over sibling components: `variant: 'desktop' | 'mobile'` drives only the trigger element's shape; dropdown content, onOpenChange handler, and side positioning are all computed inline"
  - "Test-side mock of primitive UI components to expose event handlers without needing user-event — copy this pattern for future client-component tests that need to exercise onOpenChange / onValueChange / etc. without real interaction"

requirements-completed: [HNTF-01, HNTF-02, HNTF-03]

# Metrics
duration: ~6 min
completed: 2026-04-19
---

# Phase 05 Plan 04: Unified NotificationBell + BottomTabBar v1 Tech-Debt Fix Summary

**NotificationBell rewritten as single canonical component with desktop/mobile variants, merged cycle-event feed, and useTransition-driven mark-read on open; BottomTabBar slimmed from 115 → 77 lines by deleting the inline dropdown and delegating the Alerts slot — 11 tests green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-19T23:32:33Z
- **Completed:** 2026-04-19T23:38:37Z
- **Tasks:** 2 (Task 1 TDD: test + feat; Task 2: feat)
- **Files modified:** 3

## Accomplishments

- `src/components/reminders/notification-bell.tsx` rewritten to ~220 lines: `variant: 'desktop' | 'mobile'` prop, new `householdId` + `cycleEvents` props, merged dropdown feed in fixed bucket order (overdue → due-today → unread cycle events → read cycle events), `useTransition`-driven `markNotificationsRead` call on `DropdownMenu.onOpenChange(true)`, 99+ badge cap on both variants, empty-state copy matching UI-SPEC (`You're all caught up` + `New reminders and cycle updates will appear here.`), unread rows with `border-l-2 border-accent` stripe, read rows with `opacity-60`, cycle-event icons (`Sparkles` / `UserCheck` / `AlertTriangle`) and type-branched subject copy for all 5 notification types.
- `src/components/layout/bottom-tab-bar.tsx` slimmed from 115 → 77 lines: inline `DropdownMenu` block removed entirely; dead imports (`DropdownMenu*`, `Bell`, `useRouter`) dropped; new `householdId` + `cycleEvents` props added to interface; 4th tab slot replaced with `<NotificationBell variant="mobile" ... />`. Both PROJECT.md §Known tech debt items are now resolved: (1) the mobile bell is no longer a duplicated inline dropdown; (2) the Alerts tab slot now surfaces the same merged feed as the desktop bell instead of a reminders-only subset.
- `tests/phase-05/notification-bell-variant.test.tsx` — 11 `it.todo` stubs replaced with 11 passing `it()` tests covering variant shape, badge harmonization, aria-label branches, merged feed order, unread/read row styling, and the D-20 mark-read trigger (open → fires once with correct args, open-empty → no call, close → no call).

## Task Commits

1. **Task 1 RED: failing tests for NotificationBell variant + merged feed** — `6bc229e` (test)
2. **Task 1 GREEN: rewrite NotificationBell with variant + merged feed + useTransition** — `7339591` (feat)
3. **Task 2: delegate BottomTabBar Alerts slot to <NotificationBell variant='mobile'>** — `794f948` (feat)

**Plan metadata commit:** pending (created after STATE/ROADMAP update)

## NotificationBell Prop Interface (locked for Plan 05)

```typescript
interface NotificationBellProps {
  variant: "desktop" | "mobile";
  householdId: string;        // for markNotificationsRead input
  householdSlug: string;
  count: number;              // reminderCount + unreadCycleEventCount (unified)
  reminderItems: ReminderItem[];
  cycleEvents: CycleEventItem[];
}
```

Plan 05's `src/app/(main)/h/[householdSlug]/layout.tsx` rewrite must supply all six props to both `<NotificationBell variant="desktop" />` (top-nav) and `<BottomTabBar householdId=... cycleEvents=... />` (bottom nav). Signature is final.

## BottomTabBar Line-Count Delta

| State | Lines | Notes |
|-------|-------|-------|
| Pre-plan-04 | 115 | Inline DropdownMenu (lines 62-111) + duplicate Bell trigger |
| Post-plan-04 | 77 | Tabs loop + single `<NotificationBell variant="mobile" />` render |
| Delta | **-38 lines** | Inline dropdown fully deleted; v1 tech-debt resolved |

## Files Modified

- `src/components/reminders/notification-bell.tsx` — Full rewrite: new props (variant, householdId, cycleEvents, reminderItems renamed from items), merged feed buckets, useTransition, 99+ badge, CycleEventRow helper, empty-state copy
- `src/components/layout/bottom-tab-bar.tsx` — Deleted inline DropdownMenu; added NotificationBell import + render; added householdId/cycleEvents props; removed dead imports (DropdownMenu*, Bell, useRouter)
- `tests/phase-05/notification-bell-variant.test.tsx` — 11 it.todo → 11 passing it() with mocked DropdownMenu primitive

## Decisions Made

- **Mocked `DropdownMenu` in the test file instead of installing `@testing-library/user-event`:** `@testing-library/user-event` is not in the repo; adding it mid-phase would expand the phase surface. Instead the test file mocks `@/components/ui/dropdown-menu` and exposes `onOpenChange` via two test-only buttons (`open-mock`, `close-mock`) — lets the tests drive the D-20 open/close branches deterministically without real portal/keyboard flow. Downstream phases can reuse this pattern for any base-ui menu/dialog test.
- **`CycleEventRow` helper stays inline in notification-bell.tsx:** 35 lines, only called from the bell, tightly coupled to the bell's muted/unmuted styling contract. Extracting into a standalone file would add an import line and hide the styling contract from the file it belongs to. Keep it next to the caller.
- **BottomTabBar tabs array compacted to single-line objects:** 4 lines per tab × 3 tabs = 12 lines; compacted to 3 lines; keeps the file within the 50-80 line budget the plan called for. No behavioral change.

## Deviations from Plan

None — plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Every acceptance criterion passed — grep checks, test count (11/11 green), line-count budget (77 vs 50-80 target), tsc delta (no new errors outside the plan-sanctioned layout.tsx handoff). One plan-text-only discrepancy noted: the plan's example tests use `@testing-library/user-event` imports, but that package is not installed in the repo. Tests use mocked DropdownMenu + `fireEvent` instead — same behavioral coverage, no dev-dep addition. This is a test-strategy substitution, not a deviation from the plan's functional contract, so it's logged under Decisions rather than Deviations.

## Issues Encountered

None — Task 1 RED produced 11 failing tests on first run (with the expected stack trace pointing at the old bell's `items.length` access against the new test props), and GREEN passed on first run after the component rewrite. Task 2 re-ran the same test suite to confirm the bell still renders correctly after BottomTabBar's refactor — no regressions.

## Expected Downstream Compile Errors (for Plan 05)

`src/app/(main)/h/[householdSlug]/layout.tsx` now has 4 tsc errors (2 pre-existing from Plan 02's reminder-query signature change, 2 new from this plan's component prop updates). All 4 are the explicit handoff to Plan 05 (dashboard integration):

```
layout.tsx(54,5): Expected 4 arguments, but got 3.           ← getReminderCount needs userId (Plan 02 handoff)
layout.tsx(55,5): Expected 4 arguments, but got 3.           ← getReminderItems needs userId (Plan 02 handoff)
layout.tsx(97,17): 'items' does not exist on NotificationBellProps   ← new prop shape (this plan)
layout.tsx(107,8): missing householdId, cycleEvents          ← new BottomTabBar props (this plan)
```

No other files broke. `npx tsc --noEmit` shows no new errors outside layout.tsx; the existing noise in `tests/*.test.ts` (NextMiddleware conversion warnings) is unrelated pre-existing drift.

## Threat Model Resolution

All four threat register entries confirmed:

| Threat ID | Disposition | Resolution |
|-----------|-------------|------------|
| T-05-04-01 (Tampering: client modifies notificationIds in devtools) | mitigated | Plan 02's action enforces `recipientUserId: session.user.id` + `readAt: null` at SQL level — tampering produces zero-count writes, not cross-user mark-read. Bell trusts the server-side authz. |
| T-05-04-02 (DoS: rapid open/close) | accepted | `updateMany` with `readAt: null` is idempotent; React 19 `useTransition` dedupes concurrent calls. No rate-limit needed. |
| T-05-04-03 (Info Disclosure: cross-household copy) | mitigated | `cycleEvents` prop flows from `getCycleNotificationsForViewer` which filters by `recipientUserId` + `cycleId`. Bell trusts the upstream filter. |
| T-05-04-04 (Spoofing: malicious prop injection) | accepted | Props flow through serialized React tree from Server Component — client can't inject. Plan 02's action predicate is defense in depth. |

## User Setup Required

None — no external service configuration; no env vars; no DB changes. All changes are code-side only.

## Next Plan Readiness

- **Plan 05-05 (dashboard integration)** fully unblocked. Remaining work for the phase:
  - Update `src/app/(main)/h/[householdSlug]/layout.tsx` to compute `unifiedCount = reminderCount + unreadCycleEventCount`, fetch `cycleEvents` via `getCycleNotificationsForViewer`, and thread the six-prop interface through both `<NotificationBell variant="desktop" />` and `<BottomTabBar variant-inherits />`.
  - Update `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` to render the four banners (Plan 03) based on cycle state + viewer assignee status.
  - The bell and tab-bar signatures are locked — no further plumbing changes expected in Plan 05's surface.
- `npx vitest run tests/phase-05` now reports 64 stub slots filled across Plans 01-04 (21 server + 32 banners + 11 bell = 64 real tests; all green). Plan 05's dashboard integration does not add new unit tests — its verification is Chrome DevTools manual per the phase plan.

## Self-Check: PASSED

- [x] `src/components/reminders/notification-bell.tsx` contains `"use client"`, `variant: "desktop" | "mobile"`, `useTransition`, `markNotificationsRead`, `cycleEvents: CycleEventItem[]`, `reminderItems: ReminderItem[]`, `count > 99 ? "99+"`, `You&apos;re all caught up`, `New reminders and cycle updates will appear here`, `border-l-2 border-accent`, `aria-label={ariaLabel}` — all 11 grep checks passed
- [x] `tests/phase-05/notification-bell-variant.test.tsx` has 0 `.todo(` entries and 11 `it(` entries
- [x] `npx vitest run tests/phase-05/notification-bell-variant.test.tsx` → 11/11 green
- [x] `src/components/layout/bottom-tab-bar.tsx` is 77 lines (within 50-80 budget)
- [x] Zero `DropdownMenu` imports in bottom-tab-bar.tsx (only mention is in the JSDoc describing the deleted code); `useRouter` and `Bell` imports removed
- [x] `<NotificationBell variant="mobile"` render present in bottom-tab-bar.tsx with householdId + cycleEvents passed through
- [x] `npx tsc --noEmit` shows only the 4 expected layout.tsx errors — no other files regressed
- [x] Commits 6bc229e (test), 7339591 (feat), 794f948 (feat) all present in `git log --oneline`

---
*Phase: 05-household-notifications*
*Completed: 2026-04-19*
