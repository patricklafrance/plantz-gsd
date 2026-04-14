---
phase: 02-authentication-and-onboarding
verified: 2026-04-14T14:54:04Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "After first login, user is prompted for plant count and reminder preference before reaching the dashboard"
    status: partial
    reason: "Only plant count range is collected in onboarding. Reminder preference was explicitly deferred by design decision D-08 (see 02-CONTEXT.md). The roadmap success criterion includes 'and reminder preference' but this was dropped before implementation — no reminder preference field in schema, no UI element, and no future phase addresses this as an onboarding step."
    artifacts:
      - path: "src/components/onboarding/onboarding-banner.tsx"
        issue: "Banner collects plant count range only; no reminder preference toggle or UI element present"
      - path: "prisma/schema.prisma"
        issue: "User model has no reminderPreference or notificationsEnabled field"
    missing:
      - "Decision: Either add the reminder preference step to the onboarding banner OR update the roadmap SC-4 and REQUIREMENTS.md AUTH-04 to remove 'reminder preference' from the Phase 2 scope (accepted via override)"
human_verification:
  - test: "Registration flow — end to end"
    expected: "User fills in email + password + confirm password on /register, submits, sees 'Creating account...' loading state, then is auto-redirected to /dashboard with onboarding banner visible"
    why_human: "Requires a running database (DATABASE_URL + AUTH_SECRET + prisma db push). Server Action + NextAuth signIn redirect cannot be verified without executing against a live DB."
  - test: "Session persistence across browser refresh"
    expected: "After logging in, closing and reopening the browser (or hard refresh) still lands on /dashboard without re-authenticating"
    why_human: "JWT cookie behavior requires a live browser session and NextAuth token validation — not testable via static analysis."
  - test: "Logout redirect"
    expected: "Clicking 'Sign out' in the nav clears the session and redirects to /login; subsequent visit to /dashboard redirects back to /login"
    why_human: "Requires a live browser session to verify cookie clearing via next-auth/react signOut."
  - test: "Onboarding banner selection and collapse"
    expected: "Clicking a range button (e.g., '6-15 plants') shows selected state with accent border, triggers completeOnboarding server action, shows 'Got it — your tips are personalized.' text, then banner collapses in ~300ms"
    why_human: "Animation timing and DB update require live app execution."
  - test: "Route protection for unauthenticated users"
    expected: "Visiting /dashboard, /plants, or /rooms in incognito redirects to /login via proxy.ts authorized callback"
    why_human: "proxy.ts middleware behavior requires Next.js runtime to verify; cannot be verified via static analysis."
---

# Phase 2: Authentication and Onboarding Verification Report

**Phase Goal:** Users can create accounts, log in securely, and complete minimal onboarding before reaching their dashboard
**Verified:** 2026-04-14T14:54:04Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can register with email and password and is redirected to onboarding | ? HUMAN NEEDED | `register-form.tsx` calls `registerUser` action which creates user with bcrypt hash and calls `signIn` with `redirectTo: "/dashboard"`. `isRedirectError` re-throw pattern is implemented. Dashboard renders `OnboardingBanner` when `onboardingCompleted` is false. DB required to fully verify. |
| 2 | User can log in and their session persists across full browser refresh without re-authenticating | ? HUMAN NEEDED | `auth.ts` has jwt+session callbacks propagating `user.id`. `auth.config.ts` uses `strategy: "jwt"`. `login-form.tsx` uses client-side `signIn` with `redirect:false`. Session persistence requires live browser verification. |
| 3 | User can log out from any page and is redirected to the public login page | ? HUMAN NEEDED | `logout-button.tsx` uses `signOut({ callbackUrl: "/login" })` from `next-auth/react`. `LogoutButton` is rendered in `(main)/layout.tsx` nav, present on all protected pages. Requires live session to verify. |
| 4 | After first login, user is prompted for plant count and reminder preference before reaching the dashboard | PARTIAL | Onboarding banner collects plant count range (4 options). **Reminder preference is absent** — explicitly deferred by Design Decision D-08. The schema has no `reminderPreference` field and the banner has no reminder toggle. This deviates from ROADMAP SC-4 and REQUIREMENTS.md AUTH-04. |
| 5 | Unauthenticated users visiting protected routes are redirected to the login page | ? HUMAN NEEDED | `proxy.ts` exports `auth as proxy` with matcher protecting all routes except api/static/login/register. `auth.config.ts` `authorized` callback returns `false` (redirects to `/login`) for unauthenticated access to `/dashboard`, `/plants`, `/rooms`. Requires Next.js runtime to verify middleware execution. |

