---
status: complete
phase: 02-query-action-layer-update
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03a-SUMMARY.md, 02-03b-SUMMARY.md, 02-03c-SUMMARY.md, 02-04-SUMMARY.md, 02-05a-SUMMARY.md, 02-05b-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md]
started: 2026-04-17T16:15:00Z
updated: 2026-04-17T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Stop any running dev server. Run Prisma migrate deploy — the 20260417033126_add_household_member_is_default migration applies cleanly. Start `npm run dev`. Server boots, sign-in works, and /h/{slug}/dashboard renders your plants.
result: pass

### 2. Sign In Lands on Household-Scoped Dashboard
expected: |
  Sign in with an existing account. After login you are redirected to `/h/{your-household-slug}/dashboard` (URL contains `/h/<slug>/`). The dashboard shows your plant grid and reminder bell. Re-test: log out, clear all cookies in devtools, log back in — first render of /h/{slug}/dashboard should NOT show "This page couldn't load". Fix: c1a5742 (login form uses Auth.js v5 native redirect).
result: issue
reported: "There's still the 'This page couldn't load' but after being shown, it now redirect correctly. So it's more like a flicker now."
severity: minor
prior_result: issue
prior_report: "It works if the cookies are already set up... But if I log out, clear all the cookies using devtools and log in again. There's a 'This page couldn't load' issue. Then if I do a full refresh, it now works."

### 3. Dashboard Shows Household-Scoped Data
expected: |
  On `/h/{slug}/dashboard`, the "due today" / "watering" cards, plant grid, and reminder bell all show only items belonging to this household. No plants from other households bleed in. Counts match the plants you actually own.
result: pass

### 4. Plants List is Scoped to Household
expected: |
  Visit `/h/{slug}/plants`. You see only plants belonging to this household. Clicking a plant navigates DIRECTLY to `/h/{slug}/plants/{id}` with no intermediate flash through `/plants/{id}`. Fix: 02-08 series — householdSlug threaded through PlantCard/PlantGrid/DashboardPlantCard/RoomCard so links point at the household-scoped route.
result: pass
prior_result: issue
prior_report: "Yes I only see plants belonging to this household, clicking on a plant, kinds of work as well, but it's akward because first it redirect without the slug, then automatically revert back to the link with the slug.. So it's a bad experience."
retest_note: "User confirmed: 'it works' — direct navigation to /h/{slug}/plants/{id}, no flash."

### 5. Rooms List is Scoped to Household
expected: |
  Visit `/h/{slug}/rooms`. You see only rooms belonging to this household. Clicking a room opens `/h/{slug}/rooms/{id}` and shows plants in that room.
result: pass

### 6. Create a New Plant (Add Plant Dialog)
expected: |
  From the household dashboard or plants page, click "Add plant". The dialog opens. Fill in a name and watering interval, submit. The dialog closes, the new plant appears in the plant grid, and the URL stays under `/h/{slug}/`.
result: pass

### 7. Log Watering Updates Countdown
expected: |
  On the dashboard or a plant detail page, mark a plant as watered. The "next watering" countdown resets (or the plant disappears from "due today"), and the change persists on page refresh.
result: pass

### 8. Legacy Route Redirect
expected: |
  Manually visit `/dashboard` (no household slug). You are redirected to `/h/{your-default-household-slug}/dashboard`. Same for `/plants` → `/h/{slug}/plants` and `/rooms` → `/h/{slug}/rooms`.
result: pass

### 9. Bogus Household Slug → Not Found
expected: |
  Visit `/h/this-household-does-not-exist/dashboard`. You see a household-scoped not-found page with a heading like "Household not found" and a link back to your dashboard — NOT a blank page. HTTP status remains 404. Fix: f71ff85 — added parent (main)/not-found.tsx to catch layout-level notFound().
result: pass
prior_result: issue
prior_report: "I see this in the console: GET http://localhost:3000/h/11111/dashboard 404 (Not Found) - but in the app, it's a blank page."
retest_note: "User confirmed: 'it works' — not-found page now renders for bogus slugs."

### 10. Fresh Signup → Onboarding → Household Dashboard
expected: |
  Sign up as a brand new user at `/register`. Auto-logged in. Complete onboarding. Land on `/h/{slug}/dashboard`. Click "seed N plants" in the banner — plants appear in /h/{slug}/dashboard and /h/{slug}/plants. If seeding fails (e.g. empty catalog), banner now surfaces an error instead of silently disappearing. Fix: b9e12c8 — banner surfaces seed errors + empty-catalog guard.
result: pass
prior_result: issue
prior_report: "The onboarding works, but the plant seeding does not. I click on the seed 30 plants button in the banner.. the banner disapeared, and still have no plants available in the /dashboard ans /plants pages."
retest_note: "User confirmed: 'works' — banner seed flow now functions or surfaces errors as expected."

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0
blocked: 0
notes: "Re-test pass complete. Tests 4, 9, 10 fully resolved by fix commits (8b91862 series, f71ff85, b9e12c8). Test 2 partially resolved by c1a5742 — severity reduced from major to minor; brief 'This page couldn't load' flicker remains before redirect resolves correctly."

## Gaps

- truth: "After signing in, user is redirected to /h/{slug}/dashboard and the dashboard renders on the first request — no transient error page or flicker."
  status: failed
  reason: "User reported (re-test after c1a5742): There's still the 'This page couldn't load' but after being shown, it now redirect correctly. So it's more like a flicker now. — Severity reduced from major to minor; the page no longer requires a manual refresh, but the error UI still flashes briefly before the redirect resolves."
  severity: minor
  test: 2
  prior_severity: major
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Clicking a plant in the household-scoped plants list navigates directly to /h/{slug}/plants/{id} with no intermediate redirect flash."
  status: resolved
  reason: "Fixed in 02-08 series (8b91862, d8cc2c8, a2b403b) — householdSlug threaded through PlantCard/PlantGrid/DashboardPlantCard/RoomCard. Re-tested 2026-04-17: user confirmed direct navigation, no flash."
  severity: minor
  test: 4
  root_cause: "Plant/Room card Link components hardcoded legacy /plants/{id} and /rooms/{id} hrefs; relied on legacy redirect stub to reach household-scoped route."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Visiting a nonexistent household slug (/h/{bogus}/dashboard) renders the household-scoped not-found page with a clear message."
  status: resolved
  reason: "Fixed in f71ff85 — added parent (main)/not-found.tsx to catch layout-level notFound(). Re-tested 2026-04-17: user confirmed not-found page renders correctly for bogus slugs."
  severity: major
  test: 9
  root_cause: "Layout-level notFound() in (main)/h/[householdSlug]/layout.tsx had no parent not-found boundary to render into; Next.js fell back to a blank page."
  artifacts: []
  missing: []
  debug_session: ".planning/workstreams/household/phases/02-query-action-layer-update/02-09-DIAGNOSIS.md"

- truth: "Clicking 'seed 30 plants' in the new-user banner seeds starter plants into the user's active household so they appear in /h/{slug}/dashboard and /h/{slug}/plants."
  status: resolved
  reason: "Fixed in b9e12c8 — banner now surfaces seed errors + empty-catalog guard. Re-tested 2026-04-17: user confirmed 'works'."
  severity: major
  test: 10
  root_cause: "Banner swallowed seed-action errors silently and the catalog could be empty without surfacing a user-visible message."
  artifacts: []
  missing: []
  debug_session: ".planning/workstreams/household/phases/02-query-action-layer-update/02-10-DIAGNOSIS.md"
