---
phase: 4
slug: dashboard-and-watering-core-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
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
| TBD | TBD | TBD | DASH-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WATR-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for dashboard grouping logic (DASH-01, DASH-02)
- [ ] Test stubs for watering actions (WATR-01, WATR-02, WATR-03)
- [ ] Test stubs for watering history (WATR-04, WATR-05, WATR-06)
- [ ] Shared fixtures for plants with various watering states

*Planner will populate exact task-to-test mapping after plans are created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Optimistic UI update on water tap | DASH-04 | Visual feedback timing | Tap water button, verify immediate section move |
| Toast notifications | UIAX-05 | Visual component | Verify toast appears and auto-dismisses |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
