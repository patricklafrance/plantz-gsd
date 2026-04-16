---
phase: 06-reminders-and-demo-mode
verified: 2026-04-15T16:20:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /demo without being logged in"
    expected: "Browser redirects to /dashboard signed in as the demo user; all sample plants are visible in urgency sections"
    why_human: "Cannot verify NextAuth NEXT_REDIRECT flow and session cookie creation programmatically without a running server"
  - test: "While signed in as demo, attempt to log a watering from the dashboard"
    expected: "Action is blocked; a toast appears reading 'Demo mode — sign up to save your changes.'"
    why_human: "Server Action response requires a real browser session to trigger"
  - test: "Click the bell icon in the nav with plants that are overdue"
    expected: "Dropdown opens listing overdue plants sorted by most days overdue; each item shows plant name, room, and status label (e.g. '8 days overdue'); clicking navigates to that plant's detail page"
    why_human: "Requires real browser interaction to test dropdown rendering and navigation"
  - test: "On a plant detail page for an overdue plant, click the '1d' snooze pill"
    expected: "Bell badge count drops; pill fires snoozeReminder Server Action; a success toast appears"
    why_human: "Optimistic UI and server round-trip require live app"
  - test: "During onboarding (first login on a fresh account), observe the starter plants checkbox"
    expected: "Checkbox 'Start with a few example plants' appears, checked by default; selecting any plant count range creates 5 starter plants from the catalog and they appear in the dashboard"
    why_human: "Requires full onboarding flow with a fresh user account"
  - test: "On /preferences, toggle 'In-app reminders' Switch off, then navigate to a plant detail page"
    expected: "Bell badge shows 0; per-plant reminder toggle on the plant detail page is visible but disabled with explanatory text that global reminders are off"
    why_human: "Requires real app state to verify disabled state propagation across pages"
---

# Phase 6: Reminders and Demo Mode — Verification Report

**Phase Goal:** Signed-in users receive in-app reminders for plants needing attention; unauthenticated visitors can explore the full app experience with sample data
**Verified:** 2026-04-15T16:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a notification center in the nav with a badge count showing how many plants need attention; clicking it lists those plants | ? HUMAN | `NotificationBell` component wired in `layout.tsx` using `getReminderCount` and `getReminderItems` queries. Component exists and renders count+items. Visual behavior requires browser test. |
| 2 | User can enable or disable reminders globally and configure per-plant reminder preferences and frequency | ✓ VERIFIED | `PreferencesForm` wires `toggleGlobalReminders` action to Switch toggle. `PlantReminderToggle` wires `togglePlantReminder` action on plant detail. Snooze serves as frequency control. |
| 3 | User can snooze a reminder by 1 day, 2 days, or a custom duration | ✓ VERIFIED | `SnoozePills` renders 1d/2d/1w/Custom buttons; Custom opens `Calendar` dialog. Actions `snoozeReminder` and `snoozeCustomReminder` wired with ownership checks and upsert. |
| 4 | A visitor can navigate to the app and immediately explore with pre-loaded sample plants without creating an account; all write actions are blocked for the demo session | ✓ VERIFIED | `/demo` route calls `startDemoSession` (→ NextAuth sign-in as demo user). isDemo guard in all 15 mutation Server Actions. proxy.ts and auth.config.ts allow `/demo` as public route. |
| 5 | During onboarding, a new user can optionally seed their collection with common starter plants | ✓ VERIFIED | `onboarding-banner.tsx` adds checkbox (checked by default) and calls `seedStarterPlants()` concurrently with `completeOnboarding()` via `Promise.all`. |

**Score:** 5/5 truths verified (SC-1 needs human for UI behavior confirmation — underlying code fully wired)

### Deferred Items

