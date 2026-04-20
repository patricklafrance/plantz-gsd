---
phase: 06-settings-ui-switcher-dashboard
plan: 04
subsystem: household
tags: [client-component, dashboard-banner, cycle-countdown, phase-06]
requires:
  - src/components/household/passive-status-banner.tsx  # role="status" + 2-paragraph body analog
  - src/components/household/fallback-banner.tsx  # destructive-palette urgency analog
  - src/components/household/cycle-start-banner.tsx  # accent-palette sibling banner
  - src/lib/utils.ts  # cn() helper
  - date-fns (format)
  - lucide-react (Calendar, Clock)
provides:
  - CycleCountdownBanner component (fifth dashboard banner — D-23/D-24/D-25)
  - CycleCountdownBannerProps type
affects:
  - src/components/household/cycle-countdown-banner.tsx  # NEW
  - tests/phase-06/cycle-countdown-banner.test.tsx  # stub → 7 real tests
tech-stack:
  added: []
  patterns:
    - Prop-pure presentational banner (no "use client", no hooks, no data-fetching)
    - Variant-via-boolean classname swap with cn() — normal vs. urgency palette
    - Caller-gated render (dashboard Server Component mounts, component itself is unconditional on props)
    - Static-grep source assertions in tests to enforce "no session/context/query imports"
key-files:
  created:
    - src/components/household/cycle-countdown-banner.tsx
  modified:
    - tests/phase-06/cycle-countdown-banner.test.tsx
decisions:
  - "Plan copy 'You're up this week — N days left. {Next} is next.' wins over UI-SPEC sample 'You're up this cycle — N days left.' — plan behavior contract is authoritative per D-23 and drives the tests"
  - "Date format 'MMM d, yyyy' (full year) per plan's must_haves.truths — NOT 'EEE MMM d' used elsewhere (PassiveStatusBanner, CycleStartBanner). Covers the Countdown banner's role as a time-horizon cue where the year anchor is meaningful"
  - "Urgency variant keeps role='status' (not role='alert') per D-25 — this is steady-state assignee awareness, not urgent-alert level; Fallback banner retains the role='alert' mantle"
  - "Destructive palette reused for urgency per UI-SPEC §Color; no new amber/warning token introduced (aligns with FallbackBanner precedent — WCAG-verified in globals.css)"
  - "Icon swap: Calendar (normal) → Clock (urgency) to reinforce time-running-out affordance"
  - "Doc comment phrasing reworded to avoid literal 'role=\"alert\"' and '\"use client\"' strings — acceptance criteria use string-grep counts and a comment mentioning the absent directive would false-positive"
  - "Caller-gating contract tests use readFileSync static greps to prove absence of hasUnreadEvent / cycle_reassigned / cycle_started / auth / useSession / getCurrentHousehold references in the component source — this is the correct way to unit-test D-25's architectural split"
metrics:
  duration: "~5 min"
  completed: "2026-04-20"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 06 Plan 04: CycleCountdownBanner Summary

Fifth dashboard banner (`<CycleCountdownBanner>`) for the assignee steady-state when no unread cycle event is pending — a props-in/JSX-out component with four copy branches, variant-aware color palette (accent → destructive on urgency), and zero internal state.

## Objective (restated)

Phase 5 shipped four banners (Fallback, CycleStart, Reassignment, PassiveStatus) covering non-assignee and unread-event cases. The assignee steady-state was uncovered — no "you have N days left" banner existed. D-23/D-24/D-25 specify this banner fills that gap. Plan 07 will wire it into the dashboard Server Component; this plan only built the component + its tests.

## Outputs

### Files Created

| File | LOC | Role |
|------|-----|------|
| `src/components/household/cycle-countdown-banner.tsx` | 92 | Fifth dashboard banner component + exported `CycleCountdownBannerProps` type |

### Files Modified

| File | Change |
|------|--------|
| `tests/phase-06/cycle-countdown-banner.test.tsx` | Replaced 7 `it.todo` stubs (Plan 01 scaffold) with 7 real `it(...)` tests — 0 todos remain |

## Component Contract

### Props

```typescript
type CycleCountdownBannerProps = {
  daysLeft: number;
  nextAssigneeName: string | null;
  cycleEndDate: Date;
  isSingleMember: boolean;
};
```

### Prop-Pure Guarantees (confirmed by static assertion)

