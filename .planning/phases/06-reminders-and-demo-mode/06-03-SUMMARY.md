---
phase: 06-reminders-and-demo-mode
plan: "03"
subsystem: reminders-ui
tags: [reminders, notifications, preferences, snooze, plant-detail, nav]
dependency_graph:
  requires: ["06-02"]
  provides: ["reminder-ui-components", "preferences-page", "notification-bell"]
  affects: ["src/app/(main)/layout.tsx", "src/components/plants/plant-detail.tsx"]
tech_stack:
  added: []
  patterns:
    - "base-ui render prop pattern for DropdownMenuTrigger and AlertDialogTrigger instead of asChild"
    - "Optimistic UI with error revert for Switch toggles"
    - "Parallel data fetching: getPlantReminder + user.remindersEnabled in plant detail page"
key_files:
  created:
    - src/components/reminders/notification-bell.tsx
    - src/components/reminders/snooze-pills.tsx
    - src/components/reminders/plant-reminder-toggle.tsx
    - src/components/preferences/preferences-form.tsx
    - src/components/preferences/account-settings.tsx
    - src/app/(main)/preferences/page.tsx
  modified:
    - src/app/(main)/layout.tsx
    - src/components/plants/plant-detail.tsx
    - src/app/(main)/plants/[id]/page.tsx
decisions:
  - "Used base-ui render prop pattern (render={<button />}) instead of asChild on DropdownMenuTrigger and AlertDialogTrigger — asChild is a Radix pattern not supported by base-ui"
  - "Used same timezone cookie pattern as dashboard (string-based userTz) in layout.tsx instead of integer offset per plan — consistent with established codebase pattern"
  - "Account operations (change email, change password, delete) are scaffolded with full validation but show 'not yet available' toasts — deferred to Phase 7 as specified in plan"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-15"
  tasks_completed: 3
  files_created: 6
  files_modified: 3
---

# Phase 6 Plan 03: Reminder UI Components and Preferences Page Summary

**One-liner:** Bell icon with badge/dropdown in nav, snooze pills and per-plant toggle on plant detail, and a global reminders preferences page at /preferences — all wired to the Server Actions from Plan 02.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | NotificationBell + nav integration | 238210d | notification-bell.tsx, layout.tsx |
| 2 | SnoozePills + PlantReminderToggle + plant detail | 9b88a19 | snooze-pills.tsx, plant-reminder-toggle.tsx, plant-detail.tsx, plants/[id]/page.tsx |
| 3 | Preferences page | 58ab650 | preferences-form.tsx, account-settings.tsx, preferences/page.tsx |

## What Was Built

### NotificationBell (Task 1)
- Bell icon button in the nav right section with badge count overlay
- Badge shows count 1-99, then "99+" for overflow
- `aria-label` reflects count: "N plants need attention" or "No plants need attention"
- Dropdown lists overdue/due-today plants; clicking navigates to `/plants/{id}`
- Empty state shows "All caught up!" text
- Data fetched server-side in layout.tsx using `getReminderCount` and `getReminderItems`
- Timezone cookie (`user_tz`) used for today boundary computation — same pattern as dashboard
- Preferences link added to nav right section

### SnoozePills (Task 2)
- Appears on plant detail page when `wateringStatus === "overdue"` or `"due-today"`
- Four buttons: 1d, 2d, 1w (fire `snoozeReminder` immediately), Custom (opens Calendar dialog)
- Custom dialog: date picker with past dates disabled, "Keep current schedule" cancel, "Snooze reminder" confirm
- Demo guard: shows "Sign up to save changes." toast instead of calling Server Action

### PlantReminderToggle (Task 2)
- Per-plant reminder Switch on plant detail page
- Optimistic update with error revert on failure
- Disabled (not hidden) when global reminders are off, with explanatory text
- Demo guard: shows error toast instead of toggling

### Preferences Page (Task 3)
- Route: `/preferences` — Server Component fetches user data, renders `PreferencesForm`
- Notifications card: global in-app reminders Switch with optimistic toggle
- Account card: change email form, change password form, delete account with AlertDialog
- All account forms have full Zod validation; operations show "not yet available" toast (Phase 7)
- Delete account dialog: "Keep my account" cancel / "Yes, delete my account" destructive action

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] base-ui does not support `asChild` prop**
- **Found during:** Task 1 (TypeScript error on `DropdownMenuTrigger asChild`)
- **Issue:** The plan used Radix-style `asChild` pattern on `DropdownMenuTrigger` and later `AlertDialogTrigger`. This codebase uses `@base-ui/react` which uses `render={<element />}` for slot customization.
- **Fix:** Used `render={<button className={buttonVariants(...)} />}` pattern on all affected triggers
- **Files modified:** notification-bell.tsx, account-settings.tsx
- **Commit:** 238210d, 58ab650

**2. [Rule 2 - Convention] Timezone cookie handling in layout.tsx**
- **Found during:** Task 1
- **Issue:** Plan specified integer offset arithmetic (`parseInt(cookie ?? "0")`). Dashboard uses string timezone name (`toLocaleDateString` with `timeZone: userTz`).
- **Fix:** Used the established string-based pattern from dashboard for consistency
- **Files modified:** layout.tsx
- **Commit:** 238210d

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `onEmailSubmit` calls `toast.info("Email update is not yet available.")` | account-settings.tsx:73 | Account operations deferred to Phase 7 — explicitly noted in plan |
| `onPasswordSubmit` calls `toast.info("Password update is not yet available.")` | account-settings.tsx:82 | Account operations deferred to Phase 7 — explicitly noted in plan |
| `handleDeleteAccount` calls `toast.info("Account deletion is not yet available.")` | account-settings.tsx:91 | Account operations deferred to Phase 7 — explicitly noted in plan |

These stubs are intentional and do not prevent the plan's goal (reminder UI) from being achieved. The preferences page's core feature (global reminders toggle) is fully wired.

## Verification Results

- `npx tsc --noEmit`: 20 errors in 13 files — all pre-existing, zero new errors introduced
- `npx vitest run`: 77 passed, 0 failed, 2 skipped — no regressions

## Self-Check: PASSED

Files created/exist:
- src/components/reminders/notification-bell.tsx — FOUND
- src/components/reminders/snooze-pills.tsx — FOUND
- src/components/reminders/plant-reminder-toggle.tsx — FOUND
- src/components/preferences/preferences-form.tsx — FOUND
- src/components/preferences/account-settings.tsx — FOUND
- src/app/(main)/preferences/page.tsx — FOUND

Commits exist:
- 238210d (Task 1) — FOUND
- 9b88a19 (Task 2) — FOUND
- 58ab650 (Task 3) — FOUND