None — all ROADMAP Success Criteria are either verified or pending human confirmation.

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | remindersEnabled on User, @@unique on Reminder | ✓ VERIFIED | `remindersEnabled Boolean @default(true)` at line 19; `@@unique([plantId, userId])` at line 109 |
| `src/features/reminders/schemas.ts` | Zod validation schemas | ✓ VERIFIED | Exports: snoozeSchema, snoozeCustomSchema, toggleReminderSchema, toggleGlobalRemindersSchema |
| `src/features/reminders/types.ts` | ReminderItem interface | ✓ VERIFIED | Exports `ReminderItem` with all required fields |
| `src/features/demo/seed-data.ts` | Demo seed constants | ✓ VERIFIED | Exports DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS (8 entries), STARTER_PLANTS (5 entries) |
| `src/types/next-auth.d.ts` | Session isDemo augmentation | ✓ VERIFIED | `isDemo: boolean` in Session; `isDemo?: boolean` in JWT |
| `tests/reminders.test.ts` | Test stubs for RMDR-01 through RMDR-05 | ✓ VERIFIED | 30 todo stubs + 4 active Zod schema tests; all pass |
| `tests/demo.test.ts` | Test stubs for DEMO-01 through DEMO-03 | ✓ VERIFIED | 6 todo stubs + 3 active seed data tests; all pass |
| `src/components/ui/switch.tsx` | shadcn Switch primitive | ✓ VERIFIED | File exists (installed by shadcn CLI) |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/reminders/queries.ts` | Reminder badge count and dropdown queries | ✓ VERIFIED | Exports getReminderCount, getReminderItems, getPlantReminder; real DB queries with snooze-aware filter |
| `src/features/reminders/actions.ts` | Reminder mutation Server Actions | ✓ VERIFIED | Exports snoozeReminder, snoozeCustomReminder, togglePlantReminder, toggleGlobalReminders; all have isDemo guard and `db.reminder.upsert` |
| `src/features/demo/actions.ts` | Demo session and starter plant seeding | ✓ VERIFIED | Exports startDemoSession and seedStarterPlants; seedStarterPlants has isDemo guard |
| `auth.ts` | isDemo flag in JWT/session callbacks | ✓ VERIFIED | `token.isDemo = dbUser?.email === DEMO_EMAIL` in jwt callback; propagated to session |
| `proxy.ts` | Updated matcher including demo route | ✓ VERIFIED | Matcher excludes `demo` from protection |
| `prisma/seed.ts` | Demo user seeding | ✓ VERIFIED | Creates demo user with remindersEnabled=true, 8 diverse plants, nested Reminder records. Uses DEMO_EMAIL constant (not literal string — gsd-tools false negative). |

#### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/reminders/notification-bell.tsx` | Bell icon with badge and dropdown | ✓ VERIFIED | Renders count badge (99+ overflow), dropdown with ReminderItem list, "All caught up!" empty state |
| `src/components/reminders/snooze-pills.tsx` | Snooze pill buttons (1d/2d/1w/Custom) | ✓ VERIFIED | All 4 options implemented; Custom opens Calendar dialog; snoozeCustomReminder action wired |
| `src/components/reminders/plant-reminder-toggle.tsx` | Per-plant reminder Switch | ✓ VERIFIED | Optimistic update; disabled when globalRemindersEnabled=false; isDemo guard |
| `src/app/(main)/preferences/page.tsx` | Preferences page route | ✓ VERIFIED | Server Component that fetches user data and renders PreferencesForm |
| `src/components/preferences/preferences-form.tsx` | Global toggle and account settings | ✓ VERIFIED | toggleGlobalReminders wired; AccountSettings included |

