---
status: partial
phase: 03-plant-collection-and-rooms
source: [03-VERIFICATION.md]
started: 2026-04-14T12:40:00Z
updated: 2026-04-14T12:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Add a plant from catalog
expected: Select Pothos from catalog, confirm species auto-fills to 'Epipremnum aureum', watering interval auto-fills to 10, submit. Plant appears in /plants collection grid with correct nickname, species, and badge status.
result: [pending]

### 2. Add a plant using Custom plant option
expected: Click 'Custom plant', enter nickname and interval, submit. Plant appears in /plants without a careProfileId linked.
result: [pending]

### 3. Assign a room to a plant during creation
expected: Open add-plant dialog, go to form step, select a room from dropdown, submit. Plant card shows room label; plant detail page shows room in Care info card.
result: [pending]

### 4. Filter plant collection by room
expected: Navigate to /plants, click a room pill. URL changes to ?room={id}, only plants in that room are shown; clicking 'All' restores full collection.
result: [pending]

### 5. Archive a plant then undo
expected: Click Archive on plant detail page. Plant disappears from /plants, Sonner toast shows 'Plant archived.' with Undo button; clicking Undo restores the plant.
result: [pending]

### 6. Delete a plant with confirmation
expected: Click Delete on plant detail page, confirm in AlertDialog. AlertDialog shows plant nickname in description; confirming deletes plant and navigates to /plants.
result: [pending]

### 7. Create rooms using presets
expected: Navigate to /rooms, click 'Living Room' preset chip. Room card appears with 'Living Room' name; chip becomes disabled after creation.
result: [pending]

### 8. Delete a room that has plants
expected: Assign a plant to a room, then delete the room. AlertDialog shows 'will become unassigned' warning; after deletion, plant's roomId is null.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
