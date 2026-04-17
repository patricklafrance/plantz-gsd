---
phase: 02-query-action-layer-update
plan: 10
task: 1
type: diagnosis
status: complete
---

# Plan 02-10 Task 1 — Diagnosis

## Environment

- Next.js 16.2.2 (Turbopack), running on localhost:3000
- Auth.js v5 beta-like flow (next-auth@beta per PROJECT.md stack)
- Dev DB via Prisma 7 + adapter-pg (DATABASE_URL from `.env.local`)

### UAT-2 Reproduction

Test user: newly-registered `test-02-10@example.com` (via `/register`).

Steps:
1. Opened a fresh isolated browser context via `chrome-devtools-mcp new_page(isolatedContext="cold-start-uat2")` — equivalent to a private/incognito tab with zero cookies.
2. Visited `http://localhost:3000/login`.
3. Filled credentials for the newly-created test user.
4. Clicked "Sign in".

Observed:
- URL after sign-in: `http://localhost:3000/dashboard` (legacy redirect stub, reached via `router.push("/dashboard")`).
- Rendered page: `<h1>This page couldn't load</h1>` + Reload / Back buttons — this is Next.js's error overlay, not the user's real dashboard.
- Reload button triggered a full navigation. After reload, URL resolved to `/h/92Fuzk3T/dashboard` and the dashboard rendered correctly with full chrome and the onboarding banner.

Root cause per code inspection: `src/components/auth/login-form.tsx` lines 39-52 uses the known next-auth v5 beta foot-gun:

```ts
await signIn("credentials", { email, password, redirect: false });
// ...
router.push("/dashboard");
router.refresh();
```

`{ redirect: false }` returns after the auth endpoint sets the session cookie on the response, but `router.push` immediately triggers a client-side RSC navigation before the browser attaches the freshly-set cookie to subsequent requests. The RSC payload request for `/dashboard` hits `(main)/dashboard/page.tsx` (the legacy redirect stub) without an authenticated session and/or with an incomplete JWT — the server-side render fails, Next.js renders its error overlay.

The register flow at `src/features/auth/actions.ts` lines 93-97 does NOT suffer from this race because it uses Auth.js v5 native redirect (`signIn("credentials", { redirectTo: "/dashboard" })`) — the server issues the 303 redirect AFTER writing the session cookie, so the browser's next request carries the cookie natively. That register flow worked perfectly in this very session (fresh register → landed on `/h/92Fuzk3T/dashboard` on first request).

### UAT-10 Reproduction

DB state captured via `scripts/diagnose-02-10.ts` before and after action.

```
BEFORE {
  userId: 'cmo3dauep000088na9v46a51y',
  email: 'test-02-10@example.com',
  householdId: 'cmo3daugs000188naht52d7hj',
  slug: '92Fuzk3T',
  role: 'OWNER',
  isDefault: true,
  plantCount: 0,
  householdMemberVisible: true
}
```

Steps:
1. On the (primary, still-authenticated) Chrome tab at `/h/92Fuzk3T/dashboard`, the onboarding banner was rendering.
2. Ensured "Start with a few example plants" checkbox was checked.
3. Clicked "30+ plants" (expected seed: 35 plants).
4. Waited up to 20 seconds for any of: `Got it — your tips are personalized`, `Something went wrong`, `Could not seed starter plants`.

Observed:
- Banner dismissed silently.
- No toast error appeared.
- Dashboard collapsed to "No plants yet" empty state.
- Two POST requests to `/h/92Fuzk3T/dashboard` captured (reqid=552, 553 — both `200`). These are the two Server Actions (`completeOnboarding` and `seedStarterPlants`) firing from the banner's `Promise.all`. `completeOnboarding` clearly succeeded because `onboardingCompleted` was set (banner dismissed on success).
- Next.js dev log captured: `Error: Rendered more hooks than during the previous render.` — fired during a client render cycle adjacent to the seed click. Not a server-side ForbiddenError / NEXT_NOT_FOUND. Likely a non-blocking React concurrency issue unrelated to the seed action path itself.

```
AFTER {
  userId: 'cmo3dauep000088na9v46a51y',
  email: 'test-02-10@example.com',
  householdId: 'cmo3daugs000188naht52d7hj',
  slug: '92Fuzk3T',
  role: 'OWNER',
  isDefault: true,
  plantCount: 0,
  householdMemberVisible: true
}
```

Delta: `plantCount_after - plantCount_before = 0`. Expected delta for "30+ plants": 35. **The seed action did not create any plants.** Banner dismissal occurred regardless.

Code inspection (`src/components/onboarding/onboarding-banner.tsx` lines 42-58):

```ts
const [onboardingResult] = await Promise.all([
  completeOnboarding({ plantCountRange: range }),
  seedStarters ? seedStarterPlants(range) : Promise.resolve(null),
]);
// ...
if (onboardingResult && "error" in onboardingResult) {
  toast.error("Something went wrong. Please try again.");
  setSelectedRange(null);
  return;
}
setIsCompleted(true);
setTimeout(() => setDismissed(true), 1500);
```

