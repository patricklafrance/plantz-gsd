---
phase: 07-polish-and-accessibility
reviewed: 2026-04-15T12:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/plants/page.tsx
  - src/app/(main)/rooms/[id]/page.tsx
  - src/app/(main)/rooms/page.tsx
  - src/app/globals.css
  - src/components/auth/user-menu.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/plants/add-plant-dialog.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/components/plants/filter-chips.tsx
  - src/components/plants/plant-card.tsx
  - src/components/preferences/preferences-form.tsx
  - src/components/reminders/notification-bell.tsx
  - src/components/rooms/create-room-dialog.tsx
  - src/components/rooms/room-card.tsx
  - src/components/shared/empty-state.tsx
  - src/components/shared/focus-heading.tsx
  - src/components/shared/pagination.tsx
  - src/components/shared/responsive-dialog.tsx
  - src/components/shared/timezone-warning.tsx
  - src/components/timeline/note-input.tsx
  - src/components/ui/drawer.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/components/watering/dashboard-section.tsx
  - src/components/watering/log-watering-dialog.tsx
  - src/features/notes/schemas.ts
  - src/features/plants/queries.ts
  - src/features/plants/schemas.ts
  - src/features/rooms/schemas.ts
  - src/hooks/use-focus-heading.ts
  - src/hooks/use-media-query.ts
  - tests/notes.test.ts
  - tests/plants-search.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Reviewed 35 source files spanning pages, components, schemas, queries, hooks, and tests for the Plant Minder application. The codebase is generally well-structured with consistent patterns: Server Components use direct Prisma queries, client components handle interactivity, Zod v4 schemas validate inputs, and the UI follows a cohesive design system. Authentication checks are consistently applied on all server pages.

