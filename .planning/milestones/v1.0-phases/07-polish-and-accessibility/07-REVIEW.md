---
phase: 07-polish-and-accessibility
reviewed: 2026-04-16T04:56:22Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - prisma/schema.prisma
  - src/app/(main)/dashboard/loading.tsx
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/plants/loading.tsx
  - src/app/(main)/rooms/loading.tsx
  - src/app/globals.css
  - src/components/auth/login-form.tsx
  - src/components/auth/register-form.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/onboarding/onboarding-banner.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/components/plants/filter-chips.tsx
  - src/components/plants/plant-card.tsx
  - src/components/shared/timezone-warning.tsx
  - src/components/ui/drawer.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/components/watering/timezone-sync.tsx
  - src/features/auth/actions.ts
  - src/features/demo/actions.ts
  - src/hooks/use-focus-heading.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-16T04:56:22Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed 21 files covering the Prisma schema, dashboard pages, auth forms, layout components, plant cards, watering actions, onboarding, timezone handling, and accessibility hooks. The codebase is generally well-structured with good server/client separation, proper Zod validation on server actions, and solid auth checks. Phase 7 polish work (WCAG contrast fixes, focus management, touch targets) is well-documented and applied consistently.

Five warnings were identified: missing error handling that could leave UI in stuck states, a silently-ignored seed failure during onboarding, a navigation tab that can never appear active, inconsistent error handling between login and registration forms, and an unreachable code branch in the plant card status badge logic. Three informational items were also noted.

## Warnings

### WR-01: Missing try/catch in handleWater leaves UI stuck on network error

**File:** `src/components/watering/dashboard-client.tsx:85-134`
**Issue:** The async callback inside `startTransition` has no try/catch. If `logWatering` throws an unexpected error (network failure, serialization error), the cleanup code on lines 92-101 never runs. This leaves `wateringPlantIds` and `removingIds` with stale entries, causing the water button to show a perpetual loading spinner and the card to remain in a faded/scaled-down state with no way to recover.
**Fix:** Wrap the `startTransition` body in try/catch/finally:
```typescript
startTransition(async () => {
  updateGroups(plant.id);
  try {
    const result = await logWatering({ plantId: plant.id });
    // ... existing result handling ...
  } catch {
    toast.error("Couldn't log watering. Check your connection and try again.", {
      action: { label: "Retry", onClick: () => handleWater(plant) },
    });
  } finally {
    setWateringPlantIds((prev) => {
      const next = new Set(prev);
      next.delete(plant.id);
      return next;
    });
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.delete(plant.id);
      return next;
    });
  }
});
```

### WR-02: Seed starter plants failure silently ignored during onboarding

**File:** `src/components/onboarding/onboarding-banner.tsx:43-46`
**Issue:** The `Promise.all` result destructures only `onboardingResult`, discarding the `seedStarterPlants` result. If the user checked "Start with a few example plants" and seeding fails, the banner shows "Got it -- your tips are personalized" and collapses, but no starter plants were created. The user has no indication that something went wrong and no way to retry.
**Fix:** Capture and check the seed result:
```typescript
const [onboardingResult, seedResult] = await Promise.all([
  completeOnboarding({ plantCountRange: range }),
  seedStarters ? seedStarterPlants(range) : Promise.resolve(null),
]);

setIsCompleting(false);

if (onboardingResult && "error" in onboardingResult) {
  toast.error("Something went wrong. Please try again.");
  setSelectedRange(null);
  return;
}

if (seedResult && "error" in seedResult) {
  toast.error("Could not add starter plants. You can add plants manually.");
}
```

### WR-03: Alerts tab can never show active state

