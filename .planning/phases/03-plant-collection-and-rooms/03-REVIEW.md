---
phase: 03-plant-collection-and-rooms
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - prisma.config.ts
  - prisma/data/catalog.ts
  - prisma/schema.prisma
  - prisma/seed.ts
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/plants/page.tsx
  - src/app/(main)/rooms/[id]/page.tsx
  - src/app/(main)/rooms/page.tsx
  - src/components/plants/add-plant-dialog.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/components/plants/plant-actions.tsx
  - src/components/plants/plant-card.tsx
  - src/components/plants/plant-detail.tsx
  - src/components/plants/plant-grid.tsx
  - src/components/plants/room-filter.tsx
  - src/components/rooms/create-room-dialog.tsx
  - src/components/rooms/quick-create-presets.tsx
  - src/components/rooms/room-card.tsx
  - src/components/ui/alert-dialog.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/select.tsx
  - src/features/plants/actions.ts
  - src/features/plants/queries.ts
  - src/features/plants/schemas.ts
  - src/features/rooms/actions.ts
  - src/features/rooms/queries.ts
  - src/features/rooms/schemas.ts
  - src/types/plants.ts
  - tests/plants.test.ts
  - tests/rooms.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 03 implements the plant collection and room management features: Prisma schema, seed catalog, server actions, queries, Zod schemas, page routes, and client components. The architecture is sound — server actions authenticate with session ownership checks, Prisma parameterized queries prevent SQL injection, and Zod validation runs on both client and server. No critical security issues were found.

Four warnings were identified: a watering schedule miscalculation when a plant's interval is updated before it has ever been watered, a silent input coercion that resets watering interval to 1 during typing, a navigation-before-toast ordering issue with the archive undo flow, and an unvalidated URL parameter passed into a database query. Three informational items cover the always-visible empty state on the dashboard, redundant auth checks, and a fragile manual type construction in the room detail page.

## Warnings

### WR-01: `updatePlant` skips `nextWateringAt` recalculation when `lastWateredAt` is null

**File:** `src/features/plants/actions.ts:51-57`
**Issue:** The `nextWateringAt` field is only recalculated when `lastWateredAt` is non-null. A plant that was created but whose `lastWateredAt` was somehow left null (e.g., future code paths or direct DB manipulation) will retain a stale or null `nextWateringAt` even after the interval is changed. In the current code, `createPlant` always sets `lastWateredAt: now`, so this is unlikely to trigger in practice — but the guard condition is fragile. If a future action (e.g., "reset watering history") clears `lastWateredAt`, updating the interval will silently leave `nextWateringAt` stale.

**Fix:** Recalculate from the current time as a fallback when `lastWateredAt` is null:
```typescript
if (parsed.data.wateringInterval !== existing.wateringInterval) {
  const base = existing.lastWateredAt ?? new Date();
  nextWateringAt = addDays(base, parsed.data.wateringInterval);
}
```

---

### WR-02: Watering interval input silently resets to 1 during typing

**File:** `src/components/plants/add-plant-dialog.tsx:318` and `src/components/plants/edit-plant-dialog.tsx:192`
**Issue:** The `onChange` handler uses `parseInt(e.target.value, 10) || 1`. When the user clears the field to type a new value (e.g., erasing "7" to type "14"), the intermediate empty string produces `NaN`, and `NaN || 1` coerces the value to `1`. This silently updates the form field to 1 mid-typing, making it hard to enter any two-digit value by clearing first. The Zod schema would catch an invalid final value, but the user sees unexpected behavior in the input.

**Fix:** Allow the empty/intermediate state to pass through to the field; let Zod validation handle the final check:
```typescript
onChange={(e) => {
  const raw = e.target.value;
  const parsed = parseInt(raw, 10);
  field.onChange(Number.isNaN(parsed) ? raw : parsed);
}}
```
Alternatively, keep the number coercion but only apply it on `onBlur`, not `onChange`.

---

### WR-03: Archive undo toast fires after navigation, leaving the user on the wrong page

**File:** `src/components/plants/plant-actions.tsx:44-57`
**Issue:** `router.push("/plants")` is called first, then the toast with the "Undo" action is shown. When the user clicks "Undo" from the `/plants` list page, `unarchivePlant` correctly unarchives the plant server-side, but there is no navigation back to the plant detail page and no cache revalidation is triggered for the current page's plant list (revalidation happens in `unarchivePlant` via `revalidatePath`, but the toast does not wait for it). The undo succeeds silently without the list refreshing to show the restored plant.

