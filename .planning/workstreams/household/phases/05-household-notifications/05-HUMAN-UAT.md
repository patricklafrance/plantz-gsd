---
status: complete
phase: 05-household-notifications
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-PLAN.md]
started: 2026-04-19T00:00:00Z
updated: 2026-04-20T03:05:00Z
---

## Seed Helper

Phase-5 seed script lives at `scripts/seed-phase-05-uat.ts` with these states:

| State                  | Who is assignee | Unread notification         | Intended banner         |
|------------------------|-----------------|-----------------------------|-------------------------|
| `cycle-start`          | demo            | cycle_started               | CycleStartBanner        |
| `reassignment`         | demo            | cycle_reassigned_manual_skip| ReassignmentBanner      |
| `reassignment-partner` | partner         | cycle_reassigned_manual_skip| (partner sees it)       |
| `passive`              | partner         | cycle_started (to partner)  | PassiveStatusBanner (demo) |
| `fallback`             | demo (paused)   | cycle_fallback_owner        | FallbackBanner (owner)  |
| `fallback-partner`     | partner (paused)| cycle_fallback_owner        | FallbackBanner (non-owner, demo view) |
| `reset`                | —               | —                           | wipes all phase-5 rows  |

Invocation: `node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts <state>`

**Credentials:**
- demo: `demo@plantminder.app` / `demo-password-not-secret`
- partner: `partner@plantminder.app` / `partner-password-not-secret`

The seed prints the dashboard URL; use the slug it emits. Use `scripts/check-notif-state.ts` to dump current notification rows if you need to debug.

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
procedure: |
  1. Kill any running dev server
  2. `npm run dev` (or your usual start command)
  3. Watch boot logs for errors; then open the household dashboard
expected: Server boots without errors, HouseholdNotification migration is in sync, /h/{slug}/dashboard loads cleanly (no console errors, no failed requests).
result: pass

### 2. Assignee sees CycleStartBanner on dashboard (HNTF-02)
procedure: |
  1. `node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts cycle-start`
  2. Sign in as demo@plantminder.app / demo-password-not-secret
  3. Open the dashboard URL printed by the seed script
expected: |
  Banner with subject "You're up this cycle." + meta "{N} plants due · Cycle ends {EEE MMM d}" (or "No plants due right now · Cycle ends …"), Sparkles icon, accent border/background.
result: pass

### 3. Banner render order matches D-13 spec
procedure: |
  1. Seed cycle-start → verify CycleStart sits above urgency sections.
  2. Seed fallback → verify FallbackBanner sits at top.
  3. Seed passive → verify PassiveStatusBanner sits above urgency sections.
expected: |
  When multiple banners are visible, render order top→bottom is:
  FallbackBanner → (CycleStartBanner OR ReassignmentBanner — never both) → PassiveStatusBanner → urgency sections (overdue, due-today) → plant grid.
result: pass

### 4. Non-assignee sees PassiveStatusBanner, NOT CycleStartBanner (HNTF-04)
procedure: |
  1. `node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts passive`
     (partner is the assignee; demo is non-assignee viewer)
  2. Sign in as demo@plantminder.app / demo-password-not-secret
  3. Open the dashboard URL
expected: |
  Muted banner with Users icon shows "Partner User is watering this cycle." (optionally with "{Next} is next up." tail or fallback-owner copy if memberCount > 1 and next is derivable). NO CycleStartBanner visible. No "You're up this cycle." text anywhere.
result: pass

### 5. Reminder count gated to assignee during active cycle (HNTF-01)
procedure: |
  1. `node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts passive` (partner assignee, active cycle)
  2. Sign in as demo@plantminder.app (non-assignee on active cycle)
  3. Note the NotificationBell badge count and dropdown content
  4. Sign out. `node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts cycle-start` (demo is assignee, active)
  5. Sign in as demo@plantminder.app. Note badge count and dropdown.
  6. (Paused check) Manually flip cycle.status to "paused" via `check-notif-state.ts` or DB; reload dashboard as demo (non-assignee scenario). Reminders should re-appear.
