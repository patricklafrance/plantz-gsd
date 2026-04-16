---
status: partial
phase: 05-notes-search-and-filters
source: [05-VERIFICATION.md]
started: 2026-04-15T04:00:00.000Z
updated: 2026-04-15T04:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Note Add via Timeline
expected: Type a note in the "Add a note..." input, press Enter. Toast "Note added." appears. Note shows at top of Timeline with Pencil icon.
result: [pending]

### 2. Note Inline Edit
expected: Click kebab menu on a note → Edit. Textarea appears with Save/Discard buttons. Edit content, click "Save note". Toast "Note updated." appears. Note shows "(edited)" indicator.
result: [pending]

### 3. Note Delete with Confirmation
expected: Click kebab menu on a note → Delete. AlertDialog "Delete note?" appears. Click "Delete note". Toast "Note deleted." Note removed from timeline.
result: [pending]

### 4. Search Real-time Filtering
expected: Type a plant name in the search bar on /plants page. After 300ms debounce, grid filters to matching plants. URL updates with ?search= param. Clear button (X) removes filter.
result: [pending]

### 5. Composed Room + Status Filter
expected: Select a room filter pill, then select "Overdue" status pill. Grid shows only overdue plants in that room (AND composition). Selecting "All" status resets to room-only filter.
result: [pending]

### 6. Empty State Differentiation
expected: With zero plants, shows original "No plants yet" CTA with add plant button. With plants but search miss, shows "No plants found" with "Clear search" CTA. With archived filter and no archived plants, shows "No archived plants".
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
