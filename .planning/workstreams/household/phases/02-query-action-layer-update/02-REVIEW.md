---
phase: 02-query-action-layer-update
reviewed: 2026-04-16T14:00:00Z
depth: standard
files_reviewed: 63
files_reviewed_list:
  - auth.ts
  - package.json
  - prisma/migrations/20260417033126_add_household_member_is_default/migration.sql
  - prisma/schema.prisma
  - prisma/seed.ts
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/loading.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
  - src/app/(main)/h/[householdSlug]/error.tsx
  - src/app/(main)/h/[householdSlug]/layout.tsx
  - src/app/(main)/h/[householdSlug]/not-found.tsx
  - src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx
  - src/app/(main)/h/[householdSlug]/plants/loading.tsx
  - src/app/(main)/h/[householdSlug]/plants/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/loading.tsx
  - src/app/(main)/h/[householdSlug]/rooms/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/plants/page.tsx
  - src/app/(main)/rooms/[id]/page.tsx
  - src/app/(main)/rooms/page.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/plants/add-plant-dialog.tsx
  - src/components/watering/dashboard-client.tsx
  - src/features/auth/actions.ts
  - src/features/demo/actions.ts
  - src/features/household/actions.ts
  - src/features/household/context.ts
  - src/features/household/guards.ts
  - src/features/household/queries.ts
  - src/features/household/schema.ts
  - src/features/notes/actions.ts
  - src/features/notes/queries.ts
  - src/features/notes/schemas.ts
  - src/features/plants/actions.ts
  - src/features/plants/queries.ts
  - src/features/plants/schemas.ts
  - src/features/reminders/actions.ts
  - src/features/reminders/queries.ts
  - src/features/reminders/schemas.ts
  - src/features/rooms/actions.ts
  - src/features/rooms/queries.ts
  - src/features/rooms/schemas.ts
  - src/features/watering/actions.ts
  - src/features/watering/queries.ts
  - src/features/watering/schemas.ts
  - tests/household-create.test.ts
  - tests/household-list.test.ts
  - tests/household.test.ts
  - tests/notes.test.ts
  - tests/plants.test.ts
  - tests/reminders.test.ts
  - tests/rooms.test.ts
  - tests/watering.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-16T14:00:00Z
**Depth:** standard
**Files Reviewed:** 63
**Status:** issues_found

## Summary

Phase 02 introduces household-scoped authorization across the full action layer: `requireHouseholdAccess` guard, `getCurrentHousehold` React cache helper, the `/h/[householdSlug]/` route tree, legacy redirect stubs, and migration of plants/rooms/watering/notes/reminders actions from `userId` to `householdId` scope.

The overall authorization architecture is sound. Every primary mutating action (createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant, createRoom, updateRoom, deleteRoom, logWatering, editWateringLog, deleteWateringLog, createNote, updateNote, deleteNote, snoozeReminder, snoozeCustomReminder, togglePlantReminder) calls `requireHouseholdAccess` before any DB write. All queries filter by `householdId` directly or through nested `plant: { householdId }` relations. The `ForbiddenError` class, error boundary, slug loop, and React cache usage are all correctly implemented.

One critical gap exists: `seedStarterPlants` in `src/features/demo/actions.ts` accepts a caller-supplied `householdId` and writes plants directly into it without calling `requireHouseholdAccess`. This allows any authenticated non-demo user to inject plants into any household by ID.

Four warnings are also present: two "read" actions skip membership verification; the slug-loop off-by-one makes the comment misleading; and the legacy `revalidatePath` pattern with literal bracket segments may not clear all Next.js page caches correctly.

## Critical Issues

### CR-01: `seedStarterPlants` writes to caller-supplied householdId without membership check

**File:** `src/features/demo/actions.ts:147-217`

**Issue:** `seedStarterPlants` accepts an optional `householdId` parameter from the caller and uses it directly as the target for bulk plant creation. There is no call to `requireHouseholdAccess` before writing. An authenticated non-demo user can pass any household ID they know (or guess) and populate it with plants — bypassing all household membership controls established in this phase.