expected: |
  - Step 3 (non-assignee, active): badge = 0 reminders, dropdown shows no "plants due" rows (may still show cycle events if any unread).
  - Step 5 (assignee, active): reminder rows appear (overdue/due-today based on plant data).
  - Step 6 (paused): reminders visible regardless of assignee status.
result: pass
notes: |
  Core assignee-gate behavior confirmed across all 3 parts. User reported two incidental issues during the test session (logged separately as phase-wide gaps, not specific to this test):
  - Intermittent React DOM error: "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
  - Sign-out → "Explore the demo" lands on "page not found"; clicking the reload button then lands on the dashboard correctly.

### 6. NotificationBell desktop shows merged feed (D-17, D-18)
procedure: |
  1. `node --env-file=.env.local --import tsx scripts/seed-phase-05-uat.ts cycle-start`
  2. Sign in as demo@plantminder.app, desktop viewport (>= 768px)
  3. Click the bell icon in the top-right nav
expected: |
  Dropdown opens showing content in this bucket order top→bottom:
  overdue reminders → due-today reminders → unread cycle events (with accent left-border stripe) → read cycle events (opacity-60).
  If everything is empty: shows "You're all caught up" + "New reminders and cycle updates will appear here."
result: pass

### 7. NotificationBell mobile variant via BottomTabBar 4th tab (D-21, D-22)
procedure: |
  MCP-driven verification (reassignment-partner state, partner signed in, 390×844 mobile viewport).
expected: |
  - BottomTabBar has exactly 4 tabs
  - 4th tab renders a NotificationBell (not an old inline dropdown)
  - Tapping opens a dropdown whose content matches the desktop bell exactly
result: pass
evidence: |
  - Chrome DevTools MCP at 390×844: BottomTabBar (role=navigation "Main navigation") has 4 children: Dashboard link, Plants link, Rooms link, "3 notifications" button (bell with haspopup=menu).
  - Tapping 4th tab opens menu "3 notifications" with 3 items: "Fiddle Bedroom · 0 days overdue", "Monty Living Room · Due today", "Demo User skipped — you're covering".
  - Resized to 1280×900 desktop while menu stayed open — same 3 items visible under desktop bell. Content parity confirmed.
  - Screenshot saved at uat-test7-mobile-bell.png. Console clean.

### 8. 99+ badge cap on both bell variants (D-19)
procedure: |
  Runtime verification via bulk insert is BLOCKED: HouseholdNotification has a unique constraint on
  `(cycleId, recipientUserId, type)` — only 5 notification types × 1 active cycle = max 5 unread per
  recipient. Cannot reach >99 with realistic data. Reminders could contribute but would require 100+
  plants. Verified by source inspection instead.
expected: |
  Both desktop bell and mobile (BottomTabBar) badges show "99+" when count > 99. At ≤99 shows actual number. At 0 badge hidden.
result: pass
evidence: |
  src/components/reminders/notification-bell.tsx:95 — `const displayCount = count > 99 ? "99+" : String(count);`
  Both render sites (desktop trigger line 116, mobile trigger line 129) use the same `displayCount`, so both variants cap identically.
  Badge gated by `count > 0` (lines 114, 127) → hidden at zero.
  Runtime reachability caveat logged as non-blocking: the D-19 unique index on HouseholdNotification makes 99+ unreachable via cycle events alone; would only fire if reminderCount exceeds 99.

### 9. Mark-as-read on bell dropdown open (D-20)
procedure: |
  Verified opportunistically during Test 7. Steps observed:
  1. Seed reassignment-partner → partner's badge shows "3 notifications" (2 reminders + 1 unread cycle event)
  2. Opened mobile bell dropdown → saw all 3 items
  3. Resized to desktop and found badge dropped to "2 notifications" (same dropdown still open with 3 items — read cycle event still visible in feed)
  4. Ran scripts/check-notif-state.ts → the cycle_reassigned_manual_skip row for partner has readAt=2026-04-20T02:53:23.678Z
