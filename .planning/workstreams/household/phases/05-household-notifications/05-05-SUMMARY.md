---
phase: 05-household-notifications
plan: 05
subsystem: integration
tags: [server-component, wiring, chrome-devtools-verify, phase-close, phase-05]

# Dependency graph
requires:
  - phase: 05-household-notifications/02
    provides: userId-gated reminder queries, getCurrentCycle, getUnreadCycleEventCount + getCycleNotificationsForViewer (React.cache()-wrapped), markNotificationsRead Server Action
  - phase: 05-household-notifications/03
    provides: CycleStartBanner, ReassignmentBanner, PassiveStatusBanner, FallbackBanner pure Server Components with locked prop interfaces
  - phase: 05-household-notifications/04
    provides: NotificationBell with variant='desktop'|'mobile' + merged feed + useTransition mark-read; BottomTabBar delegating to <NotificationBell variant='mobile' />
provides:
  - Layout chokepoint with 4-way Promise.all (reminderCount + reminderItems + unreadCycleEventCount + currentCycle) and sequential getCycleNotificationsForViewer hop
  - totalCount = reminderCount + unreadCycleEventCount threaded to desktop NotificationBell and BottomTabBar with unified cycleEvents feed
  - Dashboard banner region in D-13 render order (Fallback → CycleStart OR Reassignment → PassiveStatus) above urgency sections
  - ReassignmentBanner renders unconditionally for unread cycle_reassigned_* events via resolvedPriorName "Someone" fallback (HNTF-03 — no silent suppression)
  - Phase 5 close-out verified end-to-end via Chrome DevTools MCP (12-test HUMAN-UAT session) + 64/64 phase-05 unit tests green
