# Phase 6: Reminders and Demo Mode - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Signed-in users receive in-app reminders for plants needing attention; unauthenticated visitors can explore the full app experience with sample data. Includes notification center with badge count, global and per-plant reminder configuration, snooze functionality, read-only demo mode for visitors, and optional starter plant seeding during onboarding.

</domain>

<decisions>
## Implementation Decisions

### Notification Center
- **D-01:** Bell icon in the nav bar with a badge count showing how many plants need attention. Clicking opens a dropdown panel listing plants needing water.
- **D-02:** Badge count includes overdue plants + plants due today. Aligns with the dashboard's urgency-first approach.
- **D-03:** Each reminder item in the dropdown shows: plant nickname, room name, and days overdue/due status. No inline quick actions in the dropdown.
- **D-04:** Clicking a reminder item navigates to that plant's detail page where the user can water, snooze, or manage the plant.

### Reminder Settings
- **D-05:** Global reminders toggle lives on a new /preferences page. Per-plant reminder enable/disable stays on the plant detail page.
- **D-06:** The /preferences page includes the global reminders on/off toggle plus account basics (change email, change password, delete account).
- **D-07:** Reminders default to on for new users (carried forward from Phase 2 D-08).

### Snooze Behavior
- **D-08:** When a plant is overdue or due today, inline pill buttons appear on the plant detail page: "1d", "2d", "1w", "Custom". No extra menu click needed.
- **D-09:** Snooze sets the `snoozedUntil` timestamp on the Reminder model. Snoozed plants are excluded from the notification badge count until the snooze expires.

### Claude's Discretion
- Demo mode architecture — how to handle unauthenticated access (dedicated demo user in DB, session-scoped data, or middleware-based approach)
- Demo mode entry point — login page CTA, /demo route, or public landing page
- Demo mode read-only enforcement mechanism (middleware, action guards, or UI-only blocking)
- Starter plant seeding UX during onboarding (DEMO-03) — pick from list, auto-seed common set, or checkbox opt-in
- Notification dropdown empty state when no plants need attention
- Bell icon animation or visual treatment when new reminders appear
- Snooze "Custom" duration picker design (calendar, number input, etc.)
- Preferences page layout and navigation (nav link placement, page structure)
- Account settings implementation details (password change flow, email change verification, delete account confirmation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Vision, constraints ("In-app notification center only — no email or push for v1"), data model entities including Reminder
- `.planning/REQUIREMENTS.md` §Reminders — RMDR-01 through RMDR-05 acceptance criteria
- `.planning/REQUIREMENTS.md` §Demo Mode — DEMO-01 through DEMO-03 acceptance criteria
- `.planning/ROADMAP.md` §Phase 6 — Success criteria (5 items), UI hint: yes

### Prior phase context
- `.planning/phases/02-authentication-and-onboarding/02-CONTEXT.md` — D-08: reminders default to on, configured in Phase 6. D-05: root `/` redirects to dashboard/login. Onboarding banner pattern.
- `.planning/phases/03-plant-collection-and-rooms/03-CONTEXT.md` — Modal dialog pattern, catalog-first add plant, feature-based file organization

### Data model
- `prisma/schema.prisma` — Reminder model already defined (id, plantId, userId, enabled, snoozedUntil). User model has reminders relation.

### Tech stack
- `CLAUDE.md` §Technology Stack — Next.js 16, Prisma 7, shadcn/ui, Tailwind v4, Zod v4
- `CLAUDE.md` §Stack Patterns — Server Components for reads, Server Actions for writes

### Existing code
- `src/app/(main)/layout.tsx` — Nav bar where bell icon + badge will be added
- `src/app/(main)/dashboard/page.tsx` — Dashboard with urgency sections (overdue, due today, upcoming, recently watered)
- `src/features/watering/queries.ts` — `getDashboardPlants` query for urgency classification (reusable for reminder badge count)
- `src/components/ui/dropdown-menu.tsx` — shadcn DropdownMenu for notification dropdown
- `src/components/ui/badge.tsx` — shadcn Badge for notification count
- `src/components/plants/plant-detail.tsx` — Plant detail page where per-plant reminder toggle and snooze pills will live

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/dropdown-menu.tsx` — shadcn DropdownMenu for the notification bell dropdown
- `src/components/ui/badge.tsx` — shadcn Badge for notification count display
- `src/components/ui/button.tsx` — shadcn Button for snooze pills and actions
- `src/components/ui/card.tsx` — shadcn Card for preferences page sections
- `src/components/ui/input.tsx` — shadcn Input for account settings forms
- `src/components/ui/sonner.tsx` — Toast notifications for snooze confirmation, settings saved feedback
- `src/features/watering/queries.ts` — `getDashboardPlants` already classifies plants by urgency; badge count can reuse this logic
- `src/lib/db.ts` — Prisma singleton for all database queries

### Established Patterns
- Feature-based organization: `src/features/{domain}/actions.ts`, `schemas.ts`, `queries.ts` — Phase 6 should use `src/features/reminders/` and `src/features/demo/`
- Server Components for data fetching with direct Prisma queries
- Server Actions with Zod validation for mutations
- Route groups: `(auth)/` for public pages, `(main)/` for authenticated pages
- Modal/dialog pattern established in Phase 3 for CRUD operations

### Integration Points
- `src/app/(main)/layout.tsx` — Bell icon with badge needs to be added to the nav, requires a server-side query for reminder count
- `src/components/plants/plant-detail.tsx` — Needs reminder toggle and snooze pill buttons added
- `prisma/schema.prisma` — Reminder model exists; may need additional fields for frequency/preferences. User model may need a `remindersEnabled` global toggle field.
- Auth layer — Demo mode needs to bypass or simulate authentication for read-only access
- `src/app/(auth)/login/page.tsx` — May need a "Try demo" CTA linking to demo mode

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- Demo mode access & experience — User chose not to discuss; left to Claude's discretion
- Starter plant seeding UX — User chose not to discuss; left to Claude's discretion

</deferred>

---

*Phase: 06-reminders-and-demo-mode*
*Context gathered: 2026-04-15*
