---
phase: 04-invitation-system
plan: "03"
subsystem: household
tags: [server-actions, invitation, prisma, atomic, transaction, nextauth, vitest, tdd]

dependency_graph:
  requires:
    - phase: 04-01
      provides: "generateInvitationToken, hashInvitationToken (src/lib/crypto.ts); unstable_update (auth.ts); createInvitationSchema, revokeInvitationSchema, acceptInvitationSchema (schema.ts); test stub files"
    - phase: 04-02
      provides: "resolveInvitationByToken, getHouseholdInvitations, getHouseholdMembers (queries.ts)"
  provides:
    - "src/features/household/actions.ts — createInvitation, revokeInvitation, acceptInvitation Server Actions"
    - "tests/phase-04/create-invitation.test.ts — 4 mocked-Prisma unit tests (INVT-01)"
    - "tests/phase-04/revoke-invitation.test.ts — 4 mocked-Prisma unit tests (INVT-02)"
    - "tests/phase-04/accept-invitation.test.ts — 7 mocked-Prisma unit tests (INVT-04)"
  affects:
    - "04-04 (Wave 4 /join/[token] page calls acceptInvitation)"
    - "Phase 6 settings UI (calls createInvitation, revokeInvitation)"

tech-stack:
  added: []
  patterns:
    - "7-step Server Action template: auth() → demo-mode guard → Zod parse → requireHouseholdAccess → role check → write → revalidatePath"
    - "Atomic invitation acceptance via db.$transaction { updateMany + count-guard + aggregate + create }"
    - "AcceptRaceError typed class for $transaction short-circuit (count === 0 Pitfall 10 §2 guard)"
    - "unstable_update({ user: { activeHouseholdId } }) called POST-transaction, never inside (Pitfall 16)"
    - "rotationOrder computed as (aggregate._max.rotationOrder ?? -1) + 1 inside same transaction as updateMany"
    - "Idempotent revokeInvitation: findUnique pre-read, no-op on already-revoked, error on already-accepted"
    - "Demo-mode error copy Phase 4 variant: 'This action is disabled in demo mode. Sign up to get your own household.'"

key-files:
  created:
    - tests/phase-04/create-invitation.test.ts
    - tests/phase-04/revoke-invitation.test.ts
    - tests/phase-04/accept-invitation.test.ts
  modified:
    - src/features/household/actions.ts (added createInvitation, revokeInvitation, acceptInvitation + imports)

key-decisions:
  - "unstable_update receives { user: { activeHouseholdId } } (not { activeHouseholdId }) — activeHouseholdId is on session.user per auth.ts callbacks.session shape"
  - "INVITATION_ID test constant must be a valid cuid (25 chars, starts with 'c') — z.cuid() rejects shorter/invalid IDs"
  - "Prisma client must be generated in the worktree (npx prisma generate) — src/generated/ is not committed and not present in fresh worktrees"
  - "acceptInvitation skips Step 4 (requireHouseholdAccess) by design — caller proves intent via token, not existing membership"
  - "AcceptRaceError declared after acceptInvitation in the same file — class hoisting not needed since it is only used inside the function"

patterns-established:
  - "Pattern: Phase 4 demo-mode guard copy differs from Phase 2/3 copy ('This action is disabled...' vs 'Demo mode — sign up...')"
  - "Pattern: $transaction mock with shared object reference — tx argument receives same object as db.invitation, so both db.invitation.* and tx.invitation.* mock calls are trackable on the same vi.fn() instance"
  - "Pattern: INVITATION_ID test constants must pass z.cuid() — use 25-char strings starting with 'c' (e.g. 'clw...')"

requirements-completed: [INVT-01, INVT-02, INVT-04]

duration: ~12min
completed: "2026-04-19"
---

# Phase 04 Plan 03: Invitation Lifecycle Server Actions — createInvitation, revokeInvitation, acceptInvitation Summary

**Three Server Actions shipping the invite write-path: OWNER-gated create/revoke with idempotent revoke guard, and atomic `updateMany`+`count === 0` race-loss acceptance that appends to the rotation and refreshes the JWT via `unstable_update`.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-19T02:45:16Z
- **Completed:** 2026-04-19T02:57:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Implemented `createInvitation` following the 7-step template: OWNER-gated, tokenHash-only write, raw token returned once (Pitfall 10 §1), demo-mode guard with Phase 4 verbatim copy
- Implemented `revokeInvitation`: OWNER-gated, cross-household ID check (`existing.householdId === parsed.data.householdId`), idempotent on already-revoked (no-op), errors with UI-SPEC verbatim on already-accepted
- Implemented `acceptInvitation`: atomic `db.$transaction { updateMany + count-guard + aggregate + householdMember.create }` defeating concurrent-accept race (Pitfall 10 §2); rotation appended at max+1 without touching cycle pointer (Pitfall 9 §B); `unstable_update({ user: { activeHouseholdId } })` called after transaction commits (Pitfall 16)
- 15 mocked-Prisma unit tests pass across 3 files (4 + 4 + 7)

## Task Commits

1. **Task 1: createInvitation + revokeInvitation** - `beaf00e` (feat)
2. **Task 2: acceptInvitation test suite** - `508fe14` (feat)
3. **Rule 1 fix: unstable_update call shape** - `edf5cff` (fix)