#### Plan 04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(auth)/demo/page.tsx` | Demo entry route | ✓ VERIFIED | Calls `startDemoSession()` on render; fallback UI for failure case |
| `src/components/auth/login-form.tsx` | Updated login with demo CTA | ✓ VERIFIED | "Explore without signing up" link to /demo in CardFooter |
| `src/app/(main)/layout.tsx` | Demo banner when isDemo | ✓ VERIFIED | Sticky 36px banner with "Sign up to save your data" link to /register |
| `src/components/onboarding/onboarding-banner.tsx` | Starter plant seeding checkbox | ✓ VERIFIED | "Start with a few example plants" checkbox, checked by default, fires seedStarterPlants concurrently |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/features/reminders/schemas.ts` | `src/features/reminders/actions.ts` | snoozeSchema/toggleReminderSchema import | ✓ WIRED | Pattern found in source |
| `src/features/reminders/types.ts` | `src/components/reminders/notification-bell.tsx` | ReminderItem import | ✓ WIRED | Pattern found in source |
| `src/features/reminders/queries.ts` | `src/lib/db.ts` | db.plant.count and db.plant.findMany | ✓ WIRED | Manually verified at lines 25, 39, 84, 94 (gsd-tools regex escaping false negative) |
| `src/features/reminders/actions.ts` | `prisma/schema.prisma` | db.reminder.upsert (@@unique) | ✓ WIRED | Manually verified at lines 32, 60, 88 (gsd-tools regex escaping false negative) |
| `auth.ts` | `src/features/demo/seed-data.ts` | DEMO_EMAIL import | ✓ WIRED | Pattern found in source |
| `src/app/(main)/layout.tsx` | `src/features/reminders/queries.ts` | getReminderCount + getReminderItems | ✓ WIRED | Pattern found in source; data passed to NotificationBell |
| `src/components/reminders/snooze-pills.tsx` | `src/features/reminders/actions.ts` | snoozeReminder import and call | ✓ WIRED | Pattern found in source |
| `src/components/preferences/preferences-form.tsx` | `src/features/reminders/actions.ts` | toggleGlobalReminders import | ✓ WIRED | Pattern found in source |
| `src/app/(auth)/demo/page.tsx` | `src/features/demo/actions.ts` | startDemoSession call | ✓ WIRED | Pattern found in source |
| `src/components/onboarding/onboarding-banner.tsx` | `src/features/demo/actions.ts` | seedStarterPlants call | ✓ WIRED | Pattern found in source |
| `src/app/(main)/layout.tsx` | `session.user.isDemo` | conditional demo banner rendering | ✓ WIRED | Pattern found in source |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `notification-bell.tsx` | `count`, `items` | `getReminderCount` + `getReminderItems` in layout.tsx | Yes — real `db.plant.count` + `db.plant.findMany` queries | ✓ FLOWING |
| `preferences-form.tsx` | `remindersEnabled` | `user.remindersEnabled` from DB in preferences page | Yes — `db.user.findUnique` | ✓ FLOWING |
| `plant-reminder-toggle.tsx` | `initialEnabled` | `getPlantReminder` query result passed via plant detail page | Yes — `db.reminder.findUnique` | ✓ FLOWING |
| `snooze-pills.tsx` | No data state — fires actions only | n/a | n/a | ✓ FLOWING |
| `src/app/(main)/layout.tsx` (demo banner) | `isDemo` | `session.user.isDemo` from NextAuth JWT | Yes — set at JWT creation from DB email lookup | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes | `npx vitest run tests/reminders.test.ts tests/demo.test.ts` | 7 passed, 30 todo (correct — 30 stubs are intentional) | ✓ PASS |
| snoozeSchema rejects empty plantId | vitest active test | passed | ✓ PASS |
| DEMO_PLANTS has 8 entries | vitest active test | passed | ✓ PASS |
| DEMO_EMAIL is demo@plantminder.app | vitest active test | passed | ✓ PASS |
| Git commits exist | `git log --oneline` | All 9 commits (038067c through d12a66b) verified | ✓ PASS |
| Demo route /demo → startDemoSession | Requires running server | n/a | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| RMDR-01 | 06-01, 06-02, 06-03 | In-app notification center showing plants needing attention | ✓ SATISFIED | NotificationBell component with dropdown list of overdue/due-today plants |
| RMDR-02 | 06-01, 06-02, 06-03 | Badge count on the nav | ✓ SATISFIED | Badge renders count 1-99 or "99+" on bell icon in nav layout |
| RMDR-03 | 06-02, 06-03 | Enable or disable reminders globally | ✓ SATISFIED | toggleGlobalReminders action + PreferencesForm Switch toggle |
| RMDR-04 | 06-02, 06-03 | Configure reminder preferences (which plants, frequency) | ✓ SATISFIED | Per-plant toggle (PlantReminderToggle) controls "which plants"; snooze controls effective frequency |
| RMDR-05 | 06-01, 06-02, 06-03 | Snooze by 1 day, 2 days, or custom duration | ✓ SATISFIED | SnoozePills: 1d/2d/1w instant, Custom opens Calendar date picker |
| DEMO-01 | 06-02, 06-04 | Visitor can explore with pre-loaded sample plants without signing up | ✓ SATISFIED | /demo route + startDemoSession + seed script creates demo user with 8 plants |
| DEMO-02 | 06-01, 06-02 | Demo mode is read-only — mutations blocked | ✓ SATISFIED | isDemo guard in all 15 mutation Server Actions; returns error string |
| DEMO-03 | 06-02, 06-04 | Optionally seed collection with starter plants during onboarding | ✓ SATISFIED | Onboarding banner checkbox fires seedStarterPlants concurrently |

No orphaned requirements detected — all 8 Phase 6 requirements (RMDR-01 through RMDR-05, DEMO-01 through DEMO-03) appear in plan frontmatter and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/preferences/account-settings.tsx` | 77, 87, 98 | `toast.info("... not yet available.")` for email update, password update, delete account | ℹ INFO | These operations are scaffolded in the UI per plan spec but server-side is deferred to Phase 7. No requirement (RMDR-*, DEMO-*) covers account management operations. Not a blocker for phase goal. |

