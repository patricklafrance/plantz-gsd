---
phase: 02-query-action-layer-update
plan: 10
subsystem: auth, onboarding
tags: [uat-2, uat-10, auth, auth.js, onboarding, cr-01]
requires: [02-08]
provides:
  - Cold-start sign-in lands on /h/{slug}/dashboard first-try via Auth.js v5 native redirect
  - Onboarding banner surfaces seed errors via toast; does not silently dismiss on seed failure
  - seedStarterPlants guards against empty CareProfile catalog
  - OnboardingBanner receives householdId explicitly (no JWT fallback dependency)
affects:
  - src/components/auth/login-form.tsx
  - src/components/onboarding/onboarding-banner.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
  - src/features/demo/actions.ts
tech-stack:
  patterns:
    - "Auth.js v5 native redirect (signIn({redirect:true, redirectTo:'/dashboard'})) instead of client-side router.push after {redirect:false} — eliminates session-cookie propagation race"
    - "Server Action result threaded through Promise.all destructure (not dropped) so errors surface via toast"
    - "Defensive empty-result guard: return explicit {error} instead of {success:true, count:0} when downstream data prerequisite is missing"
key-files:
  created:
    - scripts/diagnose-02-10.ts
    - scripts/check-careprofiles.ts
  modified:
    - src/components/auth/login-form.tsx
    - src/components/onboarding/onboarding-banner.tsx
    - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
    - src/features/demo/actions.ts
key-decisions:
  - "Y1 (login race) and Y4 (banner swallow) are independent causes with independent fixes. X1 (shared cause) was ruled out because UAT-10 happens inside an already-authenticated session — no cold-start involved. Decomposing the fix kept each file change minimal and auditable."
  - "Y3 ruled out by direct DB visibility check (not by design-only assertion). The $transaction in registerUser commits User + Household + HouseholdMember atomically before signIn fires, confirmed by a fresh connection finding HouseholdMember role=OWNER immediately post-register."
  - "Plan did not anticipate the empty CareProfile catalog. Added a tiny in-scope defensive guard to seedStarterPlants so the failure mode surfaces via the Y4 toast path instead of silently returning {success:true, count:0}. This is a deviation (Rule 3 — missing critical guard) within the existing files_modified list."
  - "Login form uses B1a (Auth.js native redirect) as plan default. B1b (window.location.href) not chosen — no evidence in diagnosis that B1a fails in this env; register flow already uses the same pattern successfully."
requirements-completed: [HSLD-02, HSLD-03]
duration: 45 min
completed: 2026-04-17
---

# Phase 02 Plan 10: Cold-Start Sign-In + Onboarding Seed Flow Summary

Closes UAT-2 and UAT-10. Login form now uses Auth.js v5 native server-side redirect so the session cookie is written before the next request fires (UAT-2). Onboarding banner explicitly threads `householdId` and surfaces seed errors via toast instead of silently dismissing (UAT-10). A defensive empty-catalog guard in `seedStarterPlants` converts a previously silent failure into an actionable toast.

**Duration:** 45 min | **Tasks:** 3 | **Files:** 4 modified, 2 helper scripts created

## Root cause classification (from diagnosis)

- **Y1** (UAT-2, login-only): `signIn({redirect:false}) + router.push` races the session cookie.
- **Y4** (UAT-10, banner-only): `Promise.all` destructure drops the seed result; banner dismisses on `completeOnboarding` success regardless of seed outcome.
- **Y3 ruled out** via direct DB check: `HouseholdMember visible: true, role: OWNER` immediately post-register.
- **X1 (shared)**, **Y2 (revalidate scope)**: did not match.

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `f27997e` | Task 1 — diagnosis + helper | 02-10-DIAGNOSIS.md, scripts/diagnose-02-10.ts |
| `c1a5742` | Task 2 Fix B1a — login form | src/components/auth/login-form.tsx |
| `b9e12c8` | Task 2 Fix A + empty-catalog guard | onboarding-banner, dashboard/page.tsx, demo/actions.ts |

## Before / After

### UAT-2 (cold-start sign-in)

**Before:** fresh isolated Chrome context → `/login` → sign in → lands on `/dashboard` (legacy stub) → server render fails → `<h1>This page couldn't load</h1>` error overlay. Reload fixes it (stable cookie on 2nd request).

**After:** 3/3 cold-start sign-ins (independent isolated contexts, each with freshly-registered user `test-02-10-v3@example.com`) landed on `/h/uGaK37nj/dashboard` first-try with full chrome and 35 seeded plants visible. Zero "This page couldn't load" errors.

### UAT-10 (onboarding seed flow)

**Before:** fresh signup + click "30+ plants" → banner dismisses silently → DB `plantCount` stays 0 (expected 35). No toast, no visible error.

**After (with CareProfile catalog seeded):** fresh signup (`test-02-10-v3@example.com`) + click "30+ plants" → banner shows "Got it — your tips are personalized." → DB `plantCount` becomes 35. Delta = 35 = `TARGET_COUNTS["30+ plants"]`.