**Score:** 3.5/5 truths verified with confidence (4 require human execution; 1 is partially implemented)

### Deferred Items

None — the reminder preference gap is not addressed in a later phase as an onboarding step. Phase 6 adds reminder settings but does not revisit onboarding.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | User model with onboarding fields | VERIFIED | Has `onboardingCompleted Boolean @default(false)` and `plantCountRange String?` |
| `src/features/auth/schemas.ts` | Zod v4 validation schemas | VERIFIED | Exports `loginSchema`, `registerSchema`, `onboardingSchema`; uses `import { z } from "zod/v4"` |
| `src/features/auth/actions.ts` | Server Actions for registration and onboarding | VERIFIED | Exports `registerUser` and `completeOnboarding`; has `isRedirectError` re-throw, bcrypt 12 rounds, `revalidatePath` |
| `auth.ts` | JWT and session callbacks for user.id | VERIFIED | Has `async jwt({ token, user })` and `async session({ session, token })` spreading `authConfig.callbacks` |
| `src/types/next-auth.d.ts` | TypeScript augmentation for Session.user.id | VERIFIED | `declare module "next-auth"` with `id: string` in Session.user |
| `src/components/ui/form.tsx` | shadcn Form wrapper for react-hook-form | VERIFIED | Created manually; exports `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` |
| `src/components/ui/sonner.tsx` | shadcn Sonner toast component | VERIFIED | Exists; `Toaster` mounted in `src/app/layout.tsx` |
| `src/components/auth/login-form.tsx` | Login form Client Component with RHF + Zod | VERIFIED | 147 lines; `"use client"`, uses `zodResolver(loginSchema)`, `signIn` with `redirect: false`, toast error |
| `src/components/auth/register-form.tsx` | Register form Client Component with RHF + Zod | VERIFIED | 182 lines; `"use client"`, uses `registerUser` action, `zodResolver(registerSchema)`, toast on error |
| `src/app/(auth)/login/page.tsx` | Login page importing LoginForm | VERIFIED | Imports and renders `<LoginForm />` |
| `src/app/(auth)/register/page.tsx` | Register page importing RegisterForm | VERIFIED | Imports and renders `<RegisterForm />` |
| `src/app/page.tsx` | Root redirect based on auth status | VERIFIED | `auth()` check; redirects to `/dashboard` or `/login` |
| `src/app/(main)/layout.tsx` | Authenticated nav shell with logout | VERIFIED | 50 lines; has `auth()`, `db.user.findUnique`, `onboardingCompleted` check, `LogoutButton`, "Complete setup" link |
| `src/components/auth/logout-button.tsx` | Client-side logout button | VERIFIED | `"use client"`, `signOut({ callbackUrl: "/login" })` |
| `src/components/onboarding/onboarding-banner.tsx` | Onboarding banner Client Component | VERIFIED | 112 lines; `"use client"`, 4 plant ranges, dismiss X with aria-label, `completeOnboarding` call, 300ms collapse |
| `src/app/(main)/dashboard/page.tsx` | Dashboard Server Component with onboarding check | VERIFIED | Has `auth()`, `db.user.findUnique`, `onboardingCompleted` conditional, `<OnboardingBanner userId={session.user.id} />` |
| `proxy.ts` | Route protection middleware | VERIFIED | Exports `auth as proxy`; matcher excludes api/static/login/register |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/features/auth/actions.ts` | `auth.ts` | `import { signIn }` | WIRED | `signIn` imported via `"../../../auth"` (3 parent traversals) |
| `src/features/auth/actions.ts` | `prisma/schema.prisma` | `db.user.create` / `db.user.update` | WIRED | Lines 38-43, 78-83 use `db.user.create` and `db.user.update` with onboarding fields |
| `auth.ts` | `src/types/next-auth.d.ts` | `session.user.id = token.id as string` | WIRED | TypeScript augmentation in `next-auth.d.ts` types `session.user.id` as `string`; used in auth.ts line 20 |
| `src/components/auth/login-form.tsx` | `src/features/auth/schemas.ts` | `zodResolver(loginSchema)` | WIRED | `loginSchema` imported and passed to `zodResolver` |
| `src/components/auth/register-form.tsx` | `src/features/auth/actions.ts` | `registerUser` server action call | WIRED | `registerUser` imported and called in `onSubmit` |
| `src/app/(auth)/login/page.tsx` | `src/components/auth/login-form.tsx` | component import | WIRED | Imports and renders `<LoginForm />` |
| `src/app/page.tsx` | `auth.ts` | `auth()` session check | WIRED | Imports `auth` from `"../../auth"`, calls `auth()` |
| `src/app/(main)/dashboard/page.tsx` | `src/components/onboarding/onboarding-banner.tsx` | conditional render | WIRED | `!user?.onboardingCompleted && <OnboardingBanner userId={session.user.id} />` |
| `src/components/onboarding/onboarding-banner.tsx` | `src/features/auth/actions.ts` | `completeOnboarding` call | WIRED | `completeOnboarding` imported and called in `handleRangeSelect` |
| `src/app/(main)/layout.tsx` | `src/components/auth/logout-button.tsx` | `LogoutButton` import | WIRED | `LogoutButton` imported and rendered in nav |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `src/app/(main)/dashboard/page.tsx` | `user.onboardingCompleted` | `db.user.findUnique` at line 13 | Yes — real DB query | FLOWING |
| `src/app/(main)/layout.tsx` | `user.onboardingCompleted`, `user.email` | `db.user.findUnique` at line 18 | Yes — real DB query | FLOWING |
| `src/components/onboarding/onboarding-banner.tsx` | `userId` prop | Passed from DashboardPage via `session.user.id` (JWT-backed) | Yes — from verified session | FLOWING |
| `src/features/auth/actions.ts` (registerUser) | password hash | `bcryptjs.hash(parsed.data.password, 12)` | Yes — real hash | FLOWING |
| `src/features/auth/actions.ts` (completeOnboarding) | `plantCountRange`, `onboardingCompleted` | `db.user.update` at line 78 | Yes — real DB write + `revalidatePath` | FLOWING |

### Behavioral Spot-Checks

Step 7b skipped — app requires a running database and `npm run dev` server to execute. All auth flows depend on NextAuth + Prisma, which cannot execute without DATABASE_URL and AUTH_SECRET configured.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01, 02-02 | User can create an account with email and password | SATISFIED | `register-form.tsx` + `registerUser` action: validates, hashes password, creates User record, auto-logins via signIn |
| AUTH-02 | 02-01, 02-02 | User can log in and stay logged in across browser refresh (JWT session) | SATISFIED (code) | `login-form.tsx` + `auth.ts` jwt/session callbacks: JWT strategy, user.id propagated to session; requires human verification for session persistence |
| AUTH-03 | 02-03 | User can log out from any page | SATISFIED (code) | `logout-button.tsx` in `(main)/layout.tsx` nav — present on all protected pages; requires human verification |
| AUTH-04 | 02-01, 02-03 | User goes through minimal onboarding after first login (plant count, reminder preference) | PARTIAL | Plant count captured via `onboarding-banner.tsx`. Reminder preference absent (Decision D-08 deferred to Phase 6 settings). This deviates from the requirement and roadmap SC. |
| AUTH-05 | 02-03 | Authenticated routes are protected — unauthenticated users redirected to login | SATISFIED (code) | `proxy.ts` authorized callback + triple auth check (layout + dashboard page); requires human verification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/smoke.spec.ts` | 12 | `getByRole("heading", { name: "Plantz" })` — expects a "Plantz" heading on the home page that no longer exists | Warning | The root `page.tsx` was replaced with a redirect component; the smoke test will fail when E2E tests run against the live app. Not a blocker for code correctness but will cause CI failures. |