## Files Created/Modified

- `src/features/household/actions.ts` — added imports (`unstable_update`, new schemas, `generateInvitationToken`, `hashInvitationToken`); appended `createInvitation`, `revokeInvitation`, `acceptInvitation`, `AcceptRaceError` class
- `tests/phase-04/create-invitation.test.ts` — replaced 4 `test.todo` stubs with 4 real tests (INVT-01)
- `tests/phase-04/revoke-invitation.test.ts` — replaced 4 `test.todo` stubs with 4 real tests (INVT-02)
- `tests/phase-04/accept-invitation.test.ts` — replaced 7 `test.todo` stubs with 7 real tests (INVT-04)

## Decisions Made

- `unstable_update` receives `{ user: { activeHouseholdId } }` (not `{ activeHouseholdId }`): the field lives on `session.user` per `auth.ts`'s `callbacks.session` shape. Passing it at the top level caused TS2353.
- `acceptInvitation` skips Step 4 (`requireHouseholdAccess`) by design — the whole purpose is joining a household you aren't yet in.
- `AcceptRaceError` class declared at module scope after the function (not nested inside) to avoid hoisting complexity while keeping it out of the module's public API.
- Prisma client must be generated in each fresh worktree via `npx prisma generate` — `src/generated/` is not committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `unstable_update` call shape from `{ activeHouseholdId }` to `{ user: { activeHouseholdId } }`**
- **Found during:** Task 2 (TypeScript check after implementing acceptInvitation)
- **Issue:** `unstable_update({ activeHouseholdId: householdId })` caused TS2353 — `activeHouseholdId` is not a top-level session field; it lives under `session.user` per `auth.ts` callbacks.session
- **Fix:** Changed call to `unstable_update({ user: { activeHouseholdId: householdId } })`; updated test assertions to match
- **Files modified:** `src/features/household/actions.ts`, `tests/phase-04/accept-invitation.test.ts`
- **Verification:** `npx tsc --noEmit` reports zero errors in `actions.ts`; all 16 tests pass
- **Committed in:** `edf5cff`

**2. [Rule 3 - Blocking] Generated Prisma client in worktree**
- **Found during:** Task 1 RED phase (test run)
- **Issue:** `src/generated/` folder doesn't exist in fresh worktrees; `@/generated/prisma/client` import fails for all tests
- **Fix:** Ran `npx prisma generate` once in the worktree to create `src/generated/prisma/`
- **Files modified:** `src/generated/prisma/` (generated, not committed)
- **Verification:** Tests resolve imports correctly after generation
- **Committed in:** Not committed (generated output, excluded by .gitignore)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness and test execution. No scope creep.

## Issues Encountered

- `INVITATION_ID = "inv_cuid_1234567890abc"` (22 chars) failed `z.cuid()` validation causing all `revokeInvitation` tests to return `{ error: "Invalid input." }`. Fixed by using a proper 25-char cuid-shaped constant.
- `--reporter=basic` flag not valid for this vitest version (same as Plan 02). Dropped and ran without flag.

## Known Stubs

None — all three test files have zero `test.todo` remaining. No production code stubs.

## Threat Flags

No new network endpoints or auth paths introduced beyond the Server Actions declared in the plan's threat model. T-04-03-01 through T-04-03-09 mitigations are implemented as specified:

- T-04-03-01: `updateMany WHERE tokenHash AND acceptedAt IS NULL AND revokedAt IS NULL` inside `db.$transaction` with `count === 0` guard
- T-04-03-02: `existing.householdId === parsed.data.householdId` cross-check in `revokeInvitation`
- T-04-03-03: `access.role !== "OWNER"` check at Step 5 in both `createInvitation` and `revokeInvitation`
- T-04-03-04: `unstable_update` called after `$transaction` commits (Pitfall 16)
- T-04-03-05: Error messages contain only UI-SPEC copy; `parsed.data.token` is never logged
- T-04-03-06: `aggregate._max.rotationOrder` + `householdMember.create` inside same `$transaction` as `invitation.updateMany`

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/features/household/actions.ts` has `createInvitation` export | FOUND |
| `src/features/household/actions.ts` has `revokeInvitation` export | FOUND |
| `src/features/household/actions.ts` has `acceptInvitation` export | FOUND |
| `tests/phase-04/create-invitation.test.ts` has zero `test.todo` | CONFIRMED |
| `tests/phase-04/revoke-invitation.test.ts` has zero `test.todo` | CONFIRMED |
| `tests/phase-04/accept-invitation.test.ts` has zero `test.todo` | CONFIRMED |
| 16 tests pass across 3 files | CONFIRMED |
| Commit `beaf00e` (Task 1) exists | FOUND |
| Commit `508fe14` (Task 2) exists | FOUND |
| Commit `edf5cff` (Rule 1 fix) exists | FOUND |
| Zero new TypeScript errors in src/ files | CONFIRMED |

## Next Phase Readiness

- `acceptInvitation` is ready for Wave 4 `/join/[token]` page (returns `{ success: true, redirectTo: "/h/<slug>/dashboard" }`)
- `createInvitation` and `revokeInvitation` are ready for Phase 6 settings UI
- No blockers for Wave 4

---
*Phase: 04-invitation-system*
*Completed: 2026-04-19*
