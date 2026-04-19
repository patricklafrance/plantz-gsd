---
phase: 04-invitation-system
plan: "04"
subsystem: household
tags: [server-actions, membership, prisma, transaction, nextauth, vitest, tdd, role-based-access]

dependency_graph:
  requires:
    - phase: 04-01
      provides: "leaveHouseholdSchema, removeMemberSchema, promoteMemberSchema, demoteMemberSchema (schema.ts); unstable_update (auth.ts); requireHouseholdAccess, ForbiddenError (guards.ts)"
    - phase: 04-03
      provides: "src/features/household/actions.ts with createInvitation, revokeInvitation, acceptInvitation; transitionCycle import already present"
  provides:
    - "src/features/household/actions.ts — leaveHousehold, removeMember, promoteToOwner, demoteToMember Server Actions"
    - "tests/phase-04/leave-household.test.ts — 8 mocked-Prisma unit tests (INVT-05)"
    - "tests/phase-04/remove-member.test.ts — 6 mocked-Prisma unit tests (INVT-06)"
    - "tests/phase-04/promote-demote.test.ts — 8 mocked-Prisma unit tests (INVT-06)"
  affects:
    - "Phase 6 settings UI (calls leaveHousehold, removeMember, promoteToOwner, demoteToMember)"
    - "04-05 (Wave 4 public /join/[token] page — depends on full Phase 4 Server Action surface)"

tech-stack:
  added: []
  patterns:
    - "Last-OWNER pre-check pattern: count OWNERs WHERE userId NOT IN { subject } to prevent 0-OWNER household state"
    - "D-14 terminal case: db.household.delete (cascade) used only when sole-member + last-OWNER — never householdMember.delete"
    - "transitionCycle called outside $transaction when subject is active assignee (RESEARCH §Pattern 5 — no nesting)"
    - "unstable_update({ user: { activeHouseholdId: remaining?.householdId ?? undefined } }) after DB write for leaveHousehold JWT refresh"
    - "removeMember deliberately omits unstable_update — D-16.5 binding: removed user fails at requireHouseholdAccess on next request"
    - "Self-target guard in removeMember runs BEFORE requireHouseholdAccess for cleaner error UX"
    - "Idempotent promote/demote: target already at desired role returns { success: true } without DB write"

key-files:
  created:
    - tests/phase-04/leave-household.test.ts
    - tests/phase-04/remove-member.test.ts
    - tests/phase-04/promote-demote.test.ts
  modified:
    - src/features/household/actions.ts (added leaveHousehold, removeMember, promoteToOwner, demoteToMember + schema imports)

key-decisions:
  - "unstable_update receives ?? undefined (not ?? null) — auth.ts callbacks.session shape types activeHouseholdId as string | undefined, not string | null; ?? null caused TS2322"
  - "leaveHousehold calls unstable_update with remaining?.householdId ?? undefined; removeMember deliberately omits the call (D-16.5 binding)"
  - "Pitfall 6 last-OWNER count always excludes the subject user (userId: { not: targetUserId }) in both removeMember and demoteToMember"

patterns-established:
  - "Pattern: ?? undefined over ?? null when passing optional fields into unstable_update (auth.ts type constraint)"
  - "Pattern: Self-target guard before role check in removeMember — avoids confusing 'not authorized' error when user tries to remove themselves"

requirements-completed: [INVT-05, INVT-06]

duration: ~15min
completed: "2026-04-19"
---

# Phase 04 Plan 04: Membership Mutation Server Actions — leaveHousehold, removeMember, promoteToOwner, demoteToMember Summary

**Four membership-mutation Server Actions completing INVT-05/06: last-OWNER guards, D-14 cascade terminal, transitionCycle wiring for active-assignee departure, and co-owner promote/demote primitives with idempotency.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-19T23:00:00Z
- **Completed:** 2026-04-19T23:10:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Implemented `leaveHousehold` with D-13 last-OWNER pre-check (blocks multi-member sole-OWNER leave), D-14 terminal case (`db.household.delete` cascade for sole-member-last-OWNER), assignee transition via `transitionCycle(householdId, "member_left")` called before member-delete tx, future availability cancel in same `$transaction` as member delete, and JWT refresh via `unstable_update`
- Implemented `removeMember` with self-target rejection before role check, OWNER role gate, Pitfall 6 last-OWNER protection (count excludes `targetUserId`), display name in last-OWNER error, and `transitionCycle` wiring; explicitly omits `unstable_update` per D-16.5
- Implemented `promoteToOwner` and `demoteToMember`: both OWNER-gated, idempotent on already-target-role, `demoteToMember` uses `userId: { not: targetUserId }` count filter; UI-SPEC verbatim error strings throughout
- 22 mocked-Prisma unit tests pass across three files (8 leave + 6 remove + 8 promote/demote); full phase-04 suite is 48/48 passing (12 todo stubs from other plans)

## Task Commits

1. **Task 1: leaveHousehold** - `412d6bf` (feat)
2. **Task 2: removeMember** - `b29418c` (feat)
3. **Task 3: promoteToOwner + demoteToMember + Rule 1 fix** - `98d5180` (feat)

## Files Created/Modified

