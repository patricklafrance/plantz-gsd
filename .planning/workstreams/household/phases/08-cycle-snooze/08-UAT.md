---
status: complete
phase: 08-cycle-snooze
source: PHASE-8-UAT.md, PHASE-8-SUMMARY.md
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Dev server responds. Demo session reaches dashboard with 3 members + seeded plants. No hydration errors.
result: pass
note: Login page rendered; demo session reached /h/mxXV8vqA/dashboard with banner ("3 days left, Alice (alice@demo.plantminder.app) is next"), 8 plants, 0 console errors at start.

### 2. UAT 8.1 — Skip my turn (reassign current cycle in place)
expected: Demo-mode Skip click shows "sign up to save" toast (read-only guard). Solo household has no Skip button. Multi-member household: Skip reassigns assignee while keeping cycle number + end date constant; receiver gets unread notification.
result: pass
note: |
  - Demo-mode block (step 4): clicking Skip → AlertDialog "Skip your turn?" → confirm → toast "Demo mode — sign up to save your changes." Banner unchanged (Alice still "is next").
  - Solo household (step 5): Pat (newly registered, single member) — Skip button is NOT rendered in the rotation banner.
  - Multi-member (steps 6-10): Pat invited Sam via household-settings → Sam accepted via /join/<token> in an isolated browser context → Pat's dashboard showed Skip button → click → "Skipped — passed to the next member." toast → Pat banner now reads "Sam is watering this cycle. Pat is next up. Cycle ends Mon May 4" (end date preserved). Sam reloaded → bell badge "1 notifications", banner "Pat skipped — you're covering this cycle." Sam clicked Skip → handed back → Pat's banner: "Sam skipped — you're covering this cycle." (alternation works).

### 3. UAT 8.2 — Real-name on signup + derived household name
expected: /register requires "Your name" field. Empty submit blocked. Successful signup lands on /h/<slug>/dashboard. User menu shows "<Name>'s plants" with possessive rules: "Pat" → "Pat's", "Chris" → "Chris'", "Mary Smith" → "Mary's".
result: pass
note: |
  Required-field assertion covered by Playwright auth.spec.ts:23 (passes after Gap A fix).
  Possessive rules verified directly via user menu inspection:
  - Pat (registered as pat-uat-26apr@example.com) → "Pat's plants" — landed on /h/dvSqDc2K/dashboard
  - Chris (chris-uat-26apr@example.com) → "Chris' plants" — apostrophe-only since name ends in 's' — landed on /h/79ZAvuYu/dashboard
  - Mary Smith (mary-uat-26apr@example.com) → "Mary's plants" — first token only (last name dropped) — landed on /h/6yhsrJuJ/dashboard

### 4. UAT 8.3 — Real-name display in rotation copy
expected: Demo dashboard banner reads "You're up this week — N days left. **Alice** (alice@demo.plantminder.app) is next." Household-settings Members section shows three rows with bold name + muted email, no `null (email)` or stray `()`.
result: pass
note: Banner copy verified on /h/mxXV8vqA/dashboard. /h/mxXV8vqA/household-settings Members section showed the three rows exactly: 1. Demo User (demo@plantminder.app) — Watering now — OWNER; 2. Alice (alice@demo.plantminder.app) — Up next — MEMBER; 3. Bob (bob@demo.plantminder.app) — MEMBER. No null/() artifacts.

### 5. UAT 8.4 — Light + Dark Theme
expected: User menu first row has Light/Dark/Sys radios. Dark applies app-wide immediately, persists across refresh. Sys matches OS. No hydration warnings.
result: pass
note: |
  User menu shows Light / Dark / Sys radios as first three items (above household section).
  - Click Light: html.classList drops 'dark', body bg = lab(100 0 0) (white), localStorage.plantz-theme = "light".
  - Click Dark + reload: html.classList includes 'dark', body bg = lab(2.75 0 0) (near-black), localStorage.plantz-theme = "dark" — persistence confirmed.
  - 0 console warnings/errors after reload (no hydration mismatch).
  Sys radio not interactively tested but uses identical next-themes pathway.

### 6. UAT 8.5 — Critical-path E2E suite
expected: `npx playwright test` runs auth/watering/household/invite spec files; most pass on freshly-seeded DB. Caveats per spec.
result: pass
note: |
  Initial run: 2 of 12 passed. Fixed two real bugs (Gap A: form-a11y, Gap B: stale smoke heading) → 7 of 12 passed. Then fixed 5 stale tests:
  - household.spec.ts solo-Skip: inverted assertion (Skip is HIDDEN on solo, matches spec)
  - household.spec.ts:60: Availabilities → Time off menuitem
  - invite.spec.ts: rewrote invite-link extraction (textbox.value not text), restructured the dialog flow, added a multi-member skip-with-confirmation test that asserts in-place reassignment + receiver notification
  - watering.spec.ts: rewrote AddPlantDialog flow (catalog tile click → details form → "Add plant" submit)
  Final: **12 of 12 passed.**