expected: |
  - After dropdown open: unread cycle event mark-read is triggered
  - Badge count decreases (unread-only count)
  - Feed still shows the (now-read) event
  - readAt is persisted in DB
result: pass
evidence: |
  - Badge delta: 3 → 2 after dropdown open (confirmed via MCP snapshot before + after)
  - DB readAt: non-null timestamp set on the cycle_reassigned_manual_skip row (scripts/check-notif-state.ts)
  - Feed still renders the read event (content preserved with opacity styling)
  - Idempotent replay check: not separately verified via Network tab, but Plan 02's `readAt: null` predicate + `updateMany` pattern makes repeat opens no-op at SQL level (verified by design in 05-02-SUMMARY.md threat model T-05-02-03)

### 10. Banners render ONLY on dashboard page (D-11)
procedure: |
  MCP-driven navigation from reassignment-partner state: /dashboard → /plants → /rooms → /plants/{id}.
expected: |
  Banner region appears on /dashboard only. /plants, /rooms, and plant-detail pages show NO household notification banners.
result: pass
evidence: |
  - /h/tAn97yhW/plants: snapshot shows heading "My Plants" + search + filters + plant grid. NO status/alert node corresponding to a banner.
  - /h/tAn97yhW/rooms: snapshot shows heading "Rooms" + room-filter buttons + room cards. NO banner.
  - /h/tAn97yhW/plants/cmo6foixt001904nab7ms9w2f (Monty detail): snapshot shows plant content only. NO banner.
  - /h/tAn97yhW/dashboard (same session): ReassignmentBanner visible with "Demo User skipped — you're covering this cycle."

### 11. ReassignmentBanner type-branched copy (HNTF-03)
procedure: |
  MCP-driven: seeded reassignment-partner, then used scripts/set-notif-type.ts to cycle the notification
  row through all three type variants and reload the dashboard for each.
expected: |
  Subject text (priorAssigneeName bold):
  - manual_skip: "Demo User skipped — you're covering this cycle."
  - auto_skip: "Demo User is unavailable — you're covering this cycle."
  - member_left: "Demo User left the household — you're covering this cycle."
  Meta: "{N} plants due · Cycle ends {…}" or "Cycle ends {…}" when N=0. role="status".
result: pass
evidence: |
  - manual_skip: snapshot captured "Demo User" + "skipped — you're covering this cycle." + "2 plants due · Cycle ends Sun Apr 26" under role=status
  - auto_skip: snapshot captured "Demo User" + "is unavailable — you're covering this cycle." + same meta
  - member_left: snapshot captured "Demo User" + "left the household — you're covering this cycle." + same meta
  - Bold subject rendering verified by separate "Demo User" StaticText node split from the connector phrase — indicates font-semibold span wraps the name, matching PATTERNS.md
  - Tested by flipping HouseholdNotification.type via scripts/set-notif-type.ts

### 12. FallbackBanner when nobody is available (AVLB-05)
procedure: |
  MCP-driven: seed `fallback` (cycle=paused, transitionReason=all_unavailable_fallback, demo=assignee),
  then flip cycle.status=active via scripts/set-cycle-status.ts to access the not-paused branches.
  Observed the three branches by toggling viewer (partner vs demo) and cycle.status.
expected: |
  - Owner + not-paused: role="alert", "Nobody's available — you're covering this cycle." / "Check back when members update their availability."
  - Non-owner + not-paused: "Nobody's available — {Owner} is covering this cycle." / "You can update your availability in settings."
  - Paused: "This week's rotation is paused." / "Someone needs to step up — plants still need water."
