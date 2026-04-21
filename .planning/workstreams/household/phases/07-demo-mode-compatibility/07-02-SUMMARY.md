---
phase: 07-demo-mode-compatibility
plan: 02
subsystem: testing
tags: [demo, guard, audit, vitest, static-analysis, server-actions]

# Dependency graph
requires:
  - phase: 07-demo-mode-compatibility/07-01
    provides: "prisma/seed.ts expansion with DEMO_SAMPLE_MEMBERS, cycle, availability (seed-structure.test.ts reads these)"
provides:
  - "Simplified startDemoSession: findUnique → signIn → redirect (D-11)"
  - "tests/phase-07/demo-guard-audit.test.ts: HDMO-02 static regression gate for all features/**/actions.ts"
  - "tests/phase-07/seed-structure.test.ts: source-grep surrogate for Plan 01 seed expansion"
affects:
  - "Phase 8 (snooze feature) and all future phases adding mutating Server Actions"
  - "Any phase touching src/features/demo/actions.ts or prisma/seed.ts"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Paren-depth tracking for TypeScript function body extraction (handles inline param type literals)"
    - "Static audit test pattern: walk + readFileSync + regex, no src/ imports"
    - "SKIP_FUNCTIONS Set<string> keyed by function name (not file) for granular exclusion"

key-files:
  created:
    - tests/phase-07/demo-guard-audit.test.ts
    - tests/phase-07/seed-structure.test.ts
  modified:
    - src/features/demo/actions.ts

key-decisions:
  - "D-11: startDemoSession lazy bootstrap removed — seed.ts is the single source of truth for demo data"
  - "SKIP_FUNCTIONS excludes 4 legitimately guard-free functions by name (not file), per Pitfall 6"
  - "extractFunctionBodies uses paren-depth tracking to find the function body brace, not indexOf('{') which misidentifies TypeScript inline param type objects"

patterns-established:
  - "Static audit test: walk src/features/**/actions.ts, extract function bodies via paren+brace depth tracking, assert session.user.isDemo literal present"
  - "SKIP_FUNCTIONS = Set<string> with function names: startDemoSession, registerUser, loadMoreWateringHistory, loadMoreTimeline"

requirements-completed:
  - HDMO-01
  - HDMO-02

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 07 Plan 02: Demo Guard Audit + startDemoSession Simplification Summary

**`startDemoSession` reduced to findUnique→signIn→redirect (D-11) and a static Vitest audit locks HDMO-02 as a regression gate across all 8 features/**/actions.ts files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-21T02:52:34Z
- **Completed:** 2026-04-21T02:57:49Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- Removed the 127-line lazy bootstrap block from `startDemoSession`, cutting `src/features/demo/actions.ts` from 232 to 138 lines; the function is now a clean `findUnique → error-if-missing → signIn → redirect` shape with a seed-missing error that guides developers to `npx prisma db seed`
- Shipped `tests/phase-07/demo-guard-audit.test.ts` — a static Vitest audit that walks all 8 `src/features/**/actions.ts` files, extracts every `export async function` body via paren+brace depth tracking, and asserts each body contains `session.user.isDemo` (with a 4-entry SKIP_FUNCTIONS allowlist); passes green immediately on the current codebase
- Shipped `tests/phase-07/seed-structure.test.ts` — a source-grep surrogate that verifies `prisma/seed.ts` contains the Plan 01 seed expansion markers and `src/features/demo/actions.ts` has no lazy bootstrap artifacts; 2/3 tests pass now, 2 complete after Plan 01 lands

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify startDemoSession** - `954b407` (feat)
2. **Task 2: Add guard audit + seed structure tests** - `c0293a6` (test)

## Files Created/Modified

- `src/features/demo/actions.ts` - `startDemoSession` simplified to findUnique→signIn→redirect; removed `DEMO_PLANTS` and `generateHouseholdSlug` imports; `seedStarterPlants` unchanged
- `tests/phase-07/demo-guard-audit.test.ts` - HDMO-02 static regression gate; walks all features/**/actions.ts, asserts session.user.isDemo in every non-skipped function body
- `tests/phase-07/seed-structure.test.ts` - Source-grep surrogate for Plan 01 seed expansion; verifies prisma/seed.ts, demo/actions.ts, and demo/seed-data.ts structure

## Decisions Made

- Used paren-depth tracking (not `indexOf('{')`) in `extractFunctionBodies` to correctly locate the function body brace past TypeScript inline parameter type literals
- `SKIP_FUNCTIONS` is keyed by function name (not file path) per Pitfall 6 — ensures future mutating additions to watering/notes/demo files are not silently excluded
- `seed-structure.test.ts` designed to fail on Plan 01's missing artifacts (expected wave-dependency behavior), not a correctness issue in Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extractFunctionBodies to correctly locate function body brace**
- **Found during:** Task 2 (demo-guard-audit.test.ts implementation)
- **Issue:** The plan's provided `extractFunctionBodies` implementation used `src.indexOf("{", m.index + m[0].length - 1)` which finds the first `{` starting inside the function's match position. For functions with TypeScript inline parameter type literals like `data: { email: string; password: string }`, this finds the inner type object's `{` instead of the function body's `{`, causing the extracted "body" to be the type annotation rather than the function's statements. `completeOnboarding` and `registerUser` in `auth/actions.ts` both have this pattern and were incorrectly extracted, causing the test to fail.
- **Fix:** Changed the body extraction to first track paren depth from the opening `(` of the parameter list to find the matching `)`, then scan forward from that `)` to find the first `{` (the actual function body). This correctly skips all inline type literals and return type annotations.
- **Files modified:** `tests/phase-07/demo-guard-audit.test.ts`
- **Verification:** Ran `node -e` debug script confirming `completeOnboarding` body extraction includes `session.user.isDemo`; test passes green with 1/1 tests passing.
- **Committed in:** `c0293a6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for correctness — the test would have produced false-negatives on any function with TypeScript inline parameter type literals. No scope creep.

## Issues Encountered

- Guard audit test initially failed because `completeOnboarding` was falsely identified as missing the `session.user.isDemo` guard. Root cause was the `extractFunctionBodies` brace-finding bug (auto-fixed, see Deviations above). The function already had the guard at line 176 of `auth/actions.ts`.

## Known Stubs

None — all plan deliverables are fully implemented.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- HDMO-02 is now locked as a CI regression gate: any future phase (Phase 8 snooze onward) that adds a mutating Server Action without `session.user.isDemo` will fail `tests/phase-07/demo-guard-audit.test.ts`
- `seed-structure.test.ts` will go fully green once Plan 01 (seed expansion) is merged into the branch
- `startDemoSession` is ready for post-Phase-07 demo testing; the simplified shape requires the seed to have been run (`npx prisma db seed`)

---
*Phase: 07-demo-mode-compatibility*
*Completed: 2026-04-21*
