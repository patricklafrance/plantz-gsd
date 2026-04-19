---
phase: 5
slug: household-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
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
| **Estimated runtime** | ~{TBD — populate during Wave 0} seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | HNTF-01..04 | — | Only current-cycle assignee sees reminder counts; cycle-start/reassignment banners only delivered to the intended recipient | unit | `npx vitest run <test file>` | ❌ W0 | ⬜ pending |

*Populated by planner during PLAN.md generation. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Prisma migration: add `HouseholdNotification.readAt DateTime?` + index `(recipientUserId, readAt)`
- [ ] Test stub: `tests/phase-05/reminder-count-gating.test.ts` — covers HNTF-01 (non-assignee → count = 0; paused-cycle fallback branch)
- [ ] Test stub: `tests/phase-05/cycle-start-banner.test.ts` — covers HNTF-02
- [ ] Test stub: `tests/phase-05/reassignment-banner.test.ts` — covers HNTF-03 (including previous-assignee banner clear)
- [ ] Test stub: `tests/phase-05/passive-status-banner.test.ts` — covers HNTF-04
- [ ] Test stub: `tests/phase-05/get-unread-cycle-event-count.test.ts` — bell badge query (D-28)
- [ ] Test stub: `tests/phase-05/get-cycle-notifications-for-viewer.test.ts` — bell dropdown feed query (D-29)
- [ ] Test stub: `tests/phase-05/mark-notifications-read.test.ts` — Server Action (D-20)
- [ ] Test stub: `tests/phase-05/notification-bell-variant.test.ts` — unified component (D-22) desktop/mobile variants
- [ ] Mock Prisma helper reuse from Phase 2 (`tests/reminders.test.ts` precedent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell dropdown open/close UX on mobile + desktop | HNTF-01..04 (bell refactor) | Interaction/animation depends on `@base-ui/react` runtime behavior (A2 assumption) | Chrome DevTools MCP: open dashboard on both viewports, open/close bell dropdown, verify mark-read fires once |
| Banner render order on dashboard (D-13) | HNTF-02, HNTF-03, HNTF-04 | Visual hierarchy + conditional swap requires side-by-side review | Chrome DevTools MCP: navigate to `/dashboard` as assignee, non-assignee, and paused-cycle viewer; screenshot each |
| BottomTabBar Alerts slot shows unified bell on mobile | v1 tech debt (NotificationBell hidden on mobile) | Slot replacement affects layout | Chrome DevTools MCP: mobile viewport, confirm bell appears in bottom tab bar and opens correct dropdown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
