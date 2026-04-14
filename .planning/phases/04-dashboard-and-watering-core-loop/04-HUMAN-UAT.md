---
status: partial
phase: 04-dashboard-and-watering-core-loop
source: [04-VERIFICATION.md]
started: 2026-04-14T17:41:00Z
updated: 2026-04-14T17:41:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dashboard displays urgency-grouped sections with real plant data
expected: Plants grouped into Overdue, Due Today, Upcoming, Recently Watered with correct badge colors and sort order
result: [pending]

### 2. Water button interaction with optimistic UI and toast feedback
expected: Tap water droplet -> card fades out optimistically -> toast shows plant name + next date -> duplicate tap shows "Already logged!"
result: [pending]

### 3. Calendar date picker in log watering dialog
expected: Popover positions correctly on mobile/desktop, future dates disabled, week starts on correct day, pre-fills today
result: [pending]

### 4. Watering history edit and delete flows on plant detail
expected: Kebab menu opens edit/delete options, edit pre-fills values, delete shows confirmation, both update history list after mutation
result: [pending]

### 5. Duplicate watering detection within 60-second window
expected: Second water tap within 60s returns "Already logged!" toast without creating duplicate log entry
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