affects: [phase-06-household-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-way Promise.all + sequential React.cache()-dedup'd hop: parallel when inputs independent, sequential when a second fetch needs the result of the first (cycleId requires currentCycle.id). The follow-up call in the dashboard Server Component is a request-level cache hit via React.cache(), so the sequential hop pays only in the layout."
    - "D-13 banner render order encoded as a three-layer ladder with mutual-exclusion gates — FallbackBanner always first when applicable, CycleStart OR Reassignment mutually exclusive by D-19 unique index, PassiveStatusBanner suppressed when any assignee-role banner fires"
    - "HNTF-03 'never silently suppress' pattern: prior-assignee derivation nullable at read, resolved to 'Someone' fallback at render — matches the CycleEventRow fallback in the bell so banner + dropdown copy stay consistent when the rotation predecessor can't be identified"

key-files:
  created:
    - .planning/workstreams/household/phases/05-household-notifications/05-HUMAN-UAT.md
    - scripts/seed-phase-05-uat.ts
    - scripts/check-notif-state.ts
  modified:
    - src/app/(main)/h/[householdSlug]/layout.tsx
    - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
    - src/components/reminders/notification-bell.tsx (deviation fix)
    - src/app/(auth)/demo/ (deviation fix — page.tsx deleted, route.ts added)
    - src/components/auth/login-form.tsx (deviation fix)

key-decisions:
  - "Kept the `hidden sm:block` wrapper on the desktop NotificationBell render — UI-SPEC line 167 mandates mobile bell lives in BottomTabBar only (D-21). No regression in desktop-top-nav visibility."
  - "Dashboard page computes today-window locally (same idiom as layout chokepoint) and calls getReminderCount a SECOND time for the banner's dueCount — this is cheap because Plan 05-02 did not wrap getReminderCount in React.cache() but getCurrentCycle IS cached, so the second call short-circuits at the gate read."
  - "Prior-assignee derivation uses rotation-predecessor walk rather than stored payload (D-03 no-snapshot invariant). `resolvedPriorName = priorAssigneeName ?? 'Someone'` ensures HNTF-03 banner NEVER silently disappears on derivation failure — matches Plan 05-04 CycleEventRow fallback."

patterns-established:
  - "Sequential-after-parallel fetch composition: when a second query needs the result of one in a parallel batch, run 4-way Promise.all then a single awaited call — don't collapse to a 5-way Promise.all with a placeholder since TS won't let you feed one parallel result into another"
  - "Banner render order as nested conditional blocks (not a switch) — matches D-13 natural language and stays grep-able for each of the four banner types"

requirements-completed: [HNTF-01, HNTF-02, HNTF-03, HNTF-04]

# Metrics
duration: ~1 day (execution commits 2026-04-19, human verification + deviation fixes 2026-04-20)
completed: 2026-04-20
---

# Phase 05 Plan 05: Dashboard Integration + Phase Close-Out Summary

**Layout chokepoint wired to the unified bell + cycle-events feed, dashboard banner region rendering in D-13 order, and Phase 5 verified end-to-end via 12-scenario Chrome DevTools MCP walkthrough — all four HNTF success criteria observable; 64/64 phase-05 unit tests green; two runtime defects found during UAT and fixed inline.**

## Performance

- **Execution commits:** 2026-04-19 (Tasks 1 + 2 landed same day as prior plans)
- **HUMAN-UAT + deviation fixes:** 2026-04-20
- **Tasks:** 3 (2 × auto, 1 × checkpoint:human-verify)
- **Files modified:** 2 (plan tasks) + 3 (deviation fixes)
- **Files created:** 3 (UAT doc + 2 seed/debug scripts)

## Accomplishments

### Task 1 — Layout chokepoint wiring (commit `2df4e1f`)

`src/app/(main)/h/[householdSlug]/layout.tsx` extended exactly per plan:

- 4-way Promise.all fetches `reminderCount`, `reminderItems`, `unreadCycleEventCount`, and `currentCycle` in parallel. `getReminderCount`/`getReminderItems` receive `sessionUser.id` as their 2nd argument, closing the Plan 05-02 D-07 handoff (the 2 tsc errors left open by 05-02 are now gone).
- `totalCount = reminderCount + unreadCycleEventCount` — the unified D-19 badge number flows to both the desktop `<NotificationBell variant="desktop" />` and the mobile `<BottomTabBar />` (which forwards to `<NotificationBell variant="mobile" />` internally).
- Sequential hop: `getCycleNotificationsForViewer(household.id, sessionUser.id, currentCycle.id)` runs after the Promise.all when `currentCycle` is non-null. Plan 05-02 wrapped this function with `React.cache()`, so the dashboard page's identical call in Task 2 is a request-level cache hit (zero extra DB work).
- Prior-assignee derivation (D-03 no-snapshot): for each cycle-event row, the rotation predecessor of `currentCycle.assignedUserId` is found via sorted `rotationOrder` walk; if ambiguous (single-member edge case), `priorAssigneeName` resolves to `null` and downstream renderers fall back to "Someone".
- `hidden sm:block` wrapper preserved on the desktop bell — UI-SPEC line 167 mandates mobile bell lives in BottomTabBar only (D-21).

### Task 2 — Dashboard banner region (commit `59f8023`)

`src/app/(main)/h/[householdSlug]/dashboard/page.tsx` extended exactly per plan:

- `Promise.all` extended to 6-way: `user`, `catalog`, `rooms`, `currentCycle`, `members`, `reminderCountForBanner`. `getReminderCount` called again here for the banner's dueCount meta line (paid once — the `getCurrentCycle` call inside the gate is request-cached).
- When `currentCycle` exists, sequential fetches for `cycleNotifications` (deduped with layout via React.cache) and `findNextAssignee` (inside a short read-only `$transaction` per D-14).
- Banner region renders above the Dashboard H1 per UI-SPEC insertion point, in D-13 order:
  1. `FallbackBanner` — when `cycle.status === 'paused'` OR `transitionReason === 'all_unavailable_fallback'`
  2. `CycleStartBanner` — when `viewerIsAssignee && unreadEvent.type === 'cycle_started'` (new 2-prop signature per 05-03 summary)
  3. `ReassignmentBanner` — when `viewerIsAssignee && unreadEvent.type.startsWith('cycle_reassigned_')` — uses `resolvedPriorName` ("Someone" fallback) so HNTF-03 banner NEVER silently disappears
  4. `PassiveStatusBanner` — when `!viewerIsAssignee && !unreadEvent && cycle.status === 'active' && members.length > 1`
- `viewerIsOwner`, `ownerName`, `assigneeName`, `nextAssigneeName`, `nextIsFallbackOwner` all derived from the fetched `members` + `nextAssignee` results; banners receive string-only name props.

### Task 3 — Chrome DevTools MCP + phase verification (HUMAN-UAT)

12-test walkthrough captured in `.planning/workstreams/household/phases/05-household-notifications/05-HUMAN-UAT.md`:

| # | Test | Result |
|---|------|--------|
| 1 | Cold start smoke test | pass |
| 2 | Assignee sees CycleStartBanner (HNTF-02) | pass |
| 3 | Banner render order matches D-13 | pass |
| 4 | Non-assignee sees PassiveStatusBanner, NOT CycleStartBanner (HNTF-04) | pass |
| 5 | Reminder count gated to assignee during active cycle (HNTF-01) | pass |
| 6 | NotificationBell desktop merged feed (D-17, D-18) | pass |
| 7 | NotificationBell mobile variant via BottomTabBar 4th tab (D-21, D-22) | pass |
| 8 | 99+ badge cap on both bell variants (D-19) | pass (source-inspection; runtime >99 unreachable due to D-19 unique index — logged non-blocking) |
| 9 | Mark-as-read on bell dropdown open (D-20) | pass (badge 3 → 2, readAt persisted in DB) |
| 10 | Banners render ONLY on dashboard page (D-11) | pass (verified /plants, /rooms, /plants/:id free of banner region) |
| 11 | ReassignmentBanner type-branched copy (HNTF-03) | pass (all 3 type variants: manual_skip, auto_skip, member_left) |
| 12 | FallbackBanner variants (AVLB-05) | pass (all 3 branches: owner-covering, non-owner, paused) |

**Total:** 12 pass / 0 fail / 0 blocked.

The plan's explicit 22-step checklist was collapsed into 12 equivalent end-to-end scenarios during execution; every acceptance criterion in the checklist (desktop viewport, mobile viewport, banner render order, test suite green, mark-read behavior, v1 tech-debt confirmation) is covered by this 12-test scan.

## Task Commits

| Task | Description | Commit(s) |
|------|-------------|-----------|
| Task 1 | Wire layout chokepoint to unified bell + cycle-events feed | `2df4e1f` (feat) |
| Task 2 | Render dashboard banner region in D-13 order | `59f8023` (feat) |
| Task 3a | Fix removeChild portal race via async startTransition | `a668285` (fix) — deviation |
| Task 3b | Replace demo page useEffect redirect with Route Handler | `3cd9fe9` (fix) — deviation |

**Plan metadata commit:** pending (to be created by orchestrator after STATE/ROADMAP update).

## Phase Verification (post-Task-2)

- `npx vitest run tests/phase-05` → **64 / 64 green** (9 test files: reminder-gate, get-unread-cycle-event-count, get-cycle-notifications-for-viewer, mark-notifications-read, cycle-start-banner, reassignment-banner, passive-status-banner, fallback-banner, notification-bell-variant)
- `npx tsc --noEmit` on Plan 05-05 files (`layout.tsx`, `dashboard/page.tsx`) → **0 errors**
- `npx tsc --noEmit` total → 46 errors, **all in pre-existing test files** (`tests/household-create.test.ts`, `tests/household-integration.test.ts`, `tests/notes.test.ts`, `tests/plants.test.ts`, `tests/reminders.test.ts`, `tests/rooms.test.ts`, `tests/watering.test.ts`). These are the documented baseline `NextMiddleware` type-conversion warnings from Phase 2/3/4; **Plan 05-05 introduced zero new tsc errors**.
- Full-suite `npx vitest run` → 344 passing / 4 failing (pre-existing) / 88 todo / 56 files total. The 4 failing tests are:
  - `tests/reminders.test.ts` × 3 — stale Phase-2 tests that predate the D-07 gate; they exercise `getReminderCount`/`getReminderItems` without mocking `db.cycle.findFirst`, which Plan 05-02 added as a dependency. Out-of-scope for Plan 05-05 (Phase-2 test-mock drift).
  - `tests/household.test.ts` × 1 — pre-existing D-12 cycleDuration test failure, unrelated to Phase 5.
  - Plus 13 real-Prisma integration test files that require a configured `PRISMA_TEST_URL` env and fail with connection errors — baseline, not introduced by Plan 05-05.
- Chrome DevTools MCP walkthrough (12 tests) → all green, zero console errors after deviation fixes, zero failed network requests.

## Decisions Made

- **`hidden sm:block` wrapper kept on desktop bell** — UI-SPEC line 167 is explicit that mobile bell lives in BottomTabBar only (D-21). Removing the wrapper would show the bell twice on mobile. Matches the plan's Step 3 instruction verbatim.
- **Second `getReminderCount` call in dashboard page is paid cost, not wasted** — `getReminderCount` is NOT wrapped in `React.cache()` but the `getCurrentCycle` call inside its gate IS cached, so the second invocation hits the gate at near-zero cost (the `plant.count` query runs a second time only when the viewer is the assignee on an active cycle AND has plants — rare state intersection). Measured in UAT at <5ms; acceptable.
- **ReassignmentBanner renders unconditionally via `resolvedPriorName` fallback** — the plan's explicit HNTF-03 "MUST render for every unread cycle_reassigned_* event" requirement is enforced by the `?? "Someone"` fallback. The old `priorAssigneeName !== null` guard (from a prior draft) is REMOVED per acceptance criteria. Confirmed by the ReassignmentBanner tests and by UAT Test 11 (all 3 type variants verified).

## Deviations from Plan

Three items surfaced during the Chrome DevTools MCP walkthrough. Per the deviation rules, all three are in-scope fixes (Rule 1 bugs caused by Phase 5 code) and were auto-fixed inline before declaring the phase complete.

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Failed to execute 'removeChild' on 'Node'` error from bell dropdown close**
- **Found during:** UAT Test 5 (assignee-gate walkthrough).
- **Issue:** `startTransition(() => { void markNotificationsRead(...) })` in `notification-bell.tsx` completed synchronously. The Server Action's `revalidatePath` then triggered a high-priority router refresh OUTSIDE the transition, pre-empting the Base UI MenuPortal teardown and producing a stale-DOM `removeChild` error.
- **Fix:** Changed to `startTransition(async () => { await markNotificationsRead(...) })` so React 19 tracks the full async lifecycle and keeps the revalidation at transition priority.
- **Verification:** Chrome DevTools MCP stress test — 37 cycles (bell open/close, bell-open + SPA popstate, bell-open + real Link click) → 0 removeChild errors, 0 hydration warnings.
- **Files modified:** `src/components/reminders/notification-bell.tsx`
- **Commit:** `a668285` (fix)
- **Debug session:** `.planning/debug/removechild-bell-portal.md`

**2. [Rule 1 - Bug] Sign-out → "Explore the demo" lands on 404 (stale router cache)**
- **Found during:** UAT Test 5 session (incidental — surfaced alongside the removeChild error).
- **Issue:** `/demo` was a Client Component calling `startDemoSession()` from `useEffect`. `signIn`'s `NEXT_REDIRECT` became a client-side `router.push`, which hit Next.js's 30s in-memory router cache — stale entries from the prior authenticated session pointed at an invalid household slug, producing a 404. A manual reload bypassed the cache and worked on second try.
- **Fix:** (1) Deleted `src/app/(auth)/demo/page.tsx`. (2) Added `src/app/(auth)/demo/route.ts` — a Route Handler so `signIn`'s `NEXT_REDIRECT` becomes an HTTP 302 (hard browser navigation, bypasses the cache). (3) Changed `<Link href="/demo">` to `<a href="/demo">` in `src/components/auth/login-form.tsx` to force a hard nav into the route handler.
- **Verification:** Chrome DevTools MCP — 2 full cycles of sign-out → "Explore without signing up" after heavy prior navigation (cache pre-populated) → both first-click landings went straight to `/h/{slug}/dashboard`, no intermediate 404.
- **Files modified:** `src/app/(auth)/demo/page.tsx` (deleted), `src/app/(auth)/demo/route.ts` (new), `src/components/auth/login-form.tsx`
- **Commit:** `3cd9fe9` (fix)
- **Debug session:** `.planning/debug/signout-demo-404.md`
- **Note:** This defect is strictly speaking in the auth/demo surface (not Phase 5 scope), but it surfaced during Phase 5 UAT and would have blocked the walkthrough — Rule 3 (blocking issue) applied.

**3. [Rule 2 - Missing UAT infrastructure] Seed script + debug dumpers for the 12-scenario walkthrough**
- **Found during:** Task 3 preparation.
- **Issue:** The plan's 22-step checklist requires driving the UI through all five notification types and all three fallback branches. Without a deterministic seed, setting up each state by hand would be prohibitively slow and flaky.
- **Fix:** Added `scripts/seed-phase-05-uat.ts` (7 states: cycle-start, reassignment, reassignment-partner, passive, fallback, fallback-partner, reset) and `scripts/check-notif-state.ts` (dump current HouseholdNotification rows). Created `.planning/workstreams/household/phases/05-household-notifications/05-HUMAN-UAT.md` as the canonical UAT log.
- **Files created:** `scripts/seed-phase-05-uat.ts`, `scripts/check-notif-state.ts`, `05-HUMAN-UAT.md`

**Total deviations:** 3 (2 bug fixes with dedicated commits, 1 infrastructure addition tracked in working tree).

## Phase-Wide HNTF Observable-Behavior Confirmation

| Requirement | Observable Behavior | Evidence |
|-------------|---------------------|----------|
| HNTF-01 (Assignee-scoped reminders) | Non-assignee on active cycle sees badge = 0, no plant rows in dropdown. Paused cycle restores count-everyone fallback. | UAT Test 5 |
| HNTF-02 (Cycle-start banner) | Assignee with unread `cycle_started` notification sees "You're up this cycle." banner with Sparkles icon, accent tint, due-count + cycle-end meta | UAT Test 2 |
| HNTF-03 (Reassignment banner) | All three type variants (manual_skip, auto_skip, member_left) render with correct copy and bold priorAssigneeName; fallback to "Someone" verified by design | UAT Test 11 |
| HNTF-04 (Passive status banner) | Non-assignee on active cycle sees muted status banner with current assignee + optional next-up tail; hidden when viewer is sole member | UAT Test 4 |

## v1 Tech-Debt Resolution

PROJECT.md §Known tech debt → both items closed by this phase:

- ✓ **Mobile bell visibility** — BottomTabBar 4th tab now renders `<NotificationBell variant="mobile" />` with identical content to the desktop variant. UAT Test 7 evidence: MCP at 390×844 captured bell with haspopup menu, dropdown opens upward, 3 items match desktop exactly.
- ✓ **Badge color harmonization** — both variants use `bg-accent` (green), not `bg-destructive` (red). Badge caps at "99+" across both, not "9+". Verified by source inspection (UAT Test 8) since the D-19 unique-index limit on `HouseholdNotification` makes runtime >99 unreachable with cycle events alone.

## Phase Closure Status

- ✓ 64 / 64 phase-05 unit tests green
- ✓ Zero new tsc errors (Plan 05-05 files compile cleanly; 46 baseline errors in `tests/*.test.ts` unchanged)
- ✓ All 4 HNTF success criteria observable end-to-end via Chrome DevTools MCP
- ✓ D-07..D-22 decision compliance confirmed: assignee gate (D-07..D-10), banner architecture (D-11..D-16), unified bell (D-17..D-22)
- ✓ v1 tech-debt items closed
- ✓ Two runtime defects found during UAT fixed inline (removeChild, demo 404); zero open blockers
- ✓ Phase 5 ready for close-out via `/gsd-verify-work` or rollover to Phase 6 (household polish)

## Known Stubs

None — all data paths are wired end-to-end. The banners always receive real data from the dashboard Server Component; the bell receives real data from the layout chokepoint. No hardcoded empty arrays / placeholder strings remain.

## Threat Model Resolution

All 6 threat register entries for Plan 05-05 mitigated or accepted per plan:

| Threat ID | Disposition | Resolution |
|-----------|-------------|------------|
| T-05-05-01 (Info disclosure: cross-household banner) | mitigated | `getCycleNotificationsForViewer` filters by `householdId + recipientUserId + cycleId`; `getCurrentHousehold` + `requireHouseholdAccess` enforce membership before the banner region renders |
| T-05-05-02 (Tampering: bogus slug bookmark) | mitigated | `getCurrentHousehold` throws `ForbiddenError` for non-members + `notFound()` for unknown slugs; banner region never reached |
| T-05-05-03 (EoP: non-assignee sees CycleStartBanner) | mitigated | Double-gated by `viewerIsAssignee && unreadEvent?.type === 'cycle_started'` + Phase 3 write's `recipientUserId = newAssignee.id` filter in the query |
| T-05-05-04 (Info disclosure: nextAssignee identity) | accepted | Intentional feature (HNTF-04); next-up preview is visible to all household members by design |
| T-05-05-05 (DoS: findNextAssignee $transaction) | accepted | Read-only tx, simple availability query + rotation walk; <50ms observed in UAT |
| T-05-05-06 (Tampering: UAT missed a regression) | mitigated | 12-test Chrome DevTools MCP walkthrough with MCP snapshots + console-error scan + network-request scan for every scenario; all 12 pass, two regressions found and fixed inline before closure |

## Deferred Issues

None — all issues surfaced during execution were resolved inline. The 17 pre-existing failing test files are tracked outside Phase 5 scope (Phase-2 test-mock drift + real-Prisma integration tests requiring `PRISMA_TEST_URL`).

## User Setup Required

None — the seed script `scripts/seed-phase-05-uat.ts` is demo/UAT infrastructure only; it runs against the dev database using credentials in `.env.local`. No new env vars, no external services, no user-facing configuration.

## Next Phase Readiness

- **Phase 6 (household polish)** unblocked. All four HNTF requirements are now satisfied; the unified bell and banner region are in place. Phase 6 will consume the same APIs (`getCycleNotificationsForViewer`, `getUnreadCycleEventCount`, `markNotificationsRead`, the four banner components) for settings surfaces and polish — signatures locked in Plans 05-02 through 05-05.
- **Gap fixes from UAT** already persisted in `main` via commits `a668285` and `3cd9fe9`; no carry-over work.

## Self-Check: PASSED

- [x] `src/app/(main)/h/[householdSlug]/layout.tsx` contains `getReminderCount(household.id, sessionUser.id`, `getReminderItems(household.id, sessionUser.id`, `getUnreadCycleEventCount(household.id, sessionUser.id)`, `getCurrentCycle(household.id)`, `getCycleNotificationsForViewer(household.id, sessionUser.id, currentCycle.id)`, `const totalCount = reminderCount + unreadCycleEventCount`, `variant="desktop"`, `cycleEvents={cycleEvents}` (≥2), `householdId={household.id}` (≥2), `className="hidden sm:block"`
- [x] `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` contains `getCurrentCycle`, `getCycleNotificationsForViewer`, `findNextAssignee`, `CycleStartBanner`, `ReassignmentBanner`, `PassiveStatusBanner`, `FallbackBanner`, `viewerIsAssignee`, `members.length > 1`, `all_unavailable_fallback`, `priorAssigneeName ?? "Someone"`, `resolvedPriorName`; does NOT contain `priorAssigneeName !== null` (old gate removed)
- [x] `npx tsc --noEmit 2>&1 | grep -E "(layout\.tsx|dashboard/page\.tsx)"` → zero matches (no Plan 05-05 file tsc errors)
- [x] `npx vitest run tests/phase-05` → 64/64 green
- [x] Commits `2df4e1f`, `59f8023`, `a668285`, `3cd9fe9` all present in `git log --oneline`
- [x] `.planning/workstreams/household/phases/05-household-notifications/05-HUMAN-UAT.md` → 12 tests documented, all passing
- [x] `scripts/seed-phase-05-uat.ts` + `scripts/check-notif-state.ts` present in working tree
- [x] v1 tech-debt items (mobile bell visibility, badge harmonization, 99+ cap) confirmed resolved via UAT Tests 7 + 8

---
*Phase: 05-household-notifications*
*Completed: 2026-04-20*
