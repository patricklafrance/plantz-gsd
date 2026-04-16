---
status: partial
phase: 07-polish-and-accessibility
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md]
started: 2026-04-16T12:00:00Z
updated: 2026-04-16T12:05:00Z
---

## Current Test

[testing paused — 15 items skipped]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the app fresh (npm run dev). Server boots without errors, database connects, and the dashboard loads with live data.
result: skipped

### 2. [RE-VERIFY] Edit Plant Drawer Button Spacing on Mobile
expected: On mobile (<640px), open edit plant dialog. The Save/Cancel buttons at the bottom have proper spacing and do NOT touch the bottom edge of the screen (especially on notched/home-bar devices). There should be visible padding below the buttons.
result: skipped

### 3. [RE-VERIFY] Focus Moves to Heading After Navigation
expected: Navigate between pages using links (e.g., click "Plants" in the nav). After the page loads, keyboard focus should have moved to the page heading (h1). Press Tab once — focus should move to the first interactive element AFTER the heading, not back to the nav.
result: skipped

### 4. [RE-VERIFY] Timezone Mismatch Warning
expected: If your browser timezone differs from what was stored when you first used the app, a warning banner should appear on the dashboard. (To test: the timezone is stored in the database on first visit. If you've always used the same timezone, the banner correctly won't show.)
result: skipped

### 5. Password Toggle Buttons Centered in Inputs
expected: On the login and register pages, the show/hide password eye icon buttons are vertically centered within their input fields — not stuck to the top or bottom edge of the input.
result: skipped

### 6. Watering a Recently Watered Plant (No Flicker)
expected: On the dashboard, water a plant that is already in the "Recently Watered" section. The card should NOT briefly disappear and reappear — it stays in place smoothly with no visual flicker.
result: skipped

### 7. Starter Plant Count Matches Onboarding Selection
expected: During onboarding (new account or demo mode), when selecting a plant count range (e.g., "5-10 plants"), the number of starter plants seeded should fall within that range. Selecting a larger range should seed more plants.
result: skipped

### 8. Long Plant Names Don't Overflow Cards
expected: If a plant has a very long nickname with no spaces (e.g., "Superlongplantnamewithnospaces"), the text wraps or truncates within the card boundaries — it does not overflow or break the card layout.
result: issue
reported: "Plant with name 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' — the card height is not as high as a regular plant"
severity: cosmetic

### 9. Bottom Tab Bar on Mobile
expected: On mobile (<640px), a fixed bottom nav bar shows Dashboard, Plants, Rooms, and Alerts tabs. Tapping each navigates correctly. Active tab is highlighted. Hidden on desktop (>=640px).
result: skipped

### 10. Responsive Drawers for All Form Dialogs
expected: On mobile (<640px), Add Plant, Edit Plant, and Log Watering dialogs open as bottom sheet drawers sliding up from the bottom. On desktop, they open as centered modal dialogs.
result: skipped

### 11. Status Badges Show Icons (Not Color-Only)
expected: Plant status badges (Overdue, Due Today, Upcoming, Recently Watered) each display an icon alongside the text and color. Meaning is clear without relying on color alone.
result: skipped

### 12. Plants Page Pagination
expected: With more than 20 plants, the plants page shows pagination at the bottom with Previous/Next and page count. Navigating pages preserves search/filter params in the URL.
result: skipped

### 13. Empty States Across Pages
expected: Pages with no data (no plants, no rooms, no notifications) show styled empty states with icon, heading, description, and call-to-action button.
result: skipped

### 14. Character Limits on Inputs
expected: Plant nickname limits to 40 chars, room name to 40 chars, notes to 1000 chars. Character count appears near the limit. Typing beyond is prevented by maxLength.
result: skipped

### 15. Loading Skeletons
expected: Navigating to dashboard, plants, or rooms shows skeleton loading UI briefly before real content. Visible on hard refresh or slower connections.
result: skipped

### 16. Keyboard Focus Rings
expected: Using Tab key, bottom tab bar links and filter chip dropdowns show visible focus ring. Ring appears only on keyboard focus, not mouse click.
result: skipped

## Summary

total: 16
passed: 0
issues: 1
pending: 0
skipped: 15
blocked: 0

## Gaps

- truth: "Long plant names truncate or wrap within card boundaries without affecting card height"
  status: failed
  reason: "User reported: Plant with name 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' — the card height is not as high as a regular plant"
  severity: cosmetic
  test: 8
  artifacts: []
  missing: []
