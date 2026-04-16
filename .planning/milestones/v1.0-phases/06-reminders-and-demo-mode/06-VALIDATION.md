---
phase: 6
slug: reminders-and-demo-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | RMDR-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | RMDR-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 0 | RMDR-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 0 | RMDR-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 0 | RMDR-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-06 | 01 | 0 | DEMO-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-07 | 01 | 0 | DEMO-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-08 | 01 | 0 | DEMO-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/reminders.test.ts` — stubs for RMDR-01 through RMDR-05
- [ ] `tests/demo.test.ts` — stubs for DEMO-01 through DEMO-03
- [ ] Shared fixtures for demo user, reminder records, snooze state

*Existing Vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell icon badge visually updates in nav | RMDR-01 | Visual rendering | Navigate to dashboard, verify badge count matches overdue+due-today plants |
| Demo mode read-only UX | DEMO-02 | Full browser flow | Visit /demo, verify all write buttons disabled/hidden, no mutations possible |
| Snooze pill buttons appear on plant detail | RMDR-03 | Visual placement | Open overdue plant detail, verify "1d", "2d", "1w", "Custom" pills visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
