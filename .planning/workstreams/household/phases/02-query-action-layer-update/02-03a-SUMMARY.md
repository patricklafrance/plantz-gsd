---
phase: "02-query-action-layer-update"
plan: "03a"
subsystem: route-tree
tags: [nextjs-routing, layout-chokepoint, react-cache, error-boundary, not-found, route-moves, household-scope]
dependency_graph:
  requires:
    - "02-01-SUMMARY.md (getCurrentHousehold cached helper)"
    - "02-04-SUMMARY.md (queries accept householdId)"
    - "02-05a-SUMMARY.md (plants/rooms client components have householdId prop)"
    - "02-05b-SUMMARY.md (watering/notes/reminders client components have householdId prop)"
  provides:
    - "Full /h/[householdSlug]/ route tree — layout + 5 pages + 3 loading skeletons + error + not-found"
    - "D-03 chokepoint: getCurrentHousehold called once per request in layout, cache-hit in pages"
    - "ForbiddenError boundary (error.tsx) and 404 boundary (not-found.tsx)"
    - "Plan 03b unblocked (redirect stubs target this tree)"
    - "Plan 03c unblocked (chrome relocation targets this layout)"
  affects:
    - "src/app/(main)/h/[householdSlug]/ — 11 new files"
tech_stack:
  added: []
  patterns:
    - "Layout chokepoint calling getCurrentHousehold once; nested pages get cache hit (React cache)"
    - "error.tsx discriminating ForbiddenError via error.name string comparison"
    - "not-found.tsx as plain Server Component (no use client)"
    - "Explicit lambda type annotations when Prisma generated client path is unresolvable at TS compile time"
key_files:
  created:
    - src/app/(main)/h/[householdSlug]/layout.tsx
    - src/app/(main)/h/[householdSlug]/error.tsx
    - src/app/(main)/h/[householdSlug]/not-found.tsx
    - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
    - src/app/(main)/h/[householdSlug]/dashboard/loading.tsx
    - src/app/(main)/h/[householdSlug]/plants/page.tsx
    - src/app/(main)/h/[householdSlug]/plants/loading.tsx
    - src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx
    - src/app/(main)/h/[householdSlug]/rooms/page.tsx
    - src/app/(main)/h/[householdSlug]/rooms/loading.tsx
    - src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx
  modified: []
decisions:
  - "householdId prop threading in plants/[id] goes to PlantDetail (3 direct JSX attributes: EditPlantDialog, PlantActions, PlantDetail) rather than 5+ separate child components — PlantDetail is an aggregate that internally passes householdId to Timeline, WateringHistory, LogWateringDialog, SnoozePills, PlantReminderToggle. Plan spec expected direct rendering; actual component hierarchy wraps them in PlantDetail."
  - "EmptyFilterState refactored from buildClearUrl using literal /plants to using householdSlug parameter — function signature extended with householdSlug + currentParams to build correct /h/[householdSlug]/plants URLs"
  - "Chrome stays in outer (main)/layout.tsx as planned — Plan 03c will relocate it inward"
  - "Explicit type annotations added to lambda params in rooms/page.tsx and plants/page.tsx to resolve implicit any cascade caused by pre-existing @/generated/prisma/client resolution failure"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 11
  files_modified: 0
---

# Phase 02 Plan 03a: Household Route Tree — Layout Chokepoint + Page Migration Summary

**One-liner:** 11 new files under `/h/[householdSlug]/` — pure D-03 chokepoint layout, ForbiddenError/404 boundaries, and 5 household-scoped page routes with householdId query rewiring and dialog prop threading.

## What Was Built

### Task 1 — Chokepoint layout + error/not-found boundaries

**`src/app/(main)/h/[householdSlug]/layout.tsx`** — Pure D-03 chokepoint (22 lines):
```typescript
export default async function HouseholdLayout({ children, params }) {
  const { householdSlug } = await params;
  await getCurrentHousehold(householdSlug);  // 404 via notFound() or 403 via ForbiddenError
  return <>{children}</>;
}
```
- Calls `getCurrentHousehold` once per request; nested pages get cache hit at zero DB cost
- Chrome stays in `(main)/layout.tsx` until Plan 03c relocates it

**`src/app/(main)/h/[householdSlug]/error.tsx`** — Client error boundary:
- Discriminates `error.name === "ForbiddenError"` for 403 (membership removed/invalid link)
- Generic fallback for other errors with `reset()` button
- Uses `ShieldAlert` and `AlertCircle` Lucide icons + shadcn/ui `Button`
- Redirects to `/dashboard` for both cases