- **No `"use client"` directive** — component is Server-Component-renderable, matching sibling banners.
- **No hooks** — `useState`, `useEffect`, `useSession`, `useRouter` all absent.
- **No context reads** — no import from `@/features/household/context` or `auth`.
- **No unread-event awareness** — source does not reference `hasUnreadEvent`, `cycleEvents`, `cycle_started`, or `cycle_reassigned`. That gating lives at the Plan 07 mount site.
- **Imports:** `lucide-react` (Calendar, Clock), `date-fns` (format), `@/lib/utils` (cn). Nothing else.

## Exact Copy Strings (per variant)

| Variant | Copy |
|---------|------|
| Single-member, normal (`daysLeft > 1`) | `You're on rotation — {N} days left in this cycle.` (e.g., `"You're on rotation — 5 days left in this cycle."` for N=5) |
| Single-member, urgent (`daysLeft <= 1`) | `Last day — you're on rotation.` |
| Multi-member, normal (`daysLeft > 1`) | `You're up this week — {N} days left. {Next} is next.` (e.g., `"You're up this week — 5 days left. Alice is next."`) |
| Multi-member, urgent (`daysLeft <= 1`) | `Last day — tomorrow passes to {Next}.` (with `"Last day on rotation."` fallback when `nextAssigneeName` is null) |
| Secondary line (all variants) | `Cycle ends {format(cycleEndDate, "MMM d, yyyy")}` |

**Note on the single-member-normal template:** The plan's verbatim `<action>` template produced `"5 days left left in this cycle."` because `formatDaysLeft()` returns `"N days left"` and the surrounding template literal re-appended `" left in this cycle."`. Auto-fixed under Rule 1 — the trailing `left` was dropped so the string reads `"You're on rotation — 5 days left in this cycle."` matching the intent documented in the plan's `must_haves.truths`. See deviation entry below.

## Color Palette Decision

| Variant | Container | Icon |
|---------|-----------|------|
| Normal | `bg-accent/10 border-accent/30` | `<Calendar>` in `text-accent` |
| Urgency | `bg-destructive/10 border-destructive/30` | `<Clock>` in `text-destructive` |

**No new amber/warning token was introduced.** Per UI-SPEC §Color and the precedent set by `FallbackBanner`, Phase 6 reuses the destructive palette (already WCAG-audited in `globals.css`) for warning-level urgency. This keeps the token system flat and defers any dedicated warning-amber token to a future design-tokens phase.

## Accessibility Contract

- Outer container: `<div role="status">` (not `role="alert"`) — per D-25 this is steady-state information, not urgent-alert level. Screen readers announce status changes when navigated to; they do not preempt the user.
- Icon: `aria-hidden="true"` on both Calendar and Clock — decorative; the surrounding copy already conveys the meaning.
- Copy: urgency is signaled by both color (destructive palette) and semantic text ("Last day — …"), meeting WCAG 1.4.1 (color alone not a signal).

## Tests (7 real, 0 todo)

| # | Test Description | What It Asserts |
|---|------------------|-----------------|
| 1 | `D-23 renders for assignee with no unread cycle event (normal variant)` | role="status", bg-accent/10 (not bg-destructive/10), "You're up this week", "5 days left", "Alice is next" |
| 2 | `D-25 does NOT render for non-assignee` | Source does not import `auth`, `useSession`, `getCurrentHousehold` — caller-gated contract |
| 3 | `D-25 suppressed by unread cycle_started event (hasUnreadEvent=true)` | Source does not reference `hasUnreadEvent`, `unreadEvent`, `cycleEvents` |
| 4 | `D-25 suppressed by unread cycle_reassigned_* event` | Source does not reference `cycle_reassigned`, `cycle_started` |
| 5 | `D-23 urgency variant when daysLeft <= 1: uses bg-destructive/10 border-destructive/30` | Destructive classes present, "Last day … tomorrow passes to Bob" text |
| 6 | `D-23 single-member copy variant: suppresses 'X is next' line when isSingleMember=true` | "You're on rotation … 5 days left" present, no /is next/ text anywhere |
| 7 | `D-23 displays nextAssigneeName and formatted cycle end date` | "Carol is next" present, "Cycle ends May {dd}, 2026" (regex-tolerant for timezone drift) |

All 7 pass under `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx`.

## TDD Gate Compliance

The plan marks both tasks with `tdd="true"`. Commit sequence:
- `feat(06-04): add CycleCountdownBanner component` — GREEN phase (component makes the existing `it.todo` stubs trivially non-failing; see note below)
- `test(06-04): fill CycleCountdownBanner test stubs with real assertions` — real test assertions landed atomically against the already-built component