The fallback path (`session.user.activeHouseholdId`) also uses a JWT-resident value for authorization, which contradicts D-14/Pitfall 16: the JWT value is a landing-target hint only and must not be used as the authorization source.

```typescript
// Current (insecure):
const targetHouseholdId = householdId ?? session.user.activeHouseholdId;
if (!targetHouseholdId) return { error: "No household found." };

// Fixed:
const targetHouseholdId = householdId ?? session.user.activeHouseholdId;
if (!targetHouseholdId) return { error: "No household found." };

// Add after the targetHouseholdId check:
await requireHouseholdAccess(targetHouseholdId);
```

Import `requireHouseholdAccess` at the top of `src/features/demo/actions.ts`:

```typescript
import { requireHouseholdAccess } from "@/features/household/guards";
```

## Warnings

### WR-01: `loadMoreWateringHistory` and `loadMoreTimeline` skip membership check, exposing household data to unauthenticated cross-household reads

**File:** `src/features/watering/actions.ts:193-204` and `src/features/notes/actions.ts:100-109`

**Issue:** Both pagination actions are documented as safe because "the underlying query filters by `plant.householdId`". However, the query filter only prevents a non-member from seeing plants from a *different* household — it does not prevent a member of household A from enumerating watering history or timeline entries from household B if they supply household B's ID and a plant ID that happens to exist in household B. The session check (`!session?.user?.id`) only verifies the user is authenticated, not that they are a member of the requested household.

A user removed from a household can continue paginating through historical data until their session expires.

```typescript
// Fix for loadMoreWateringHistory:
export async function loadMoreWateringHistory(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = loadMoreWateringHistorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  return getWateringHistory(parsed.data.plantId, parsed.data.householdId, parsed.data.skip, 20);
}
```

Apply the same pattern to `loadMoreTimeline` in `src/features/notes/actions.ts`.

### WR-02: Slug collision loop throw threshold is off-by-one relative to its comment

**File:** `src/features/household/actions.ts:41-51` and `src/features/demo/actions.ts:37-48` and `prisma/seed.ts:64-72`

**Issue:** The loop increments `attempts` with `++attempts > 10` *after* the break check, meaning the loop runs for attempts 0 through 10 — 11 total iterations — before throwing. The comment and error message both say "after 10 attempts". The test in `household-create.test.ts:88` asserts `findUnique.mock.calls.length >= 11`, confirming 11 calls happen. This is not a functional bug (11 attempts is fine), but the mismatch between the documented intent ("10 attempts") and the actual behavior (11 attempts) creates confusion and makes the test assertion counterintuitive.

```typescript
// Current (throws after 11 attempts):
if (++attempts > 10) {
  throw new Error("Slug generation failed after 10 attempts");
}

// Option A — fix the threshold to match the message (10 attempts total):
if (attempts++ >= 9) {
  throw new Error("Slug generation failed after 10 attempts");
}

// Option B — fix the message to match the behavior (cleaner):
if (++attempts > 10) {
  throw new Error("Slug generation failed after 11 attempts");
}
```

The same pattern exists in `src/features/auth/actions.ts:63-65` and `prisma/seed.ts:71` — fix all four occurrences consistently.

### WR-03: JWT narrowing converts `null` activeHouseholdId to `undefined`, causing redirect loop for new users with no household

**File:** `auth.ts:39-41`

**Issue:** The session callback converts `token.activeHouseholdId` from `null` to `undefined`:

```typescript
session.user.activeHouseholdId =
  typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined;
```

This is correct for the TypeScript declaration (`activeHouseholdId?: string` on Session, not `string | null`). However, legacy redirect stubs (`/dashboard`, `/plants`, `/rooms`, `/plants/[id]`, `/rooms/[id]`) branch on `!id` (where `id = session.user.activeHouseholdId`) and redirect to `/login` when it is falsy:

```typescript
const id = session.user.activeHouseholdId;
if (!id) redirect("/login");
```

