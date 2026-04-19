---
status: partial
phase: 04-invitation-system
source: [04-VERIFICATION.md]
started: 2026-04-19T11:50:00Z
updated: 2026-04-19T11:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Logged-out callbackUrl round-trip (login path)
expected: Sign out, open `/join/<valid-token>` directly. Branch 5a renders with "Sign in" / "Create account" buttons. Click "Sign in", complete login, verify redirect back to `/join/<same-token>` and Branch 5b confirm card renders with correct household name, owner, member count. `encodeURIComponent` on the callbackUrl produces a valid percent-encoded URL.
result: [pending]

### 2. Logged-out callbackUrl round-trip (register path)
expected: Same as #1 but via "Create account" → complete signup flow → verify redirect to `/join/<token>`. New user lands on 5b confirm; no auto-accept; explicit click required.
result: [pending]

### 3. Accept-and-land flow
expected: From Branch 5b as a logged-in user NOT in the household, click "Accept and join". Redirect to `/h/<newSlug>/dashboard`. On next page load, the household appears in the user's membership list and `session.user.activeHouseholdId === <newId>`. JWT reissued with new activeHouseholdId; dashboard renders household-scoped data.
result: [pending]

### 4. Revocation immediately invalidates link
expected: (a) Seed or generate an invitation; open `/join/<token>` to confirm Branch 5a or 5b renders. (b) Revoke it (Server Action invocation or direct `UPDATE Invitation SET revokedAt = NOW()`). (c) Refresh `/join/<token>` — Branch 2 (ShieldOff EmptyState, "This invite has been revoked") renders.
result: [pending]

### 5. Already-member branch (Branch 4)
expected: As a logged-in member of household H, open a still-valid, still-unrevoked invitation token for H. Branch 4 renders (Home icon, "You're already in {Household}", link to `/h/<slug>/dashboard`), not Branch 5b. Branch 4 takes precedence over Branch 5b when membership exists.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