### Human Verification Required

#### 1. Registration Flow End-to-End

**Test:** Start `npm run dev`. Open `/register` in incognito. Fill in valid email, matching passwords (6+ chars). Submit.
**Expected:** Loading state shows "Creating account...", then auto-redirect to `/dashboard` with onboarding banner visible.
**Why human:** Requires live PostgreSQL (DATABASE_URL), AUTH_SECRET, and `npx prisma db push` completed.

#### 2. Session Persistence Across Browser Refresh

**Test:** After logging in, perform a hard refresh (Ctrl+F5) or close and reopen the tab. Navigate to `/dashboard`.
**Expected:** Session persists — user lands on `/dashboard` without being prompted to log in again.
**Why human:** JWT cookie behavior requires live browser + NextAuth token validation.

#### 3. Logout Redirect

**Test:** While logged in, click "Sign out" in the nav. Then try to navigate to `/dashboard`.
**Expected:** Redirected to `/login` after logout; `/dashboard` visit also redirects to `/login`.
**Why human:** Cookie clearing requires live browser session.

#### 4. Onboarding Banner Selection and Collapse Animation

**Test:** Register a new account. On the dashboard, click a range button (e.g., "6-15 plants").
**Expected:** Button shows accent border (selected state). "Got it — your tips are personalized." appears. Banner collapses smoothly in ~300ms. "Complete setup" link disappears from nav.
**Why human:** Animation timing, DB write, and revalidatePath behavior require live execution.