Key concerns center around a few logic bugs (unreachable dead code in the plant card status badge, a potential crash in the user menu when given an empty email), missing error handling in async flows, and an XSS-adjacent pattern where user search input is interpolated into rendered text without explicit sanitization (mitigated by React's default escaping, but flagged for awareness). No critical security vulnerabilities were found.

## Warnings

### WR-01: Dead code branch in PlantCard `getStatusBadge` -- `overdueDays === 0` is unreachable

**File:** `src/components/plants/plant-card.tsx:26`
**Issue:** The `daysUntil < 0` branch computes `overdueDays = Math.abs(daysUntil)`. Since `daysUntil` is strictly less than zero, `overdueDays` will always be at least 1 and can never be 0. The conditional `overdueDays === 0 ? "Overdue" : ...` on line 26 is dead code -- the "Overdue" label without a day count will never render. This same pattern is duplicated in `dashboard-plant-card.tsx:30`.
**Fix:**
Remove the dead branch or change the guard to `daysUntil <= 0` if the intent is to show "Overdue" when `daysUntil` is exactly 0. If `daysUntil === 0` should be handled by the "Due today" case (line 30), then simply remove the dead ternary:
```tsx
// plant-card.tsx line 22-27
if (daysUntil < 0) {
  const overdueDays = Math.abs(daysUntil);
  return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 items-center">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {`${overdueDays}d overdue`}
    </Badge>
  );
}
```

### WR-02: `getInitials` crashes on empty string email

**File:** `src/components/auth/user-menu.tsx:26`
**Issue:** When `name` is falsy and `email` is an empty string, `email[0]` is `undefined`, and calling `.toUpperCase()` on it throws a TypeError. The layout passes `user?.email ?? ""` which means if the user record is null, an empty string reaches this function.
**Fix:**
Add a guard for empty email:
```tsx
function getInitials(email: string, name?: string | null): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0][0].toUpperCase();
  }
  if (email.length > 0) return email[0].toUpperCase();
  return "?";
}
```

### WR-03: `EmptyFilterState` uses room name instead of room ID in `allParams` for `buildClearUrl`

**File:** `src/app/(main)/plants/page.tsx:159`
**Issue:** The `allParams` record sets `room: roomName` (the display name) but `buildClearUrl` preserves params by key/value. If "room" is not in `clearKeys`, the room _name_ gets written into the URL query string instead of the room _id_. For example, `buildClearUrl(allParams, ["search"])` would produce `?room=Living%20Room` instead of `?room=<uuid>`. This happens in the `search && !status && !roomName` branch when a room filter is also active (since `roomName` is truthy, that branch is not entered, so this is currently unreachable due to the conditional structure, but the data mapping is still incorrect and fragile).
**Fix:**
Pass the room ID, not the room name:
```tsx
// line 156-159
const allParams: Record<string, string | undefined> = {
  search,
  status,
  room: roomName ? activeRoomId : undefined,  // Use the ID, not the display name
};
```
Note: `activeRoomId` would need to be passed as a prop to `EmptyFilterState`, or `allParams` restructured. The current code is technically not reachable due to the branching conditions, but if the logic is ever extended, this will silently produce broken URLs.

### WR-04: Missing `await` error handling in `NoteInput.handleSubmit`

**File:** `src/components/timeline/note-input.tsx:17-32`
**Issue:** The `handleSubmit` function calls `await createNote(...)` but does not wrap it in try/catch. If the server action throws (network error, unexpected server failure), the promise rejection is unhandled. `isPending` will remain `true` permanently, leaving the input disabled.
**Fix:**
```tsx
async function handleSubmit() {
  const trimmed = value.trim();
  if (!trimmed) return;

  setIsPending(true);
  try {
    const result = await createNote({ plantId, content: trimmed });
    if ("error" in result) {
      toast.error("Couldn't add note. Try again.");
      return;
    }
    setValue("");
    toast("Note added.");
  } catch {
    toast.error("Couldn't add note. Try again.");
  } finally {
    setIsPending(false);
  }
}
```

### WR-05: Missing `try/catch` in several dialog `onSubmit` handlers

**File:** `src/components/plants/add-plant-dialog.tsx:105-119`, `src/components/plants/edit-plant-dialog.tsx:74-85`, `src/components/watering/log-watering-dialog.tsx:87-124`
**Issue:** The `onSubmit` functions in `AddPlantDialog`, `EditPlantDialog`, and `LogWateringDialog` all `await` server actions without try/catch. If the server action throws (e.g., network failure), the form enters a broken state: `react-hook-form`'s `isSubmitting` stays `true` and the submit button remains permanently disabled.
**Fix:**
Wrap each server action call in try/catch, e.g.:
```tsx
async function onSubmit(data: CreatePlantInput) {
  setFormError(undefined);
  try {
    const result = await createPlant({
      ...data,
      careProfileId: selectedProfile?.id,
    });
    if ("error" in result) {
      setFormError(result.error);
      return;
    }
    toast("Plant added.");
    handleOpenChange(false);
  } catch {
    setFormError("Something went wrong. Please try again.");
  }
}
```

## Info

### IN-01: `useMediaQuery` returns `false` during SSR, causing layout flash

**File:** `src/hooks/use-media-query.ts:6`
**Issue:** The hook initializes `matches` to `false`, which means during server-side rendering and the first client render, `ResponsiveDialog` always renders as the desktop `Dialog`. On mobile, this causes a brief flash before switching to the `Drawer` variant after the `useEffect` fires. This is a known tradeoff with media query hooks in SSR frameworks, but worth noting.
**Fix:** Consider using CSS-based responsive display instead of JS-driven component swapping for initial render, or accept the flash as a known limitation.

### IN-02: Unused import `updateRoom` in `create-room-dialog.tsx`

**File:** `src/components/rooms/create-room-dialog.tsx:18`
**Issue:** `updateRoom` is imported from `@/features/rooms/actions` but the component uses it in the edit mode path. This is actually used -- disregard. Upon closer inspection, the import IS used on line 73. No action needed. (Retracted.)

### IN-03: `allCaughtUp` condition may be confusing when only `recentlyWatered` has plants

**File:** `src/app/(main)/dashboard/page.tsx:76-80`
**Issue:** The `allCaughtUp` flag requires `totalInGroups > 0`, meaning if the only group with plants is `recentlyWatered`, the banner shows. This is correct behavior ("all caught up"), but the condition `groups.upcoming.length === 0` means if a plant is upcoming but not overdue or due today, the banner does not show -- which could be surprising to users who might expect "all caught up" to mean "nothing urgent" rather than "nothing upcoming at all."
**Fix:** No code fix needed -- this is a product decision. Document the intent if the condition is intentional.

### IN-04: Hardcoded `PAGE_SIZE = 20` as a magic number

**File:** `src/features/plants/queries.ts:3`
**Issue:** `PAGE_SIZE` is exported and well-named, which is good. However, it is hardcoded in the queries file. If pagination size needs to differ across views (e.g., dashboard vs. plants list), this single constant would need to be refactored.
**Fix:** No immediate action -- the current single-use pattern is fine for v1.

### IN-05: Bottom tab bar "Alerts" tab links to `/dashboard` instead of a dedicated route

**File:** `src/components/layout/bottom-tab-bar.tsx:36`
**Issue:** The `href` for the "Alerts" tab is hardcoded to redirect to `/dashboard` when the TABS config declares it as `/notifications`. The `isActive` check uses `pathname === href` (where `href` is `/notifications`), so the "Alerts" tab will never show as active since navigation actually goes to `/dashboard`. This means the active state highlighting for Alerts is broken.
**Fix:**
Either create a `/notifications` route, or fix the active state logic to account for the redirect:
```tsx
// Option 1: Fix active state for the redirect case
const actualHref = href === "/notifications" ? "/dashboard" : href;
const isActive = exact
  ? pathname === actualHref
  : pathname === actualHref || pathname.startsWith(actualHref + "/");
```
Note: Option 1 would make "Alerts" and "Dashboard" both active on `/dashboard`, which is also confusing. The cleanest fix is to create a `/notifications` page or remove the redirect.

### IN-06: Duplicate status badge rendering logic between `plant-card.tsx` and `dashboard-plant-card.tsx`

**File:** `src/components/plants/plant-card.tsx:10-44`, `src/components/watering/dashboard-plant-card.tsx:23-68`
**Issue:** Both files contain a `getStatusBadge` function with very similar logic for rendering watering status badges. This duplication means any bug fix (like WR-01) needs to be applied in two places.
**Fix:** Extract a shared `StatusBadge` component or utility function into `src/components/shared/` that both card components can import.

---

_Reviewed: 2026-04-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
