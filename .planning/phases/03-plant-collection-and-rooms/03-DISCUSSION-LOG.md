# Phase 3: Plant Collection and Rooms - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 03-plant-collection-and-rooms
**Areas discussed:** Add Plant Flow, Plant Detail & Editing, Room Organization, Care Catalog Design

---

## Add Plant Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog-first | User browses/searches catalog first, selects plant which auto-fills fields | ✓ |
| Form-first | Empty form with optional catalog button | |
| Wizard steps | Step-by-step: catalog or custom, details, room | |

**User's choice:** Catalog-first
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | Nickname, species, room, watering interval | ✓ |
| Full upfront | All fields at once | |
| You decide | Claude picks | |

**User's choice:** Minimal

| Option | Description | Selected |
|--------|-------------|----------|
| Floating action button | Persistent FAB | |
| Dashboard + collection page | Button in header areas | ✓ |
| You decide | Claude places it | |

**User's choice:** Dashboard + collection page

| Option | Description | Selected |
|--------|-------------|----------|
| Full page | Dedicated /plants/new page | |
| Side sheet / drawer | Slides from right | |
| Modal dialog | Centered overlay | ✓ |

**User's choice:** Modal dialog

---

## Plant Detail & Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on detail page | Edit button makes fields editable in-place | |
| Separate edit page | Navigate to /plants/[id]/edit | |
| Edit modal | Modal with pre-filled form | ✓ |

**User's choice:** Edit modal

| Option | Description | Selected |
|--------|-------------|----------|
| Archive from menu, delete from archive | Separation of concerns | |
| Both from detail page | Archive instant with undo, delete with confirmation | ✓ |
| You decide | Claude picks | |

**User's choice:** Both from detail page

| Option | Description | Selected |
|--------|-------------|----------|
| Card sections | Status, Care info, History, Notes in cards | ✓ |
| Single scrollable page | Linear scroll layout | |
| You decide | Claude designs it | |

**User's choice:** Card sections

---

## Room Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Inline creation | Room dropdown with '+ New room' in plant forms | |
| Dedicated room management | Separate /rooms page with full CRUD | ✓ |
| You decide | Claude picks complexity | |

**User's choice:** Dedicated room management

| Option | Description | Selected |
|--------|-------------|----------|
| Plant grid with summary | Room header + plant card grid | ✓ |
| Simple plant list | Room name + list of plant names | |
| You decide | Claude designs it | |

**User's choice:** Plant grid with summary

| Option | Description | Selected |
|--------|-------------|----------|
| Tab/pill bar | Horizontal room pills above collection | ✓ |
| Dropdown filter | Filter dropdown in header | |
| You decide | Claude picks based on room count | |

**User's choice:** Tab/pill bar

---

## Care Catalog Design

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma seed script | JSON/TS data, prisma db seed | ✓ |
| Admin UI to manage catalog | Basic admin page | |
| You decide | Claude picks seeding approach | |

**User's choice:** Prisma seed script

| Option | Description | Selected |
|--------|-------------|----------|
| Search + category grid | Search bar + grid grouped by category | ✓ |
| Searchable dropdown | Combobox/autocomplete | |
| You decide | Claude picks UX | |

**User's choice:** Search + category grid

| Option | Description | Selected |
|--------|-------------|----------|
| Core care data | Species, common name, interval, light, care note | ✓ |
| Extended profiles | Core + humidity, temp, toxicity, difficulty | |
| You decide | Claude picks for v1 | |

**User's choice:** Core care data

---

## Claude's Discretion

- Plant card design (icon/emoji, info density, hover states)
- Exact catalog categories and plant assignments
- Empty state for collection page
- Room deletion behavior when room has plants
- Form validation messages
- Mobile responsive layout
- Loading states and skeletons

## Deferred Ideas

None — discussion stayed within phase scope
