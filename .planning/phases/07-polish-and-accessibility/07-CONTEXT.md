# Phase 7: Polish and Accessibility - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The app is responsive and touch-friendly on mobile, meets WCAG AA accessibility standards, and handles all known edge cases gracefully. This phase delivers no new features — it hardens and polishes the existing app across mobile layout, accessibility, and robustness.

</domain>

<decisions>
## Implementation Decisions

### Mobile Layout Strategy
- **D-01:** Bottom tab bar on mobile with 3-4 icons (Dashboard, Plants, Rooms, Notification bell). Fixed at bottom, thumb-friendly. Top header retained for branding and user menu.
- **D-02:** Card grids reflow to single column on mobile (<640px), 2-col on tablet, 3-col on desktop. Standard responsive stacking.
- **D-03:** All interactive elements (buttons, pills, toggles, links) must meet 44x44px minimum touch target. Systematic audit of every interactive element, padding adjustments only.
- **D-04:** Modals (add plant, edit plant, log watering) become full-screen bottom-up sheets on mobile. Better form UX on small screens.

### Accessibility — Keyboard and Screen Reader
- **D-05:** Full keyboard navigation flow: Tab through all elements in logical order, Enter/Space to activate, Escape to close dialogs. Visible focus rings on all interactive elements. Skip-to-content link on every page.
- **D-06:** Aria-live regions for key actions only: watering logged, reminder snoozed, plant added/deleted, error messages. No live regions for routine UI updates like filter changes.
- **D-07:** Every status indicator (overdue, due today, upcoming, recently watered) gets an icon AND text label alongside color. No color-only status anywhere.
- **D-08:** Reduced motion: skip for v1. Animations are minimal (toast, dialog transitions) — not worth the effort now.

### Accessibility — Structure and Audit
- **D-09:** Trust shadcn/ui Form component defaults for form accessibility. Only fix gaps found during manual testing — no proactive fieldset/legend restructuring.
- **D-10:** Audit and fix all custom colors against WCAG AA 4.5:1 contrast ratio. Status badges, onboarding banner gradient, card borders, text on colored backgrounds — everything custom gets checked.
- **D-11:** Standardize heading hierarchy across all pages. Each page gets exactly one h1, sections use h2, subsections h3. No skipped levels.
- **D-12:** Focus heading on client-side navigation — after route change, move focus to the new page's h1. Screen reader users know they've arrived.
- **D-13:** Verify and add landmark roles across both layout groups. Ensure <nav>, <main>, <header>, <footer> semantic elements are correct. Add aria-label to distinguish multiple nav regions (top nav vs bottom tab bar).

### Edge Case Hardening
- **D-14:** Enforce character limits on text inputs: plant nicknames and room names get a max character limit (e.g., 40 chars) at the input level. Prevents overflow issues at the source.
- **D-15:** Server-side pagination on the plants collection page (20-30 per page). Dashboard stays unpaginated but limits each urgency section. Handles 100+ plant collections gracefully.
- **D-16:** Graceful error states for network failures. Server Actions show inline error messages on failure. Failed watering logs show retry option. Loading skeletons for slow data fetches. No data loss on network hiccups.
- **D-17:** All dates display in user's browser local timezone. "Due today" calculated from local midnight. Server stores UTC (TIMESTAMPTZ already in place). Add timezone mismatch warning if server/client disagree.

### Claude's Discretion
- Empty state polish — whether to create a shared EmptyState component, add icons/illustrations, or keep existing text-based empty states
- Bottom tab bar icon selection and visual treatment
- Exact character limits for plant nicknames and room names
- Pagination UI design (page numbers, load more button, or infinite scroll)
- Loading skeleton design for slow data fetches
- Specific icon choices for status indicators (overdue, due today, etc.)
- Focus ring styling (color, width, offset)
- Skip-to-content link styling and positioning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Vision, constraints ("App is responsive and polished on mobile and desktop", "App is accessible")
- `.planning/REQUIREMENTS.md` §UI and Accessibility — UIAX-01 through UIAX-05 acceptance criteria
- `.planning/ROADMAP.md` §Phase 7 — Success criteria (4 items), UI hint: yes

### Prior phase context
- `.planning/phases/01-scaffold-and-foundations/01-CONTEXT.md` — Feature-based file organization (D-01 through D-04), route groups, shadcn/ui primitives
- `.planning/phases/02-authentication-and-onboarding/02-CONTEXT.md` — Inline validation errors (D-02), toast for server errors, onboarding banner pattern (D-06, D-11)
- `.planning/phases/03-plant-collection-and-rooms/03-CONTEXT.md` — Modal dialog pattern (D-04, D-05), card-based grids, horizontal pill bar filtering (D-10)
- `.planning/phases/06-reminders-and-demo-mode/06-CONTEXT.md` — Bell icon notification center (D-01), snooze pills (D-08), preferences page (D-05, D-06)

### Tech stack
- `CLAUDE.md` §Technology Stack — Next.js 16, Tailwind CSS v4 (@theme directive), shadcn/ui, React 19.2
- `CLAUDE.md` §Stack Patterns — Server Components for reads, Server Actions for writes

### Existing code
- `src/app/globals.css` — Tailwind v4 @theme config with design tokens, container sizes
- `src/app/(main)/layout.tsx` — Main layout with nav bar (where bottom tab bar logic needs to go)
- `src/app/(auth)/layout.tsx` — Auth layout group
- `src/components/ui/dialog.tsx` — shadcn Dialog (base for mobile sheet conversion)
- `src/components/ui/button.tsx` — shadcn Button (touch target audit target)
- `src/app/(main)/dashboard/page.tsx` — Dashboard with urgency sections and empty state
- `src/app/(main)/plants/page.tsx` — Plants collection with filtering and multiple empty states
- `src/app/(main)/rooms/page.tsx` — Rooms page with empty state
- `prisma/schema.prisma` — Data model with TIMESTAMPTZ columns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/dialog.tsx` — shadcn Dialog, can be extended with Sheet variant for mobile full-screen
- `src/components/ui/skeleton.tsx` — shadcn Skeleton for loading states
- `src/components/ui/tooltip.tsx` — shadcn Tooltip (if needed for truncation fallback)
- `src/components/ui/sonner.tsx` — Toast notifications (already has aria-live)
- `src/components/ui/badge.tsx` — Status badges (need contrast audit + icon addition)
- All shadcn components provide baseline keyboard/focus support via Radix primitives

### Established Patterns
- Tailwind v4 responsive classes (sm:, md:, lg:) used in ~16 files — extend this pattern for mobile-first
- Feature-based organization: `src/features/{domain}/` for actions, queries, schemas
- Server Components for data fetching, Server Actions for mutations
- Card-based grids for plants and rooms — need responsive reflow
- Modal dialogs for CRUD operations — need mobile sheet conversion

### Integration Points
- `src/app/(main)/layout.tsx` — Bottom tab bar needs to be conditionally rendered on mobile (media query or client-side width detection)
- All page-level components need h1 audit and heading hierarchy standardization
- All interactive elements across the app need touch target audit
- Status indicators in dashboard sections, plant cards, and room cards need icon+text enhancement
- Plants collection page needs server-side pagination added to `getPlants` query

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- Empty state polish (shared component, illustrations) — left to Claude's discretion
- Reduced motion / prefers-reduced-motion support — deferred to post-v1

</deferred>

---

*Phase: 07-polish-and-accessibility*
*Context gathered: 2026-04-15*