### 7. UAT 8.6 — Onboarding no longer seeds plants
expected: Fresh signup lands on dashboard with onboarding banner. Selecting plant-count range collapses banner ("Got it — your tips are personalized.") but does NOT auto-create plants. Dashboard still shows "No plants yet".
result: pass
note: |
  Verified primary claim: clicking "1-5 plants" did NOT create any plants (count remained at the pre-click value).
  Verified secondary claim with a MutationObserver-style poll: after clicking "1-5 plants", the banner transitioned through "Saving…" (~ms 111) → "Got it — your tips are personalized." (~ms 405) → removed (~ms 1208). Earlier I missed this 800ms window with a single late snapshot — the copy IS rendered.

### 8. UAT 8.7 — Demo tools page (ribbon)
expected: Demo session hides "Demo tools" menu item; direct nav to /demo-tools redirects to dashboard. Real users see "Demo tools" entry; page has Heads-up + Seed-starter-plants card. Seeding 1-5 default produces toast "Seeded 5 plants." and the 5 plants appear in Recently Watered. Repeat seeds stack (no de-dup).
result: pass
note: |
  - Demo user menu has no "Demo tools" entry (only Household / Time off / Account / Sign out).
  - Direct nav http://localhost:3000/h/mxXV8vqA/demo-tools as demo → server redirected to /h/mxXV8vqA/dashboard.
  - Pat (real account) user menu DOES contain "Demo tools" between Account and Sign out.
  - /h/dvSqDc2K/demo-tools renders heading "Demo & testing tools", "Pat's plants" subtitle, yellow Heads-up card, Seed-starter-plants card with 4-button range selector (1-5 default pressed) + primary "Seed starter plants" button.
  - Click Seed (1-5) → confirm() dialog → accept → toast "Seeded 5 plants." Dashboard shows "Recently Watered (5)".
  - Click Seed (1-5) again → toast "Seeded 5 plants." again → dashboard shows "Recently Watered (10)". Duplicates stack as documented.

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "react-hook-form fields render with their FormLabel programmatically associated to the input"
  status: fixed
  reason: "FormControl wrapped a bare <div id={formItemId}> instead of a Slot, so htmlFor on the label pointed at the wrapper, not the input. Cascaded into 8/12 e2e failures plus a real screen-reader regression."
  severity: major
  test: 6
  resolution: "Commit a37f44a — added @radix-ui/react-slot as direct dep, switched FormControl to <Slot>, restructured password adornments + watering-interval inputs in login-form, register-form, add-plant-dialog, edit-plant-dialog so FormControl directly wraps Input."

- truth: "e2e/smoke.spec.ts:9 'home page displays Plantz heading' passes"
  status: fixed
  reason: "Test navigated to / which redirects to /login. /login's <h1> reads 'Sign in to your account', not 'Plantz'."
  severity: minor
  resolution: "Commit a37f44a — assertion now checks the redirect lands on /login and the 'Sign in to your account' heading is visible."

- truth: "Dev server stays healthy under parallel Playwright run + interactive use"
  status: fixed
  reason: "12-worker Playwright concurrency saturated Next.js dev's jest-worker pool, producing HTTP 500 + 'Jest worker encountered N child process exceptions' overlay."
  severity: minor
  test: 1
  resolution: "playwright.config.ts now sets `workers: process.env.CI ? undefined : 4` so local runs cap concurrency."

- truth: "5 e2e tests reflect current production behavior (solo Skip contract, menuitem renames, AddPlantDialog catalog flow)"
  status: fixed
  reason: "Tests asserted Skip visible on solo (spec says HIDDEN), looked for 'Availabilities' (renamed to 'Time off'), looked for 'Household settings' menuitem (renamed to 'Household'), and used a watering flow that didn't match the AddPlantDialog catalog → details step transition."
  severity: minor
  test: 6
  resolution: "Rewrote household.spec.ts solo Skip assertion + Settings group test, added new multi-member skip+notification test in invite.spec.ts, fixed invite-link extraction to read textbox value, rewrote watering.spec.ts to drive the catalog → details flow. All 12/12 passing."

- truth: "Onboarding banner shows 'Got it — your tips are personalized.' confirmation copy after the user picks a plant-count range"
  status: validated
  reason: "Initial sample missed the ~800ms window. A polling MutationObserver-style script confirmed the transitions: 'Saving…' (ms~111) → 'Got it — your tips are personalized.' (ms~405) → card removed (ms~1208)."
  severity: cosmetic
  test: 7
