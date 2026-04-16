---
status: partial
phase: 07-polish-and-accessibility
source: [07-VERIFICATION.md]
started: 2026-04-16T00:00:00Z
updated: 2026-04-16T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Mobile bottom tab bar layout
expected: BottomTabBar shows Dashboard, Plants, Rooms, Alerts tabs; desktop nav links hidden on 375px viewport
result: [pending]

### 2. Drawer sheet on mobile
expected: Add Plant dialog renders as bottom drawer with rounded top corners, swipe-to-dismiss on 375px viewport
result: [pending]

### 3. Drawer footer safe-area spacing (Plan 06 fix)
expected: Cancel and Save buttons are well-spaced above the device home bar/safe area, not cut off or cramped
result: [pending]

### 4. Full keyboard navigation
expected: All interactive elements receive visible focus rings; skip-to-content link is first; focus moves to h1 after navigation
result: [pending]

### 5. Screen reader navigation
expected: Landmarks announced, badge counts read aloud, toast announcements for watering success/failure
result: [pending]

### 6. Focus after navigation with streaming (Plan 06 fix)
expected: After clicking a nav link, focus reliably moves to the h1 heading even when page content streams in via Suspense
result: [pending]

### 7. Timezone mismatch warning (Plan 06 fix)
expected: When user's DB-stored timezone differs from browser timezone, a warning banner appears on the dashboard
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
