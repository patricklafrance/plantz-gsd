---
phase: 05-household-notifications
plan: 03
subsystem: ui
tags: [react-component, server-component, ui-spec-consumer, tailwind, phase-05]

# Dependency graph
requires:
  - phase: 05-household-notifications/01
    provides: CycleEventItem sibling type + test scaffolds with it.todo stubs for all four banners (tests/phase-05/*.test.tsx)
  - phase: 05-household-notifications/02
    provides: getCycleNotificationsForViewer data shape (consumed only indirectly — banners are props-driven)
provides:
  - CycleStartBanner React component with 2-prop interface { dueCount, cycleEndDate } (HNTF-02)
  - ReassignmentBanner React component with type-branched subject copy for manual_skip / auto_skip / member_left (HNTF-03)
  - PassiveStatusBanner React component with optional next-up tail + fallback-owner copy variant (HNTF-04)
  - FallbackBanner React component with three branches (owner-covering, non-owner view, paused) + role="alert" (AVLB-05 / D-12.4)
affects: [05-05-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure Server Component banner pattern: no hooks, no state, no DB writes; props-in → render-once"
    - "afterEach(cleanup) + local-Date constructors in Testing Library + jsdom tests to avoid DOM bleed and UTC-midnight day-shift"
    - "Native DOM assertions (querySelector + .not.toBeNull() + .className matchers) instead of @testing-library/jest-dom (not installed in this repo)"

key-files:
  created:
    - src/components/household/cycle-start-banner.tsx
    - src/components/household/reassignment-banner.tsx
    - src/components/household/passive-status-banner.tsx
    - src/components/household/fallback-banner.tsx
  modified:
    - tests/phase-05/cycle-start-banner.test.tsx
    - tests/phase-05/reassignment-banner.test.tsx
    - tests/phase-05/passive-status-banner.test.tsx
    - tests/phase-05/fallback-banner.test.tsx
    - .planning/workstreams/household/phases/05-household-notifications/05-PATTERNS.md

key-decisions:
  - "CycleStartBanner intentionally omits `assigneeName` from its props — 'You're up this cycle.' addresses the viewer in second person; PATTERNS.md updated to match shipped 2-prop interface"
  - "Used afterEach(cleanup) + local-Date constructors instead of installing @testing-library/jest-dom — keeps phase-05 banner tests self-contained and avoids a new dev dependency mid-phase"
  - "FallbackBanner wraps the non-owner subject in a React fragment so the outer <span className='font-semibold'> keeps the uniform banner-shell contract; the nested owner-name span also carries font-semibold (intentional, harmless)"

patterns-established:
  - "Phase-05 banner shell: <div role={status|alert} className='flex items-start gap-3 rounded-lg border {variant-border} {variant-bg} px-4 py-3'> + <Icon aria-hidden='true' /> + <p subject> + <p meta>"
  - "Color-token contract: accent (cycle-start/reassignment) | muted (passive-status) | destructive (fallback); role='alert' reserved for destructive-urgency banners only"

requirements-completed: [HNTF-02, HNTF-03, HNTF-04]

# Metrics
duration: ~7 min
completed: 2026-04-19
---

# Phase 05 Plan 03: Dashboard Banner Components Summary

**Four pure Server Component banners shipped with UI-SPEC-exact copy, color tokens, icons, and role values — 32 tests green across four phase-05 test files; CycleStartBanner ships with the 2-prop interface (PATTERNS.md deviation resolved inline).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-19T23:19:21Z
- **Completed:** 2026-04-19T23:26:37Z
- **Tasks:** 2
- **Files modified:** 9 (4 created components, 4 modified test files, 1 PATTERNS.md doc-fix)

## Accomplishments

- **CycleStartBanner** (`src/components/household/cycle-start-banner.tsx`) — Sparkles icon, accent-10/30 tokens, role="status". Two-prop interface `{ dueCount, cycleEndDate }`; intentionally omits `assigneeName` because the canonical copy "You're up this cycle." addresses the viewer directly. Meta pluralizes correctly for dueCount (1 → "plant", >1 → "plants", 0 → "No plants due right now").
- **ReassignmentBanner** (`src/components/household/reassignment-banner.tsx`) — UserCheck icon, accent tokens, role="status". Three type-branched verb phrases keyed by `reassignType`: `manual_skip` → "skipped", `auto_skip` → "is unavailable", `member_left` → "left the household". Meta omits the plants-due clause when dueCount === 0 (shows only the cycle-end date). The `priorAssigneeName` is wrapped in `<span className="font-semibold">` inside the subject.
- **PassiveStatusBanner** (`src/components/household/passive-status-banner.tsx`) — Users icon, muted/50 + border-border tokens, role="status". Subject suppresses the next-up tail when `memberCount === 1` or `nextAssigneeName` is undefined. Fallback-owner copy branch ("covers if no one's available next.") is selected via the `nextIsFallbackOwner` boolean.
- **FallbackBanner** (`src/components/household/fallback-banner.tsx`) — AlertTriangle icon, destructive tokens, role="alert" (matches TimezoneWarning precedent). Three subject+meta branches driven by `{ viewerIsOwner, isPaused }` booleans. The `<span className="font-semibold">{ownerName}</span>` is nested inside the subject fragment so the outer subject span still wraps the full subject text (uniform shell contract).
- **PATTERNS.md §cycle-start-banner** updated to match the shipped 2-prop interface (`assigneeName` documented as intentionally omitted).
- **32 tests green** across `tests/phase-05/cycle-start-banner.test.tsx` (7) + `reassignment-banner.test.tsx` (9) + `passive-status-banner.test.tsx` (8) + `fallback-banner.test.tsx` (8). All four files' `it.todo` stubs replaced with real assertions; zero `.todo(` entries remain.

## Task Commits

1. **Task 1: CycleStartBanner + ReassignmentBanner (HNTF-02, HNTF-03)** — `80b329b` (feat)
2. **Task 2: PassiveStatusBanner + FallbackBanner (HNTF-04, AVLB-05)** — `8f2ee42` (feat)

**Plan metadata commit:** pending (created after STATE/ROADMAP update)

## Copy-Map Summary (UI-SPEC exact-string coverage)

| Banner | Variant | Subject (exact) | Meta (exact pattern) |
|--------|---------|-----------------|----------------------|
| CycleStart | dueCount>0 | `You're up this cycle.` | `{N} plants due · Cycle ends {EEE MMM d}` |
| CycleStart | dueCount=0 | `You're up this cycle.` | `No plants due right now · Cycle ends {EEE MMM d}` |
| Reassignment | manual_skip | `{Name} skipped — you're covering this cycle.` | `{N} plants due · Cycle ends {...}` or `Cycle ends {...}` |
| Reassignment | auto_skip | `{Name} is unavailable — you're covering this cycle.` | (same meta) |
| Reassignment | member_left | `{Name} left the household — you're covering this cycle.` | (same meta) |
| PassiveStatus | multi + next known | `{Assignee} is watering this cycle. {Next} is next up.` | `Cycle ends {EEE MMM d}` |
| PassiveStatus | multi + fallback-owner next | `{Assignee} is watering this cycle. {Owner} covers if no one's available next.` | (same meta) |
| PassiveStatus | single / unknown next | `{Assignee} is watering this cycle.` | (same meta) |
| Fallback | viewerIsOwner & !paused | `Nobody's available — you're covering this cycle.` | `Check back when members update their availability.` |
| Fallback | !viewerIsOwner & !paused | `Nobody's available — {Owner} is covering this cycle.` | `You can update your availability in settings.` |
| Fallback | isPaused | `This week's rotation is paused.` | `Someone needs to step up — plants still need water.` |

## Files Created/Modified

- `src/components/household/cycle-start-banner.tsx` — **created** — HNTF-02 banner, 2-prop interface, Sparkles + accent tokens + role="status"
- `src/components/household/reassignment-banner.tsx` — **created** — HNTF-03 banner, type-branched subject (3 variants), UserCheck + accent tokens + role="status"
- `src/components/household/passive-status-banner.tsx` — **created** — HNTF-04 banner, optional next-up tail, Users + muted tokens + role="status"
- `src/components/household/fallback-banner.tsx` — **created** — AVLB-05 banner, 3 branches (owner-covering / non-owner / paused), AlertTriangle + destructive tokens + role="alert"
- `tests/phase-05/cycle-start-banner.test.tsx` — filled 7 previously-todo tests
- `tests/phase-05/reassignment-banner.test.tsx` — filled 9 previously-todo tests (8 asserting + 1 doc-marker)
- `tests/phase-05/passive-status-banner.test.tsx` — filled 8 previously-todo tests
- `tests/phase-05/fallback-banner.test.tsx` — filled 8 previously-todo tests
- `.planning/workstreams/household/phases/05-household-notifications/05-PATTERNS.md` — updated §cycle-start-banner interface (dropped `assigneeName`, added omission comment)

## Decisions Made

- **`CycleStartBanner` interface is 2-prop, not 3-prop:** The canonical UI-SPEC copy "You're up this cycle." is second-person; the banner never names the viewer. Dashboard page (Plan 05-05) only mounts it when `viewerIsAssignee === true`, so no ambiguity. PATTERNS.md §cycle-start-banner entry updated inline to document the intentional omission.
- **Native DOM assertions instead of `@testing-library/jest-dom`:** The matcher is not installed in this repo (Phase 2/3 tests don't use it either). Banner tests use `querySelector` + `.not.toBeNull()` + `.className` regex matchers, which cover every acceptance-criterion assertion without a new dev dependency.
- **`afterEach(cleanup)` + local Date constructors in tests:** jsdom DOM bleeds across tests without explicit cleanup — caused "Found multiple elements" errors after refactoring to use shared date fixtures. Also, `new Date("2026-04-23T00:00:00Z")` renders as "Wed Apr 22" locally on any runner west of UTC; switching to `new Date(2026, 3, 23)` (local constructor) keeps day-of-week stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing DOM matcher fallback + jsdom cleanup + local Date**
- **Found during:** Task 1 GREEN — first vitest run failed with "Invalid Chai property: toBeInTheDocument" (jest-dom not installed) and "Wed Apr 22" (UTC-midnight Date shifted locally to Tue).
- **Issue:** Plan sample test code used `.toBeInTheDocument()` matcher (jest-dom) and `new Date("2026-04-23T00:00:00Z")` UTC literal, both of which fail in this repo's Vitest + jsdom setup without `@testing-library/jest-dom` and in any non-UTC test runner timezone.
- **Fix:** Replaced `.toBeInTheDocument()` with `.not.toBeNull()` (native DOM check); replaced UTC-literal Dates with `new Date(2026, 3, 23)` local constructor; added `afterEach(cleanup)` to all four test files to isolate jsdom state.
- **Files modified:** all four `tests/phase-05/*-banner.test.tsx`
- **Commit:** bundled into `80b329b` and `8f2ee42` (no separate fix commit — the fixes are inside the RED/GREEN TDD cycle for each task)

**Total deviations:** 1 (blocking-fix; no architectural decisions needed).
**Impact on plan:** Every behavioral acceptance criterion from the plan passes; copy strings and color tokens match UI-SPEC exactly. The deviation only touches test machinery.

## Issues Encountered

- **`toBeInTheDocument` / DOM cleanup / Date-literal UTC shift** — see deviation Rule 3 above. All resolved inline.
- **Initial test run surfaced apostrophe-escape ambiguity:** JSX `&apos;` renders as a literal straight-quote `'`, which matches the regex `/You're up this cycle/i` once `.toBeInTheDocument` was replaced with the native matcher. No source change required.

## User Setup Required

None — banner components and their tests are self-contained; no new dependencies, no env vars, no DB changes.

## Threat Model Resolution

All four threat register entries confirmed:

| Threat ID | Disposition | Resolution |
|-----------|-------------|------------|
| T-05-03-01 (Info Disclosure: cross-household names) | mitigated | Banners take names via props only; dashboard Server Component filters by cycleId from getCurrentCycle — no cross-household path exists. |
| T-05-03-02 (Tampering: prop manipulation) | accepted | Server Components; client bundle contains no banner code, no URL/cookie reaches them. |
| T-05-03-03 (Spoofing: XSS via names) | mitigated | All names rendered as React text nodes (auto-escaped); no `dangerouslySetInnerHTML`, no attribute interpolation. |
| T-05-03-04 (EoP: owner info to non-owners) | accepted | Owner name is already public household metadata (UserMenu, settings). No PII beyond name surfaced. |

## Next Plan Readiness

- **Plan 05-04 (NotificationBell unified variant)** remains unblocked by Plan 05-02's server layer. Independent of this plan.
- **Plan 05-05 (dashboard integration)** unblocked: imports all four banner components + the render-decision logic to mount the correct one based on `viewerIsAssignee`, `unreadNotification.type`, `cycle.status`, and `transitionReason`. Props contracts are locked — signatures will not change.

## Self-Check: PASSED

- [x] `src/components/household/cycle-start-banner.tsx` exports CycleStartBanner (verified with grep)
- [x] `src/components/household/reassignment-banner.tsx` exports ReassignmentBanner
- [x] `src/components/household/passive-status-banner.tsx` exports PassiveStatusBanner
- [x] `src/components/household/fallback-banner.tsx` exports FallbackBanner
- [x] No `"use client"` / `useState` / `useEffect` in any banner file
- [x] `npx vitest run tests/phase-05/cycle-start-banner.test.tsx tests/phase-05/reassignment-banner.test.tsx tests/phase-05/passive-status-banner.test.tsx tests/phase-05/fallback-banner.test.tsx` → 32/32 green
- [x] `npx tsc --noEmit` introduces zero new errors under `src/components/household/` (the four banner files emit no TS diagnostics)
- [x] `.todo(` count across all four banner test files = 0
- [x] PATTERNS.md §cycle-start-banner interface no longer contains `assigneeName:` field
- [x] Commit hashes 80b329b, 8f2ee42 present in `git log --oneline`

---
*Phase: 05-household-notifications*
*Completed: 2026-04-19*
