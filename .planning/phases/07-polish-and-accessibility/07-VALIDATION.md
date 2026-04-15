---
phase: 7
slug: polish-and-accessibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts |
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
| 07-01-01 | 01 | 1 | UIAX-01 | — | N/A | manual | Lighthouse mobile audit | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | UIAX-02 | — | N/A | manual | WCAG contrast checker | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | UIAX-03 | — | N/A | manual | Screen reader navigation test | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | UIAX-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing test infrastructure covers phase requirements
- [ ] Accessibility testing utilities (if needed) added to test setup

*Existing infrastructure covers most phase requirements. Accessibility validation is primarily manual (Lighthouse, screen reader, keyboard navigation).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile touch targets ≥ 44px | UIAX-01 | Visual/dimensional check | Inspect elements in Chrome DevTools mobile emulation, verify min-height/min-width |
| WCAG AA contrast ratios | UIAX-02 | Color perception check | Run Lighthouse accessibility audit, verify score ≥ 90 |
| Keyboard navigation flow | UIAX-02 | Interactive flow check | Tab through all pages, verify focus indicators and logical tab order |
| Screen reader labels | UIAX-03 | Assistive tech check | Navigate with screen reader (NVDA/VoiceOver), verify all interactive elements announced |
| Empty state guidance | UIAX-04 | Content/UX check | Remove all plants/rooms/notes, verify helpful messages appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
