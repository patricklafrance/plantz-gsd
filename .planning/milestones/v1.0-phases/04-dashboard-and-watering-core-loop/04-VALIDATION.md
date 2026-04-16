---
phase: 4
slug: dashboard-and-watering-core-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/watering.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/watering.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DASH-01 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | WATR-01 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 1 | WATR-02 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-01-04 | 01 | 1 | WATR-03 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ (partial) | ⬜ pending |
| 04-01-05 | 01 | 1 | WATR-05 | — | Ownership check | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-01-06 | 01 | 1 | WATR-06 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-01-07 | 01 | 1 | WATR-07 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | DASH-02 | — | N/A | manual-only | — | — | ⬜ pending |
| 04-02-02 | 02 | 2 | DASH-04 | — | N/A | manual-only | — | — | ⬜ pending |
| 04-02-03 | 02 | 2 | DASH-05 | — | N/A | manual-only | — | — | ⬜ pending |
| 04-02-04 | 02 | 2 | UIAX-05 | — | N/A | manual-only | — | — | ⬜ pending |
| 04-03-01 | 03 | 2 | WATR-04 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 2 | DASH-03 | — | N/A | unit | `npx vitest run tests/watering.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/watering.test.ts` — Add test case for retroactive log that does not displace a newer log's `nextWateringAt` (WATR-03 edge case)
- [ ] `tests/watering.test.ts` — Add test case for `classifyAndSort` where upcoming plant watered within 48h is moved to `recentlyWatered`

*Existing infrastructure covers framework requirements. Only 2 gap tests needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One-tap water from dashboard | DASH-02 | React UI interaction with optimistic state | Navigate to dashboard, click water button, verify card moves to Recently Watered |
| Dashboard loads with section counts | DASH-04 | Server-rendered layout | Load dashboard, verify section headers show correct counts |
| Responsive on mobile/desktop | DASH-05 | CSS layout testing | Resize browser or use DevTools device mode |
| Optimistic UI for watering | UIAX-05 | React 19 useOptimistic state management | Water a plant, verify instant UI update before server confirms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
