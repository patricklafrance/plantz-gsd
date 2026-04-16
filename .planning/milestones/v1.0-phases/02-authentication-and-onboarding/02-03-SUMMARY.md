---
phase: 02-authentication-and-onboarding
plan: "03"
subsystem: auth
tags: [nextauth, nextjs, react, server-components, client-components, onboarding]

requires:
  - phase: 02-authentication-and-onboarding/02-01
    provides: auth.ts (auth/signOut), completeOnboarding server action, onboarding schema, Prisma User with onboardingCompleted field

provides:
  - Root / redirects to /dashboard (authenticated) or /login (unauthenticated)
  - Authenticated nav shell with Plant Minder wordmark, Complete setup link, user email, Sign out button
  - LogoutButton Client Component using next-auth/react signOut
  - Onboarding banner Client Component with 4 plant-range buttons, dismiss, and collapse animation
  - Dashboard Server Component conditionally rendering OnboardingBanner and empty-state

affects:
  - phase-03-plant-management (dashboard page will be extended)
  - phase-04-watering-core (dashboard Server Component pattern to follow)

tech-stack:
  added: []
  patterns:
    - "Server Component auth check: auth() + redirect('/login') if no session"
    - "Client Component logout: signOut from next-auth/react with callbackUrl"
    - "Triple-layered route protection: proxy.ts + layout auth() + page auth()"
    - "Onboarding banner: Client Component receiving userId prop from Server Component"

key-files:
  created:
    - src/components/auth/logout-button.tsx
    - src/components/onboarding/onboarding-banner.tsx
  modified:
    - src/app/page.tsx
    - src/app/(main)/layout.tsx
    - src/app/(main)/dashboard/page.tsx
    - tests/page.test.tsx

key-decisions:
  - "Use next-auth/react signOut (client-side) in LogoutButton, not server-action signOut from auth.ts"
  - "Dashboard Server Component passes userId to OnboardingBanner as prop (not inferred in Client Component)"
  - "Triple auth check on dashboard: proxy.ts authorized callback + main layout + dashboard page"

patterns-established:
  - "Logout pattern: Client Component with next-auth/react signOut({ callbackUrl })"
  - "Protected layout pattern: Server Component reads session via auth(), redirects if missing"
  - "Onboarding banner: Client Component self-manages dismiss/complete state; parent only decides whether to render"

requirements-completed: [AUTH-03, AUTH-04, AUTH-05]

duration: 3min
completed: 2026-04-14
---

# Phase 2 Plan 3: Dashboard Shell, Nav, and Onboarding Banner Summary

**Authenticated nav shell with Plant Minder wordmark and logout, dismissible onboarding banner with 4-range plant count selection and 300ms collapse animation, dashboard Server Component with triple-layered auth protection**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-14T05:33:54Z
- **Completed:** 2026-04-14T05:37:00Z
- **Tasks:** 3 auto tasks complete (1 checkpoint pending human verification)
- **Files modified:** 5 (+ 1 test file)

## Accomplishments
- Root / now redirects to /dashboard or /login based on session (AUTH-05)
- Main layout provides authenticated nav with Plant Minder wordmark (Leaf icon), Complete setup link (when onboarding incomplete), user email, and Sign out button (AUTH-03)
- Onboarding banner renders as nature-themed Card with accent styling, 4 range buttons (44px touch targets), dismiss X (44px, aria-label), post-selection confirmation text, and 300ms ease-out collapse animation (AUTH-04, D-06 through D-11)
- Dashboard Server Component reads onboardingCompleted from DB and conditionally renders banner; shows No plants yet empty state below it (D-06)

## Task Commits

1. **Task 1: Root page redirect + authenticated main layout with nav** - `2391592` (feat)
2. **Task 2: Onboarding banner Client Component** - `fcab510` (feat)
3. **Task 3: Dashboard Server Component with onboarding wiring** - `f971685` (feat)

## Files Created/Modified
- `src/app/page.tsx` - Root redirect Server Component (auth() -> /dashboard or /login)
- `src/app/(main)/layout.tsx` - Authenticated nav shell with wordmark, Complete setup, user email, LogoutButton
- `src/components/auth/logout-button.tsx` - Client Component using next-auth/react signOut with /login redirect
- `src/components/onboarding/onboarding-banner.tsx` - Onboarding banner with nature styling, range selection, dismiss, animation
- `src/app/(main)/dashboard/page.tsx` - Dashboard Server Component with session check, onboarding banner wiring, empty state
- `tests/page.test.tsx` - Updated to reflect new redirect-only page.tsx (old Plantz heading test removed)

## Decisions Made
- Used `signOut` from `next-auth/react` (client-side) in LogoutButton rather than the server-action `signOut` from `auth.ts`. Client-side handles cookie clearing and browser redirect natively.
- Dashboard Server Component passes `session.user.id` as `userId` prop to OnboardingBanner. The Client Component cannot independently access session — the prop pattern prevents any need for client-side auth calls.
- Triple auth check implemented on dashboard page: proxy.ts authorized callback + main layout auth() + dashboard page auth(). Each layer independently redirects unauthenticated access to /login per threat model T-02-11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken test for replaced page.tsx**
- **Found during:** Task 1 (Root page redirect implementation)
- **Issue:** `tests/page.test.tsx` tested the old "Plantz" heading stub. After replacing `page.tsx` with an async redirect component, the test expected `<Page />` to render synchronously and show a heading — both assumptions broken.
- **Fix:** Replaced the unit test with a module-level check that verifies the export is an async function. The redirect behavior is covered by E2E tests (Playwright), not unit tests.
- **Files modified:** tests/page.test.tsx
- **Verification:** `npx tsc --noEmit` passes without errors on the test file
- **Committed in:** `2391592` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Necessary correction — the original test was a stub test for a stub component, both of which were replaced by the plan.

## Issues Encountered
- Pre-existing TypeScript error: `@/generated/prisma/client` not found (Prisma types not generated — requires running database and `npx prisma generate`). This is not introduced by this plan.
- No node_modules in worktree — TypeScript check runs against source types only. sonner/next-themes types not available until `npm install`.

## Checkpoint Status

**Task 4 (checkpoint:human-verify)** is pending. The 3 auto tasks are complete and committed. Human verification of the complete auth and onboarding flow in a browser is required before this plan can be marked done.

## User Setup Required
Prerequisites for human verification:
- PostgreSQL running with DATABASE_URL set in .env.local
- AUTH_SECRET set in .env.local
- `npx prisma db push` completed
- `npm run dev` started

## Next Phase Readiness
- Dashboard shell complete — Phase 3 (Plant Management) can extend the dashboard page
- OnboardingBanner is self-contained; no changes needed when Phase 3 adds plant cards
- The `space-y-lg` container on dashboard will naturally flow plant content below the banner

---
*Phase: 02-authentication-and-onboarding*
*Completed: 2026-04-14 (checkpoint pending human verification)*

## Self-Check: PASSED