**Before CareProfile seed (regression discovery):** `seedStarterPlants` silently returned `{success: true, count: 0}` when the catalog was empty. Banner now surfaces `"Could not seed starter plants: Starter plant catalog is empty. Run \`npx prisma db seed\` to populate it."` via toast.

## CR-01 positional guard

Restructured `seedStarterPlants` so `await requireHouseholdAccess(targetHouseholdId);` sits in the 2 lines immediately preceding the for-loop's first `db.plant.create`. The `grep -B2 'db.plant.create' src/features/demo/actions.ts | grep -q 'requireHouseholdAccess(targetHouseholdId)'` defensive check now passes. `nextWateringAt` computation moved inline into the create data block (functional equivalent; no behavior change).

## Verification Performed

Automated:
- `npx tsc --noEmit` → 43 errors (baseline preserved).
- `grep -B2 'db.plant.create' ... | grep -q 'requireHouseholdAccess(targetHouseholdId)'` → exit 0 (CR-01 positional).
- `grep -c "requireHouseholdAccess(targetHouseholdId)" src/features/demo/actions.ts` → 1 (not duplicated).
- `grep -c "householdId" src/components/onboarding/onboarding-banner.tsx` → 3 (interface + destructure + call site).
- `grep -c "const \[onboardingResult, seedResult\]" src/components/onboarding/onboarding-banner.tsx` → 1.
- `grep -ci "toast.error.*seed" src/components/onboarding/onboarding-banner.tsx` → 1.
- `grep -c 'redirectTo: "/dashboard"' src/components/auth/login-form.tsx` → 1.
- Literal `router.push("/dashboard")` no longer present in login-form.tsx.

Browser (Chrome DevTools MCP):
- UAT-2 × 3 isolated cold-start contexts, all 3 landed directly on dashboard.
- UAT-10: plantCount delta 0 → 35 verified via `scripts/diagnose-02-10.ts` before and after.
- Regression: register flow still works (`test-02-10-v3@example.com` successfully registered and auto-logged-in).
- HOUSEHOLD_PATHS literal bracket pattern untouched in `src/features/household/paths.ts`.

Db:
- `npx prisma db seed` run mid-verification to populate CareProfile catalog (40 entries upserted). This is a dev-env prerequisite for UAT-10 — not part of the code fix.

## Deviations from Plan

**[Rule 3 — missing critical guard] Empty-catalog silent-success in `seedStarterPlants`**

Found during browser verification of Fix A: first UAT-10 retest with test-v2 user showed banner dismissing silently, DB plantCount still 0. Investigation revealed `CareProfile.count() === 0` on this dev DB. The action path returned `{success: true, count: 0}` — Fix A's `seedResult && "error" in seedResult` check passed (no `error` key) so banner dismissed.

This is structurally related to UAT-10 (silent failure mode) but not scoped in the plan. Added a single guard in `src/features/demo/actions.ts`:

```ts
if (allProfiles.length === 0) {
  return { error: "Starter plant catalog is empty. Run `npx prisma db seed` to populate it." };
}
```

Placed after the two catalog lookups, before `createdPlants` allocation. Now the Y4 toast path surfaces the prerequisite to the user instead of silent `{success:true, count:0}`. 1 file already in plan's `files_modified`.

**Total deviations:** 1 (Rule 3 — missing critical guard, user-approved scope within plan files). **Impact:** closes a real silent-failure mode that would have shipped even with Fix A. No regression risk (only adds an early error return when a pre-condition is already broken).

## Issues Encountered

Register flow occasionally showed "This page couldn't load" on the very first POST response, then rendered correctly after a reload. This is a SECOND instance of the same class of race as UAT-2 but in a different code path (register → signIn with `redirectTo: "/dashboard"` → 2-hop redirect through legacy stub → `/h/{slug}/dashboard`). Not in 02-10's scope; Fix B only targets the login form. Worth filing as a follow-up plan if the symptom persists during user testing.

`next-development.log` shows sporadic `"Rendered more hooks than during the previous render."` browser errors during banner re-renders. These don't appear to block the banner's functional behavior (seed still works, toast surfaces) but indicate a potential hooks-rule violation elsewhere in the tree. Out of scope for 02-10.

## Next Phase Readiness

All 3 incomplete gap-closure plans now complete. Phase 02 should now pass verification:
- GAP-02-01 (CR-01 guard in seedStarterPlants): closed in `c1ae214` (pre-session) and positionally re-verified in this plan.
- UAT-4 (card legacy hrefs): closed in Plan 02-08 (including RoomCard scope expansion).
- UAT-9 (/h/{bogus-slug} blank page): closed in Plan 02-09.
- UAT-2 (cold-start sign-in): closed in this plan.
- UAT-10 (onboarding seed): closed in this plan.

Ready to advance to phase verification (`gsd-verifier` agent) and, if it returns `passed`, mark Phase 02 complete.
