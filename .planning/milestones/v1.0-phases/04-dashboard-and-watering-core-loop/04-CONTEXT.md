# Phase 4: Dashboard and Watering Core Loop - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see at a glance which plants need watering today and log it in one tap — the core value of the product. Includes urgency-grouped dashboard, one-tap watering with optimistic feedback, automatic next-date recalculation, chronological watering history with retroactive logging, and edit/delete of watering logs. Notes, search, and reminders are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Card Layout
- **D-01:** Compact horizontal row cards: leaf icon | nickname + species + room (centered) | urgency badge | water button. Info-dense, fits many plants on screen.
- **D-02:** Sections merged into three groups: "Needs water" (overdue + due today combined), "Upcoming", "Recently Watered". Empty sections are hidden entirely.
- **D-03:** Card info: nickname, species, room name, urgency badge with icon (e.g. "3d overdue", "Due today", "In 5d"), and inline snooze pills on overdue/due-today cards. No explicit next-water-date on the card.
- **D-04:** Responsive grid: 1 column on mobile, 2 on sm, 3 on lg. Section headers show count (e.g. "Needs water (4)") with separators between sections.

### Water Action Feedback
- **D-05:** One-tap watering from dashboard with optimistic UI. Card fades out (opacity + scale animation) from current section and appears at top of "Recently Watered" immediately.
- **D-06:** Success toast shows plant name and next watering date: "Monstera watered! Next: May 2".
- **D-07:** Duplicate detection: same-day block — server rejects second log within the same calendar day. Toast: "Already logged! Edit from history if needed."
- **D-08:** Failure handling: retry toast with action button on network/server errors. No confirmation dialog before watering — keep it frictionless.

### Watering History UX
- **D-09:** Chronological list on plant detail page, newest first, 20 entries per page with "Load more" button. No visual timeline — clean list.
- **D-10:** Retroactive logging via calendar date picker in the "Log watering" dialog. Defaults to today, can pick any past date. Future dates disabled.
- **D-11:** Optional note field (280 chars) on each watering log for context (e.g. "used filtered water").
- **D-12:** Edit/delete via kebab menu (three dots) on each history entry. Edit opens same dialog with pre-filled values. Delete is immediate with no confirmation dialog.

### Empty & Edge States
- **D-13:** No-plants empty state: EmptyState component with leaf icon, "No plants yet" heading, body text, and Add Plant dialog CTA. No suggested starter plants in this state.
- **D-14:** All-caught-up state: green accent banner with checkmark icon: "All caught up! Check back when the next one is due." Shown when user has plants but nothing is overdue, due today, or upcoming.
- **D-15:** Timezone handling: cookie-based sync. Client-side TimezoneSync component writes `user_tz` cookie on mount. Server reads cookie to compute today's start/end boundaries in UTC for urgency classification. No manual timezone selection required.

### Claude's Discretion
- Loading skeleton design and animation
- Exact spacing, typography, and color values within the established design system
- Sort order within sections (overdue: most days late first, due today: alphabetical, upcoming: soonest first, recently watered: most recent first)
- Error state designs beyond the retry toast
- "All caught up" banner animation or transitions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Vision, constraints, UX direction ("calm, friendly, nature-inspired"), core value statement
- `.planning/REQUIREMENTS.md` §Dashboard — DASH-01 through DASH-05 acceptance criteria
- `.planning/REQUIREMENTS.md` §Watering — WATR-01 through WATR-07 acceptance criteria
- `.planning/REQUIREMENTS.md` §UI and Accessibility — UIAX-05 (optimistic UI for watering)
- `.planning/ROADMAP.md` §Phase 4 — Success criteria (5 items), UI hint: yes

### Prior phase context
- `.planning/phases/03-plant-collection-and-rooms/03-CONTEXT.md` — Plant card patterns, modal dialog pattern, feature-based file organization
- `.planning/phases/02-authentication-and-onboarding/02-CONTEXT.md` — Auth patterns, onboarding banner on dashboard

### Tech stack
- `CLAUDE.md` §Technology Stack — Next.js 16, Prisma 7, date-fns for date arithmetic, shadcn/ui, Tailwind v4
- `CLAUDE.md` §Stack Patterns — Server Components for reads, Server Actions for writes, computed watering status server-side

### Data model
- `prisma/schema.prisma` — Plant (wateringInterval, lastWateredAt, nextWateringAt), WateringLog (wateredAt, note) models

### Existing code (Phase 3 foundation)
- `src/features/plants/` — Plant CRUD actions and queries (pattern to follow for watering)
- `src/components/plants/plant-detail.tsx` — Plant detail page (watering history integrates here)
- `src/components/ui/` — shadcn components (Card, Button, Badge, Calendar, Popover, Skeleton, Sonner)
- `src/components/shared/empty-state.tsx` — Reusable EmptyState component
- `src/app/(main)/dashboard/page.tsx` — Dashboard page (watering sections integrate here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.tsx` — shadcn Card for dashboard plant cards
- `src/components/ui/badge.tsx` — shadcn Badge for urgency status badges
- `src/components/ui/calendar.tsx` — shadcn Calendar for date picker in log dialog
- `src/components/ui/popover.tsx` — shadcn Popover for calendar popover
- `src/components/ui/skeleton.tsx` — shadcn Skeleton for loading states
- `src/components/shared/empty-state.tsx` — EmptyState component for no-plants state
- `src/components/shared/responsive-dialog.tsx` — ResponsiveDialog (dialog on desktop, drawer on mobile)
- `src/lib/db.ts` — Prisma singleton for all database queries
- `src/features/plants/queries.ts` — Pattern for Prisma query functions

### Established Patterns
- Feature-based organization: `src/features/watering/actions.ts`, `queries.ts`, `schemas.ts`
- Server Components for data fetching with direct Prisma queries
- Server Actions with Zod v4 validation for mutations
- Optimistic UI with React 19 `useOptimistic` hook
- Toast notifications via Sonner for success/error feedback
- ResponsiveDialog pattern: Dialog on desktop, Drawer on mobile (from Phase 7)

### Integration Points
- `src/app/(main)/dashboard/page.tsx` — Dashboard page fetches urgency groups and renders sections
- `src/app/(main)/plants/[id]/page.tsx` — Plant detail page shows watering history
- `prisma/schema.prisma` — WateringLog model with plantId FK, wateredAt TIMESTAMPTZ, note
- Timezone cookie `user_tz` set by TimezoneSync component, read by dashboard server component

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-dashboard-and-watering-core-loop*
*Context gathered: 2026-04-16*
