---
phase: 5
slug: household-notifications
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-19
updated: 2026-04-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=dot` (single file target during task work) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~25 seconds (full phase-05 suite; full-project suite ~50s) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (quick run)

---

## Per-Task Verification Map

13 tasks across 5 plans. Task numbering reflects the Plan 05-01 split (Task 3 → 3a + 3b per revision 1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01 T1 | 05-01 | 1 | HNTF-01..04 | T-05-01-01 | Schema edit is additive, nullable, no DEFAULT — no data-loss risk | prisma validate | `npx prisma format && npx prisma validate` | ✅ | ✅ green |
| 05-01 T2 | 05-01 | 1 | HNTF-01..04 | T-05-01-01 | migrate dev with committed migration.sql (no db push); ALTER+INDEX SQL verified post-generation | prisma migration | `npx prisma migrate status && ls prisma/migrations/ \| grep add_household_notification_read_at` | ✅ | ✅ green |
| 05-01 T3a | 05-01 | 1 | HNTF-02, HNTF-03 | — | Sibling CycleEventItem type extends types.ts without breaking ReminderItem consumers | tsc typecheck | `npx tsc --noEmit 2>&1 \| grep -E "(types\.ts\|fixtures\.ts)" ; test $? -ne 0` | ✅ | ✅ green |
| 05-01 T3b | 05-01 | 1 | HNTF-01..04 | T-05-01-04 | 9 test scaffolds with it.todo/test.todo stubs covering every HNTF ID; no real assertions yet | vitest todo run | `npx vitest run tests/phase-05 --reporter=dot` | ✅ | ✅ green |
| 05-02 T1 | 05-02 | 2 | HNTF-01 | T-05-02-06 | Active-cycle non-assignee never reaches plant.count (early-return gate); paused bypass per D-09 | unit (mocked Prisma) | `npx vitest run tests/phase-05/reminder-gate.test.ts` | ✅ | ✅ green |
| 05-02 T2 | 05-02 | 2 | HNTF-01, HNTF-02, HNTF-03 | T-05-02-04, T-05-02-05 | getUnreadCycleEventCount + getCycleNotificationsForViewer scope by householdId+recipientUserId; cache() dedups duplicate calls within one request | unit (mocked Prisma) | `npx vitest run tests/phase-05/get-unread-cycle-event-count.test.ts tests/phase-05/get-cycle-notifications-for-viewer.test.ts` | ✅ | ✅ green |
| 05-02 T3 | 05-02 | 2 | HNTF-01 | T-05-02-01, T-05-02-02, T-05-02-03, T-05-02-08 | Cross-user write blocked at SQL predicate (recipientUserId = session.user.id); idempotent replay via readAt: null filter; 7-step action template | unit (mocked Prisma, 8 branches) | `npx vitest run tests/phase-05/mark-notifications-read.test.ts` | ✅ | ✅ green |
| 05-03 T1 | 05-03 | 3 | HNTF-02, HNTF-03 | T-05-03-03 | CycleStartBanner + ReassignmentBanner pure Server Components; React auto-escapes all name text nodes; no DB calls on render | component (RTL) | `npx vitest run tests/phase-05/cycle-start-banner.test.tsx tests/phase-05/reassignment-banner.test.tsx` | ✅ | ✅ green |
| 05-03 T2 | 05-03 | 3 | HNTF-04 | T-05-03-01, T-05-03-03 | PassiveStatusBanner + FallbackBanner pure Server Components; role="alert" on Fallback for urgent state; exact UI-SPEC copy strings | component (RTL) | `npx vitest run tests/phase-05/passive-status-banner.test.tsx tests/phase-05/fallback-banner.test.tsx` | ✅ | ✅ green |
| 05-04 T1 | 05-04 | 3 | HNTF-01, HNTF-02, HNTF-03 | T-05-04-01, T-05-04-02, T-05-04-03, T-05-04-04 | Unified bell with useTransition mark-read on open; variant prop branches trigger shape; 99+ badge cap both variants; unreadIds snapshotted (no re-read on open) | client component (RTL + userEvent) | `npx vitest run tests/phase-05/notification-bell-variant.test.tsx` | ✅ | ✅ green |
| 05-04 T2 | 05-04 | 3 | HNTF-01 | — | BottomTabBar inline DropdownMenu deleted; 4th tab slot delegates to <NotificationBell variant="mobile">; v1 tech-debt eliminated | tsc + vitest regression | `npx tsc --noEmit 2>&1 \| grep -v "layout\.tsx" \| grep -E "bottom-tab-bar\|notification-bell" ; test $? -ne 0` | ✅ | ✅ green |
| 05-05 T1 | 05-05 | 4 | HNTF-01..04 | T-05-05-01, T-05-05-02 | Layout 4-way Promise.all + sequential cycleEvents fetch; totalCount threads to both bell instances; hidden sm:block wrapper preserved | tsc typecheck | `npx tsc --noEmit 2>&1 \| grep "h/\[householdSlug\]/layout.tsx" ; test $? -ne 0` | ✅ | ✅ green |
| 05-05 T2 | 05-05 | 4 | HNTF-02, HNTF-03, HNTF-04, AVLB-05 | T-05-05-03, T-05-05-04, T-05-05-05 | Dashboard renders 4 banners in D-13 order; ReassignmentBanner uses resolvedPriorName ("Someone" fallback) — never silently suppressed; getCycleNotificationsForViewer dedup'd via React.cache | tsc typecheck | `npx tsc --noEmit 2>&1 \| grep "dashboard/page.tsx" ; test $? -ne 0` | ✅ | ✅ green |
| 05-05 T3 | 05-05 | 4 | HNTF-01..04 | T-05-05-06 | Chrome DevTools MCP walkthrough (22 steps) — desktop + mobile viewports, bell interaction, banner render order, v1 tech-debt eliminated | manual (MCP-assisted) | See Plan 05-05 Task 3 resume signal; full suite `npx vitest run` + `npx next build` + `npx tsc --noEmit` all green | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Populated by planner; updated by executor during PLAN.md execution*

> **2026-04-20 audit:** All 13 task rows ran green during validate-phase audit. Full phase-05 vitest suite: 9 files, 64 tests, 0 failures (5.81s). Statuses updated ⬜ → ✅.

---

## Wave 0 Requirements

All Wave 0 test scaffolds are delivered by Plan 05-01 Task 3b (9 test files) + Task 3a (fixtures + CycleEventItem type). Wave 0 complete.

- [x] Prisma migration: add `HouseholdNotification.readAt DateTime?` + index `(recipientUserId, readAt)` — Plan 05-01 Tasks 1-2
- [x] Test stub: `tests/phase-05/reminder-gate.test.ts` — covers HNTF-01 (non-assignee → count = 0; paused-cycle fallback branch) — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/cycle-start-banner.test.tsx` — covers HNTF-02 — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/reassignment-banner.test.tsx` — covers HNTF-03 (including previous-assignee banner clear doc-only test) — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/passive-status-banner.test.tsx` — covers HNTF-04 — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/get-unread-cycle-event-count.test.ts` — bell badge query (D-28) — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/get-cycle-notifications-for-viewer.test.ts` — bell dropdown feed query (D-29) — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/mark-notifications-read.test.ts` — Server Action (D-20) — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/notification-bell-variant.test.tsx` — unified component (D-22) desktop/mobile variants — Plan 05-01 Task 3b
- [x] Test stub: `tests/phase-05/fallback-banner.test.tsx` — covers AVLB-05 / D-12.4 — Plan 05-01 Task 3b
- [x] CycleEventItem type + `tests/phase-05/fixtures.ts` — Plan 05-01 Task 3a
- [x] Mock Prisma helper reuse from Phase 2 (`tests/reminders.test.ts` precedent) + Phase 4 (`tests/phase-04/fixtures.ts` RUN_ID + EMAIL_PREFIX precedent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell dropdown open/close UX on mobile + desktop | HNTF-01..04 (bell refactor) | Interaction/animation depends on `@base-ui/react` runtime behavior (A2 assumption) | Chrome DevTools MCP: open dashboard on both viewports, open/close bell dropdown, verify mark-read fires once (Plan 05-05 Task 3 steps 6-9, 16-17) |
| Banner render order on dashboard (D-13) | HNTF-02, HNTF-03, HNTF-04 | Visual hierarchy + conditional swap requires side-by-side review | Chrome DevTools MCP: navigate to `/dashboard` as assignee, non-assignee, and paused-cycle viewer; screenshot each (Plan 05-05 Task 3 step 19) |
| ReassignmentBanner "Someone" fallback renders visibly | HNTF-03 | Must confirm the banner is never silently suppressed when priorAssigneeName derivation fails | Chrome DevTools MCP: force a reassignment state where rotation predecessor cannot be derived; verify the banner renders with text "Someone skipped — you're covering this cycle." (Plan 05-05 Task 3 step 19) |
| BottomTabBar Alerts slot shows unified bell on mobile | v1 tech debt (NotificationBell hidden on mobile) | Slot replacement affects layout | Chrome DevTools MCP: mobile viewport, confirm bell appears in bottom tab bar and opens correct dropdown (Plan 05-05 Task 3 steps 11-18) |
| Badge harmonized to accent color + 99+ cap on both variants | HNTF-01, D-19 | Token swap + cap behavior needs visual verification across breakpoints | Chrome DevTools MCP: check both bell instances render bg-accent (not bg-destructive) and cap at "99+" not "9+" (Plan 05-05 Task 3 steps 14-15) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task row above has an automated command; Task 05-05 T3 is the sole checkpoint:human-verify task with the MCP walkthrough as its verification)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (checked: only 05-05 T3 is manual; 05-05 T1 and T2 both have tsc-based automated verify)
- [x] Wave 0 covers all MISSING references (9 test scaffolds + fixtures + CycleEventItem type — all delivered by Plan 05-01)
- [x] No watch-mode flags (all commands use `npx vitest run` without `--watch`)
- [x] Feedback latency < 30s (single-file vitest runs ~5s; full phase-05 suite ~25s)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** planner-approved (revision 1 applied — task split in 05-01 reflected; per-task map populated)

---

## Validation Audit 2026-04-20

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Test files verified | 9 |
| Tests passing | 64 |
| Test suite runtime | 5.81s |

**Requirement coverage (re-verified):**

- HNTF-01 → `reminder-gate.test.ts` + `get-unread-cycle-event-count.test.ts` + `mark-notifications-read.test.ts` + `notification-bell-variant.test.tsx` ✅
- HNTF-02 → `cycle-start-banner.test.tsx` + `get-cycle-notifications-for-viewer.test.ts` ✅
- HNTF-03 → `reassignment-banner.test.tsx` + `get-cycle-notifications-for-viewer.test.ts` ✅
- HNTF-04 → `passive-status-banner.test.tsx` ✅
- AVLB-05 → `fallback-banner.test.tsx` ✅

No COVERED→PARTIAL/MISSING regressions detected. Phase 5 remains Nyquist-compliant. Only `05-05 T3` remains manual (Chrome DevTools MCP walkthrough), by design per VALIDATION sign-off.
