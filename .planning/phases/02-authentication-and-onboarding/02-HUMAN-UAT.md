---
status: partial
phase: 02-authentication-and-onboarding
source: [02-VERIFICATION.md]
started: 2026-04-14T10:00:00Z
updated: 2026-04-14T11:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Registration with email/password redirects to dashboard
expected: User registers, is auto-logged-in, redirected to /dashboard with onboarding banner
result: passed (user-verified during checkpoint)

### 2. Session persists across browser refresh
expected: After login, closing and reopening browser tab keeps user authenticated
result: pending

### 3. Logout from any page redirects to /login
expected: Clicking "Sign out" redirects to /login, /dashboard is blocked
result: passed (user-verified during checkpoint)

### 4. Onboarding prompts for plant count before dashboard
expected: After first login, onboarding banner shows with plant range buttons; selecting one collapses banner
result: passed (user-verified during checkpoint)

### 5. Unauthenticated users redirected to /login
expected: Visiting / or /dashboard in incognito redirects to /login
result: passed (user-verified during checkpoint)

## Summary

total: 5
passed: 4
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

### SC-4: Reminder preference not collected during onboarding
Design decision D-08 in 02-CONTEXT.md explicitly deferred this. Only plant count is collected.
status: accepted-deviation
