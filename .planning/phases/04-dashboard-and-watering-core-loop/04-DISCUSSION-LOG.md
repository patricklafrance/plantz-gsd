# Phase 4: Dashboard and Watering Core Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 04-dashboard-and-watering-core-loop
**Areas discussed:** Dashboard layout, One-tap watering UX, Watering history & retroactive logging

---

## Dashboard Layout

### Section organization

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked sections with card grid | Vertical sections (Overdue, Due Today, Upcoming, Recently Watered) each with header and grid of plant cards | Yes |
| Single flat list sorted by urgency | All plants in one list sorted by urgency with colored badges | |
| Compact summary + expandable | Top summary bar with counts, click to expand sections | |

**User's choice:** Stacked sections with card grid
**Notes:** Recommended option. Maps directly to DASH-01 requirements.

### Empty sections

| Option | Description | Selected |
|--------|-------------|----------|
| Hide empty sections | Section doesn't render if no plants in that status | Yes |
| Show all sections with empty state | All 4 sections always visible with "All caught up!" messages | |

**User's choice:** Hide empty sections
**Notes:** Keeps dashboard focused on actionable items.

### Sorting within sections

| Option | Description | Selected |
|--------|-------------|----------|
| Most urgent first | Overdue: most late first. Due Today: alphabetical. Upcoming: soonest first. Recently Watered: most recent first | Yes |
| Alphabetical within section | Consistent alphabetical order in every section | |

**User's choice:** Most urgent first

### Card information

| Option | Description | Selected |
|--------|-------------|----------|
| Name + status + room | Nickname, watering status badge, room name | Yes |
| Name + status + species + room | Adds species name below nickname | |
| Name + status only | Just nickname and urgency badge | |

**User's choice:** Name + status + room

---

## One-Tap Watering UX

### Water button appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Droplet icon button on card | Small water-droplet icon on right side of card, one tap waters | Yes |
| 'Water' text button on card | Explicit text button, clearer but takes more space | |
| Water button only on hover/focus | Appears on hover/long-press, minimalist but less discoverable | |

**User's choice:** Droplet icon button on card

### Optimistic UI feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Card animates out + toast | Card fades/slides out, success toast shows next watering date, optimistic update | Yes |
| Card updates in-place | Badge changes to checkmark, card stays in position | |
| Checkmark animation + move | Brief animation then card moves to Recently Watered | |

**User's choice:** Card animates out + toast

### Water button scope

| Option | Description | Selected |
|--------|-------------|----------|
| Overdue + Due Today only | Water button only where action is needed | |
| All sections | Water button on every card across all sections | Yes |

**User's choice:** All sections
**Notes:** Departed from recommendation. User wants water button available everywhere for flexibility.

### Undo behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Undo via toast | Toast includes Undo button for ~5 seconds | |
| No undo, edit from history | No immediate undo; user edits/deletes from plant detail history | Yes |
| Confirmation before watering | Popover confirmation before logging | |

**User's choice:** No undo, edit from history
**Notes:** Departed from recommendation. User prefers simpler approach without undo toast.

---

## Watering History & Retroactive Logging

### History display

| Option | Description | Selected |
|--------|-------------|----------|
| Simple chronological list | Clean list with date, relative time, optional note. Most recent first | Yes |
| Visual timeline | Vertical timeline with dots and connecting lines | |
| Calendar heatmap | Month view with colored days | |

**User's choice:** Simple chronological list

### Retroactive logging

| Option | Description | Selected |
|--------|-------------|----------|
| Date picker in dialog | "Log watering" button opens dialog with date picker + note field | Yes |
| Inline date field in history | Add entry row at top of history list | |
| Dashboard only, no retroactive | Always logs today's date | |

**User's choice:** Date picker in dialog

### Edit/delete watering logs

| Option | Description | Selected |
|--------|-------------|----------|
| Kebab menu on each entry | Three-dot menu with Edit/Delete options per history entry | Yes |
| Swipe actions + icons | Swipe on mobile, icons on desktop | |
| Edit from detail only | Click entry to edit, delete inside edit dialog | |

**User's choice:** Kebab menu on each entry

### Duplicate prevention

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side debounce, 1 min | Server rejects second log for same plant within 60 seconds | Yes |
| Disable button after tap | Client-side button disable for 30 seconds | |
| Allow duplicates, warn user | Let through with warning dialog | |

**User's choice:** Server-side debounce, 1 minute window

---

## Claude's Discretion

- Timezone implementation approach (client header vs URL param vs date-fns-tz)
- Dashboard card animation specifics (CSS transitions, timing)
- Date picker component choice
- History pagination threshold
- Loading skeleton design
- Mobile responsive breakpoints
- Next watering date recalculation logic placement
- Dashboard state when all plants are recently watered

## Deferred Ideas

None -- discussion stayed within phase scope
