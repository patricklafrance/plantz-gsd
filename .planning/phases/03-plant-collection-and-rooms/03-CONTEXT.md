# Phase 3: Plant Collection and Rooms - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can build and manage a personal plant collection, select from a seeded catalog of ~30-50 common houseplants, and organize plants by room. Includes add/edit/archive/delete plant flows, plant detail page, room CRUD with presets, room-based filtering, and catalog browsing. Watering logging and dashboard urgency sections are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Add Plant Flow
- **D-01:** Catalog-first approach. User browses/searches the catalog first, selects a plant which auto-fills species and suggested watering interval, then customizes. "Custom plant" option at bottom for unlisted plants.
- **D-02:** Minimal form fields: nickname (required), species (auto-filled from catalog), room (dropdown), watering interval (auto-filled, editable). Additional fields available on the detail page after creation.
- **D-03:** "Add plant" button lives on the dashboard header and the plant collection page. No floating action button.
- **D-04:** Adding a plant opens a modal dialog. Catalog browsing happens inside the modal with a search + category grid view, then transitions to the form fields.

### Plant Detail & Editing
- **D-05:** Edit via modal dialog. Edit button on the plant detail page opens a modal with pre-filled form fields. Consistent with the add-plant modal pattern.
- **D-06:** Both archive and delete actions available from the plant detail page. Delete always shows a confirmation dialog. Archive is instant with an undo toast notification.
- **D-07:** Detail page organized in card sections: Status card (next watering, days until due), Care info card (species, interval, light requirement), History card (recent waterings — empty for now, populated in Phase 4), Notes section. Clean and scannable.

### Room Organization
- **D-08:** Dedicated room management page (/rooms) to create, rename, reorder, and delete rooms. Room presets (Living Room, Bedroom, Kitchen, Bathroom, Office, Balcony) shown as quick-create suggestions.
- **D-09:** Room page shows a header (room name, plant count, watering status summary) with a grid of plant cards showing each plant's name, species, and watering status.
- **D-10:** Collection filtering via horizontal tab/pill bar above the plant grid: "All" | room names. Active pill highlighted. Simple and visible.

### Care Catalog
- **D-11:** Catalog seeded via Prisma seed script. JSON/TS data file with ~30-50 common houseplants, loaded via `prisma db seed`. Version-controlled, runs on setup.
- **D-12:** Catalog browsing in the add-plant modal uses search bar + category grid (Succulents, Tropicals, Low-light, etc.). Selecting a card fills the form fields.
- **D-13:** Core care data per catalog entry: species name, common name, suggested watering interval (days), light requirement (low/medium/bright), brief care note. Maps to existing CareProfile model.

### Claude's Discretion
- Plant card design (icon/emoji, info density, hover states)
- Exact catalog categories and which plants go where
- Empty state for collection page (no plants yet)
- Room deletion behavior when room has plants (reassign vs unassign)
- Form validation error messages and field constraints
- Mobile responsive layout for grids and modals
- Loading states and skeleton patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Vision, constraints, entity list (Plant, Room, CareProfile), UX direction
- `.planning/REQUIREMENTS.md` §Plant Management — PLNT-01 through PLNT-08 acceptance criteria
- `.planning/REQUIREMENTS.md` §Room Organization — ROOM-01 through ROOM-05 acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — Success criteria (5 items), UI hint: yes

### Prior phase context
- `.planning/phases/02-authentication-and-onboarding/02-CONTEXT.md` — Auth patterns, feature-based file organization, shadcn component usage, Zod v4 imports

### Data model
- `prisma/schema.prisma` — Plant, Room, CareProfile, WateringLog models already defined with fields and relations

### Tech stack
- `CLAUDE.md` §Technology Stack — Next.js 16, Prisma 7, shadcn/ui, Tailwind v4, react-hook-form + Zod v4
- `CLAUDE.md` §Stack Patterns — Server Components for reads, Server Actions for writes, computed watering status server-side

### Existing code
- `src/features/auth/` — Established feature-based pattern (actions.ts, schemas.ts)
- `src/components/ui/` — shadcn components (Button, Card, Input, Label, Skeleton, Form, Sonner)
- `src/app/(main)/layout.tsx` — Authenticated layout with nav (add plant links here)
- `src/app/(main)/dashboard/page.tsx` — Dashboard (add plant button goes here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.tsx` — shadcn Card for plant cards, room cards, detail sections
- `src/components/ui/form.tsx` — shadcn Form with react-hook-form integration for add/edit forms
- `src/components/ui/input.tsx` — shadcn Input for text fields
- `src/components/ui/button.tsx` — shadcn Button for actions
- `src/components/ui/sonner.tsx` — Toast notifications for archive undo, success feedback
- `src/lib/db.ts` — Prisma singleton for all database queries
- `src/lib/utils.ts` — cn() utility for Tailwind class merging
- `src/features/auth/schemas.ts` — Pattern for Zod v4 schema definitions

### Established Patterns
- Feature-based organization: `src/features/{domain}/actions.ts`, `schemas.ts` — Phase 3 should use `src/features/plants/` and `src/features/rooms/`
- Server Components for data fetching with direct Prisma queries
- Server Actions with Zod validation for mutations
- Route groups: `(main)/` for authenticated pages with shared layout
- Modal pattern: needs shadcn Dialog component (not yet installed)

### Integration Points
- `src/app/(main)/layout.tsx` — Nav needs "Plants" and "Rooms" links
- `src/app/(main)/dashboard/page.tsx` — Add plant button placement
- `prisma/schema.prisma` — Plant and Room models exist; CareProfile needs seed data
- Auth session — plant/room queries must filter by `session.user.id`

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

*Phase: 03-plant-collection-and-rooms*
*Context gathered: 2026-04-14*
