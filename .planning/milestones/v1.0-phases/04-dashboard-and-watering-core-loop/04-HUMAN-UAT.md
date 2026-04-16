---
status: partial
phase: 04-dashboard-and-watering-core-loop
source: [04-VERIFICATION.md]
started: 2026-04-16T12:25:00Z
updated: 2026-04-16T12:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dashboard urgency sections render correctly
expected: Sections are present (Overdue, Due Today, Upcoming, Recently Watered), counts are accurate, badges display correct labels (e.g., '3d overdue', 'Due today', 'In 5d', 'Watered X ago'). Section headers show counts in format 'Needs water (3)'.
result: [pending]

### 2. One-tap watering with optimistic UI
expected: Card immediately moves to the Recently Watered section with a fade/scale animation (transition-all duration-300). A success toast appears: '{name} watered! Next: {Month Day}'. The WaterButton shows a Loader2 spinner while pending.
result: [pending]

### 3. Duplicate watering detection
expected: Toast appears: 'Already logged! Edit from history if needed.' Card does NOT move to Recently Watered again.
result: [pending]

### 4. Watering history edit and delete on plant detail
expected: History shows newest first. Edit opens 'Edit watering log' dialog pre-filled with existing date/note. Delete shows AlertDialog titled 'Delete watering log?' with cancel 'Keep log' and action 'Delete log'. After deletion, next watering date recalculates.
result: [pending]

### 5. Retroactive watering log via calendar date picker
expected: Calendar prevents future date selection. After retroactive log, if a newer log already exists, nextWateringAt is based on the newer log. Success toast: '{name} watered on {Month Day}. Next: {Month Day}'.
result: [pending]

### 6. Responsive dashboard layout at mobile/desktop breakpoints
expected: Mobile: single-column card grid. Mid: 2-column grid (sm). Desktop: 3-column grid (lg). Cards have horizontal flex layout with leaf icon, plant info, badge, and water button. Touch targets are 44px minimum.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
