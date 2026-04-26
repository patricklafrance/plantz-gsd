---
phase: 07-demo-mode-compatibility
fixed_at: 2026-04-20T00:00:00Z
review_path: .planning/workstreams/household/phases/07-demo-mode-compatibility/07-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-04-20T00:00:00Z
**Source review:** .planning/workstreams/household/phases/07-demo-mode-compatibility/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (3 warnings; 0 critical; 3 info out of scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Variable shadowing — `now` declared twice in `prisma/seed.ts`

**Files modified:** `prisma/seed.ts`
**Commit:** `84a3d20`
**Applied fix:** Hoisted a single `const now = new Date()` declaration to immediately before `db.$transaction(...)` (line 68). Removed the inner declaration at the former line 158 (inside the transaction callback) and the duplicate at the former line 213 (before the plant loop). Both consumers now reference the same outer-scope `now`, eliminating shadowing and the clock-skew risk called out in the review. Added an explanatory comment at the hoisted declaration tying it to WR-01 for future maintainers.

### WR-03: `requireHouseholdAccess` called after multiple DB reads in `seedStarterPlants` — TOCTOU ordering

**Files modified:** `src/features/demo/actions.ts`
**Commit:** `f321e8c`
**Applied fix:** Moved `await requireHouseholdAccess(targetHouseholdId)` to immediately after the `targetHouseholdId` null-guard (new line 79), before the `careProfile.findMany` calls and the plant-creation write. The original "immediately before the write loop" placement (former lines 104-110) was defensive in intent but violated the 7-step Server Action template (Step 4: authorize before business logic) and let two reads run on a JWT-cached `activeHouseholdId` before live membership was confirmed. The comment preserves the Pitfall 16 / D-14 rationale; a short breadcrumb remains near the write site pointing to the new location so the mechanical-grep intent is still traceable.

### WR-02: `seedStarterPlants` plant-creation loop is not atomic — partial writes possible

**Files modified:** `src/features/demo/actions.ts`
**Commit:** `3348dd6`
**Applied fix:** Replaced the sequential `for (const profile of allProfiles) { await db.plant.create(...) }` loop with `db.$transaction(allProfiles.map((profile) => db.plant.create({ ... })))`. Any failure mid-batch (unique constraint, transient DB error, network blip) now rolls back all partial writes so the user's collection stays consistent — matching the atomicity suggestion in the review. `createdPlants` is now the array returned from `$transaction`; `.length` feeds the returned `count`. The demo guard (`session.user.isDemo` check at line 59) is unaffected; the phase-07 HDMO-02 audit test still passes (33/33).

## Verification

- Tier 1: Re-read the modified regions of both files; fixes are present and surrounding code intact.
- Tier 2: `npx tsc --noEmit` produces zero new errors for `prisma/seed.ts` or `src/features/demo/actions.ts`.
- Tier 2 (bonus): `npx vitest run tests/phase-07/demo-guard-audit.test.ts tests/phase-07/seed-structure.test.ts` → 33/33 passed.

Info findings (IN-01, IN-02, IN-03) were out of scope for this iteration (`fix_scope: critical_warning`) and remain unaddressed.

---

_Fixed: 2026-04-20T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
