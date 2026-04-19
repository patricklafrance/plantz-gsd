---
status: resolved
phase: 04-invitation-system
source: [04-VERIFICATION.md]
started: 2026-04-19T11:50:00Z
updated: 2026-04-19T14:05:00Z
---

## Current Test

[all 5 passed — GAP-04-01 fixed inline, re-verified end-to-end via Chrome DevTools MCP]

## Tests

### 1. Logged-out callbackUrl round-trip (login path)
expected: Sign out, open `/join/<valid-token>` directly. Branch 5a renders with "Sign in" / "Create account" buttons. Click "Sign in", complete login, verify redirect back to `/join/<same-token>` and Branch 5b confirm card renders with correct household name, owner, member count. `encodeURIComponent` on the callbackUrl produces a valid percent-encoded URL.
result: passed (after GAP-04-01 fix, commit 3d70796) — Chrome DevTools MCP drove the flow end-to-end: logged-out visitor saw Branch 5a with `callbackUrl=%2Fjoin%2F<token>` encoded on both auth links; after sign-in, landed on `/join/<token>` with Branch 5b confirm card showing "My Plants / pat@pat.com / 2 members".

### 2. Logged-out callbackUrl round-trip (register path)
expected: Same as #1 but via "Create account" → complete signup flow → verify redirect to `/join/<token>`. New user lands on 5b confirm; no auto-accept; explicit click required.
result: passed (after GAP-04-01 fix, commit 3d70796) — Chrome DevTools MCP: new account registration landed on `/join/<token>` with Branch 5b confirm card; explicit click still required to accept.

### 3. Accept-and-land flow
expected: From Branch 5b as a logged-in user NOT in the household, click "Accept and join". Redirect to `/h/<newSlug>/dashboard`. On next page load, the household appears in the user's membership list and `session.user.activeHouseholdId === <newId>`. JWT reissued with new activeHouseholdId; dashboard renders household-scoped data.
result: passed

### 4. Revocation immediately invalidates link
expected: (a) Seed or generate an invitation; open `/join/<token>` to confirm Branch 5a or 5b renders. (b) Revoke it (Server Action invocation or direct `UPDATE Invitation SET revokedAt = NOW()`). (c) Refresh `/join/<token>` — Branch 2 (ShieldOff EmptyState, "This invite has been revoked") renders.
result: passed

### 5. Already-member branch (Branch 4)
expected: As a logged-in member of household H, open a still-valid, still-unrevoked invitation token for H. Branch 4 renders (Home icon, "You're already in {Household}", link to `/h/<slug>/dashboard`), not Branch 5b. Branch 4 takes precedence over Branch 5b when membership exists.
result: passed

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### GAP-04-01: callbackUrl query param ignored by login + register forms (blocks SC-2) — RESOLVED

**Source tests:** UAT #1 (login path), UAT #2 (register path)

**Behavior observed:** A logged-out user who visits `/join/<token>` sees Branch 5a with "Sign in" / "Create account" links pointing to `/login?callbackUrl=%2Fjoin%2F<token>` and `/register?callbackUrl=%2Fjoin%2F<token>` (correctly URL-encoded — WR-02 fix verified). After completing login or registration, the user lands at `/dashboard` (or their own auto-created household's dashboard) instead of returning to `/join/<token>` to accept the invitation.

**Root cause:** Both auth forms hardcode `redirectTo: "/dashboard"` and never read the `callbackUrl` query param:
- `src/components/auth/login-form.tsx:46` — `signIn("credentials", { ..., redirectTo: "/dashboard" })`
- `src/features/auth/actions.ts:124` — inside `registerUser`, `signIn("credentials", { ..., redirectTo: "/dashboard" })`

NextAuth v5 does not auto-read `callbackUrl` from the URL when an explicit `redirectTo` is passed — the explicit value wins.

**Why the verifier missed it:** The verifier traced the join page → callbackUrl construction (WR-02 fix) and stopped there, assuming NextAuth would auto-consume the query param. The forms were never inspected for `useSearchParams` / `callbackUrl` handling.

**Impact:** Blocks ROADMAP Phase 4 success criterion #2 (“the token survives the authentication redirect and the join-confirm page appears after login”). The invitation flow is unusable for any non-existing user — the entire purpose of supporting the logged-out path.

**Required fix:**
1. `src/components/auth/login-form.tsx`: read `callbackUrl` via `useSearchParams()`; pass it to `signIn("credentials", { ..., redirectTo: callbackUrl ?? "/dashboard" })`. Validate that `callbackUrl` is a same-origin relative path before honoring it (open-redirect guard).
2. `src/components/auth/register-form.tsx`: read `callbackUrl` via `useSearchParams()`; thread it to `registerUser({ ..., callbackUrl })`.
3. `src/features/auth/actions.ts` (`registerUser`): accept optional `callbackUrl: string`; validate same-origin; pass to `signIn("credentials", { ..., redirectTo: callbackUrl ?? "/dashboard" })`.
4. Add a relative-path validator helper (e.g. `validateCallbackUrl(url): string | null` that rejects absolute URLs, protocol-relative URLs, and non-`/`-prefixed values) — reuse in both spots.
5. Add unit tests for the validator and end-to-end coverage in `tests/phase-04/` for the round-trip.

status: resolved (commit 3d70796 — verified end-to-end via Chrome DevTools MCP on 2026-04-19)
