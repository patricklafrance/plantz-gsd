---
status: diagnosed
phase: 07-polish-and-accessibility
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md]
started: 2026-04-15T12:00:00Z
updated: 2026-04-15T12:16:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bottom Tab Bar on Mobile
expected: On a mobile viewport (<640px), a fixed bottom navigation bar appears with 4 tabs: Dashboard, Plants, Rooms, and Alerts. Tapping each tab navigates to the correct page. The active tab is visually highlighted. On desktop (>=640px), the bottom bar is hidden.
result: pass

### 2. Skip-to-Content Link
expected: Press Tab on any page — the first focusable element is a "Skip to content" link. Pressing Enter on it jumps focus to the main content area, skipping the navigation.
result: pass

### 3. Touch Targets (44px Minimum)
expected: On mobile, all small interactive elements (user menu icon, snooze pills, filter chip dropdowns, room card edit/delete buttons) have at least 44x44px tap area. They should be easy to tap without accidentally hitting adjacent elements.
result: pass

### 4. Responsive Card Grids
expected: Card grids (dashboard, plants, rooms) show 1 column on mobile, 2 columns on small tablets (>=640px), and 3 columns on desktop (>=1024px). Cards reflow smoothly when resizing the browser.
result: pass

### 5. Add Plant Dialog as Bottom Drawer on Mobile
expected: On mobile (<640px), tapping "Add Plant" opens a bottom sheet drawer that slides up from the bottom. On desktop, it opens as a centered modal dialog.
result: pass

### 6. Edit Plant Dialog as Bottom Drawer on Mobile
expected: On mobile (<640px), tapping edit on a plant opens a bottom sheet drawer. On desktop, it opens as a centered modal dialog.
result: issue
reported: "Yes, but the buttons are touching the bottom of the screens"
severity: cosmetic

### 7. Log Watering Dialog as Bottom Drawer on Mobile
expected: On mobile (<640px), tapping "Water" on a plant card opens a bottom sheet drawer. On desktop, it opens as a centered modal dialog.
result: pass

### 8. Focus Moves to Heading After Navigation
expected: After navigating between pages (e.g., Dashboard to Plants), keyboard focus automatically moves to the page's h1 heading. This is observable by tabbing — the next Tab press should move to the first interactive element after the heading, not back to the nav.
result: issue
reported: "The focus remains on the link I click"
severity: major

### 9. Status Badges Show Icons (Not Color-Only)
expected: Plant status badges (Overdue, Due Today, Upcoming, Recently Watered, Unknown) each display an icon alongside the text label and color. The meaning is conveyed without relying on color alone.
result: pass

### 10. Watering Failure Shows Retry Toast
expected: If a watering action fails (e.g., network error), an error toast appears with a "Retry" action button. Clicking Retry re-attempts the watering.
result: skipped
reason: User unsure how to trigger a network error

### 11. Plants Page Pagination
expected: With more than 20 plants, the plants page shows a pagination bar at the bottom with Previous/Next buttons and a page count (e.g., "Page 1 of 3"). Navigating pages preserves any active search or filter params in the URL.
result: pass

### 12. Empty States
expected: When there are no plants, rooms, or notifications, each page shows a styled empty state with an icon, heading, description, and a call-to-action button (e.g., "Add your first plant"). These replace any blank/bare content areas.
result: pass

### 13. Character Limits on Inputs
expected: Plant nickname input limits to 40 characters, room name to 40 characters, and notes to 1000 characters. A character count appears when approaching the limit. Typing beyond the limit is prevented.
result: pass

### 14. Timezone Mismatch Warning
expected: If the browser's timezone differs from the timezone stored in the user's cookie/preferences, a warning banner appears on the dashboard informing the user. It can be dismissed and stays dismissed for the browser session.
result: issue
reported: "I don't see any warning banner"
severity: major

### 15. Loading Skeletons
expected: When navigating to dashboard, plants, or rooms pages, a skeleton loading UI appears briefly (matching the page layout structure) before the real content loads. Visible on slower connections or hard refresh.
result: pass

### 16. Keyboard Focus Rings on Bottom Tab Bar and Filter Chips
expected: When using keyboard navigation (Tab key), the bottom tab bar links and filter chip dropdown buttons show a visible focus ring indicator. The ring is only visible on keyboard focus, not on mouse click.
result: pass

## Summary

total: 16
passed: 12
issues: 3
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Edit plant bottom drawer has properly spaced buttons with safe area padding on mobile"
  status: failed
  reason: "User reported: Yes, but the buttons are touching the bottom of the screens"
  severity: cosmetic
  test: 6
  root_cause: "edit-plant-dialog.tsx uses raw <div> for footer instead of ResponsiveDialogFooter, and DrawerFooter in drawer.tsx negates parent safe-area padding with -mb-4 without adding its own"
  artifacts:
    - path: "src/components/plants/edit-plant-dialog.tsx"
      issue: "Line 214: raw <div> instead of ResponsiveDialogFooter"
    - path: "src/components/ui/drawer.tsx"
      issue: "Line 94: DrawerFooter -mb-4 negates safe-area padding, needs pb-[calc(1rem+env(safe-area-inset-bottom))]"
  missing:
    - "Replace raw div with ResponsiveDialogFooter in edit-plant-dialog.tsx"
    - "Add safe-area-inset-bottom padding to DrawerFooter in drawer.tsx"
  debug_session: ""

- truth: "Timezone mismatch warning banner appears on dashboard when browser timezone differs from stored preference"
  status: failed
  reason: "User reported: I don't see any warning banner"
  severity: major
  test: 14
  root_cause: "TimezoneSync writes browser timezone to user_tz cookie on every load; TimezoneWarning compares browser timezone against that same cookie — they always match, so the warning never triggers"
  artifacts:
    - path: "src/components/watering/timezone-sync.tsx"
      issue: "Line 7-8: overwrites cookie with browser timezone on every render"
    - path: "src/components/shared/timezone-warning.tsx"
      issue: "Line 15-21: compares browser TZ against cookie that always matches"
  missing:
    - "Store user timezone preference in database, compare browser TZ against that stored preference instead of the cookie that TimezoneSync overwrites"
  debug_session: ""

- truth: "Focus automatically moves to h1 heading after client-side navigation"
  status: failed
  reason: "User reported: The focus remains on the link I click"
  severity: major
  test: 8
  root_cause: "useFocusHeading uses fixed 50ms setTimeout which races against Next.js 16 streaming/Suspense — the new page h1 may not be in the DOM yet when querySelector runs, returning null and silently failing"
  artifacts:
    - path: "src/hooks/use-focus-heading.ts"
      issue: "Lines 9-11: 50ms setTimeout races against streamed page content"
  missing:
    - "Replace fixed timeout with MutationObserver or requestAnimationFrame polling that waits for h1[tabindex='-1'] to appear in DOM before focusing"
  debug_session: ""
