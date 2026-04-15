# Phase 5: Notes, Search, and Filters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 05-notes-search-and-filters
**Areas discussed:** Notes timeline integration, Notes entry & editing UX, Search placement & behavior, Filter & sort controls

---

## Notes Timeline Integration

### How should notes appear on the plant detail page relative to watering history?

| Option | Description | Selected |
|--------|-------------|----------|
| Unified timeline | Notes and watering events interleaved in one chronological list. Each entry has a type icon (droplet vs pencil). Gives a complete plant care story in one scroll. | ✓ |
| Separate sections | Keep the existing Watering History card as-is. Notes get their own card below it with a separate chronological list. Simpler to build, but the care story is split. | |
| You decide | Claude picks the approach during planning based on implementation complexity. | |

**User's choice:** Unified timeline
**Notes:** None

### Should there be a new Note model in the database, or should notes reuse the existing HealthLog model?

| Option | Description | Selected |
|--------|-------------|----------|
| New Note model | Dedicated Note model (id, plantId, content, createdAt, updatedAt). Clean separation — HealthLog stays reserved for health observations (v2). Simple and purpose-built. | ✓ |
| Reuse HealthLog | Use HealthLog's 'observation' field for notes, add a 'type' discriminator. Avoids a new table but muddies the model when health tracking arrives in v2. | |
| You decide | Claude picks based on schema cleanliness and migration complexity. | |

**User's choice:** New Note model
**Notes:** None

### When showing a unified timeline, what time range should load by default?

| Option | Description | Selected |
|--------|-------------|----------|
| Last 20 entries | Load the 20 most recent events (notes + waterings combined), with a 'Load more' button. Matches the existing watering history pagination pattern. | ✓ |
| Last 30 days | Show all events from the past 30 days regardless of count. Calendar-oriented but could be empty for low-maintenance plants. | |
| You decide | Claude picks the pagination strategy during planning. | |

**User's choice:** Last 20 entries
**Notes:** None

---

## Notes Entry & Editing UX

### How should users add a new note to a plant?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline text field | A text input at the top of the timeline card — type and press Enter or click 'Add'. Low friction, no modal needed. Similar to adding a comment in a chat. | ✓ |
| Dialog form | An 'Add note' button opens a modal dialog with a textarea. Consistent with the add/edit watering log dialog pattern from Phase 4. | |
| You decide | Claude picks based on UX consistency and implementation simplicity. | |

**User's choice:** Inline text field
**Notes:** None

### How should note editing and deletion work?

| Option | Description | Selected |
|--------|-------------|----------|
| Kebab menu on each note | Three-dot menu on each note entry with 'Edit' and 'Delete' options. Edit opens inline editing (text becomes editable). Delete shows confirmation. Matches watering history entry pattern. | ✓ |
| Click to edit, swipe to delete | Clicking a note makes it editable inline. Swipe-left reveals delete button on mobile. More gestural but less discoverable. | |
| You decide | Claude picks the edit/delete pattern during planning. | |

**User's choice:** Kebab menu on each note
**Notes:** None

### Should notes have a character limit?

| Option | Description | Selected |
|--------|-------------|----------|
| 500 characters | Short and focused — enough for observations like 'New leaf unfurling' or 'Moved to brighter spot'. Keeps the timeline scannable. | |
| No limit | Freeform text of any length. More flexible but risks long notes cluttering the timeline. | ✓ |
| You decide | Claude picks a sensible limit during planning. | |

**User's choice:** No limit
**Notes:** None

---

## Search Placement & Behavior

### Where should the search bar live?

| Option | Description | Selected |
|--------|-------------|----------|
| Plants page only | Search bar at the top of the /plants collection page, above the room filter pills. Scoped to plant search — simple and focused. | ✓ |
| Global nav bar | Search in the top nav, available from any page. Results show in a dropdown or redirect to /plants with query. More powerful but heavier to build. | |
| You decide | Claude picks the best placement during planning. | |

**User's choice:** Plants page only
**Notes:** None

### How should search results appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant filter | As the user types, the plant grid filters in real-time using URL search params. No separate results page — the existing grid just shows matching plants. Debounced input (300ms). | ✓ |
| Submit + results page | User types and presses Enter or clicks search. Results appear on a dedicated search results view. More traditional but adds an extra step. | |
| You decide | Claude picks the search interaction pattern. | |

**User's choice:** Instant filter
**Notes:** None

### Should search match against nickname only, or also species name?

| Option | Description | Selected |
|--------|-------------|----------|
| Both nickname and species | Search matches against both plant nickname and species name. Users may remember either. Simple ILIKE query. | ✓ |
| Nickname only | Only search by the name the user gave the plant. Simpler query but users who search by species won't find results. | |
| You decide | Claude picks the match fields. | |

**User's choice:** Both nickname and species
**Notes:** None

---

## Filter & Sort Controls

### How should watering status filters be presented alongside the existing room filter pills?

| Option | Description | Selected |
|--------|-------------|----------|
| Second pill row | Room pills stay on top. A second row below adds status filter pills: All, Overdue, Due today, Upcoming, Archived. Both rows use URL search params and can be combined. | ✓ |
| Dropdown filter menu | A 'Filter' button opens a dropdown with checkboxes for status and room. Compact but hides options behind a click. | |
| You decide | Claude picks the filter UI pattern during planning. | |

**User's choice:** Second pill row
**Notes:** None

### How should sort options be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Sort dropdown | A 'Sort by' dropdown button near the search bar with options: Next watering, Name (A-Z), Recently added. Default sort: Next watering date. | ✓ |
| Clickable column headers | Table-style sortable headers above the grid. More powerful but changes the grid layout toward a table feel. | |
| You decide | Claude picks the sort UI approach. | |

**User's choice:** Sort dropdown
**Notes:** None

### Should room filters and status filters be combinable (AND logic)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, combinable | User can select room AND status to see only matching plants. Filters compose with AND logic. URL params: ?room=abc&status=overdue&sort=name. | ✓ |
| Mutually exclusive groups | User can filter by room OR by status, not both at once. Simpler but less useful. | |
| You decide | Claude picks the filter composition strategy. | |

**User's choice:** Yes, combinable
**Notes:** None

---

## Claude's Discretion

- Search bar styling and placeholder text
- Status pill colors/variants
- Timeline entry layout details
- Inline note editing interaction (save on blur vs explicit save button)
- Empty state when search/filter returns no results
- Mobile responsive behavior for two filter rows + sort dropdown
- Note model migration details

## Deferred Ideas

None — discussion stayed within phase scope