#### 5. Route Protection for Unauthenticated Users

**Test:** In incognito, visit `http://localhost:3000/dashboard`, `/plants`, and `/rooms`.
**Expected:** All three routes redirect to `/login`.
**Why human:** `proxy.ts` middleware requires Next.js runtime to intercept and evaluate the `authorized` callback.

### Gaps Summary

**1 gap identified — SC-4 reminder preference:**

ROADMAP success criterion SC-4 states: "After first login, user is prompted for plant count **and reminder preference** before reaching the dashboard." REQUIREMENTS.md AUTH-04 likewise includes "reminder preference" in the onboarding scope.

The implementation collects plant count range only. The reminder preference step was explicitly removed by Design Decision D-08 in `02-CONTEXT.md`: "No reminder preference in onboarding. Reminders default to on; users configure in settings later (Phase 6)." This was a deliberate scope reduction that occurred during the design phase, before plans were written.

This looks intentional — D-08 is a documented decision. However, it constitutes a deviation from the roadmap contract (SC-4) and the formal requirement (AUTH-04). To close this gap, one of two actions is needed:

**Option A:** Implement reminder preference in the onboarding banner (a simple on/off toggle).

**Option B:** Accept the deviation by adding an override to this VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "After first login, user is prompted for plant count and reminder preference before reaching the dashboard"
    reason: "Design Decision D-08 explicitly defers reminder preference to Phase 6 settings. Reminders default to on. The roadmap SC and AUTH-04 were written before D-08 was decided."
    accepted_by: "your-name"
    accepted_at: "2026-04-14T00:00:00Z"
```

**Additional finding — smoke test will break in CI:**

`e2e/smoke.spec.ts` test "home page displays Plantz heading" was not updated when `src/app/page.tsx` was replaced with a redirect. This test will fail against the live app. Plan 02-03 updated `tests/page.test.tsx` (Vitest unit test) but not the E2E smoke spec. This is a Warning, not a blocker for the phase goal.

---

_Verified: 2026-04-14T14:54:04Z_
_Verifier: Claude (gsd-verifier)_