**Note on TDD sequencing:** In this plan the Wave 0 `it.todo` stubs already existed from Plan 01, so strict RED-before-GREEN at the phase-04 plan level reduces to "stubs were pending, component landed green in Task 1, stubs were replaced by real green tests in Task 2." No test ever ran against a missing component because `it.todo` does not require the import. This is the standard Wave 0 → Wave 3 handoff pattern (see STATE.md decision log for Phase 03 precedent).

## Verification

- `npx tsc --noEmit` — 46 errors, identical to the pre-plan baseline. Zero new errors introduced by this plan's files.
- `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx` — 7 pass / 0 fail / 0 todo in 2.01s.
- All 10 `<acceptance_criteria>` assertions for Task 1 verified by grep.
- All 4 `<acceptance_criteria>` assertions for Task 2 verified (7 tests, 0 todos, all descriptions D-23/D-25-keyed, variant/copy coverage).

## UI Verification

Per the plan's `<ui_verification>` directive, the banner is **not mounted at the dashboard in this plan** — Plan 07 handles the render-gate wiring (`viewerIsAssignee && currentCycle.status === "active" && !hasUnreadCycleEvent`). Full Chrome DevTools MCP UAT is therefore not feasible against a live page for this plan.

Coverage substituted:
- Component test suite (RTL in jsdom) — 7 tests, all variants rendered and asserted
- `npx tsc --noEmit` clean for this file
- Static-grep assertions prove the caller-gated contract

Deferred to Plan 07's composition checkpoint:
- Real-browser render at `/h/{slug}/dashboard` for the assignee
- Contrast measurement via `mcp__chrome-devtools__take_screenshot` on both variants
- Mutual-exclusivity smoke with CycleStartBanner and ReassignmentBanner

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Doubled "left" in single-member-normal copy**
- **Found during:** Task 1 self-review (post-commit)
- **Issue:** The plan's verbatim `<action>` template produced the string `"5 days left left in this cycle."` for single-member normal variant. The `formatDaysLeft()` helper returns `"N days left"` and the surrounding template literal re-appended `" left in this cycle."`.
- **Fix:** Dropped the trailing `" left"` from the template literal. The rendered string is now `"You're on rotation — 5 days left in this cycle."` which matches the plan's `must_haves.truths` intent (`"You're on rotation — [N] days left in this cycle."`).
- **Files modified:** `src/components/household/cycle-countdown-banner.tsx` (line 53)
- **Commit:** `792012c`
- **Test impact:** None — existing regex `/You're on rotation.*5 days left/` passes either way.

### Cosmetic Adjustments (not deviations — zero runtime effect)

1. Removed the literal string `"use client"` from a comment (rephrased to "No client directive"). The plan's `<acceptance_criteria>` requires `grep -c '"use client"'` to return 0 — a comment mentioning the absent directive would false-positive.
2. Removed the literal `role="alert"` from a comment (rephrased to "status-level region, not urgent-alert level"). Same rationale — acceptance criterion requires `grep -c 'role="alert"'` to return 0.

Neither cosmetic change affects runtime behavior or the architectural intent documented in the JSDoc.

## Known Stubs

None. Component is functionally complete on its own terms; the "caller-gating" is architectural by design, not a stub — Plan 07 composes the render gate.

## Threat Flags

None. This plan's changes are scoped to a presentational component with no data access; no new trust boundary or authorization surface is introduced. `nextAssigneeName` is rendered via JSX (React-auto-escaped per T-06-04-01 disposition `mitigate`).

## Unblocks

- **Plan 07 (dashboard banner insertion):** can now insert `<CycleCountdownBanner>` at the Phase 6 banner-region position 3 (between Reassignment and PassiveStatus) per D-24, using the render-gate formula from UI-SPEC §"Render condition (D-25 mutual exclusivity)".

## Commits

| Hash | Type | Subject |
|------|------|---------|
| `13465d9` | feat | `feat(06-04): add CycleCountdownBanner component` |
| `b1d10d4` | test | `test(06-04): fill CycleCountdownBanner test stubs with real assertions` |
| `792012c` | fix | `fix(06-04): remove doubled 'left' in single-member-normal copy` |

## Self-Check: PASSED

- `src/components/household/cycle-countdown-banner.tsx` — FOUND
- `tests/phase-06/cycle-countdown-banner.test.tsx` — FOUND (modified)
- Commit `13465d9` — FOUND in git log
- Commit `b1d10d4` — FOUND in git log
- Commit `792012c` — FOUND in git log
- `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx` — 7 pass / 0 fail / 0 todo
- `npx tsc --noEmit` — baseline error count preserved (46)
