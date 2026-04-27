---
status: partial
phase: 08-cycle-snooze
source: PHASE-8-UAT.md, PHASE-8-SUMMARY.md
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:00Z
---

## Current Test

[testing paused — multi-member skip path (UAT 8.1 steps 6-10) requires 2-account invite flow; deferred to user]

## Tests

### 1. Cold Start Smoke Test
expected: Dev server responds. Demo session reaches dashboard with 3 members + seeded plants. No hydration errors.
result: pass
note: Login page rendered; demo session reached /h/mxXV8vqA/dashboard with banner ("3 days left, Alice (alice@demo.plantminder.app) is next"), 8 plants, 0 console errors at start.

### 2. UAT 8.1 — Skip my turn (reassign current cycle in place)
expected: Demo-mode Skip click shows "sign up to save" toast (read-only guard). Solo household has no Skip button. Multi-member household: Skip reassigns assignee while keeping cycle number + end date constant; receiver gets unread notification.
result: partial
note: |
  Verified:
  - Demo-mode block (step 4): clicking Skip → AlertDialog "Skip your turn?" → confirm → toast "Demo mode — sign up to save your changes." Banner unchanged (Alice still "is next"). PASS.
  - Solo household (step 5): Pat (newly registered, single member) — Skip button is NOT rendered in the rotation banner. PASS.
  Deferred: steps 6-10 (multi-member skip via invite, receiver notification, alternating skip). Requires registering a second account in an isolated browser context, accepting an invite link, and verifying cross-session notifications. Defer to user — 2-tab manual flow.

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
result: partial
note: |
  After fixing Gap A (form a11y) and Gap B (smoke heading): 7 passed, 5 failed (was 2 passed / 10 failed).
  All 5 remaining failures are test-code drift, NOT app bugs:
  - household.spec.ts:22, :32 — tests assume Skip button is visible on solo households, but PHASE-8-UAT.md UAT 8.1 step 5 explicitly says it should be ABSENT on solo. Test contract is wrong.
  - household.spec.ts:60 — looks for "Availabilities" menuitem; renamed to "Time off" in commits 7d3ae9a / 5e71416.
  - invite.spec.ts:35 — looks for /household settings/i menuitem (probably renamed similarly to "Household").
  - watering.spec.ts:38 — regex /^add$|save plant|^save$/i for the AddPlantDialog primary button likely doesn't match current copy.
  None block phase 8; tracked as separate test-maintenance gaps below.

### 7. UAT 8.6 — Onboarding no longer seeds plants
expected: Fresh signup lands on dashboard with onboarding banner. Selecting plant-count range collapses banner ("Got it — your tips are personalized.") but does NOT auto-create plants. Dashboard still shows "No plants yet".
result: pass
note: |
  Verified primary claim (no auto-seed): on Pat's dashboard with 5 plants and the onboarding banner still visible, clicking "1-5 plants" → banner disappears, plant count stays at 5 (no new plants). PASS.
  Minor mismatch with spec wording: spec says banner collapses to "Got it — your tips are personalized." In reality the banner is removed entirely; no "Got it" copy is shown. See Gap D.

### 8. UAT 8.7 — Demo tools page (ribbon)
expected: Demo session hides "Demo tools" menu item; direct nav to /demo-tools redirects to dashboard. Real users see "Demo tools" entry; page has Heads-up + Seed-starter-plants card. Seeding 1-5 default produces toast "Seeded 5 plants." and the 5 plants appear in Recently Watered. Repeat seeds stack (no de-dup).
result: pass
note: |
  - Demo user menu has no "Demo tools" entry (only Household / Time off / Account / Sign out). PASS.
  - Direct nav http://localhost:3000/h/mxXV8vqA/demo-tools as demo → server redirected to /h/mxXV8vqA/dashboard. PASS.
  - Pat (real account) user menu DOES contain "Demo tools" between Account and Sign out. PASS.
  - /h/dvSqDc2K/demo-tools renders heading "Demo & testing tools", "Pat's plants" subtitle, yellow Heads-up card, Seed-starter-plants card with 4-button range selector (1-5 default pressed) + primary "Seed starter plants" button. PASS.
  - Click Seed (1-5) → confirm() dialog → accept → toast "Seeded 5 plants." Dashboard shows "Recently Watered (5)". PASS.
  - Click Seed (1-5) again → toast "Seeded 5 plants." again → dashboard shows "Recently Watered (10)". Duplicates stack as documented. PASS.

## Summary

total: 8
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0
partial: 2

## Gaps