**`src/app/(main)/h/[householdSlug]/not-found.tsx`** — Server Component 404:
- No `"use client"` directive (intentionally a Server Component)
- "Household not found" heading + recovery link to `/dashboard`
- Uses `SearchX` icon

### Task 2 — 5 page routes + 3 loading skeletons

All pages: `params: Promise<{ householdSlug: string [; id: string] }>` (Next.js 16 async params). Each page calls `getCurrentHousehold(householdSlug)` and sources `household.id` from the cached result — guaranteed zero extra DB round-trips after layout's call.

#### Per-page query rewiring

| Page | Old query args | New query args |
|------|---------------|----------------|
| dashboard | `getDashboardPlants(userId, ...)` | `getDashboardPlants(householdId, ...)` |
| dashboard | `db.plant.count({ where: { userId } })` | `db.plant.count({ where: { householdId } })` |
| plants | `getPlants(session.user.id, opts)` | `getPlants(household.id, opts)` |
| plants | `getRoomsForSelect(session.user.id)` | `getRoomsForSelect(household.id)` |
| plants | `db.plant.count({ where: { userId } })` | `db.plant.count({ where: { householdId } })` |
| plants/[id] | `getPlant(id, session.user.id)` | `getPlant(id, household.id)` |
| plants/[id] | `getRoomsForSelect(session.user.id)` | `getRoomsForSelect(household.id)` |
| plants/[id] | `getTimeline(id, session.user.id)` | `getTimeline(id, household.id)` |
| rooms | `getRooms(session.user.id)` | `getRooms(household.id)` |
| rooms/[id] | `getRoom(id, session.user.id)` | `getRoom(id, household.id)` |

#### Dialog prop threading

| Page | Components receiving householdId |
|------|----------------------------------|
| dashboard/page.tsx | `<AddPlantDialog householdId={household.id} />` (header + EmptyState CTA), `<DashboardClient householdId={household.id} />` |
| plants/page.tsx | `<AddPlantDialog householdId={household.id} />` (header + EmptyState CTA) |
| plants/[id]/page.tsx | `<EditPlantDialog householdId={household.id} />`, `<PlantActions householdId={household.id} />`, `<PlantDetail householdId={household.id} />` (PlantDetail internally threads to Timeline, WateringHistory, LogWateringDialog, SnoozePills, PlantReminderToggle) |
| rooms/page.tsx | `<CreateRoomDialog householdId={household.id} />` (header + EmptyState CTA), `<QuickCreatePresets householdId={household.id} />`, `<RoomCard householdId={household.id} />` |

#### URL template literal conversions (plants/page.tsx)

All hardcoded `/plants` literal strings replaced with template literals:

| Before | After |
|--------|-------|
| `redirect(... "/plants")` | `redirect(... \`/h/${householdSlug}/plants\`)` |
| `basePath="/plants"` | `basePath={\`/h/${householdSlug}/plants\`}` |
| `clearUrl = "/plants"` | `clearUrl = \`/h/${householdSlug}/plants\`` |
| `buildClearUrl(allParams, [...])` — returned `/plants?...` | `buildClearUrl(householdSlug, currentParams, [...])` — returns `/h/${householdSlug}/plants?...` |

Grep for `"/plants"` in the new plants/page.tsx returns 0 matches.

#### CRITICAL FIX — rooms/[id]/page.tsx Pitfall 1

**Before (broken — `Room.userId` dropped in Phase 1):**
```typescript
room: { id: room.id, name: room.name, userId: room.userId, createdAt: ..., updatedAt: ... }
```

**After (fixed):**
```typescript
room: {
  id: room.id,
  name: room.name,
  householdId: room.householdId,   // CHANGED
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
  createdByUserId: room.createdByUserId,
}
```

Grep for `room.userId` in the new file returns 0 matches.

#### Loading skeletons

All 3 loading files copied verbatim from legacy paths — no route-dependent logic:
- `dashboard/loading.tsx` — 2-section urgency skeleton
- `plants/loading.tsx` — header + search/filter + 6-card grid skeleton
- `rooms/loading.tsx` — header + preset chips + 3-card grid skeleton

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Incorrect auth import path depth in 4 of 5 page files**
- **Found during:** Task 2 TypeScript check
- **Issue:** Pages under `/h/[householdSlug]/` are 6 directories deep (for `dashboard/`, `plants/`, `rooms/`) and 7 directories deep (for `plants/[id]/`, `rooms/[id]/`). Initial writes used wrong relative depths.
- **Fix:** Corrected via `sed` — 6-level pages use `../../../../../../auth`; 7-level pages use `../../../../../../../auth`
- **Files modified:** All 5 page.tsx files
- **Commit:** 145716f

