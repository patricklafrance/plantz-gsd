---
phase: 04-invitation-system
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - auth.config.ts
  - auth.ts
  - proxy.ts
  - src/app/join/[token]/accept-form.tsx
  - src/app/join/[token]/page.tsx
  - src/components/household/destructive-leave-dialog.tsx
  - src/features/household/actions.ts
  - src/features/household/queries.ts
  - src/features/household/schema.ts
  - src/lib/crypto.ts
  - tests/phase-04/accept-invitation-concurrency.test.ts
  - tests/phase-04/accept-invitation.test.ts
  - tests/phase-04/assignee-leaves.test.ts
  - tests/phase-04/create-invitation.test.ts
  - tests/phase-04/fixtures.ts
  - tests/phase-04/get-household-invitations.test.ts
  - tests/phase-04/get-household-members.test.ts
  - tests/phase-04/join-page-branches.test.ts
  - tests/phase-04/jwt-refresh.test.ts
  - tests/phase-04/leave-household-sole.test.ts
  - tests/phase-04/leave-household.test.ts
  - tests/phase-04/promote-demote.test.ts
  - tests/phase-04/remove-member.test.ts
  - tests/phase-04/resolve-invitation.test.ts
  - tests/phase-04/revoke-invitation.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 4 delivers the invitation lifecycle (create, revoke, accept), membership mutations (leave, remove, promote, demote), the public `/join/[token]` routing with 5-branch logic, auth carve-out in `proxy.ts`, and JWT refresh via `unstable_update`. The core implementation is solid: the atomic `updateMany` concurrency guard prevents duplicate membership, the `AcceptRaceError` sentinel cleanly short-circuits the transaction on race loss, the crypto module correctly never persists the raw token, and the OWNER-gate pattern is consistently applied across all mutation actions.

No critical issues were found. Three warnings address a schema validation gap, a potential encoding fragility in URL construction, and a `leaveHousehold` logic gap for a low-probability but reachable state. Four info items cover coding conventions and minor defensive hardening.

---

## Warnings

### WR-01: `acceptInvitationSchema` accepts tokens of any length — no format guard

**File:** `src/features/household/schema.ts:117`
**Issue:** The `acceptInvitationSchema` validates the token with only `z.string().min(1)`. A caller can submit a 1-character string that passes schema validation, proceeds through SHA-256 hashing, and hits `db.invitation.findUnique` with a hash that will never match. The actual token is always 64 hex characters (256-bit entropy from `randomBytes(32).toString("hex")` in `crypto.ts`). Without an explicit length+format guard, the schema provides no defense against trivially malformed inputs reaching the database.

**Fix:**
```typescript
export const acceptInvitationSchema = z.object({
  // Raw token is always 64 hex chars (randomBytes(32).toString("hex"))
  token: z.string().regex(/^[0-9a-f]{64}$/, "Invalid invitation token format."),
});
```
This eliminates the DB round-trip for obviously invalid tokens and makes the schema self-documenting about the token format.

---

### WR-02: `callbackUrl` in join page uses unencoded token in query parameter

**File:** `src/app/join/[token]/page.tsx:194,205`
**Issue:** The `callbackUrl` query parameter is constructed without `encodeURIComponent`:
```tsx
href={`/login?callbackUrl=/join/${token}`}
href={`/register?callbackUrl=/join/${token}`}
```
The current token format is lowercase hex, which is URL-safe, so this does not break today. However, if the token format ever changes (e.g., base64url encoding), this silently produces a malformed URL. The `callbackUrl` value `/join/<token>` contains a path separator `/` which must be percent-encoded when embedded as a query parameter value, or the query string parser may misinterpret it.

**Fix:**
```tsx
href={`/login?callbackUrl=${encodeURIComponent(`/join/${token}`)}`}
href={`/register?callbackUrl=${encodeURIComponent(`/join/${token}`)}`}
```
NextAuth v5 accepts percent-encoded `callbackUrl` values and decodes them before redirecting, so this is a safe change.

---

### WR-03: `leaveHousehold` orphans a household when the sole non-owner member leaves

**File:** `src/features/household/actions.ts:572-586`
**Issue:** The terminal household-delete branch at line 584 fires only when `isSoleMember && callerIsOwner && otherOwnerCount === 0`. A sole `MEMBER` (not OWNER) triggers `isSoleMember = true` but `callerIsOwner = false`, so the terminal branch is skipped. The else-branch then deletes the `HouseholdMember` row, leaving a household with zero members and no OWNER in the database.

This state is reachable today: Owner A creates a household, invites MEMBER B (joins with `role: "MEMBER"`), Owner A calls `leaveHousehold`. The last-OWNER pre-check at line 573 blocks A (`wouldBeLastOwnerBlocked = true`), forcing A to first promote B. After B is promoted to OWNER, A can leave — leaving B as sole OWNER. At that point B's leave correctly hits the terminal case.

