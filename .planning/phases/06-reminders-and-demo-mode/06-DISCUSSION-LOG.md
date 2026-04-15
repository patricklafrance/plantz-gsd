# Phase 6: Reminders and Demo Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 06-reminders-and-demo-mode
**Areas discussed:** Notification center, Reminder settings & snooze

---

## Notification Center

### How should the notification center appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Bell icon with dropdown panel | Bell icon in nav with badge count; clicking opens dropdown listing plants needing attention. Familiar pattern, no page navigation. | ✓ |
| Bell icon linking to /reminders page | Bell with badge in nav, clicking navigates to a full page with filters, history, settings. | |
| Popover with expandable detail | Bell opens small popover showing top 5 items; "View all" link to full page. Hybrid approach. | |

**User's choice:** Bell icon with dropdown panel
**Notes:** None

### What should each reminder item in the dropdown show?

| Option | Description | Selected |
|--------|-------------|----------|
| Plant name + days overdue + quick actions | Each row: plant nickname, urgency, Water and Snooze buttons inline. | |
| Plant name + days overdue only | Minimal rows, click to go to plant detail for actions. | |
| Plant name + room + days overdue + quick actions | Richer rows including room name. More info but larger dropdown. | |

**User's choice:** Plant name + room + days overdue (custom — from "Plant name + room + days overdue + quick actions" but without quick actions)
**Notes:** User wanted room context but no inline actions in the dropdown.

### What should clicking a reminder item do?

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to plant detail page | Clicking takes you to plant's detail page for water, snooze, manage. | ✓ |
| Expand inline with action buttons | Clicking expands row to show Water/Snooze buttons in dropdown. | |

**User's choice:** Navigate to plant detail page
**Notes:** None

### Badge count scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Overdue + due today | Total count of plants needing attention now. Aligns with dashboard urgency-first. | ✓ |
| Overdue only | Only past-due plants. Less noisy but might miss timely action. | |
| Overdue + due today + snoozed expiring today | Most comprehensive count including snooze expirations. | |

**User's choice:** Overdue + due today
**Notes:** None

---

## Reminder Settings & Snooze

### Where should users configure reminder preferences?

| Option | Description | Selected |
|--------|-------------|----------|
| Global toggle in Settings page + per-plant on detail | /settings page with master on/off. Per-plant toggle on detail page. | |
| All in plant detail page only | No separate settings page. Everything on plant detail pages. | |
| Dropdown from notification bell | Gear icon in notification dropdown for inline settings. | |

**User's choice:** Custom — New /preferences page for global toggle; per-plant configuration on plant detail pages
**Notes:** User initially selected "All in plant detail page only" but then clarified they want a new preferences page for the global reminder toggle, while individual plant reminder settings stay on the plant detail page.

### Preferences page scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — just reminders toggle | Clean /preferences with only global reminders on/off. | |
| Include account basics too | Reminders toggle plus change email, change password, delete account. | ✓ |

**User's choice:** Include account basics too
**Notes:** None

### How should snooze options be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Snooze button with preset durations menu | "Snooze" button opens small menu: 1 day, 2 days, 1 week, Custom. | |
| Snooze via inline pill buttons | When overdue/due, show pill buttons: "1d" "2d" "1w" "Custom". No extra click. | ✓ |
| Snooze from notification dropdown only | Snooze only available in the bell dropdown. | |

**User's choice:** Snooze via inline pill buttons
**Notes:** None

### Global reminders toggle location?

| Option | Description | Selected |
|--------|-------------|----------|
| In notification dropdown header | Small toggle at top of bell dropdown. | |
| In nav user menu | User dropdown with reminders toggle alongside logout. | |
| On dashboard header | Subtle toggle near dashboard title. | |

**User's choice:** Custom — On a new /preferences page
**Notes:** User wanted a dedicated preferences page rather than embedding the toggle in existing UI elements.

---

## Claude's Discretion

- Demo mode architecture and entry point
- Demo mode read-only enforcement
- Starter plant seeding UX during onboarding (DEMO-03)
- Notification dropdown empty state
- Bell icon animation
- Snooze "Custom" duration picker design
- Preferences page layout
- Account settings implementation details

## Deferred Ideas

- Demo mode access & experience — User chose not to discuss in gray area selection
- Starter plant seeding — User chose not to discuss in gray area selection