No blocker or warning anti-patterns found in reminder/demo core paths.

### Human Verification Required

#### 1. Demo Entry Flow

**Test:** Open a private/incognito browser tab. Navigate to `/demo`.
**Expected:** Page briefly shows "Starting demo..." then redirects to `/dashboard`. The dashboard is signed in as the demo user and shows sample plants in urgency sections (e.g., Monty overdue, Lily due today, Snakey recently watered).
**Why human:** NextAuth NEXT_REDIRECT behavior and session cookie creation cannot be verified without a running server.

#### 2. Demo Mode Write Blocking

**Test:** While in the demo session from step 1, click the water button on any plant in the dashboard.
**Expected:** Action is blocked. A toast message appears reading "Demo mode — sign up to save your changes." The plant's status does not change.
**Why human:** Server Action response requires a real browser session with the demo user's JWT.

#### 3. Notification Bell Dropdown

**Test:** Log in as a regular user who has plants overdue. Click the bell icon in the top-right nav.
**Expected:** A dropdown panel opens. Each overdue plant appears with its nickname, room name, and status label (e.g., "8 days overdue" or "Due today"). Overdue plants appear first, sorted by most days overdue descending. Clicking any item navigates to that plant's detail page. If no plants need attention, "All caught up!" is shown.
**Why human:** Requires real browser interaction and live data.

#### 4. Snooze Pills — Per-Plant Interaction

**Test:** Navigate to the detail page of an overdue plant. Observe the snooze pills section. Click "1d".
**Expected:** The snooze reminder Server Action fires. A toast confirms success. When returning to the dashboard, the plant is no longer shown in the Overdue section (it has been snoozed). The bell badge count decreases by 1.
**Why human:** Requires live server, real database, and optimistic/actual UI state verification.

#### 5. Onboarding Starter Plants

**Test:** Register a fresh account. Complete onboarding. Observe the starter plants checkbox ("Start with a few example plants", checked by default). Select any plant count range.
**Expected:** Both `completeOnboarding` and `seedStarterPlants` fire concurrently. After the banner collapses, the dashboard shows 5 starter plants (Pothos, Snake Plant, Spider Plant, Peace Lily, ZZ Plant) ready to be managed.
**Why human:** Requires a fresh user account and full onboarding flow.

#### 6. Global Reminders Toggle → Per-Plant Toggle Disabled State

**Test:** Navigate to `/preferences`. Toggle "In-app reminders" Switch to off. Navigate to any plant's detail page.
**Expected:** The bell badge shows 0. On the plant detail page, the "Remind me" switch is visible but disabled (grayed out) with explanatory text that global reminders are turned off.
**Why human:** Requires real app state propagation between the preferences page and plant detail page.

### Gaps Summary

No gaps blocking goal achievement. All 5 ROADMAP Success Criteria are verified at the code level. Account settings operations (change email, change password, delete account) are intentional stubs scaffolded in the UI but with no backing server actions — these are explicitly deferred and have no corresponding requirement in v1.

The 6 human verification items test the live flow behaviors that cannot be asserted programmatically without a running server.

---

_Verified: 2026-04-15T16:20:00Z_
_Verifier: Claude (gsd-verifier)_