**Fix:** Either call `router.refresh()` inside the undo onClick, or reverse the order so `router.push` happens after the toast dismisses:
```typescript
onClick: async () => {
  const undoResult = await unarchivePlant(plant.id);
  if ("error" in undoResult) {
    toast.error(undoResult.error);
  } else {
    router.refresh(); // refresh current page to show restored plant
    toast("Archive undone.");
  }
},
```

---

### WR-04: Unvalidated `roomId` URL parameter passed directly into a Prisma query

**File:** `src/app/(main)/plants/page.tsx:20` and `src/features/plants/queries.ts:6-12`
**Issue:** `params.room` from `searchParams` (a raw URL query string value) is passed without any validation into `getPlants`. Inside `getPlants`, if `roomId` is truthy it is placed directly into a Prisma `where` clause. Prisma uses parameterized queries so SQL injection is not possible, but there is no validation that the value is a well-formed CUID, a reasonable string length, or even belongs to the current user. A user could craft a URL like `/plants?room=<very-long-string>` and it would reach the database. The `userId` filter prevents cross-user data exposure, but the missing input fence is an unnecessary gap.

**Fix:** Validate that `roomId` looks like a CUID before using it, or add a ownership pre-check:
```typescript
// In plants/page.tsx — validate before passing to query
const roomId = params.room && /^[a-z0-9]{20,30}$/.test(params.room)
  ? params.room
  : undefined;

const [plants, catalog, rooms] = await Promise.all([
  getPlants(session.user.id, roomId),
  ...
]);
```

---

## Info

### IN-01: Dashboard always renders the empty state regardless of plant count

**File:** `src/app/(main)/dashboard/page.tsx:37-49`
**Issue:** The dashboard page fetches `catalog` and `rooms` but does not fetch the user's plants. The "No plants yet" empty state block is rendered unconditionally for all users, including those with existing plants. This means users who have added plants will still see "No plants yet" on the dashboard. This appears to be an intentional placeholder (the comment says "visible when no plants (D-06)"), but as implemented the condition is missing — `getPlants` is not called and there is no conditional guard.

**Fix:** Either fetch plants and conditionally show the empty state, or add a TODO comment making the placeholder intent explicit so it is not mistaken for working code:
```typescript
const [user, plants, catalog, rooms] = await Promise.all([
  db.user.findUnique({ where: { id: session.user.id }, select: { onboardingCompleted: true } }),
  getPlants(session.user.id),
  getCatalog(),
  getRoomsForSelect(session.user.id),
]);

// Then conditionally render:
{plants.length === 0 ? <EmptyState ... /> : <PlantList plants={plants} />}
```

---

### IN-02: Redundant `auth()` call in dashboard page — layout already guards the route

**File:** `src/app/(main)/dashboard/page.tsx:11-13`
**Issue:** `MainLayout` at `src/app/(main)/layout.tsx:13-16` already calls `auth()` and redirects unauthenticated users. `DashboardPage` also calls `auth()` independently, resulting in two round-trips to the session store for this route. The same pattern appears in all pages under `(main)`. While not a correctness issue, it adds latency and duplication.

**Fix:** In Next.js App Router, `auth()` from Auth.js v5 caches per-request via React cache, so the second call is typically a cache hit at no cost. This is actually fine as-is. No change needed if Auth.js request-scoped caching is confirmed — but worth verifying this is cached and not making two separate database reads.

---

### IN-03: Manual `PlantWithRelations` construction in room detail page is fragile

**File:** `src/app/(main)/rooms/[id]/page.tsx:21-24`
**Issue:** The room detail page manually constructs a `room` sub-object to attach to each plant, pulling individual fields (`id`, `name`, `userId`, `createdAt`, `updatedAt`) from the parent `room` object. If the `Room` model gains new required fields in `prisma/schema.prisma`, this spread will be silently incomplete at runtime (TypeScript may catch it at compile time if the type is strict). It also duplicates the room data N times across all plant objects.

**Fix:** Either reshape the query to return plants with their room already included (requires a separate `getPlants` call filtered by room), or use a type assertion only and add a comment explaining the invariant:
```typescript
// room.plants from getRoom already belong to this room by query — safe to cast
const plantsWithRoom = room.plants.map((plant) => ({
  ...plant,
  room: { id: room.id, name: room.name, userId: room.userId,
          createdAt: room.createdAt, updatedAt: room.updatedAt } satisfies Room,
}));
```
Using `satisfies Room` will produce a TypeScript error if the Room type changes and fields are missing.

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