However, the path `sole MEMBER calls leaveHousehold` can be reached if a household is left in the state of having only MEMBER rows (e.g., via a future admin tool, a migration error, or a direct DB edit during development). In that scenario, `leaveHousehold` removes the last member row without deleting the household, leaving an orphan.

**Fix:** Extend the terminal condition to include a sole member regardless of role:
```typescript
// D-14 terminal: sole member leaves, delete the entire household.
// The callerIsOwner && otherOwnerCount === 0 guard is redundant when isSoleMember
// is true — if there's only one member and they're leaving, no one remains.
if (isSoleMember) {
  await db.household.delete({ where: { id: householdId } });
} else {
  // ...
}
```
The existing `wouldBeLastOwnerBlocked` guard (line 573) still correctly prevents a sole OWNER in a multi-member household from leaving without promotion. The `isSoleMember` shortcut simply ensures the sole-member terminal case is always a clean delete.

---

## Info

### IN-01: `AcceptRaceError` class defined after its use site in the file

**File:** `src/features/household/actions.ts:474,492,514`
**Issue:** `AcceptRaceError` is thrown at line 474 and caught at line 492, but the class declaration appears at line 514 — after the `acceptInvitation` function body that uses it. In ES modules, class declarations are NOT hoisted (they are in the temporal dead zone until the declaration is evaluated). This works at runtime because the class is evaluated before `acceptInvitation` is ever *called*, but it violates the "define before use" convention and would cause a `ReferenceError` if the class were ever referenced during module initialization.

**Fix:** Move the `AcceptRaceError` class declaration to before `acceptInvitation` (around line 428), or to a dedicated errors module.

---

### IN-02: `householdSlug` in schemas is validated but unused in most actions

**File:** `src/features/household/schema.ts:85,95,107,128,139,150,163`
**Issue:** Most Phase 4 schemas include `householdSlug: z.string().min(1)` (e.g., `createInvitationSchema`, `leaveHouseholdSchema`, `removeMemberSchema`, `promoteMemberSchema`, `demoteMemberSchema`). However, the corresponding actions (`createInvitation`, `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember`) use `HOUSEHOLD_PATHS.settings` or `HOUSEHOLD_PATHS.dashboard` as hardcoded paths in `revalidatePath` rather than constructing the path from `parsed.data.householdSlug`. The slug field is parsed and validated but its value is silently discarded in these actions. This creates dead input fields that inflate the attack surface without providing value.

**Fix:** Either use `parsed.data.householdSlug` in `revalidatePath` to construct household-specific paths (more targeted cache invalidation), or remove `householdSlug` from schemas where it is not consumed. Check what `HOUSEHOLD_PATHS.settings` resolves to — if it's a static string, household-specific revalidation is not happening.

---

### IN-03: `todayStart` server-local time in `leaveHousehold` and `removeMember` is undocumented

**File:** `src/features/household/actions.ts:598-599,700-701`
**Issue:** Both `leaveHousehold` and `removeMember` use `new Date()` then `setHours(0, 0, 0, 0)` for the availability cancellation cutoff. This uses server-local time (UTC on serverless deployments). The `createAvailabilitySchema` in `schema.ts` has a comment at line 62 acknowledging this timezone issue for the start-date refinement, but the corresponding comment is absent in both action bodies where the same "start of day UTC" assumption applies to cancellation. A user in UTC+12 could have their "today" availability cancelled unexpectedly.

**Fix:** Add a comment in both action bodies matching the acknowledgment in `schema.ts`:
```typescript
// Note: uses server-local "today" (typically UTC on serverless).
// Phase 6 may thread household timezone for timezone-aware cancellation.
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
```
No code change is required — this is a documentation gap, not a behavior change.

---

### IN-04: Concurrency test mocks `auth()` for both concurrent calls — does not simulate independent sessions

**File:** `tests/phase-04/accept-invitation-concurrency.test.ts:70-73`
**Issue:** The two-concurrent-accept test at line 70 calls `mockSessionFor(joiner.id)` once before launching both concurrent `acceptInvitation` calls. Since Vitest mocks are synchronous, both concurrent calls share the same mock resolution. In production, two separate users (not the same user) racing to accept the same token is the meaningful concurrency scenario. The current test verifies the DB atomicity guard (the `updateMany` count check) but not the case where two distinct users simultaneously accept the same invitation.

This does not constitute a false-positive test — the DB-level `updateMany` guard is correctly exercised. However, the test comment at line 68 says "both concurrent calls share the same mocked session," which should note the consequence: the test primarily validates the DB guard, not the "two users" scenario. A separate test with two distinct `userId`s passed to the same `rawToken` would complete the coverage.

**Fix:** Add a third test case that creates two distinct users and races them, asserting exactly one membership row exists and one of the two users is the member. No change to existing tests required.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
