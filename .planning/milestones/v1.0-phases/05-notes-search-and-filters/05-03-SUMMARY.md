---
phase: 05-notes-search-and-filters
plan: "03"
subsystem: plants/search
tags: [search, filter, sort, url-params, prisma, base-ui]
dependency_graph:
  requires: [05-01]
  provides: [SRCH-01, SRCH-02, SRCH-03]
  affects: [src/app/(main)/plants/page.tsx, src/features/plants/queries.ts]
tech_stack:
  added: [dropdown-menu.tsx (@base-ui/react/menu), tooltip.tsx (@base-ui/react/tooltip)]
  patterns:
    - URL search params as single source of truth for filter/sort state
    - Server-side timezone-aware date boundaries via user_tz cookie
    - Link-based CTA in Server Component empty state (avoids client component for navigation)
    - Parallel data fetch with totalPlantCount to distinguish zero-collection vs no-results
key_files:
  created:
    - src/features/plants/queries.ts (extended — options object with search/status/sort/dates)
    - src/components/plants/search-bar.tsx
    - src/components/plants/status-filter.tsx
    - src/components/plants/sort-dropdown.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/tooltip.tsx
  modified:
    - src/app/(main)/plants/page.tsx
    - tests/plants-search.test.ts
decisions:
  - Used @base-ui/react/menu and @base-ui/react/tooltip for new UI primitives, consistent with existing stack (no Radix in this project)
  - Link-based clear CTA instead of client ClearFiltersButton — server page avoids unnecessary client bundle
  - Parallel fetch of totalPlantCount enables accurate empty state differentiation without extra query round-trips
metrics:
  duration_minutes: 15
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_changed: 8
---

# Phase 05 Plan 03: Search, Filter, and Sort Summary

Search bar, status filter pills, sort dropdown, and extended plant query delivering SRCH-01/02/03 — all filter state persists in URL search params with no client state.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Extended getPlants query + SearchBar, StatusFilter, SortDropdown + UI primitives + tests | dfa95ff |
| 2 | Wired all filters into plants page with timezone dates and context-aware empty state | 6ffaacf |

## What Was Built

**Extended `getPlants` query (`src/features/plants/queries.ts`)**
- Signature changed from `(userId, roomId?)` to `(userId, options?)` with `roomId`, `search`, `status`, `sort`, `todayStart`, `todayEnd`
- Case-insensitive OR search across `nickname` and `species` using Prisma `contains` + `mode: "insensitive"`
- Status filter maps to Prisma date comparisons: overdue=`lt todayStart`, due-today=`gte todayStart lt todayEnd`, upcoming=`gte todayEnd`
- Archived filter toggles `archivedAt: null` (default) vs `archivedAt: { not: null }` (archived status)
- Sort maps: name→`nickname asc`, recently-added→`createdAt desc`, default→`nextWateringAt asc`

**SearchBar (`src/components/plants/search-bar.tsx`)**
- 300ms debounce on input → URL `?search=` param update via `useRouter().push`
- Clear button with tooltip (using new `tooltip.tsx` primitive)
- Accessible: `aria-label="Search plants"`, `aria-label="Clear search"`, `placeholder="Search plants..."`

**StatusFilter (`src/components/plants/status-filter.tsx`)**
- Pills: All | Overdue | Due today | Upcoming | Archived
- Per-status color variants per UI-SPEC (destructive tint for overdue, accent for due-today, secondary for archived)
- Clicking active non-All pill deselects (returns to All)
- URL `?status=` param update

**SortDropdown (`src/components/plants/sort-dropdown.tsx`)**
- Options: Next watering | Name (A-Z) | Recently added
- Checkmark on active option
- Default (next-watering) omits the sort param from URL
- Uses new `dropdown-menu.tsx` primitive

**New UI primitives**
- `src/components/ui/dropdown-menu.tsx` — wraps `@base-ui/react/menu` following project convention
- `src/components/ui/tooltip.tsx` — wraps `@base-ui/react/tooltip` with `TooltipProvider`

