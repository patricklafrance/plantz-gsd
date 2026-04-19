---
phase: 04-invitation-system
plan: "01"
subsystem: household
tags: [scaffolding, crypto, auth, schemas, test-stubs]
dependency_graph:
  requires: []
  provides:
    - src/lib/crypto.ts (generateInvitationToken, hashInvitationToken)
    - auth.ts (unstable_update export)
    - src/features/household/schema.ts (7 Phase 4 Zod schemas + types)
    - tests/phase-04/fixtures.ts (EMAIL_PREFIX, createHouseholdWithInvitation)
    - tests/phase-04/*.test.ts (14 stub files with test.todo markers)
  affects:
    - All Wave 2/3/4 plans that import from src/lib/crypto.ts
    - All Wave 2/3/4 plans that import from auth.ts (unstable_update)
    - All Wave 2/3/4 plans that import Phase 4 schemas from schema.ts
    - All Wave 2/3/4 test files that use tests/phase-04/fixtures.ts
tech_stack:
  added: []
  patterns:
    - node:crypto namespaced import for CSPRNG + SHA-256 (crypto.ts)
    - unstable_update re-export from NextAuth factory (auth.ts line 9)
    - Phase 4 Zod schemas appended to schema.ts (D-16 hidden-field convention)
    - test.todo stubs with [INVT-XX] requirement-ID prefixes
    - createHouseholdWithInvitation helper extending createHouseholdWithMembers
key_files:
  created:
    - src/lib/crypto.ts
    - tests/phase-04/fixtures.ts
    - tests/phase-04/create-invitation.test.ts
    - tests/phase-04/revoke-invitation.test.ts
    - tests/phase-04/accept-invitation.test.ts
    - tests/phase-04/resolve-invitation.test.ts
    - tests/phase-04/get-household-invitations.test.ts
    - tests/phase-04/get-household-members.test.ts
    - tests/phase-04/leave-household.test.ts
    - tests/phase-04/remove-member.test.ts
    - tests/phase-04/promote-demote.test.ts
    - tests/phase-04/join-page-branches.test.ts
    - tests/phase-04/accept-invitation-concurrency.test.ts
    - tests/phase-04/leave-household-sole.test.ts
    - tests/phase-04/assignee-leaves.test.ts
    - tests/phase-04/jwt-refresh.test.ts
  modified:
    - auth.ts (line 9: add unstable_update to destructured export)
    - src/features/household/schema.ts (append 7 Zod schemas + 7 types)
decisions:
  - "Matched phase-03/fixtures.ts untyped tx pattern (same pre-existing TS7006 baseline error)"
  - "Used node:crypto namespaced import in crypto.ts per RESEARCH §Pattern 1, not bare crypto import used in slug.ts"
  - "All 7 schemas use z.cuid() (not z.string().cuid()) matching existing schema.ts convention"
metrics:
  duration: ~13 minutes
  completed: "2026-04-19T02:31:35Z"
  tasks: 3
  files_created: 17
  files_modified: 2
---

# Phase 04 Plan 01: Wave 0 Scaffolding — Crypto Helper, Schemas, Test Stubs Summary

**One-liner:** Wave 0 scaffolding landing CSPRNG token helper (`crypto.randomBytes(32)`/SHA-256), `unstable_update` re-export, 7 Zod schemas, and 14 test stubs that Wave 2/3/4 executors grep-and-replace without authoring tests from scratch.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add crypto helper and unstable_update export | 359f41e | src/lib/crypto.ts (new), auth.ts (modified) |
| 2 | Append Phase 4 Zod schemas to household/schema.ts | a54516b | src/features/household/schema.ts (7 new schemas + types) |
| 3 | Create phase-04 test fixtures and 14 test stub files | 7e117b7 | tests/phase-04/fixtures.ts + 14 .test.ts stubs |

## What Was Built

### Task 1: Crypto Helper + unstable_update

`src/lib/crypto.ts` provides two exported functions:
- `generateInvitationToken()` — calls `randomBytes(32).toString('hex')` for 256-bit entropy, returns `{ rawToken, tokenHash }` where `tokenHash` is the SHA-256 hex digest. Only `tokenHash` is ever persisted.
- `hashInvitationToken(rawToken)` — symmetric lookup helper used by `acceptInvitation` and `resolveInvitationByToken` to recover the hash from the URL segment.

`auth.ts` line 9 now exports `unstable_update` from the NextAuth factory, enabling Server Actions to call it without importing directly from `next-auth`.

### Task 2: Phase 4 Zod Schemas

Seven schemas appended to `src/features/household/schema.ts`:
1. `createInvitationSchema` — `{ householdId, householdSlug }` (OWNER-gated)
2. `revokeInvitationSchema` — `{ invitationId, householdId, householdSlug }` (OWNER-gated)
3. `acceptInvitationSchema` — `{ token }` only (no household gate — caller proves intent by holding token)
4. `leaveHouseholdSchema` — `{ householdId, householdSlug }` (last-owner pre-check at action layer)
5. `removeMemberSchema` — `{ householdId, householdSlug, targetUserId }` (OWNER-gated)
6. `promoteMemberSchema` — `{ householdId, householdSlug, targetUserId }` (OWNER-gated, idempotent)
7. `demoteMemberSchema` — `{ householdId, householdSlug, targetUserId }` (separate export for grep-friendliness)

All mutating schemas except `acceptInvitationSchema` include both `householdId` and `householdSlug` per D-16 grep-consistency convention.

### Task 3: Phase-04 Test Fixtures + 14 Stubs

`tests/phase-04/fixtures.ts` exports:
- `RUN_ID`, `EMAIL_PREFIX` (`phase04-test-${RUN_ID}`)
- `emailFor(tag)`, `createBareUser()`, `createHouseholdWithMembers(memberCount, ownerAtOrder?)`
- `createHouseholdWithInvitation(memberCount?)` — extends `createHouseholdWithMembers`, inserts one active `Invitation` row using `generateInvitationToken()`, returns `{ ...household, invitationId, rawToken, tokenHash }`

14 stub test files with `test.todo` markers mapping to INVT-01..06 and D-23..27 requirements. All 51 todos are pending; `npx vitest run tests/phase-04/` exits 0.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (crypto.ts, auth.ts) | OK — zero errors in task files |
| `npx tsc --noEmit` (schema.ts) | OK — zero errors |
| `npx tsc --noEmit` (phase-04 tests) | 1 TS7006 in fixtures.ts (same pre-existing pattern as phase-03/fixtures.ts) |
| `grep "from \"node:crypto\""` | Line 15 in crypto.ts |
| `grep "unstable_update"` auth.ts | Line 9 |
| `grep -c "^export const.*Schema"` schema.ts | 15 (>= required 9) |
| `npx vitest run tests/phase-04/` | 14 files skipped, 51 todos, 0 failures |
| `ls tests/phase-04/*.test.ts \| wc -l` | 14 |
| `grep "createHouseholdWithInvitation"` fixtures.ts | Exported at line 161 |
| `grep "phase04-test-"` fixtures.ts | Match (EMAIL_PREFIX correct) |
| No unexpected file deletions | Confirmed |

## Deviations from Plan

### TS7006 in tests/phase-04/fixtures.ts (accepted baseline pattern)

**Found during:** Task 3

**Issue:** The `$transaction(async (tx) => {...})` callback has an implicit `any` type for `tx` (TS7006). Attempted to fix with `import type { Prisma } from "@/generated/prisma/client"` and `tx: Prisma.TransactionClient` annotation, but the generated Prisma client isn't generated in this worktree, causing a TS2307 error — a worse delta than the original TS7006.

**Decision:** Reverted to the same untyped `tx` pattern used in `tests/phase-03/fixtures.ts` (line 99), which has an identical pre-existing TS7006 error accepted in the baseline. The phase-04 fixtures mirror that exact pattern. Net delta: +1 TS7006 matching the established baseline pattern category.

**Files modified:** `tests/phase-04/fixtures.ts`

## Known Stubs

All 14 test files are intentional stubs — Wave 2/3/4 executors replace `test.todo` with real `test(` implementations. No production code stubs exist.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes were introduced. `src/lib/crypto.ts` is a pure utility with no runtime side effects. `auth.ts` adds a re-export of an existing NextAuth API function. Test fixtures are test-only code.

T-04-01-01 and T-04-01-02 from the plan's threat register are mitigated: `generateInvitationToken` uses `randomBytes(32)` (256-bit entropy per D-01), and only `tokenHash` (SHA-256) is returned to callers for DB persistence — the raw token is ephemeral in memory only.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/crypto.ts exists | FOUND |
| tests/phase-04/fixtures.ts exists | FOUND |
| 14 .test.ts stubs exist | FOUND |
| Commit 359f41e (Task 1) exists | FOUND |
| Commit a54516b (Task 2) exists | FOUND |
| Commit 7e117b7 (Task 3) exists | FOUND |
| auth.ts has unstable_update on line 9 | FOUND |
| schema.ts has 15 exported Schema constants (>= 9) | FOUND |
