---
phase: 6
slug: settings-ui-switcher-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-20
updated: 2026-04-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit + integration) + @playwright/test 1.59.x (E2E if needed) |
| **Config file** | `vitest.config.mts` (root) |
| **Quick run command** | `npx vitest run tests/phase-06/<file>.test.{ts,tsx}` |
| **Full suite command** | `npm test` (maps to `vitest run`) |
| **Estimated runtime** | ~45 seconds (vitest full phase-06) |

---

## Sampling Rate

- **After every task commit:** Run the specific `npx vitest run tests/phase-06/<file>.test.{ts,tsx}` for files touched by the task
- **After every plan wave:** Run `npx vitest run tests/phase-06/`
- **Before `/gsd-verify-work`:** `npm test` — full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Each task maps to a requirement ID and a verifiable command. Source: RESEARCH.md §Validation Architecture (lines 855–881 — "Phase Requirements → Test Map").

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| P1.T1 | 06-01 | 0 | HSET-01/02/03/ROTA-01 | scaffold | `npx vitest run tests/phase-06/` (all stubs recognized, only todos) | ⬜ pending |
| P1.T2 | 06-01 | 0 | HSET-02/HSET-03/ROTA-01 | schema | `npx vitest run tests/phase-06/ -t "schema"` (passes via Plan 02 tests) | ⬜ pending |
| P2.T1 | 06-02 | 1 | HSET-02 (setDefault) | unit (mocked Prisma) | `npx vitest run tests/phase-06/set-default-household.test.ts` | ⬜ pending |
| P2.T1 | 06-02 | 1 | HSET-03 (updateSettings) | unit (mocked Prisma) | `npx vitest run tests/phase-06/update-household-settings.test.ts` | ⬜ pending |
| P2.T1 | 06-02 | 1 | ROTA-01 (reorderRotation) | unit (mocked Prisma) | `npx vitest run tests/phase-06/reorder-rotation.test.ts` | ⬜ pending |
| P2.T2 | 06-02 | 1 | HSET-02 (sort change) | grep (source scan) | `npx vitest run tests/phase-06/dashboard-redirect.test.ts` | ⬜ pending |
| P2.T3 | 06-02 | 1 | HSET-02/HSET-03/ROTA-01 | unit replace-todos | `npx vitest run tests/phase-06/set-default-household.test.ts tests/phase-06/update-household-settings.test.ts tests/phase-06/reorder-rotation.test.ts tests/phase-06/dashboard-redirect.test.ts` | ⬜ pending |
| P3.T1 | 06-03 | 2 | HSET-01/HSET-02 | unit (component) | `npx vitest run tests/phase-06/household-switcher.test.tsx` | ⬜ pending |
| P3.T2 | 06-03 | 2 | HSET-01 | unit replace-todos | `npx vitest run tests/phase-06/household-switcher.test.tsx` | ⬜ pending |
| P4.T1 | 06-04 | 2 | HSET-03 (D-23) | unit (component) | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx` | ⬜ pending |
| P4.T2 | 06-04 | 2 | HSET-03 (D-23) | unit replace-todos | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx` | ⬜ pending |
| P5a.T1 | 06-05 | 3 | HSET-03 (D-13/D-14/D-15/D-16) | unit (component) | `npx vitest run tests/phase-06/settings-general-form.test.tsx` | ⬜ pending |
| P5a.T2 | 06-05 | 3 | HSET-03 (D-17/D-18/D-19) | unit (component) | `npx vitest run tests/phase-06/settings-general-form.test.tsx` (DangerZone wiring) | ⬜ pending |
| P5a.T3 | 06-05 | 3 | HSET-03 | unit replace-todos | `npx vitest run tests/phase-06/settings-general-form.test.tsx` | ⬜ pending |
| P5b.T1 | 06-05 | 3 | HSET-03/ROTA-01 (D-10/D-12/D-18) | unit (component) | `npx vitest run tests/phase-06/members-list.test.tsx` | ⬜ pending |
| P5b.T2 | 06-05 | 3 | ROTA-01 (D-10/D-12) | unit (component) | `npx vitest run tests/phase-06/rotation-reorder.test.tsx` | ⬜ pending |
| P5b.T3 | 06-05 | 3 | HSET-03/ROTA-01 | unit replace-todos | `npx vitest run tests/phase-06/members-list.test.tsx tests/phase-06/rotation-reorder.test.tsx` | ⬜ pending |
| P6.T1 | 06-06 | 3 | HSET-03 (D-20/D-21/D-22) | unit (component) | `npx vitest run tests/phase-06/invitations-card.test.tsx` | ⬜ pending |
| P6.T2 | 06-06 | 3 | HSET-03 (D-27/D-28/D-29/D-30) | unit (component) | `npx vitest run tests/phase-06/availability-form.test.tsx` | ⬜ pending |
| P6.T3 | 06-06 | 3 | HSET-03 | unit replace-todos | `npx vitest run tests/phase-06/invitations-card.test.tsx tests/phase-06/availability-form.test.tsx` | ⬜ pending |
| P7.T1 | 06-07 | 4 | HSET-01/02/03, ROTA-01 | integration (page assembly) | `npx tsc --noEmit` + subsequent Wave 3 tests remain green | ⬜ pending |
| P7.T2 | 06-07 | 4 | HSET-01/HSET-02/D-24 | integration (wiring) | `npx tsc --noEmit` + `npx vitest run tests/phase-06/links-audit.test.ts` | ⬜ pending |
| P7.T3 | 06-07 | 4 | ROTA-01 (D-35) + HSET-01 (Pitfall 17) | integration + grep | `npx vitest run tests/phase-06/reorder-rotation-concurrency.test.ts tests/phase-06/links-audit.test.ts` | ⬜ pending |
| P7.T4 | 06-07 | 4 | all | human-verify (Chrome DevTools MCP UAT) | manual — `npm run dev` + Chrome DevTools MCP checklist | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage note:** The 21 actual phase-06 tasks across 8 plans (01, 02, 03, 04, 05a, 05b, 06, 07) each map to one or more `tests/phase-06/<file>.test.{ts,tsx}` files or a type/grep gate. No task is unverified.

