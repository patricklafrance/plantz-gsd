# Phase 4: Dashboard and Watering Core Loop - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see at a glance which plants need watering today and log it in one tap. Dashboard displays plants grouped by urgency (Overdue, Due Today, Upcoming, Recently Watered). Watering logs are created, edited, deleted, and viewed in history. Next watering date recalculates automatically. All dates are timezone-safe. This is the core product value loop.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- **D-01:** Stacked vertical sections with card grid — Overdue, Due Today, Upcoming (next 7 days), Recently Watered. Each section has a header with count and a grid of plant cards beneath.
- **D-02:** Empty sections are hidden. If no plants are overdue, that section doesn't render. Dashboard only shows sections with plants in them.
- **D-03:** Plants sorted by urgency within each section — Overdue: most days late first. Due Today: alphabetical. Upcoming: soonest due first. Recently Watered: most recently watered first.
- **D-04:** Each dashboard card shows: plant nickname, watering status badge (e.g., "3d overdue", "Due today", "In 2 days"), and room name. Reuses existing PlantCard layout pattern with an added water action button.

### One-Tap Watering UX
- **D-05:** Droplet icon button on the right side of each dashboard card across all sections (Overdue, Due Today, Upcoming, and Recently Watered). One tap logs watering for today.
- **D-06:** Optimistic UI (UIAX-05): after tapping the water button, the card animates out of its current section (fade/slide). A success toast appears showing "Monstera watered! Next: [date]". Plant reappears in Recently Watered on next render. UI updates before server confirms.
- **D-07:** No undo toast after watering. If a user makes a mistake, they go to the plant detail page and delete or edit the watering log from history.

### Watering History & Retroactive Logging
- **D-08:** Plant detail page shows watering history as a simple chronological list (most recent first). Each entry shows: date, relative time ("3 days ago"), and optional note text.
- **D-09:** "Log watering" button on the plant detail page opens a dialog with a date picker (defaults to today) and an optional note field. User can pick any past date for retroactive logging (WATR-03). Dashboard one-tap uses the same Server Action with today's date.
- **D-10:** Each history entry has a kebab (three-dot) menu with "Edit" and "Delete" options. Edit reopens the log dialog with pre-filled values. Delete shows a confirmation. Consistent with Phase 3 archive/delete patterns.
- **D-11:** Server-side duplicate prevention (WATR-06): Server Action rejects a second watering log for the same plant within a 60-second window. Toast feedback: "Already logged! Edit from history if needed."

### Timezone Handling
- **D-12:** "Due today" computed using the user's local timezone. Client passes timezone to server via header or query param; server uses it for date comparisons. All timestamps stored as TIMESTAMPTZ in PostgreSQL (already established in schema).

### Claude's Discretion
- Timezone implementation approach (client header vs URL param vs date-fns-tz)
- Dashboard card animation specifics (CSS transitions, timing, easing)
- Date picker component choice (shadcn calendar or simple input)
- History list pagination or "load more" threshold
- Loading skeleton design for dashboard sections
- Mobile responsive layout for card grids (1-col vs 2-col breakpoints)
- Next watering date recalculation logic placement (Server Action vs Prisma middleware)
- Dashboard empty state when user has plants but none need attention (all recently watered)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` -- Vision, constraints, UX direction ("calm, friendly"), watering model (firm interval countdown), edge cases (retroactive logs, duplicate debounce, timezone)
- `.planning/REQUIREMENTS.md` SS Dashboard -- DASH-01 through DASH-05 acceptance criteria
- `.planning/REQUIREMENTS.md` SS Watering -- WATR-01 through WATR-07 acceptance criteria
- `.planning/REQUIREMENTS.md` SS UI and Accessibility -- UIAX-05 (optimistic UI for watering log)
- `.planning/ROADMAP.md` SS Phase 4 -- Success criteria (5 items), UI hint: yes

### Prior phase context
- `.planning/phases/03-plant-collection-and-rooms/03-CONTEXT.md` -- Plant detail page card sections (D-07), modal dialog pattern (D-04, D-05), archive/delete pattern (D-06), room filter pattern (D-10)

### Data model
- `prisma/schema.prisma` -- Plant model (lastWateredAt, nextWateringAt, wateringInterval), WateringLog model (wateredAt, note, plantId), all TIMESTAMPTZ

### Tech stack
- `CLAUDE.md` SS Technology Stack -- date-fns for date arithmetic, Server Actions for mutations, Server Components for reads
- `CLAUDE.md` SS Stack Patterns -- Compute watering status server-side, pass pre-sorted data to client components

### Existing code
- `src/app/(main)/dashboard/page.tsx` -- Current dashboard shell (empty state + add plant button, needs urgency sections)
- `src/components/plants/plant-card.tsx` -- PlantCard with getWateringStatusText() computing Overdue/Due today/Xd from nextWateringAt
- `src/features/plants/queries.ts` -- getPlants() and getPlant() queries (need dashboard-specific query with urgency grouping)
- `src/features/plants/actions.ts` -- Plant CRUD actions (watering actions go alongside or in new src/features/watering/)
- `src/types/plants.ts` -- PlantWithRelations type (may need WateringLog include)
- `src/components/ui/sonner.tsx` -- Toast notifications for watering feedback

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/plants/plant-card.tsx` -- PlantCard already computes watering status via getWateringStatusText(). Needs water button added and animation support for dashboard context.
- `src/components/ui/card.tsx` -- shadcn Card for dashboard section containers and history entries
- `src/components/ui/sonner.tsx` -- Toast for watering success feedback
- `src/components/ui/dialog.tsx` -- shadcn Dialog for log watering dialog and edit watering dialog
- `src/components/ui/button.tsx` -- shadcn Button for water droplet icon button
- `src/components/ui/badge.tsx` -- shadcn Badge for urgency status badges
- `src/lib/db.ts` -- Prisma singleton for all queries
- `src/features/plants/schemas.ts` -- Zod schema pattern for validation (extend for watering schemas)
- `date-fns` -- Already imported in PlantCard (differenceInDays), available for all date arithmetic

### Established Patterns
- Feature-based organization: `src/features/{domain}/actions.ts`, `schemas.ts`, `queries.ts` -- watering logic goes in `src/features/watering/`
- Server Components for data fetching with direct Prisma queries
- Server Actions with Zod validation for mutations
- Modal dialog pattern for forms (add/edit plant dialogs in Phase 3)
- Sonner toast for success/error feedback
- Kebab menu pattern needs new shadcn DropdownMenu component

### Integration Points
- `src/app/(main)/dashboard/page.tsx` -- Complete rewrite needed: replace empty state with urgency-grouped sections, add server-side watering status computation
- `src/app/(main)/plants/[id]/page.tsx` -- Plant detail page needs watering history section and log watering button
- `src/features/plants/queries.ts` -- Needs dashboard query that includes WateringLog data and computes urgency grouping
- `prisma/schema.prisma` -- No schema changes needed; WateringLog model already has required fields
- Auth session -- watering actions must verify plant ownership via session.user.id

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-dashboard-and-watering-core-loop*
*Context gathered: 2026-04-14*
