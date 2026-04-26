---
status: diagnosed
phase: 07-demo-mode-compatibility
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md]
started: 2026-04-21T00:00:00Z
updated: 2026-04-21T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Stop any running dev server. Reset the DB and run the demo seed from scratch:
      npx prisma migrate reset --force
      npm run dev
  Server boots with no errors. Seed finishes without throwing. Open
  http://localhost:3000/login and click "Try Demo" — app signs you in as
  demo@plantminder.app and lands on the dashboard with plants visible.
result: pass
notes: |
  Initially reported as issue (DB was empty — seed had not run, so `/demo`
  silently 307'd to `/login?error=demo_failed`). After running
  `npx prisma db seed`, Try Demo correctly lands on
  `/h/RmVvBy35/dashboard` with 8 seeded plants visible. Reclassified as
  pass per user direction; the silent-failure UX is captured under Test 5.

### 2. Try Demo Sign-In (simplified startDemoSession)
expected: |
  From http://localhost:3000/login click the "Try Demo" button.
  You are signed in as demo@plantminder.app and redirected to the dashboard
  in under 1 second. No errors in console. No multi-step onboarding; the
  demo user lands directly on the main dashboard with seeded plants listed.
result: pass
verified_via: |
  Auto-verified via Chrome DevTools MCP. Cleared cookies, navigated to
  /login, clicked "Explore without signing up". Network: GET /demo → 307
  Location: /dashboard → 302 to /h/RmVvBy35/dashboard. Final URL:
  /h/RmVvBy35/dashboard. Demo banner present ("You're in demo mode — Sign
  up to save your data"). Console: no errors (only pre-existing
  autocomplete a11y notices on the login form, unrelated). startDemoSession
  is the simplified findUnique→signIn→redirect shape from Plan 02.

### 3. Demo Household Has 3 Members (Demo, Alice, Bob)
expected: |
  Three members belong to the Demo Household:
    - demo@plantminder.app (OWNER, rotationOrder 0)
    - alice@demo.plantminder.app (MEMBER, rotationOrder 1)
    - bob@demo.plantminder.app (MEMBER, rotationOrder 2)
result: pass
verified_via: |
  DB query confirms exactly 3 members in household slug 'RmVvBy35' (name:
  "Demo Plants"):
    - demo@plantminder.app, OWNER, rotationOrder 0
    - alice@demo.plantminder.app, MEMBER, rotationOrder 1
    - bob@demo.plantminder.app, MEMBER, rotationOrder 2
  Matches DEMO_SAMPLE_MEMBERS roster from src/features/demo/seed-data.ts.

### 4. Demo Cycle + Alice Availability Seeded
expected: |
  Active rotation cycle started ~3 days ago, ends ~4 days from now, assigned
  to the demo user. Alice has Availability "Out of town" ~10-to-17 days out.
result: pass
verified_via: |
  DB query confirms (today = 2026-04-26):
    - Cycle: startDate 2026-04-23 (-3d), endDate 2026-04-30 (+4d),
      assignedUserId = demo user ✓
    - Availability: alice@demo.plantminder.app, "Out of town",
      2026-05-06 → 2026-05-13 (+10d to +17d) ✓
  Dashboard renders cycle status: "You're up this week — 3 days left.
  Alice is next. Cycle ends Apr 30, 2026" — confirms the cycle math is
  surfaced to the user.

### 5. Seed-Missing Error Guides to Seed Command
expected: |
  When the demo user is missing from the DB, clicking Try Demo shows a
  clear error directing the user to run `npx prisma db seed` — not a silent
  redirect or generic stack trace.
result: pass
fix_commit: a1a8889
fix_summary: |
  Originally reported during Test 1 ("page reloads but nothing happens"),
  reclassified to Test 5 once root cause was identified.
  Root cause: login-form.tsx ignored the ?error=demo_failed query param
  set by /demo route handler.
  Fix: read searchParams.error and render an inline alert instructing the
  user to run `npx prisma db seed` when error === "demo_failed".
verified_via: |
  Auto-verified via Chrome DevTools MCP. Navigated to
  /login?error=demo_failed — alert renders with the seed instruction
  ("Couldn't start the demo session — the demo data is missing. Run
  `npx prisma db seed` to set it up, then try again."). Navigated to
  /login (no param) — alert does NOT render. No console errors.
  TypeScript clean (no new errors on login-form.tsx).

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "When the demo seed is missing, clicking Try Demo surfaces a clear in-app error instructing the user to run `npx prisma db seed`"
  status: fixed
  reason: "User reported (firsthand on Test 1): page reloads but nothing happens — login form silently swallowed ?error=demo_failed query param"
  severity: major
  test: 5
  root_cause: "src/components/auth/login-form.tsx did not read or render searchParams.error; the /demo route handler correctly sets ?error=demo_failed but the login form ignored it"
  fix_commit: a1a8889
  fix_summary: "Read searchParams.error in login-form.tsx and render an inline alert with the seed-instruction when error === 'demo_failed'."
  artifacts:
    - path: "src/components/auth/login-form.tsx"
      change: "Added searchParams.error read + inline alert block above form"
  debug_session: ""
