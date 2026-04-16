---
phase: 02-authentication-and-onboarding
fixed_at: 2026-04-14T12:15:00Z
review_path: .planning/phases/02-authentication-and-onboarding/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-14T12:15:00Z
**Source review:** .planning/phases/02-authentication-and-onboarding/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Insecure Direct Object Reference (IDOR) in completeOnboarding

**Files modified:** `src/features/auth/actions.ts`, `src/components/onboarding/onboarding-banner.tsx`
**Commit:** ac1ffd9
**Applied fix:** Removed client-supplied `userId` parameter from `completeOnboarding` server action. The function now calls `auth()` to get the server session and uses `session.user.id` for the database update. Updated `OnboardingBanner` to stop passing `userId` to the action call. This eliminates the IDOR vulnerability where any client could modify another user's onboarding state.

### WR-01: DATABASE_URL non-null assertion fails silently

**Files modified:** `src/lib/db.ts`
**Commit:** dcbdf2f
**Applied fix:** Replaced `process.env.DATABASE_URL!` non-null assertion with an explicit guard that throws a descriptive error if `DATABASE_URL` is not set. This produces a clear startup failure message instead of a confusing runtime error deep in the Prisma adapter.

### WR-02: Route protection uses allowlist of protected paths instead of denylist of public paths

**Files modified:** `auth.config.ts`
**Commit:** 46dce71
**Applied fix:** Replaced the allowlist pattern (only `/dashboard`, `/plants`, `/rooms` protected) with a denylist pattern (only `/login` and `/register` are public, all other routes require authentication). This ensures any new routes added to the app are protected by default, preventing accidental authorization bypasses.

### WR-03: Proxy matcher excludes all /api routes from authentication

**Files modified:** `proxy.ts`
**Commit:** b77301a
**Applied fix:** Narrowed the proxy matcher exclusion from `api` (all API routes) to `api/auth` (only NextAuth API routes). This ensures that any future API routes (e.g., `/api/plants`, `/api/users`) will be covered by the proxy-level auth check, while the NextAuth handler routes continue to manage their own authentication.

### WR-04: useFormField guard runs after the value it guards is already used

**Files modified:** `src/components/ui/form.tsx`
**Commit:** bf2d9e3
**Applied fix:** Moved the `fieldContext.name` guard to run before `getFieldState(fieldContext.name, formState)` is called. Changed the guard condition from `!fieldContext` (which was always truthy due to the `{}` default) to `!fieldContext.name` (which correctly detects the missing-provider case). This ensures the error is thrown before `undefined` is passed to `getFieldState`.

## Skipped Issues

None -- all in-scope findings were successfully fixed.

---

_Fixed: 2026-04-14T12:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