**2. [Rule 1 - Bug] Implicit `any` type in lambda params (cascade from pre-existing @/generated/prisma/client resolution failure)**
- **Found during:** Task 2 TypeScript check
- **Issue:** `@/generated/prisma/client` cannot be resolved by tsc (pre-existing project issue), causing `getRooms()` and `getRoomsForSelect()` return types to propagate as `any[]`. Lambda params in `.map()` and `.find()` callbacks were then untyped.
- **Fix:** Added explicit type annotations: `RoomWithPlantCount` import in rooms/page.tsx; `{ id: string; name: string }` inline annotation in plants/page.tsx; `PlantWithRelations[]` cast before `.map()` in rooms/[id]/page.tsx
- **Files modified:** `plants/page.tsx`, `rooms/page.tsx`, `rooms/[id]/page.tsx`
- **Commit:** 145716f

### Plan Spec Notes

**householdId prop count in plants/[id]/page.tsx: 3 direct JSX attrs (not ≥5)**
- The plan's acceptance criterion expected ≥5 direct `householdId={household.id}` matches for EditPlantDialog, PlantActions, Timeline, WateringHistory, PlantReminderToggle
- Actual count: 3 direct attrs (EditPlantDialog, PlantActions, PlantDetail)
- Reason: `PlantDetail` is an aggregate server+client component that internally receives householdId and forwards it to Timeline, LogWateringDialog, SnoozePills, PlantReminderToggle, WateringHistory — those components are not rendered directly in the page. The plan spec was written expecting direct rendering, but the actual architecture routes through PlantDetail.
- Impact: None — householdId reaches all downstream components via PlantDetail. This is correct behavior.

## Verification Results

| Check | Status |
|-------|--------|
| All 11 files exist under `src/app/(main)/h/[householdSlug]/` | PASS |
| `npx tsc --noEmit` — zero errors in new files | PASS (0 errors) |
| `getCurrentHousehold` in layout.tsx | 2 matches (import + call) |
| `error.name === "ForbiddenError"` in error.tsx | 1 match |
| `"use client"` on line 1 of error.tsx | PASS |
| No `"use client"` in not-found.tsx | PASS (0 matches) |
| `"Household not found"` in not-found.tsx | 1 match |
| `getCurrentHousehold` in each new page.tsx | 2 matches each (import + call) |
| `household.id` in query args in every page.tsx | PASS |
| `householdSlug` + `id` both destructured in `plants/[id]` and `rooms/[id]` | 1 match each |
| `room.userId` in rooms/[id]/page.tsx | 0 matches (PASS) |
| `householdId: room.householdId` in rooms/[id]/page.tsx | 1 match |
| Literal `"/plants"` in plants/page.tsx | 0 matches (all template literals) |
| Literal `"/rooms"` in rooms/page.tsx | 0 matches |
| No TODO/FIXME/placeholder stubs | 0 matches |

## Known Stubs

None. All 5 pages are fully wired to household-scoped queries and pass `householdId` to every client component that requires it.

## Threat Flags

The new route tree introduces 6 page.tsx + layout.tsx endpoints that handle authenticated user requests. These are all covered by the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-chokepoint | src/app/(main)/h/[householdSlug]/layout.tsx | All 6 routes pass through `getCurrentHousehold` which composes `resolveHouseholdBySlug` + `requireHouseholdAccess` — T-02-03a-01 mitigated |
| threat_flag: 403-boundary | src/app/(main)/h/[householdSlug]/error.tsx | ForbiddenError discrimination via `error.name` string comparison — T-02-03a-02 accepted (slug entropy) |
| threat_flag: prop-threading | src/app/(main)/h/[householdSlug]/*/page.tsx | household.id sourced from DB-validated cached result, never from URL — T-02-03a-03 mitigated |

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | e86eb95 | feat(02-03a): create /h/[householdSlug] chokepoint layout + error/not-found boundaries |
| Task 2 | 145716f | feat(02-03a): move dashboard/plants/rooms pages under /h/[householdSlug]/ with household-scoped queries |

## Self-Check

## Self-Check: PASSED

- `src/app/(main)/h/[householdSlug]/layout.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/error.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/not-found.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/dashboard/loading.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/plants/page.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/plants/loading.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/rooms/page.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/rooms/loading.tsx` — FOUND
- `src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx` — FOUND
- Commit `e86eb95` — FOUND in git log
- Commit `145716f` — FOUND in git log
