---
phase: "03"
plan: "03"
subsystem: plant-ui
tags: [ui, plants, modal, server-component, react-hook-form]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: [plant-card, plant-grid, add-plant-dialog, plants-collection-page]
  affects: [dashboard, plants-page]
tech_stack:
  added: []
  patterns:
    - Two-step modal dialog (catalog browser -> form) using Dialog + useState step management
    - Server Component page fetching data in parallel via Promise.all, passing to Client Components as props
    - Category grouping via client-side catalogData name->category map (CareProfile DB model has no category field)
    - Watering status computation in Client Component using date-fns differenceInDays
key_files:
  created:
    - src/components/plants/plant-card.tsx
    - src/components/plants/plant-grid.tsx
    - src/components/plants/add-plant-dialog.tsx
  modified:
    - src/app/(main)/plants/page.tsx
decisions:
  - "Category grouping for catalog browser: CareProfile DB model has no category column — category is seeding metadata only. Used catalogData name->category map to cross-reference DB entries by name."
  - "Catalog import path: prisma/data/catalog.ts is outside src/, so relative import used (../../../prisma/data/catalog) rather than @/ alias."
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_changed: 4
---

# Phase 03 Plan 03: Plants Collection UI Summary

## One-liner

Responsive plant collection page with PlantCard/PlantGrid components and a two-step add-plant modal (catalog browser -> form) using Server Action submission and Sonner toast feedback.

## What Was Built

### Task 1: Plant Card and Plant Grid Components (commit: eb5e803)

**`src/components/plants/plant-card.tsx`**
- Client component rendering a horizontal Card with Leaf icon (40px, `bg-accent/10`), plant nickname (`text-base font-semibold`), species (`text-sm text-muted-foreground`), room label (`text-xs`), and watering status Badge
- `getWateringStatusText()` computes Overdue / Due today / Xd using `differenceInDays` from date-fns
- Hover: `hover:shadow-sm hover:border-accent/40`
- Full card is a Link to `/plants/[id]`

**`src/components/plants/plant-grid.tsx`**
- Client component wrapping PlantCard in a responsive CSS grid
- Layout: `grid-cols-1` (mobile), `sm:grid-cols-2` (tablet), `lg:grid-cols-3` (desktop)

### Task 2: Add-Plant Dialog and Plants Collection Page (commit: 1bd1a13)

**`src/components/plants/add-plant-dialog.tsx`**
- Two-step modal: step "catalog" (browse + search) and step "form" (details entry)
- Step 1: real-time client-side search filtering, entries grouped by `CATALOG_CATEGORIES` using a `name->category` map cross-referencing `catalogData` (since DB CareProfile has no category column), "Custom plant" card with `Plus` icon
- Step 2: react-hook-form with zodResolver(createPlantSchema), fields: nickname (required), species (auto-filled), room (Select dropdown), watering interval (number input with "days" suffix)
- On submit: calls `createPlant` Server Action, shows `toast("Plant added.")`, resets and closes dialog
- Dialog close resets all state: step, selectedProfile, search, formError, form fields

**`src/app/(main)/plants/page.tsx`**
- Server Component replacing the `<h1>Plants</h1>` stub
- Auth check with `redirect("/login")`
- `searchParams` as `Promise<{ room?: string }>` (Next.js 16 async pattern), `await`ed before use
- `Promise.all([getPlants, getCatalog, getRoomsForSelect])` for parallel data fetching
- Header: "My Plants" + AddPlantDialog trigger
- Empty state: centered Leaf icon, "No plants yet" heading, body copy, AddPlantDialog CTA
- Non-empty state: PlantGrid with full collection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CareProfile DB model has no category field**
- **Found during:** Task 2 (add-plant-dialog step 1 category grouping)
- **Issue:** Plan referenced `entry.category` for grouping, but `CareProfile` in Prisma schema has no `category` column — category is seeding metadata only (exists in `catalogData` but not persisted to DB)
- **Fix:** Imported `catalogData` alongside `CATALOG_CATEGORIES`, built a `Map<name, category>` to cross-reference DB entries by their name field
- **Files modified:** `src/components/plants/add-plant-dialog.tsx`
- **Commit:** 1bd1a13

**2. [Rule 3 - Blocking] Catalog import path outside @/ alias**
- **Found during:** Task 2 implementation
- **Issue:** `prisma/data/catalog.ts` is outside `src/`, so `@/` TypeScript alias doesn't resolve it
- **Fix:** Used relative import `../../../prisma/data/catalog` from `src/components/plants/`
- **Files modified:** `src/components/plants/add-plant-dialog.tsx`
- **Commit:** 1bd1a13

## Threat Mitigations Verified

| Threat ID | Mitigation | Verified |
|-----------|------------|---------|
| T-03-03-01 | zodResolver + createPlantSchema.safeParse double validation | Both present |
| T-03-03-02 | auth() check + redirect("/login") in page | Present |
| T-03-03-03 | getPlants(session.user.id, params.room) scoped by userId | Present |

## Known Stubs

None. All components connect to real data sources and Server Actions.

## Self-Check: PASSED

Files created/modified:
- FOUND: src/components/plants/plant-card.tsx
- FOUND: src/components/plants/plant-grid.tsx
- FOUND: src/components/plants/add-plant-dialog.tsx
- FOUND: src/app/(main)/plants/page.tsx

Commits:
- FOUND: eb5e803 (feat(03-03): plant card and plant grid components)
- FOUND: 1bd1a13 (feat(03-03): add-plant dialog and plants collection page)
