# Phase 5: Notes, Search, and Filters - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can annotate individual plants with timestamped notes and quickly find any plant in their collection. Includes notes CRUD, unified plant timeline (notes + watering events), plant search by nickname/species, watering status filters, room + status filter composition, and sort controls. Reminders, demo mode, and health observations are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Notes Timeline Integration
- **D-01:** Unified timeline — notes and watering events interleaved in one chronological list on the plant detail page. Each entry has a type icon (droplet for watering, pencil for note). Replaces the separate "Watering history" and placeholder "Notes" cards with a single "Timeline" card.
- **D-02:** New dedicated `Note` model in the database (id, plantId, content, createdAt, updatedAt). Keeps notes separate from HealthLog, which stays reserved for health observations in v2.
- **D-03:** Default load: last 20 entries (notes + waterings combined), with a "Load more" button. Matches the existing watering history pagination pattern.

### Notes Entry & Editing UX
- **D-04:** Inline text field at the top of the timeline card for adding notes. Type and press Enter or click "Add". Low friction, no modal needed.
- **D-05:** Kebab (three-dot) menu on each note entry with "Edit" and "Delete" options. Edit opens inline editing (text becomes editable in place). Delete shows a confirmation. Consistent with watering history entry kebab menu pattern from Phase 4.
- **D-06:** No character limit on notes. Freeform text of any length.

### Search Placement & Behavior
- **D-07:** Search bar on the /plants collection page only, at the top above the room filter pills. Scoped to plant search.
- **D-08:** Instant filter — as the user types, the plant grid filters in real-time using URL search params. No separate results page. Debounced input (300ms).
- **D-09:** Search matches against both plant nickname and species name. Simple case-insensitive query.

### Filter & Sort Controls
- **D-10:** Second pill row below the existing room filter pills for watering status filters: All | Overdue | Due today | Upcoming | Archived. Both rows use URL search params.
- **D-11:** Room filters and status filters are combinable with AND logic. Example: Kitchen + Overdue = only overdue plants in the kitchen. URL params: `?room=abc&status=overdue&sort=name`.
- **D-12:** Sort dropdown button near the search bar with options: Next watering date (default), Name (A-Z), Recently added.

### Claude's Discretion
- Search bar styling and placeholder text
- Status pill colors/variants (e.g., red for Overdue, green for Due today)
- Timeline entry layout details (spacing, timestamp format, icon styling)
- Inline note editing interaction (save on blur vs explicit save button)
- Empty state when search/filter returns no results
- Mobile responsive behavior for two filter rows + sort dropdown
- Whether search query should persist in URL on page navigation
- Note model migration details (indexes, constraints)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Vision, constraints, UX direction ("calm, friendly"), entity list (Plant, Room)
- `.planning/REQUIREMENTS.md` §Notes — NOTE-01, NOTE-02, NOTE-03 acceptance criteria
- `.planning/REQUIREMENTS.md` §Search and Filters — SRCH-01, SRCH-02, SRCH-03 acceptance criteria
- `.planning/ROADMAP.md` §Phase 5 — Success criteria (4 items), UI hint: yes

### Prior phase context
- `.planning/phases/03-plant-collection-and-rooms/03-CONTEXT.md` — Plant detail card sections (D-07), room filter pill bar (D-10), modal dialog pattern (D-04/D-05)
- `.planning/phases/04-dashboard-and-watering-core-loop/04-CONTEXT.md` — Watering history timeline (D-08), log watering dialog (D-09), kebab menu pattern (D-10), optimistic UI (D-06)

### Data model
- `prisma/schema.prisma` — Plant model (nickname, species, roomId, nextWateringAt, archivedAt), WateringLog model (wateredAt, note), HealthLog model (exists but not used for notes). No Note model yet — needs migration.

### Tech stack
- `CLAUDE.md` §Technology Stack — Next.js 16, Prisma 7, shadcn/ui, Tailwind v4, Zod v4, date-fns
- `CLAUDE.md` §Stack Patterns — Server Components for reads, Server Actions for writes, URL search params for filter state

### Existing code
- `src/app/(main)/plants/page.tsx` — Plants collection page with room filter via URL search params. Search bar and status filters integrate here.
- `src/components/plants/room-filter.tsx` — RoomFilter component using URL search params pattern. Status filter pills follow this same pattern.
- `src/components/plants/plant-detail.tsx` — Plant detail page with Status, Care info, Watering history, and placeholder Notes cards. Timeline replaces the separate history + notes cards.
- `src/components/watering/watering-history.tsx` — WateringHistory component with load-more pagination. Timeline component replaces/extends this.
- `src/components/watering/watering-history-entry.tsx` — Entry with kebab menu (edit/delete). Note entries follow same pattern.
- `src/features/plants/queries.ts` — getPlants() with roomId filter. Needs search query param and status filter support.
- `src/features/watering/actions.ts` — Watering CRUD actions. Note actions go in new `src/features/notes/` directory.
- `src/features/watering/schemas.ts` — Zod schema pattern. Note schemas follow same pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/plants/room-filter.tsx` — URL search param filter pattern. Status filter pills and sort dropdown integrate alongside this.
- `src/components/watering/watering-history.tsx` — Load-more pagination pattern with state management. Timeline component can extend or replace this.
- `src/components/watering/watering-history-entry.tsx` — Kebab menu with edit/delete actions. Note entries reuse this pattern.
- `src/components/ui/button.tsx` — Pill button variants for filter rows
- `src/components/ui/badge.tsx` — Status badges for filter pills
- `src/components/ui/input.tsx` — Search input field
- `src/components/ui/sonner.tsx` — Toast for note CRUD feedback
- `src/lib/db.ts` — Prisma singleton for all queries
- `date-fns` — Already in use for date formatting in timeline entries

### Established Patterns
- Feature-based organization: `src/features/{domain}/actions.ts`, `schemas.ts`, `queries.ts` — notes go in `src/features/notes/`
- URL search params for filter state (`room` param already used, extend with `search`, `status`, `sort`)
- Server Components for data fetching with direct Prisma queries
- Server Actions with Zod validation for mutations
- Kebab DropdownMenu for entry-level actions (watering history entries)

### Integration Points
- `src/app/(main)/plants/page.tsx` — Add search bar, status filter row, sort dropdown. Extend `searchParams` to include `search`, `status`, `sort`.
- `src/app/(main)/plants/[id]/page.tsx` — Plant detail page needs unified timeline replacing separate history + notes cards
- `src/features/plants/queries.ts` — `getPlants()` needs search text filter, status filter, and sort parameter support
- `prisma/schema.prisma` — New Note model with migration
- `src/components/plants/plant-detail.tsx` — Refactor from separate Watering History + Notes cards to unified Timeline card

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

*Phase: 05-notes-search-and-filters*
*Context gathered: 2026-04-14*
