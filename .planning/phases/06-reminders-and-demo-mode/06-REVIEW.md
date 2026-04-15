---
phase: 06-reminders-and-demo-mode
reviewed: 2026-04-15T12:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - auth.config.ts
  - auth.ts
  - prisma/schema.prisma
  - prisma/seed.ts
  - proxy.ts
  - src/app/(auth)/demo/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/preferences/page.tsx
  - src/components/auth/login-form.tsx
  - src/components/onboarding/onboarding-banner.tsx
  - src/components/plants/plant-detail.tsx
  - src/components/preferences/account-settings.tsx
  - src/components/preferences/preferences-form.tsx
  - src/components/reminders/notification-bell.tsx
  - src/components/reminders/plant-reminder-toggle.tsx
  - src/components/reminders/snooze-pills.tsx
  - src/components/ui/switch.tsx
  - src/features/auth/actions.ts
  - src/features/demo/actions.ts
  - src/features/demo/seed-data.ts
  - src/features/notes/actions.ts
  - src/features/plants/actions.ts
  - src/features/reminders/actions.ts
  - src/features/reminders/queries.ts
  - src/features/reminders/schemas.ts
  - src/features/reminders/types.ts
  - src/features/rooms/actions.ts
  - src/features/watering/actions.ts
  - src/types/next-auth.d.ts
  - tests/demo.test.ts
  - tests/reminders.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-04-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 6 introduces the in-app reminders system (notification bell, snooze pills, per-plant and global reminder toggles) and demo mode (shared demo user, starter plant seeding, mutation guards). The code is well-structured overall with consistent patterns: every server action checks authentication, validates with Zod schemas, enforces ownership via Prisma queries, and guards demo users from mutations. The Prisma schema is clean with appropriate indexes and cascade deletes.

No critical security issues were found. Authorization is consistently enforced across all server actions. The demo password is intentionally public (accepted risk per planning artifacts). The three warnings relate to a potential uncaught error in concurrent onboarding actions, inconsistent `isRedirectError` import patterns, and a missing `isDemo` prop that bypasses client-side UI feedback. The info items cover minor code quality observations.

## Warnings

### WR-01: Onboarding banner does not handle seedStarterPlants failure independently

**File:** `src/components/onboarding/onboarding-banner.tsx:43-54`
**Issue:** `handleRangeSelect` fires `completeOnboarding` and `seedStarterPlants` concurrently via `Promise.all`, but only checks the result of `completeOnboarding`. If `seedStarterPlants` fails (network error, DB error) while `completeOnboarding` succeeds, the banner collapses with a success animation but the starter plants silently fail to create. The user sees "Got it -- your tips are personalized" but has no plants.
**Fix:** Check the result of `seedStarterPlants` as well and show a warning toast if it fails:
```tsx
const [onboardingResult, seedResult] = await Promise.all([
  completeOnboarding({ plantCountRange: range }),
  seedStarters ? seedStarterPlants() : Promise.resolve(null),
]);

setIsCompleting(false);

if (onboardingResult && "error" in onboardingResult) {
  toast.error("Something went wrong. Please try again.");
  setSelectedRange(null);
  return;
}

if (seedResult && "error" in seedResult) {
  toast.warning("Onboarding saved, but starter plants could not be created.");
}
```

### WR-02: Inconsistent isRedirectError import pattern between auth and demo actions

**File:** `src/features/demo/actions.ts:22`
**Issue:** `startDemoSession` uses a dynamic `await import(...)` for `isRedirectError` inside the catch block, while `registerUser` in `src/features/auth/actions.ts:8` uses a static top-level import. The dynamic import introduces a potential failure point: if the dynamic import itself fails (e.g., module resolution issue), the redirect error would not be re-thrown, causing the demo session start to return an error response instead of redirecting. This is unlikely but violates the principle of consistent error handling patterns.
**Fix:** Use a static import like `auth/actions.ts` does:
```ts
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function startDemoSession() {
  try {
    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return { error: "Could not start demo session. Please try again." };
  }
}
```