A brand-new authenticated user whose household creation failed in a race condition, or any user whose JWT was issued before the household was created, will be silently redirected to `/login` instead of receiving an actionable error. This is an edge case but produces a confusing UX with no error message.

**Fix:** Replace the silent `/login` redirect in legacy stubs with a redirect to an error or onboarding page, or surface a toast/error before redirecting.

### WR-04: `revalidatePath` with literal bracket patterns may not invalidate all cached pages

**File:** `src/features/plants/actions.ts:40-41`, `src/features/rooms/actions.ts:27-28`, `src/features/watering/actions.ts:77-78`, and similar across all actions

**Issue:** The revalidation calls use literal bracket segments:

```typescript
revalidatePath("/h/[householdSlug]/plants", "page");
revalidatePath("/h/[householdSlug]/dashboard", "page");
```

In Next.js 15/16, `revalidatePath` with a dynamic-segment pattern in bracket notation invalidates all rendered instances of that route (all slugs). This is documented behavior and is intentional here. However, the pattern only works if the segment name in the call exactly matches the folder name in `src/app/(main)/h/[householdSlug]/`. If the folder name ever changes, this revalidation will silently stop working with no build-time error.

This is a documentation/fragility warning rather than a runtime bug at present. Consider centralizing the path patterns as named constants to make refactoring safer:

```typescript
// src/features/household/paths.ts
export const HOUSEHOLD_PATHS = {
  dashboard: "/h/[householdSlug]/dashboard",
  plants: "/h/[householdSlug]/plants",
  plantDetail: "/h/[householdSlug]/plants/[id]",
  rooms: "/h/[householdSlug]/rooms",
  roomDetail: "/h/[householdSlug]/rooms/[id]",
} as const;
```

## Info

### IN-01: `deleteRoomSchema` in `rooms/schemas.ts` is dead code — `deleteRoom` action uses `roomTargetSchema`

**File:** `src/features/rooms/schemas.ts:20-23`

**Issue:** `deleteRoomSchema` defines `{ householdId, id }` but the `deleteRoom` action imports and uses `roomTargetSchema` (which defines `{ householdId, roomId }`). `deleteRoomSchema` is never imported anywhere.

```typescript
// Remove dead schema:
export const deleteRoomSchema = z.object({
  householdId: z.string().min(1),
  id: z.string().min(1),
});
```

### IN-02: Inconsistent `householdId` validation across Zod schemas

**File:** `src/features/plants/schemas.ts:38-41` vs `src/features/plants/schemas.ts:3-6`

**Issue:** `plantTargetSchema.householdId` uses `.cuid()` validation while `createPlantSchema.householdId` uses `.string().min(1)`. Similarly, `roomTargetSchema.householdId` uses `.cuid()` but `createRoomSchema.householdId` uses `.min(1)`. The inconsistency is harmless at runtime (all valid household IDs are CUIDs) but makes the API surface harder to reason about and could cause surprising validation failures if IDs ever change format.

Pick one convention and apply it uniformly. Given that `requireHouseholdAccess` is the authoritative membership check, `.string().min(1)` is sufficient for all schemas — `.cuid()` at the schema layer provides minimal additional security value since the guard is the enforcement point.

### IN-03: `completeOnboarding` in `src/features/auth/actions.ts` still calls `revalidatePath("/dashboard")` (legacy path) instead of household-scoped path

**File:** `src/features/auth/actions.ts:152`

**Issue:** After Phase 02 migration, `/dashboard` is now a legacy redirect stub that immediately forwards to `/h/[householdSlug]/dashboard`. The `revalidatePath("/dashboard")` call will revalidate the stub (which has no persistent cache) rather than the actual dashboard page. The onboarding banner will continue to appear until the user navigates to a page that triggers a server re-render.

```typescript
// Current:
revalidatePath("/dashboard");

// Fix — revalidate the actual page pattern:
revalidatePath("/h/[householdSlug]/dashboard", "page");
```

---

_Reviewed: 2026-04-16T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
