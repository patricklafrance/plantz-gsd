---
status: partial
phase: 01-schema-foundation-data-migration
source: [01-VERIFICATION.md]
started: 2026-04-16T22:45:00Z
updated: 2026-04-16T22:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end signup smoke test — register a new user via the UI
expected: User lands on /dashboard; DB has a new User row + a Household row (name='My Plants', 8-char unambiguous slug, timezone matches browser, cycleDuration=7, rotationStrategy='sequential') + a HouseholdMember row (role='OWNER', rotationOrder=0)
result: [pending]

### 2. Verify session.user.activeHouseholdId is populated after a fresh sign-in
expected: After signing in with an existing account (or immediately after registering), inspecting the JWT cookie or calling a Server Component that reads session.user.activeHouseholdId should return the user's single household id, not null/undefined
result: [pending]

### 3. Confirm requireHouseholdAccess throws and is caught correctly in a real Server Action path
expected: Calling a future Phase 2 Server Action with an invalid householdId yields a ForbiddenError and an observable 403-equivalent response; instanceof check works across module boundaries
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
