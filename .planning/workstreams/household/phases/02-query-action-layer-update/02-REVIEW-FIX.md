---
phase: 02-query-action-layer-update
fixed_at: 2026-04-17T16:08:00Z
review_path: .planning/workstreams/household/phases/02-query-action-layer-update/02-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-04-17T16:08:00Z
**Source review:** .planning/workstreams/household/phases/02-query-action-layer-update/02-REVIEW.md
**Iteration:** 2 (invoked with `--all` to include Info findings)

**Summary:**

- Findings in scope: 5 (0 Critical, 0 Warning, 5 Info — all included because of `--all`)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### IN-01: `deleteRoomSchema` in `rooms/schemas.ts` is dead code

**Files modified:** `src/features/rooms/schemas.ts`
**Commit:** 2e47d51
**Applied fix:** Removed the `deleteRoomSchema` export. It was never imported anywhere — `deleteRoom` uses `roomTargetSchema` — so dropping the duplicate collapses the redundancy flagged across iterations 1 and 2.

### IN-02: Inconsistent `householdId` validation across Zod schemas

**Files modified:** `src/features/plants/schemas.ts`, `src/features/rooms/schemas.ts`
**Commit:** ebf3534
**Applied fix:** Changed `z.string().cuid()` to `z.string().min(1)` on `plantTargetSchema.householdId` and `roomTargetSchema.householdId` so target schemas match their sibling create/edit schemas. `requireHouseholdAccess` remains the authoritative membership check. Existing tests use CUID fixtures so no test updates were required.

### IN-03: `completeOnboarding` revalidated legacy `/dashboard` path

**Files modified:** `src/features/auth/actions.ts`
**Commit:** f5926d5
**Applied fix:** Imported `HOUSEHOLD_PATHS` from `@/features/household/paths` and replaced `revalidatePath("/dashboard")` with `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")`. The legacy `/dashboard` path is only a redirect stub, so the previous call did not invalidate the real household-scoped page — the onboarding banner only cleared on subsequent unrelated re-renders. The new path targets the actual page route and clears the banner on the next navigation.

### IN-04: Unused `household` destructure from `requireHouseholdAccess` in mutation actions

**Files modified:** `src/features/plants/actions.ts`, `src/features/rooms/actions.ts`
**Commit:** 4db5df7
**Applied fix:** Removed the unused `const { household } = ...` destructure from six mutation actions — `updatePlant`, `archivePlant`, `unarchivePlant`, `deletePlant`, `updateRoom`, and `deleteRoom`. Each now calls `await requireHouseholdAccess(parsed.data.householdId)` without destructuring. The guard's throw semantics are preserved. `createPlant` and `createRoom` keep the destructure because they use `household.id` in the create payload. Baseline lint comparison confirmed warnings dropped by exactly 6, matching the six removed destructures.

### IN-05: Slug-loop test assertion is loose relative to corrected behavior

**Files modified:** `tests/household-create.test.ts`
**Commit:** 9c1bcce
**Applied fix:** Replaced `expect(txMock.household.findUnique.mock.calls.length).toBeGreaterThanOrEqual(10)` with `expect(txMock.household.findUnique).toHaveBeenCalledTimes(10)` so the regression guard enforces the documented "exactly 10 attempts before throw" behavior. The companion comment on the line above already stated that intent; the assertion now matches.

## Skipped Issues

None — all in-scope findings were fixed in this iteration.

## Validation

Before commits, the working tree was checked against a baseline (fixes stashed):

| Check | Baseline | After fixes | Delta |
|---|---|---|---|
| tsc errors | 43 | 43 | 0 (all pre-existing) |
| lint errors | 165 | 165 | 0 (all pre-existing) |
| lint warnings | 70 | 64 | −6 (IN-04 destructure removals) |

Pre-existing issues not addressed by this phase:
- `tests/household-integration.test.ts` fails to import — missing `pg` package install (infrastructure).
- `NextMiddleware` type cast errors in `tests/*.test.ts` — mock pattern pre-existing.
- `react-hooks/set-state-in-effect` lint errors in `timeline.tsx`, `watering-history.tsx`, `use-media-query.ts` — files untouched by Phase 02.

---

_Fixed: 2026-04-17T16:08:00Z_
_Fixer: Claude (manual application after `gsd-code-fixer` agent preview)_
_Iteration: 2_