**Plants page (`src/app/(main)/plants/page.tsx`)**
- Layout order: heading row → SearchBar → RoomFilter → StatusFilter → SortDropdown → grid/empty state
- Timezone-aware `todayStart`/`todayEnd` from `user_tz` cookie (same pattern as dashboard)
- Parallel fetch: plants + catalog + rooms + `totalPlantCount`
- `totalPlantCount === 0 && !hasActiveFilters` → original "No plants yet" empty state
- Otherwise empty → context-aware `EmptyFilterState` with scenario-specific copy and Link CTA

**Context-aware empty states**
- archived + no other filters → "No archived plants / Plants you archive will appear here."
- search only → `No plants match "${search}".` + Clear search CTA
- status only → `No plants are {status} right now.` + Show all plants CTA
- room + status → `No {status} plants in {roomName}.` + Clear filters CTA
- catch-all → "No plants match your current filters." + Clear filters CTA

## Tests

11 tests converted from `test.todo` to real assertions — all pass:
- Search: nickname contains, species contains, case-insensitive mode
- Status: overdue (lt), due-today (gte+lt), upcoming (gte), archived (not null), default (null)
- Sort: name (nickname asc), recently-added (createdAt desc), default (nextWateringAt asc)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing UI primitives] Created dropdown-menu.tsx and tooltip.tsx using @base-ui/react**
- Found during: Task 1
- Issue: Plan referenced `DropdownMenu`, `Tooltip`, `TooltipProvider` imports but no such files existed in `src/components/ui/`. Project uses `@base-ui/react` (not Radix), so standard shadcn components don't apply.
- Fix: Created both UI primitives from scratch following the `@base-ui/react` pattern used by existing components (dialog.tsx, select.tsx, button.tsx). Used `Menu` and `Tooltip` from `@base-ui/react`.
- Files created: `src/components/ui/dropdown-menu.tsx`, `src/components/ui/tooltip.tsx`
- Commit: dfa95ff

**2. [Rule 1 - Bug] Replaced client ClearFiltersButton with Link-based approach**
- Found during: Task 2
- Issue: Plan offered a `ClearFiltersButton` client component as one option, but the plants page is a Server Component. Embedding a client component solely for navigation is unnecessary bundle overhead.
- Fix: Used `buildClearUrl()` server-side helper + `<Link href={clearUrl}>` wrapping a Button — no client component needed.
- Files modified: `src/app/(main)/plants/page.tsx`
- Commit: 6ffaacf

**3. [Rule 3 - Blocked TS] Fixed plants-search.test.ts optional chaining for mock.calls[0]**
- Found during: Task 1 verification
- Issue: `mock.calls[0][0]` caused TS18048 (possibly undefined) error.
- Fix: Changed to `mock.calls[0]?.[0]` with optional chaining on property access.
- Files modified: `tests/plants-search.test.ts`
- Commit: dfa95ff

## Known Stubs

None. All filter/sort/search functionality is fully wired.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers. All queries include `userId` in the where clause (T-05-08 mitigation). URL params are safely consumed via Prisma parameterized queries (T-05-06 mitigation).

## Self-Check: PASSED

Files created/exist:
- src/features/plants/queries.ts — FOUND
- src/components/plants/search-bar.tsx — FOUND
- src/components/plants/status-filter.tsx — FOUND
- src/components/plants/sort-dropdown.tsx — FOUND
- src/components/ui/dropdown-menu.tsx — FOUND
- src/components/ui/tooltip.tsx — FOUND
- src/app/(main)/plants/page.tsx — FOUND
- tests/plants-search.test.ts — FOUND

Commits exist:
- dfa95ff — FOUND (feat(05-03): extend getPlants query...)
- 6ffaacf — FOUND (feat(05-03): wire search, filter, sort...)

Tests: 11/11 plants-search tests pass. Full suite: 42 passed, 0 failed.