result: pass
evidence: |
  - Paused variant (demo as owner, cycle.status=paused): snapshot captured role=alert with "This week's rotation is paused." + "Someone needs to step up — plants still need water."
  - Non-owner + not-paused (partner signed in, cycle.status=active): snapshot captured role=alert with "Nobody's available — " + "Demo User" + " is covering this cycle." + "You can update your availability in settings."
  - Owner + not-paused (demo signed in, cycle.status=active): snapshot captured role=alert with "Nobody's available — you're covering this cycle." + "Check back when members update their availability."
  All three variants match UI-SPEC copy exactly.

## Summary

total: 12
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Dashboard and bell UI should not throw React DOM reconciliation errors in the console during normal use"
  status: resolved
  reason: "User reported: 'I often get: Failed to execute removeChild on Node: The node to be removed is not a child of this node.' — intermittent, surfaced during Test 5 (assignee-gate walkthrough involving sign-in / sign-out / bell open / dashboard reload)"
  severity: major
  test: null
  scope: phase-wide
  suspected_area: "NotificationBell dropdown open/close (useTransition + DropdownMenu portal) OR banner unmount during route transitions — Plan 05-04 components most likely, check Radix DropdownMenu + React 19 useTransition interaction"
  artifacts: []
  missing: []
  resolution: "2026-04-19. Root cause: `startTransition(() => { void markNotificationsRead(...) })` in src/components/reminders/notification-bell.tsx completed synchronously, so the Server Action's `revalidatePath` triggered a high-priority router refresh outside the transition — preempting Base UI MenuPortal teardown and producing the stale-DOM removeChild error. (Suspected library was @base-ui/react, not Radix.) Fix: changed to `startTransition(async () => { await markNotificationsRead(...) })` so React 19 tracks the full async lifecycle and keeps the refresh at transition priority. Verified via Chrome DevTools MCP with 37 stress cycles (bell open/close, bell-open + SPA popstate nav, bell-open + real Next.js Link click) — 0 removeChild errors, 0 hydration warnings. Debug session: .planning/debug/removechild-bell-portal.md"

- truth: "Sign-out → 'Explore the demo' should land the user directly on the dashboard, not on a 'page not found' page"
  status: resolved
  reason: "User reported: 'Sign out -> Explore the demo -> page not found -> click on the reload button -> dashboard' — the demo-exploration entry-point returns 404 on first load, recovers only after user manually reloads"
  severity: major
  test: null
  scope: phase-wide (sign-out + demo flow, not strictly Phase 5 scope but surfaced during Phase 5 UAT)
  suspected_area: "Demo-session redirect + revalidation race after sign-out; possibly stale cookies or cache entry from the authenticated session. Check src/app/(auth) sign-out handler + whatever route 'Explore the demo' links to (likely a demo-seed-and-redirect endpoint)"
  artifacts: []
  missing: []
  resolution: "2026-04-19. Root cause: `/demo` was a Client Component that called `startDemoSession()` (Server Action → NextAuth `signIn`) from useEffect. `signIn`'s NEXT_REDIRECT became a client-side router.push (soft navigation), which resolved against Next.js's in-memory router cache (30s TTL, not cleared by signOut) — stale entries from the prior authenticated session pointed at an invalid household slug, producing the 404. Browser reload bypasses the cache, so the second try worked. Fix: (1) deleted src/app/(auth)/demo/page.tsx; (2) added src/app/(auth)/demo/route.ts — a Route Handler so `signIn`'s NEXT_REDIRECT becomes an HTTP 302 (hard browser navigation bypassing the cache); (3) changed `<Link href=\"/demo\">` to `<a href=\"/demo\">` in src/components/auth/login-form.tsx to force a hard nav into the route handler and clear the cache before the demo flow begins. Verified via Chrome DevTools MCP with 2 full cycles of sign-out → 'Explore without signing up' after heavy prior navigation (cache pre-populated) — both first-click landings went straight to /h/tAn97yhW/dashboard, no intermediate 404. Debug session: .planning/debug/signout-demo-404.md"