---

## Wave 0 Requirements

Plan 01 creates these files under `tests/phase-06/` (plus `tests/phase-06/fixtures.ts`) as keyed `test.todo` / `it.todo` stubs. Waves 1–4 replace the todos with real tests.

- [ ] `tests/phase-06/fixtures.ts` — shared helpers (RUN_ID, EMAIL_PREFIX, emailFor, getDb — mirrors `tests/phase-05/fixtures.ts`)
- [ ] `tests/phase-06/set-default-household.test.ts` — HSET-02 mocked-Prisma stubs (happy path, non-member, demo, invalid input, revalidatePath)
- [ ] `tests/phase-06/update-household-settings.test.ts` — HSET-03 mocked-Prisma stubs (happy, non-OWNER, invalid cycleDuration, invalid timezone, preserves active cycle)
- [ ] `tests/phase-06/reorder-rotation.test.ts` — ROTA-01 mocked-Prisma stubs (happy, members-changed length, members-changed set, non-OWNER, demo, invalid input, revalidatePath)
- [ ] `tests/phase-06/reorder-rotation-concurrency.test.ts` — D-35 real-Prisma concurrency stub (Plan 07 fills it in)
- [ ] `tests/phase-06/dashboard-redirect.test.ts` — HSET-02 grep/source assertion stubs (auth.ts + legacy dashboard sort)
- [ ] `tests/phase-06/household-switcher.test.tsx` — HSET-01 component stubs (route-preservation, detail-route fallback, default-star, set-default invocation, buildSwitchPath utility)
- [ ] `tests/phase-06/cycle-countdown-banner.test.tsx` — D-23 component stubs (7 tests: assignee render, non-assignee, suppressed-by-unread, urgency, single-member, date format, role="status")
- [ ] `tests/phase-06/settings-general-form.test.tsx` — HSET-03 component stubs (prefill, submit, pending disable, empty name, cycleDuration 4 options)
- [ ] `tests/phase-06/members-list.test.tsx` — HSET-03 component stubs (7 tests: role-conditional 3-dot matrix cells, rotation-order prefix)
- [ ] `tests/phase-06/rotation-reorder.test.tsx` — ROTA-01 component stubs (6 tests: optimistic update, revert on error, top/bottom arrow disable, all-arrows isPending disable)
- [ ] `tests/phase-06/invitations-card.test.tsx` — HSET-03 component stubs (Phase A/B/C, revoke confirm, no-copy-on-existing, empty state)
- [ ] `tests/phase-06/availability-form.test.tsx` — HSET-03 component stubs (two pickers, date validation errors, "You" label, delete gate matrix, past-filter)
- [ ] `tests/phase-06/links-audit.test.ts` — HSET-01/Pitfall 17 grep-audit stub (Plan 07 fills it in)

**Framework install:** none (Vitest already installed; no new dependencies for Phase 6).

---

## Manual-Only Verifications

These are surfaced at the Plan 07 Chrome DevTools MCP UAT checkpoint (Task 4).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OWNER role pill WCAG 4.5:1 contrast | HSET-03 (D-13) | Visual contrast measurement | Chrome DevTools MCP — render `/h/[slug]/settings` → Accessibility panel contrast check on the OWNER pill. If <4.5:1, the fallback `bg-muted text-foreground` is already shipped (audited 5.4:1); no code change needed. |
| Mobile switcher "Set as default" touch-target ≥ 44px | HSET-02 (D-04/D-36/D-38) | Physical device interaction feel | Chrome DevTools MCP — `emulate` mobile viewport, `take_snapshot`, inspect bounding box of the star button row. |
| Frame-flash absence between bell mark-read and CycleCountdown render | HSET-03 (D-24/D-25) | Sub-frame timing not capturable in unit tests | Manual observation during UAT Step 10 (Plan 07) — mark notification read while on dashboard, watch for double-banner render. |
| Responsive parity of all dialogs (Drawer vs Dialog swap at 640px) | HSET-03 (D-27) | Visual behavior across viewports | Chrome DevTools MCP — toggle viewport width between 320px and 1024px on invite dialog, destructive leave dialog, create-household dialog. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`--watch`, `-w`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Per-Task Verification Map populated with 21 phase-06 tasks + commands
- [x] Wave 0 Requirements listed using actual `tests/phase-06/*.test.{ts,tsx}` paths

**Approval:** ready for execution (pending Wave 0 creation via Plan 01)
