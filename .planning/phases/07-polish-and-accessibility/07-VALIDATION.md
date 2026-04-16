---
phase: 7
slug: polish-and-accessibility
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 07-01-01 | 01 | 1 | UIAX-01 | T-07-01 | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-01-02 | 01 | 1 | UIAX-01 | — | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-02-01 | 02 | 1 | UIAX-01 | T-07-04 | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-02-02 | 02 | 1 | UIAX-01 | — | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-03-01 | 03 | 2 | UIAX-02 | T-07-06 | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-03-02 | 03 | 2 | UIAX-03 | T-07-07 | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-04-01 | 04 | 3 | UIAX-04 | T-07-09 | Page param validated | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-04-02 | 04 | 3 | UIAX-04 | — | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-04-03 | 04 | 3 | UIAX-04 | T-07-10 | Zod max enforced | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |
| 07-04-04 | 04 | 3 | UIAX-04 | — | N/A | regression | `npx vitest run --reporter=verbose` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing test infrastructure covers phase requirements
- [x] No new test utilities needed — phase is CSS/HTML/accessibility focused

*Existing vitest infrastructure provides regression coverage. Phase 7 tasks are primarily CSS class changes, new components, and HTML attribute additions. The automated `npx vitest run` command verifies no regressions. Accessibility-specific validation (contrast, keyboard flow, screen reader) is inherently manual and documented below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile touch targets >= 44px | UIAX-01 / D-03 | Visual/dimensional check | Inspect elements in Chrome DevTools mobile emulation (375px), verify min-height/min-width on BottomTabBar links, filter chips, snooze pills |
| WCAG AA contrast ratios | UIAX-02 / D-10 | Color perception check | Verify globals.css contrast audit comment documents all checked values; optionally run Lighthouse accessibility audit |
| Keyboard navigation flow | UIAX-02 / D-05 | Interactive flow check | Tab through all pages: verify focus-visible rings on BottomTabBar links, FilterChips, Pagination buttons, skip-to-content link |
| Focus-after-navigation | UIAX-02 / D-12 | Interactive flow check | Click a nav link, verify focus moves to new page h1 (press Tab — next element after h1 receives focus) |
| Screen reader labels | UIAX-03 / D-06 | Assistive tech check | Trigger watering, snooze, add plant, delete plant actions — verify toast announced by screen reader |
| Bottom sheet on mobile | UIAX-01 / D-04 | Visual/interaction check | Open Add Plant dialog on 375px viewport — should render as bottom-up drawer with swipe-to-dismiss |
| Empty state guidance | UIAX-04 | Content/UX check | Remove all plants/rooms, verify EmptyState component renders with correct icon, heading, body, CTA |
| Loading skeletons | UIAX-04 / D-16 | Visual check | Throttle network in DevTools, navigate to dashboard/plants/rooms — skeleton should appear briefly |

---

## Nyquist Compliance Note

All tasks use `npx vitest run --reporter=verbose` as their `<automated>` verify command. This provides regression coverage ensuring code changes don't break existing functionality. Phase 7 is primarily a CSS/HTML/accessibility hardening phase — the core accessibility validations (contrast ratios, keyboard flow, screen reader announcements, touch target dimensions) are inherently manual and listed in the Manual-Only Verifications table above. This is accepted as nyquist-compliant because:

1. Every task has an automated command that runs in <15 seconds
2. The automated tests catch regressions from the code changes (broken imports, TypeScript errors, test failures)
3. Manual verifications supplement but do not replace the automated checks

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