### WR-03: snooze-pills disabled prop uses loose boolean coercion for isDemo

**File:** `src/components/reminders/snooze-pills.tsx:77,87`
**Issue:** The `disabled` prop uses `disabled={isPending || isDemo}` where `isDemo` is typed as `boolean | undefined`. When `isDemo` is `undefined` and `isPending` is `false`, the expression evaluates to `undefined` rather than `false`. While this is functionally correct for the HTML `disabled` attribute (undefined = not disabled), it is inconsistent with other components like `account-settings.tsx` and `preferences-form.tsx` that use `!!isDemo`. More importantly, the `handleQuickSnooze` function checks `if (isDemo)` which also evaluates `undefined` as falsy, so the server-side guard is the real protection -- but the inconsistency makes the code harder to reason about.
**Fix:** Use `!!isDemo` for consistency:
```tsx
disabled={isPending || !!isDemo}
```

## Info

### IN-01: Demo password hardcoded in source code (accepted risk)

**File:** `src/features/demo/seed-data.ts:2`
**Issue:** `DEMO_PASSWORD = "demo-password-not-secret"` is committed to source code. This is documented as an accepted risk in the phase plan (T-06-02) since the demo user is intentionally public. Noting for traceability.
**Fix:** No action required. The variable name clearly communicates intent. Consider adding a code comment referencing the risk acceptance if one is not already documented nearby.

### IN-02: Test files contain only .todo() placeholders

**File:** `tests/demo.test.ts:4-11`, `tests/reminders.test.ts:4-40`
**Issue:** The majority of test cases are `it.todo(...)` placeholders. Only 4 actual tests exist across both files (3 in demo.test.ts for seed data constants, 4 in reminders.test.ts for schema validation). The todo tests cover important scenarios: mutation guards for demo users, snooze behavior, toggle behavior, and reminder query logic. These should be implemented before the phase is considered complete.
**Fix:** Implement the `.todo()` tests. Priority order: (1) mutation guard tests for demo mode, (2) getReminderCount/getReminderItems query tests, (3) snooze and toggle action tests.

### IN-03: Duplicate query for user.remindersEnabled in main layout

**File:** `src/app/(main)/layout.tsx:22-25,36-39`
**Issue:** The layout fetches `user.remindersEnabled` on line 24, and then `getReminderCount` and `getReminderItems` (lines 37-38) also independently query `user.remindersEnabled` internally (see `src/features/reminders/queries.ts:16-19` and `67-71`). This results in three separate DB queries for the same `remindersEnabled` field in a single page load. The layout already has the value and could pass it to the query functions to avoid the redundant lookups.
**Fix:** Refactor `getReminderCount` and `getReminderItems` to accept an optional `remindersEnabled` parameter, or create a variant that skips the internal check when the caller has already verified it:
```ts
// Option: pass remindersEnabled to avoid redundant lookup
const [reminderCount, reminderItems] = user?.remindersEnabled
  ? await Promise.all([
      getReminderCount(session.user.id, todayStart, todayEnd),
      getReminderItems(session.user.id, todayStart, todayEnd),
    ])
  : [0, []];
```

### IN-04: loadMoreTimeline exported from both queries.ts and actions.ts

**File:** `src/features/notes/queries.ts:63-70`, `src/features/notes/actions.ts:93-101`
**Issue:** `loadMoreTimeline` is defined in both `queries.ts` (as a direct DB function) and `actions.ts` (as a server action wrapper). The `queries.ts` version is a thin wrapper around `getTimeline` that adds no logic. This is dead code if only the server action version is called from client components. The naming collision could also cause confusion about which to import.
**Fix:** Remove the `loadMoreTimeline` export from `queries.ts` since the server action in `actions.ts` is the public API for client components, and it already calls `getTimeline` directly.

---

_Reviewed: 2026-04-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
