# Phase 4: Dashboard and Watering Core Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 04-dashboard-and-watering-core-loop
**Areas discussed:** Dashboard card layout, Water action feedback, Watering history UX, Empty & edge states

**Note:** Phase 4 was already implemented (plans 04-01 through 04-03 complete) when this context was gathered. Discussion confirmed existing implementation decisions retroactively.

---

## Dashboard Card Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Compact row (current) | Horizontal card: icon, name+species+room, urgency badge, water button. Info-dense. | ✓ |
| Larger visual card | Taller card with plant icon prominent at top, name below, urgency + water at bottom. | |
| You decide | Claude picks best layout. | |

**User's choice:** Compact row (current)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Merged 'Needs water' (current) | Overdue + due today combined into one section. Simpler, fewer visual breaks. | ✓ |
| Separate overdue / due today | Keep as distinct sections per DASH-01. More granular urgency. | |
| You decide | Claude picks best grouping. | |

**User's choice:** Merged 'Needs water' (current)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Current info set | Nickname, species, room, urgency badge with icon, inline snooze pills on urgent cards. | ✓ |
| Add next water date | Add explicit 'Next: Apr 20' below species. More info but noisier. | |
| You decide | Claude picks right info density. | |

**User's choice:** Current info set
**Notes:** None

---

## Water Action Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Current behavior | Optimistic move + toast with next date + duplicate block + retry on error. | ✓ |
| Add undo option | Same plus 'Undo' action button in success toast for ~5 seconds. | |
| Confirmation first | Brief confirmation popup before logging. Prevents accidental taps. | |

**User's choice:** Current behavior
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show next date (current) | Toast: 'Monstera watered! Next: May 2'. Immediate confirmation of what changed. | ✓ |
| Simple confirmation only | Toast: 'Monstera watered!'. Less noise. | |
| You decide | Claude picks best toast verbosity. | |

**User's choice:** Show next date (current)
**Notes:** None

---

## Watering History UX

| Option | Description | Selected |
|--------|-------------|----------|
| List with load-more (current) | Simple chronological list, 20 entries per page, 'Load more' button. | ✓ |
| Timeline view | Visual vertical timeline with date markers and connecting line. | |
| You decide | Claude picks best history display. | |

**User's choice:** List with load-more (current)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar picker (current) | Date picker in log dialog, defaults to today, any past date selectable. | ✓ |
| Quick-pick recent days | Quick buttons for 'Today', 'Yesterday', '2 days ago', 'Custom date...'. | |
| You decide | Claude picks best retroactive logging approach. | |

**User's choice:** Calendar picker (current)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Kebab menu, no delete confirm (current) | Three-dot menu with Edit/Delete. Delete is immediate. | ✓ |
| Kebab menu + delete confirmation | Same menu but Delete shows confirmation dialog. Safer. | |
| You decide | Claude picks best edit/delete UX. | |

**User's choice:** Kebab menu, no delete confirm (current)
**Notes:** None

---

## Empty & Edge States

| Option | Description | Selected |
|--------|-------------|----------|
| Current empty state | EmptyState component with icon, heading, body, Add Plant CTA. | ✓ |
| Richer onboarding | Same plus 2-3 suggested starter plants from catalog as quick-add cards. | |
| You decide | Claude picks best empty state. | |

**User's choice:** Current empty state
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same-day block (current) | One log per plant per calendar day. Server rejects duplicates. | ✓ |
| Short-window debounce | Block within 1-2 hours. Allows multiple daily waterings. | |
| You decide | Claude picks best duplicate prevention. | |

**User's choice:** Same-day block (current)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cookie-based sync (current) | Client sets timezone cookie, server reads for date boundaries. | ✓ |
| User-selected timezone | User picks timezone in settings. Falls back to cookie if not set. | |
| You decide | Claude picks best timezone approach. | |

**User's choice:** Cookie-based sync (current)
**Notes:** None

---

## Claude's Discretion

- Loading skeleton design and animation
- Exact spacing, typography, and color values
- Sort order within sections
- Error state designs beyond retry toast
- "All caught up" banner transitions

## Deferred Ideas

None — discussion stayed within phase scope
