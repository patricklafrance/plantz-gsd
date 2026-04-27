---
status: partial
phase: 08-cycle-snooze
source: PHASE-8-UAT.md, PHASE-8-SUMMARY.md
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:00Z
---

## Current Test

[testing paused — dev server crashed mid-run; 1 issue diagnosed in form a11y]

## Tests

### 1. Cold Start Smoke Test
expected: Dev server responds. Demo session reaches dashboard with 3 members + seeded plants. No hydration errors.
result: pass
note: Login page rendered; demo session reached /h/mxXV8vqA/dashboard with banner ("3 days left, Alice (alice@demo.plantminder.app) is next"), 8 plants, 0 console errors at start.

### 2. UAT 8.1 — Skip my turn (reassign current cycle in place)
expected: Demo-mode Skip click shows "sign up to save" toast (read-only guard). Solo household has no Skip button. Multi-member household: Skip reassigns assignee while keeping cycle number + end date constant; receiver gets unread notification.
result: blocked
blocked_by: server
reason: "Dev server returning 500 (Next.js Jest-worker pool exception); requires restart"

### 3. UAT 8.2 — Real-name on signup + derived household name
expected: /register requires "Your name" field. Empty submit blocked. Successful signup lands on /h/<slug>/dashboard. User menu shows "<Name>'s plants" with possessive rules: "Pat" → "Pat's", "Chris" → "Chris'", "Mary Smith" → "Mary's".
result: blocked
blocked_by: server
reason: "Dev server crash (see UAT 8.1). Independent diagnosis: form fields render visually but accessible-name binding is broken — see Gap A."

### 4. UAT 8.3 — Real-name display in rotation copy
expected: Demo dashboard banner reads "You're up this week — N days left. **Alice** (alice@demo.plantminder.app) is next." Household-settings Members section shows three rows with bold name + muted email, no `null (email)` or stray `()`.
result: pass
note: Banner copy verified on /h/mxXV8vqA/dashboard. /h/mxXV8vqA/household-settings Members section showed the three rows exactly: 1. Demo User (demo@plantminder.app) — Watering now — OWNER; 2. Alice (alice@demo.plantminder.app) — Up next — MEMBER; 3. Bob (bob@demo.plantminder.app) — MEMBER. No null/() artifacts.

### 5. UAT 8.4 — Light + Dark Theme
expected: User menu first row has Light/Dark/Sys radios. Dark applies app-wide immediately, persists across refresh. Sys matches OS. No hydration warnings.
result: blocked
blocked_by: server
reason: "Dev server crash before user-menu interaction"

### 6. UAT 8.5 — Critical-path E2E suite
expected: `npx playwright test` runs auth/watering/household/invite spec files; most pass on freshly-seeded DB. Caveats per spec.
result: issue
reported: "10 of 12 Playwright tests failed. Root cause: Gap A — FormControl uses bare <div id={formItemId}> instead of <Slot>, so getByLabel() can't find inputs and label clicks don't focus. Plus Gap B: e2e/smoke.spec.ts:11 looks for 'Plantz' heading on /, but / redirects to /login whose heading is 'Sign in to your account'."
severity: major

### 7. UAT 8.6 — Onboarding no longer seeds plants
expected: Fresh signup lands on dashboard with onboarding banner. Selecting plant-count range collapses banner ("Got it — your tips are personalized.") but does NOT auto-create plants. Dashboard still shows "No plants yet".
result: blocked
blocked_by: server
reason: "Dev server crash + needs fresh signup which is gated by Gap A"

### 8. UAT 8.7 — Demo tools page (ribbon)
expected: Demo session hides "Demo tools" menu item; direct nav to /demo-tools redirects to dashboard. Real users see "Demo tools" entry; page has Heads-up + Seed-starter-plants card. Seeding 1-5 default produces toast "Seeded 5 plants." and the 5 plants appear in Recently Watered. Repeat seeds stack (no de-dup).
result: blocked
blocked_by: server
reason: "Dev server crash before user-menu interaction"

## Summary

total: 8
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 5

## Gaps

- truth: "react-hook-form fields render with their FormLabel programmatically associated to the input (clicking label focuses input; getByLabel(name) resolves the input)"
  status: failed
  reason: "FormControl in src/components/ui/form.tsx applies id={formItemId} and aria-describedby/aria-invalid to a wrapping <div>, not to the underlying <input>. FormLabel sets htmlFor={formItemId} which therefore points at the wrapper, not the input. Result: clicking 'Your name' does not focus the textbox, screen readers don't announce the label, and Playwright's getByLabel() times out — which cascades into 8/12 e2e failures (every spec that registers/logs in via labels)."
  severity: major
  test: 6
  artifacts:
    - path: "src/components/ui/form.tsx"
      issue: "FormControl uses native <div> instead of @radix-ui/react-slot's <Slot>; @radix-ui/react-slot is present transitively under node_modules/@radix-ui/react-slot via @base-ui/react but is not a direct dependency"
  missing:
    - "Add @radix-ui/react-slot as a direct dependency (canonical shadcn approach)"
    - "Replace <div> in FormControl with <Slot> so id/aria-* forward to the child Input"
  debug_session: ""

- truth: "e2e/smoke.spec.ts:9 'home page displays Plantz heading' passes"
  status: failed
  reason: "Test navigates to / which redirects to /login. /login's <h1> reads 'Sign in to your account', not 'Plantz'. The header brand text 'Plant Minder' is in a <span>, not a heading. The other smoke test ('home page loads without errors') passes because it doesn't assert on a heading."
  severity: minor
  test: 6
  artifacts:
    - path: "e2e/smoke.spec.ts"
      issue: "assertion targets a heading that the codebase does not render"
  missing:
    - "Either delete the assertion (the brand 'Plant Minder' is never an <h1>) or change to getByRole('heading', { name: 'Sign in to your account' }) since / always redirects to /login when unauthenticated"
  debug_session: ""

- truth: "Dev server stays healthy under parallel Playwright run + interactive use"
  status: failed
  reason: "After `npx playwright test` finished, every subsequent dashboard load returns HTTP 500 with overlay 'Jest worker encountered 2 child process exceptions, exceeding retry limit'. Reproducible across reloads. Likely cause: Next.js dev worker pool exhausted by 12-worker Playwright concurrency hitting the same dev server (playwright.config webServer reuse)."
  severity: minor
  test: 1
  artifacts:
    - path: "playwright.config.ts"
      issue: "webServer reuse with workers=12 may saturate the dev server's worker pool"
  missing:
    - "Lower default workers in playwright.config (e.g., workers: 4) OR disable dev-server reuse (start a separate `next start` for tests) OR document that running e2e + interactive UAT in parallel is unsupported"
  debug_session: ""