- `src/features/household/actions.ts` — added `leaveHouseholdSchema`, `removeMemberSchema`, `promoteMemberSchema`, `demoteMemberSchema` to schema import; appended `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember`
- `tests/phase-04/leave-household.test.ts` — replaced 5 `test.todo` stubs with 8 real tests (INVT-05)
- `tests/phase-04/remove-member.test.ts` — replaced 4 `test.todo` stubs with 6 real tests (INVT-06)
- `tests/phase-04/promote-demote.test.ts` — replaced 6 `test.todo` stubs with 8 real tests (INVT-06)

## Decisions Made

- `unstable_update` must receive `?? undefined` not `?? null` — the `activeHouseholdId` field on `session.user` is typed `string | undefined` per `auth.ts`'s `callbacks.session` shape. Passing `null` caused TS2322. Fixed in Task 3 commit alongside the promote/demote implementation.
- `removeMember` deliberately omits `unstable_update` for the removed user — this is the D-16.5 binding. The removed user's next request hits `requireHouseholdAccess`, finds no membership row, and throws `ForbiddenError`; the error boundary routes them to a safe page. No server-push mechanism needed.
- Self-target guard in `removeMember` runs before `requireHouseholdAccess` — gives the caller a more actionable error ("use Leave instead of Remove") rather than an authorization error, without revealing whether the action would have been authorized.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `unstable_update` call: `?? null` → `?? undefined`**
- **Found during:** Task 3 (TypeScript check after implementing promoteToOwner/demoteToMember)
- **Issue:** `unstable_update({ user: { activeHouseholdId: remaining?.householdId ?? null } })` caused TS2322 — `activeHouseholdId` is typed `string | undefined` in `auth.ts`'s session shape, not `string | null`
- **Fix:** Changed to `?? undefined`; updated two `leave-household.test.ts` assertions from `null` to `undefined`
- **Files modified:** `src/features/household/actions.ts`, `tests/phase-04/leave-household.test.ts`
- **Verification:** `npx tsc --noEmit` reports zero errors in `actions.ts`; all 22 tests pass
- **Committed in:** `98d5180` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Fix required for type correctness. No behavior change — `undefined` and `null` both clear the JWT field at the `callbacks.session` layer (line 40 of `auth.ts`: `typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined`).

## Issues Encountered

- The plan's `<action>` block specifies `unstable_update({ activeHouseholdId: ... })` (top-level field) but Plan 03's SUMMARY established that the correct shape is `{ user: { activeHouseholdId } }`. The plan's action block used the top-level form; implementation used the correct nested form per the established pattern from Plan 03.

## Known Stubs

None — all three test files have zero `test.todo` remaining. No production code stubs.

## Threat Flags

No new network endpoints or auth paths introduced beyond the Server Actions declared in the plan's threat model. All STRIDE mitigations verified by tests:

- T-04-04-01: Every action checks `access.role !== "OWNER"` at Step 5 — verified by "non-OWNER caller" tests
- T-04-04-02: `requireHouseholdAccess` throws `ForbiddenError` for non-members — forwarded at catch
- T-04-04-03: `leaveHousehold` last-OWNER pre-check + D-14 terminal case — verified by tests 1 and 4
- T-04-04-04: `removeMember` last-OWNER count uses `userId: { not: targetUserId }` — verified by Pitfall 6 test
- T-04-04-05: `db.householdMember.findFirst({ where: { householdId, userId: targetUserId } })` — cross-household mismatch → "Member not found"
- T-04-04-06: `transitionCycle` uses `FOR UPDATE SKIP LOCKED` (Phase 3 contract) — race handled by skipped result
- T-04-04-08: `unstable_update` called post-DB in `leaveHousehold` — verified by test 8; `removeMember` correctly omits it

## Self-Check

| Item | Status |
|------|--------|
| `src/features/household/actions.ts` has `leaveHousehold` export | FOUND (line 529) |
| `src/features/household/actions.ts` has `removeMember` export | FOUND (line 637) |
| `src/features/household/actions.ts` has `promoteToOwner` export | FOUND (line 727) |
| `src/features/household/actions.ts` has `demoteToMember` export | FOUND (line 776) |
| D-13 verbatim error string present | FOUND (line 579) |
| D-14 `db.household.delete` present | FOUND (line 586) |
| `transitionCycle(..., "member_left")` present | FOUND (lines 594, 693) |
| `unstable_update` present in `leaveHousehold` | FOUND (line 620) |
| `unstable_update` absent from `removeMember` | CONFIRMED |
| `tests/phase-04/leave-household.test.ts` — 8 tests, zero `test.todo` | CONFIRMED |
| `tests/phase-04/remove-member.test.ts` — 6 tests, zero `test.todo` | CONFIRMED |
| `tests/phase-04/promote-demote.test.ts` — 8 tests, zero `test.todo` | CONFIRMED |
| 22 tests pass across three files | CONFIRMED |
| Zero new TypeScript errors in `actions.ts` | CONFIRMED |
| Commit `412d6bf` (Task 1) exists | FOUND |
| Commit `b29418c` (Task 2) exists | FOUND |
| Commit `98d5180` (Task 3) exists | FOUND |

## Self-Check: PASSED

## Next Phase Readiness

- All 7 Phase 4 Server Actions are in `src/features/household/actions.ts` (createInvitation, revokeInvitation, acceptInvitation, leaveHousehold, removeMember, promoteToOwner, demoteToMember)
- Phase 6 settings UI can consume all four membership-mutation actions — signatures are locked
- No blockers for Wave 4 (04-05) or subsequent plans

---
*Phase: 04-invitation-system*
*Completed: 2026-04-19*