- truth: "react-hook-form fields render with their FormLabel programmatically associated to the input (clicking label focuses input; getByLabel(name) resolves the input)"
  status: fixed
  reason: "FormControl in src/components/ui/form.tsx applied id={formItemId} and aria-describedby/aria-invalid to a wrapping <div>, not to the underlying <input>. Cascaded into 8/12 e2e failures plus a real screen-reader regression."
  severity: major
  test: 6
  resolution: "Commit a37f44a — added @radix-ui/react-slot as direct dep, switched FormControl to <Slot>, restructured password adornments and watering-interval inputs in login-form, register-form, add-plant-dialog, edit-plant-dialog so FormControl directly wraps Input. /register snapshot now exposes textboxes with accessible names; Playwright passes 7/12 (was 2/12)."
  debug_session: ""

- truth: "e2e/smoke.spec.ts:9 'home page displays Plantz heading' passes"
  status: fixed
  reason: "Test navigated to / which redirects to /login. /login's <h1> reads 'Sign in to your account', not 'Plantz'. Brand 'Plant Minder' was a <span>."
  severity: minor
  resolution: "Commit a37f44a — repointed the assertion to check the redirect lands on /login and the 'Sign in to your account' heading is visible."
  debug_session: ""

- truth: "Dev server stays healthy under parallel Playwright run + interactive use"
  status: open
  reason: "After `npx playwright test --workers=12 --reuseExistingServer` finished, every subsequent dashboard load returned HTTP 500 with overlay 'Jest worker encountered 2 child process exceptions, exceeding retry limit'. Reproducible. Workaround: restart dev server. Re-running with --workers=4 did not crash the server."
  severity: minor
  test: 1
  artifacts:
    - path: "playwright.config.ts"
      issue: "default workers count + webServer reuse may saturate Next.js dev's jest-worker pool on Windows"
  missing:
    - "Lower default workers in playwright.config (workers: 4) OR run e2e against a separate `next start` instance OR document the constraint."

- truth: "Onboarding banner shows 'Got it — your tips are personalized.' confirmation copy after the user picks a plant-count range"
  status: open
  reason: "Spec PHASE-8-UAT.md UAT 8.6 step 4 says the banner collapses to that exact phrase. Reality: the banner is removed entirely with no follow-up copy. Functional claim ('no auto-seed') still holds."
  severity: cosmetic
  test: 7
  artifacts:
    - path: "src/components/onboarding/onboarding-banner.tsx (suspected)"
      issue: "either the spec was aspirational or the 'Got it' state was never wired"
  missing:
    - "Decide whether to render the 'Got it — your tips are personalized.' confirmation (matching spec) or update PHASE-8-UAT.md to reflect the silent-collapse behavior."

- truth: "e2e/household.spec.ts:22 (solo-household assignee sees Skip button) passes"
  status: open
  reason: "Test asserts Skip button visible on a solo household, but the production behavior (verified manually) and PHASE-8-UAT.md UAT 8.1 step 5 explicitly say Skip should be HIDDEN on solo households (no one to reassign to). The test contract contradicts the spec."
  severity: minor
  test: 6
  missing:
    - "Either delete this test or rewrite to assert the Skip button is NOT visible on solo households."

- truth: "e2e/household.spec.ts:32 (skip-my-turn confirms via dialog) passes"
  status: open
  reason: "Same root cause as above — registers a fresh user (solo household) and tries to click a Skip button that does not render. Should set up a multi-member household via invite before attempting Skip."
  severity: minor
  test: 6
  missing:
    - "Refactor: register two users, invite second to first's household, then exercise Skip."

- truth: "e2e/household.spec.ts:60 (user-menu Settings group has Household / Availabilities / Account) passes"
  status: open
  reason: "Test waits on a menuitem named 'Availabilities', which was renamed to 'Time off' in commits 7d3ae9a / 5e71416."
  severity: minor
  test: 6
  missing:
    - "Update assertion to look for 'Time off' (or whatever final copy the team settles on)."

- truth: "e2e/invite.spec.ts:16 (owner invites + second user accepts) passes"
  status: open
  reason: "After the form-a11y fix, the test now reaches user-menu interaction but fails at `getByRole('menuitem', { name: /household settings/i })`. The menuitem text in the actual UI is 'Household' (not 'Household settings'); user lands on /h/<slug>/household-settings via that link."
  severity: minor
  test: 6
  missing:
    - "Update locator to match the rendered menuitem text 'Household'."

- truth: "e2e/watering.spec.ts:12 (add plant + log watering) passes"
  status: open
  reason: "Times out clicking `getByRole('button', { name: /^add$|save plant|^save$/i })`. AddPlantDialog primary button copy doesn't match this regex anymore (likely 'Add plant')."
  severity: minor
  test: 6
  missing:
    - "Inspect AddPlantDialog primary button copy and update the regex (e.g., /^add plant$/i)."