**File:** `src/components/layout/bottom-tab-bar.tsx:9-36`
**Issue:** The "Alerts" tab is defined with `href: "/notifications"` (line 12) and the active check compares pathname against `/notifications` (lines 29-31). However, the actual link target is overridden to `/dashboard` on line 36 (`href={href === "/notifications" ? "/dashboard" : href}`). Since navigating the tab goes to `/dashboard`, the active indicator always highlights "Dashboard" instead of "Alerts". Additionally, no `/notifications` route exists. The tab misleads users into thinking there is a dedicated notifications page.
**Fix:** Either remove the Alerts tab entirely until a notifications page is implemented, or disable it visually:
```typescript
const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/plants", icon: Leaf, label: "Plants", exact: false },
  { href: "/rooms", icon: DoorOpen, label: "Rooms", exact: false },
  // Alerts tab deferred until notifications page is built
] as const;
```

### WR-04: Missing try/catch in register form onSubmit

**File:** `src/components/auth/register-form.tsx:37-51`
**Issue:** The `onSubmit` function calls `registerUser` without a try/catch. If the server action throws an unexpected error (not a redirect), the user sees no feedback. This is inconsistent with `login-form.tsx` (line 53) which has a catch block showing "Something went wrong." While react-hook-form will reset `isSubmitting`, the user gets no error toast.
**Fix:** Add a try/catch consistent with the login form:
```typescript
async function onSubmit(values: RegisterInput) {
  try {
    const result = await registerUser({
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (result?.error) {
      toast.error(result.error);
      return;
    }
  } catch {
    toast.error("Something went wrong. Please try again in a moment.");
  }
}
```

### WR-05: Dead code branch -- overdueDays === 0 is unreachable

**File:** `src/components/plants/plant-card.tsx:21-26`
**Issue:** On line 21, the condition `daysUntil < 0` (strict less-than) means `Math.abs(daysUntil)` on line 22 will always be >= 1. The ternary `overdueDays === 0 ? "Overdue"` on line 26 is unreachable dead code. If `daysUntil` were exactly 0, execution would fall through to the `daysUntil === 0` check on line 30 instead. The same pattern exists in `dashboard-plant-card.tsx:26-30`.
**Fix:** Remove the unreachable branch:
```typescript
if (daysUntil < 0) {
  const overdueDays = Math.abs(daysUntil);
  return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 items-center">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {overdueDays}d overdue
    </Badge>
  );
}
```

## Info

### IN-01: Unused Skeleton import in dashboard page

**File:** `src/app/(main)/dashboard/page.tsx:14`
**Issue:** `Skeleton` is imported from `@/components/ui/skeleton` but the `DashboardSkeleton` component defined inline (lines 17-39) also imports it. Since `DashboardSkeleton` is in the same file and uses the same import, this is fine. However, `Skeleton` is not used outside of `DashboardSkeleton`, so the import on line 14 is effectively a duplicate of the usage on line 1 of the inner component -- no issue per se, but the `loading.tsx` file at `src/app/(main)/dashboard/loading.tsx` already defines a separate loading skeleton. The inline `DashboardSkeleton` duplicates the loading skeleton pattern. Consider reusing the `loading.tsx` export.

### IN-02: Notification badge count accessible name missing

**File:** `src/components/layout/bottom-tab-bar.tsx:47-49`
**Issue:** The notification count badge (`<span>9+</span>` or `<span>{notificationCount}</span>`) is purely visual. Screen readers will see the "Alerts" label but won't announce the count. Consider adding an `aria-label` or `sr-only` span for the count.
**Fix:** Add a screen-reader-only announcement:
```tsx
<span className="sr-only">{notificationCount} unread</span>
```

### IN-03: Hardcoded demo credentials in source code

**File:** `src/features/demo/seed-data.ts:1-2`
**Issue:** `DEMO_EMAIL` and `DEMO_PASSWORD` are defined as plaintext constants. The password value is `"demo-password-not-secret"` which is self-documented as not sensitive. This is acceptable for a demo seeding mechanism since the demo user is intentionally public. No action needed, but noting for visibility -- ensure this account cannot be escalated to admin privileges and that the demo password is not reused anywhere.

---

_Reviewed: 2026-04-16T04:56:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