The Promise.all destructure drops the second element (the seed result). Any `{error: ...}` or non-successful return from `seedStarterPlants` is silently ignored. The banner dismisses on `completeOnboarding` success alone. This is **Y4 (structural)** — confirmed by code reading even independent of the error mode.

Additionally, the banner does not pass `householdId` to `seedStarterPlants` — it relies on the action's `session.user.activeHouseholdId` fallback. That value is DB-populated on signin (Y3 verified — see below), so it should be present for a fresh register flow, but the banner has no explicit wiring either way.

Hypothesis for the actual failure mode (tentative, not blocking the fix): the `seedStarterPlants` action may have thrown an unhandled error somewhere OR returned `{error: "..."}` silently for a reason not visible in the logs. The structural fix (Y4) surfaces it regardless.

### Y3 Ruled Out

Y3 hypothesis: CR-01's `requireHouseholdAccess(targetHouseholdId)` throws ForbiddenError because the HouseholdMember row is not yet visible to a fresh DB connection when the action runs.

Direct verification: ran `scripts/diagnose-02-10.ts test-02-10@example.com before` immediately after register redirected to the dashboard, before clicking anything. Result (quoted from BEFORE block above):

```
HouseholdMember visible: true
role: OWNER
isDefault: true
```

HouseholdMember is visible to a fresh DB connection immediately after register completes. `$transaction` atomically committed User + Household + HouseholdMember before `signIn` fired. `session.user.activeHouseholdId` IS populated when the banner calls `seedStarterPlants`, and `requireHouseholdAccess` cannot throw ForbiddenError on that basis. **Y3 is impossible per direct DB evidence. STOP/return-to-planner NOT triggered.**

## Root cause classification

Matched causes:

- **Y1** (UAT-2 only — login form router.push races session cookie). Evidence: fresh isolated context + login → `/dashboard` stub renders "This page couldn't load"; reload fixes it. Register flow (uses `redirectTo`) does NOT exhibit the failure.
- **Y4** (UAT-10 — banner silently swallows seed action result). Evidence: `onboarding-banner.tsx` destructure at line 43 drops the second Promise result. Confirmed by code inspection AND reproduction: plantCount delta = 0 despite banner dismissal.

**Not matched:**
- X1 (a SHARED cause for UAT-2 and UAT-10). UAT-10 would reproduce regardless of login race because it fires inside an already-authenticated session, not across a cold start. Y1 (login-only) and Y4 (banner-only) together are the right decomposition.
- Y2 (revalidatePath scope mismatch). Not reached — the seed action never created plants, so revalidation scope is moot.
- Y3 — ruled out as above.

## Fix plan for Task 2

### Fix A — ALWAYS apply (Y4 structural):

File: `src/components/onboarding/onboarding-banner.tsx`
- Extend `OnboardingBannerProps` with `householdId: string`.
- Destructure `householdId` in the function signature.
- In `handleRangeSelect`, capture BOTH promise results: `const [onboardingResult, seedResult] = await Promise.all([...]);`
- Pass `householdId` explicitly to `seedStarterPlants(range, householdId)`.
- Surface `seedResult?.error` via `toast.error(\`Could not seed starter plants: ${seedResult.error}\`)` and prevent auto-dismiss on seed failure.

File: `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`
- Line 137 (or wherever `<OnboardingBanner ...>` is after 02-08's edits): add `householdId={household.id}` alongside the existing `userId={session.user.id}`. `household` is already in scope from line 123 (`const { household } = await getCurrentHousehold(householdSlug)`).

### Fix B — Apply (Y1 matched):

File: `src/components/auth/login-form.tsx`
- Replace `onSubmit` body to use Auth.js v5 native redirect:
  ```ts
  await signIn("credentials", {
    email: values.email,
    password: values.password,
    redirect: true,
    redirectTo: "/dashboard",
  });
  ```
- Wrap in try/catch and re-throw `isRedirectError(error)` (signIn's NEXT_REDIRECT on success). Toast on other errors.
- Remove the now-unused `useRouter` import.

B1a preferred (documented default in the plan). B1b (window.location.href) NOT CHOSEN — no evidence in this diagnosis that B1a is broken in this environment. The project already uses `redirectTo: "/dashboard"` successfully in `src/features/auth/actions.ts registerUser` and `src/features/demo/actions.ts startDemoSession`.

### Fix C — NOT applied

Y2 did not match.

### HOUSEHOLD_PATHS constraint

The literal bracket pattern (`"/h/[householdSlug]/dashboard"`) in `src/features/household/paths.ts` is NOT modified by any of the above fixes. WR-04 compliance preserved.

### CR-01 constraint

`await requireHouseholdAccess(targetHouseholdId)` at line 171 of `src/features/demo/actions.ts` is NOT modified. CR-01 security fix preserved.

## Dev server

Left running (PID 681992 on port 3000) for Task 2 verification. Test user `test-02-10@example.com` / `test-password-123` remains in the DB for post-fix verification.
