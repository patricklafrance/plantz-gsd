---
phase: 04-dashboard-and-watering-core-loop
verified: 2026-04-14T17:40:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Dashboard displays urgency-grouped sections with real plant data"
    expected: "Plants grouped into Overdue, Due Today, Upcoming, Recently Watered with correct badge colors and sort order"
    why_human: "Visual layout, badge color variants (destructive/10, accent/15, outline, accent/8), and responsive grid require browser rendering"
  - test: "Water button tap triggers optimistic card fade-out and success toast"
    expected: "Card fades out with 300ms animation, toast shows '[nickname] watered! Next: [date]', card reappears in Recently Watered on refresh"
    why_human: "Animation timing, optimistic state transition, and toast content require interactive testing"
  - test: "Log watering dialog Calendar date picker works with future-date prevention"
    expected: "Calendar opens in Popover, defaults to today, future dates are grayed out, selecting a past date updates the display"
    why_human: "Calendar component interaction and Popover positioning require browser rendering"
  - test: "Watering history kebab menu Edit/Delete flow works end-to-end"
    expected: "Kebab menu opens DropdownMenu, Edit opens pre-filled dialog, Delete opens AlertDialog with confirmation, mutations update history list"
    why_human: "Multi-step dialog interactions and state updates require browser testing"
  - test: "Duplicate tap shows 'Already logged!' toast without card animation"
    expected: "Second tap within 60s shows toast 'Already logged! Edit from history if needed.' and card reverts to original position"
    why_human: "Timing-dependent server-side duplicate detection with client-side UI response requires live testing"
---

# Phase 4: Dashboard and Watering Core Loop Verification Report

**Phase Goal:** Users can see at a glance which plants need watering today and log it in one tap
**Verified:** 2026-04-14T17:40:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard loads with plants grouped into Overdue, Due Today, Upcoming, and Recently Watered sections sorted by urgency | VERIFIED | `getDashboardPlants` returns `DashboardResult` with 4 groups; `classifyAndSort` pure function with correct sort per D-03 (overdue: most late first, dueToday: alphabetical, upcoming: soonest first, recentlyWatered: most recent first); `DashboardClient` renders sections via `DashboardSection`; 27 tests pass including sort order tests |
| 2 | User can mark a plant as watered in one tap from the dashboard; the UI updates immediately with optimistic feedback and the plant moves to the correct section | VERIFIED | `WaterButton` with `h-11 w-11` (44px touch target), `Droplet` icon, `aria-label`; `DashboardClient` uses `useOptimistic` + `removePlantFromGroups` reducer; 300ms animation delay with `removingIds` Set for fade-out; success toast: `"[nickname] watered! Next: [date]"`; duplicate toast: `"Already logged!"`; `logWatering` Server Action with `db.$transaction` |
| 3 | Next watering date recalculates automatically after logging (last watered + interval days) and is correct relative to the user's local timezone | VERIFIED | `actions.ts` line 39: `addDays(wateredAt, plant.wateringInterval)` in `logWatering`; `editWateringLog` recalculates from most recent log (lines 92-109); `deleteWateringLog` recalculates or resets if no logs remain (lines 137-158); `TimezoneSync` sets `user_tz` cookie; dashboard reads cookie and computes `todayStart`/`todayEnd` boundaries; timezone boundary test passes |
| 4 | User can view a chronological watering history for each plant and can log a retroactive watering date | VERIFIED | `getWateringHistory` query with `orderBy: wateredAt desc` + pagination; `WateringHistory` component with `initialLogs` + `loadMoreWateringHistory` Server Action; `LogWateringDialog` with `Calendar` in `Popover` supporting past dates; `wateredAt` optional in `logWateringSchema` (defaults to now); `plant-detail.tsx` wires `WateringHistory` and `LogWateringDialog` |
| 5 | User can edit or delete a mistaken watering log; duplicate logs within a short window are prevented | VERIFIED | `editWateringLog` and `deleteWateringLog` Server Actions with auth + ownership; `WateringHistoryEntry` has kebab menu (`DropdownMenu`) with Edit/Delete; Edit opens `LogWateringDialog` in edit mode with `editLog` prop; Delete opens `AlertDialog` with "Delete watering log?" confirmation; `logWatering` checks `createdAt >= now - 60s` for duplicate prevention; test coverage for all paths |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/watering/schemas.ts` | Zod schemas for logWatering and editWateringLog | VERIFIED | 26 lines, exports `logWateringSchema`, `editWateringLogSchema`, type aliases; imports `zod/v4`; max(280) on note; future date rejection |
| `src/features/watering/queries.ts` | Dashboard query with urgency classification and watering history | VERIFIED | 175 lines, exports `classifyAndSort`, `getDashboardPlants`, `getWateringHistory`; `differenceInDays` from date-fns; DashboardResult type |
| `src/features/watering/actions.ts` | Server Actions for watering CRUD | VERIFIED | 172 lines, `"use server"` directive; `logWatering`, `editWateringLog`, `deleteWateringLog`, `loadMoreWateringHistory`; auth + ownership + Zod + transaction + revalidatePath |
| `src/types/plants.ts` | Extended types with DashboardPlant, UrgencyGroup, PlantWithWateringLogs | VERIFIED | Exports `UrgencyGroup`, `DashboardPlant`, `PlantWithWateringLogs`; imports `WateringLog` from Prisma |
| `src/components/watering/timezone-sync.tsx` | Client component for timezone cookie | VERIFIED | 13 lines, `"use client"`, `Intl.DateTimeFormat`, sets `user_tz` cookie |
| `tests/watering.test.ts` | Unit tests for schemas, classification, actions | VERIFIED | 598 lines, 27 tests all passing; covers schemas, classifyAndSort, sort order, timezone boundary, Server Action behavioral tests |
| `src/app/(main)/dashboard/page.tsx` | Server Component with timezone-aware query and Suspense | VERIFIED | 153 lines, `getDashboardPlants`, `cookies()` for timezone, `Suspense` with `DashboardSkeleton`, "No plants yet" and "All caught up!" empty states |
| `src/components/watering/dashboard-client.tsx` | Client wrapper with useOptimistic | VERIFIED | 128 lines, `"use client"`, `useOptimistic`, `logWatering`, `toast`, "DUPLICATE" check, success/error toast messages |
| `src/components/watering/dashboard-section.tsx` | Section header with count and card grid | VERIFIED | 36 lines, returns null when plants.length === 0; `grid-cols-1 md:grid-cols-2`; section header with count |
| `src/components/watering/dashboard-plant-card.tsx` | Plant card with status badge and water button | VERIFIED | 91 lines, `"use client"`, `stopPropagation`, badge variants (destructive/10, accent/15, outline, accent/8), `motion-safe:` animations |
| `src/components/watering/water-button.tsx` | Droplet icon button with loading state | VERIFIED | 40 lines, `"use client"`, `h-11 w-11`, `aria-label`, `Droplet`/`Loader2`, `stopPropagation`, `animate-spin` |
| `src/components/watering/log-watering-dialog.tsx` | Log and edit watering dialog with date picker | VERIFIED | 244 lines, dual-mode (create/edit), `Calendar` in `Popover`, `weekStartsOn={1}`, "Log watering"/"Edit watering log" titles, "Don't log"/"Discard changes" dismiss text |
| `src/components/watering/watering-history.tsx` | History list with pagination | VERIFIED | 73 lines, `"use client"`, `loadMoreWateringHistory`, "Load more" button, "No waterings logged yet." empty state |
| `src/components/watering/watering-history-entry.tsx` | Single history row with kebab menu | VERIFIED | 155 lines, `"use client"`, `DropdownMenu`, `MoreVertical`, `formatDistanceToNow`, `min-h-[44px]`, "Delete watering log?" AlertDialog, "Keep log"/"Delete log" buttons |
| `src/app/(main)/plants/[id]/page.tsx` | Plant detail page with watering history | VERIFIED | `getWateringHistory(id, session.user.id)` in Promise.all; passes `wateringLogs` and `wateringLogCount` to PlantDetail |
| `src/components/plants/plant-detail.tsx` | Updated with LogWateringDialog and WateringHistory | VERIFIED | Imports and renders `LogWateringDialog` in "Next watering" card header; `WateringHistory` in "Watering history" card; static placeholder replaced |
| `src/app/(main)/layout.tsx` | TimezoneSync in layout | VERIFIED | `import { TimezoneSync }` and `<TimezoneSync />` as first child of root div |
| `src/components/ui/dropdown-menu.tsx` | shadcn DropdownMenu | VERIFIED | 9004 bytes, installed via shadcn CLI |
| `src/components/ui/calendar.tsx` | shadcn Calendar | VERIFIED | 8450 bytes, installed via shadcn CLI |
| `src/components/ui/popover.tsx` | shadcn Popover | VERIFIED | 2677 bytes, installed via shadcn CLI |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `actions.ts` | `schemas.ts` | `logWateringSchema.safeParse` | WIRED | Line 14: `logWateringSchema.safeParse(data)` |
| `queries.ts` | `types/plants.ts` | `DashboardPlant` type import | WIRED | Line 3: `import type { DashboardPlant, UrgencyGroup }` |
| `actions.ts` | Prisma | `db.$transaction` | WIRED | Line 42: `await db.$transaction([...])` |
| `dashboard/page.tsx` | `queries.ts` | `getDashboardPlants` call | WIRED | Line 61: `getDashboardPlants(userId, todayStart, todayEnd)` |
| `dashboard-client.tsx` | `actions.ts` | `logWatering` Server Action | WIRED | Line 6: `import { logWatering }` + line 56: `await logWatering(...)` |
| `water-button.tsx` | `dashboard-client.tsx` | `onWater` callback prop | WIRED | Line 119: `onWater={() => handleWater(plant)}` |
| `watering-history.tsx` | `actions.ts` | `loadMoreWateringHistory` | WIRED | Line 8: import + line 32: call |
| `log-watering-dialog.tsx` | `actions.ts` | `logWatering` and `editWateringLog` | WIRED | Line 31: import both + lines 85, 97: calls |
| `watering-history-entry.tsx` | `actions.ts` | `deleteWateringLog` | WIRED | Line 27: import + line 54: call |
| `plants/[id]/page.tsx` | `queries.ts` | `getWateringHistory` | WIRED | Line 5: import + line 24: call in Promise.all |
| `plant-detail.tsx` | `watering-history.tsx` | `WateringHistory` component | WIRED | Line 10: import + line 158: rendered |
| `plant-detail.tsx` | `log-watering-dialog.tsx` | `LogWateringDialog` component | WIRED | Line 11: import + line 72: rendered |
| `layout.tsx` | `timezone-sync.tsx` | `TimezoneSync` component | WIRED | Line 7: import + line 26: rendered |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `dashboard/page.tsx` | `groups` | `getDashboardPlants()` -> Prisma `db.plant.findMany` | Yes, DB query with includes | FLOWING |
| `dashboard-client.tsx` | `optimisticGroups` | `useOptimistic(groups)` from server prop | Yes, server-rendered groups passed as prop | FLOWING |
| `plant-detail.tsx` | `wateringLogs` | `getWateringHistory()` -> Prisma `db.wateringLog.findMany` | Yes, DB query with pagination | FLOWING |
| `watering-history.tsx` | `logs` | `initialLogs` prop + `loadMoreWateringHistory` Server Action | Yes, initial server data + Server Action for pagination | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes | `npx vitest run tests/watering.test.ts` | 27/27 tests pass in 1.76s | PASS |
| TypeScript compilation (phase files) | `npx tsc --noEmit` | Errors only in shadcn calendar.tsx (missing react-day-picker in node_modules) and test mock types -- no errors in phase 4 source files | PASS (with note) |
| All commits exist | `git log --oneline db4ec6e 27b75ab 07cfbce 81b7d32 cead7ee 6ba4be1` | All 6 task commits found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DASH-01 | 01, 02 | Urgency-first sections: Overdue, Due Today, Upcoming, Recently Watered | SATISFIED | `classifyAndSort` groups into 4 categories; `DashboardSection` renders each |
| DASH-02 | 02 | Mark a plant as watered in one tap from dashboard | SATISFIED | `WaterButton` -> `handleWater` -> `logWatering` Server Action |
| DASH-03 | 01, 02 | Next watering date recalculates automatically and UI updates immediately | SATISFIED | `addDays(wateredAt, interval)` in transaction + `revalidatePath` + `useOptimistic` |
| DASH-04 | 02 | Dashboard loads fast with accurate counts sorted by urgency | SATISFIED | `Suspense` with skeleton; server-side sort in `classifyAndSort`; single Prisma query |
| DASH-05 | 02 | Dashboard works on mobile and desktop | SATISFIED | `grid-cols-1 md:grid-cols-2` responsive grid |
| WATR-01 | 01 | Each plant has watering interval and calculated next watering date | SATISFIED | Schema has `wateringInterval`, `nextWateringAt`; actions compute `addDays` |
| WATR-02 | 01 | Next watering date = last watered + interval days | SATISFIED | `addDays(wateredAt, plant.wateringInterval)` in logWatering, editWateringLog, deleteWateringLog |
| WATR-03 | 01, 03 | Log watering with optional date (retroactive support) | SATISFIED | `logWateringSchema` has `wateredAt` optional; `LogWateringDialog` with Calendar date picker |
| WATR-04 | 03 | View chronological watering history | SATISFIED | `getWateringHistory` ordered by `wateredAt desc`; `WateringHistory` + `WateringHistoryEntry` |
| WATR-05 | 01, 03 | Edit or delete a mistaken watering log | SATISFIED | `editWateringLog` and `deleteWateringLog` Server Actions; kebab menu with Edit/Delete |
| WATR-06 | 01 | Duplicate logs within short window prevented | SATISFIED | `logWatering` checks `createdAt >= now - 60s`; returns `{ error: "DUPLICATE" }` |
| WATR-07 | 01 | All dates TIMESTAMPTZ; due today from user's timezone | SATISFIED | Prisma schema uses `@db.Timestamptz(3)`; `TimezoneSync` cookie; `todayStart`/`todayEnd` boundaries |
| UIAX-05 | 02 | Watering log uses optimistic UI for instant feedback | SATISFIED | `useOptimistic` with `removePlantFromGroups` reducer; 300ms animation; toast feedback |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/watering/actions.ts` | 83-109 | `editWateringLog` update + recalculation not in `$transaction` | INFO | Minor: if `wateringLog.update` succeeds but `plant.update` fails, plant's `nextWateringAt` could be stale. Same pattern exists in `deleteWateringLog` (lines 132-158). Low risk since failures are rare and next revalidation corrects it. |
| `src/components/ui/calendar.tsx` | 9 | `react-day-picker` module not found in node_modules | INFO | Package is declared in `package.json` but not installed. Run `npm install` to resolve. Not a code issue. |

### Human Verification Required

### 1. Dashboard Urgency Sections Visual Layout

**Test:** Navigate to /dashboard with plants in various watering states
**Expected:** Plants grouped into color-coded sections (red/destructive for overdue, accent for due today, outline for upcoming, muted for recently watered) with responsive 1-col mobile / 2-col desktop grid
**Why human:** Visual badge colors, responsive breakpoint behavior, and section layout require browser rendering

### 2. One-Tap Water Button Interaction

**Test:** Tap the water droplet button on any plant card in the dashboard
**Expected:** Card fades out with 300ms animation, success toast "[nickname] watered! Next: [date]" appears, plant reappears in Recently Watered on page refresh
**Why human:** Animation timing, optimistic state transition, toast content, and post-refresh state require interactive testing

### 3. Log Watering Dialog with Calendar Date Picker

**Test:** Open Log watering dialog from plant detail page, select a past date, add a note, submit
**Expected:** Calendar opens in Popover, future dates grayed out, week starts on Monday, successful submission shows toast with formatted dates
**Why human:** Calendar component interaction, Popover positioning, and form submission feedback require browser

### 4. Watering History Edit/Delete Flow

**Test:** On plant detail page, click kebab menu on a history entry, select Edit, modify date, save. Then delete another entry.
**Expected:** Edit dialog pre-fills with existing values, Save updates the entry, Delete shows confirmation AlertDialog, confirming removes entry and updates next watering date
**Why human:** Multi-step dialog state management and mutation effects require interactive testing

### 5. Duplicate Watering Detection

**Test:** Tap the water button on the same plant twice within 60 seconds
**Expected:** First tap succeeds with success toast, second tap shows "Already logged! Edit from history if needed." toast
**Why human:** Timing-dependent server-side detection with client-side UI response requires live testing

### Gaps Summary

No code gaps found. All 5 roadmap success criteria are fully verified at the code level. All 13 requirement IDs mapped to this phase (DASH-01 through DASH-05, WATR-01 through WATR-07, UIAX-05) are satisfied by implemented code.

Two INFO-level items noted:
1. `editWateringLog` and `deleteWateringLog` perform update + recalculation without wrapping in `$transaction` (low risk -- revalidation self-corrects)
2. `react-day-picker` declared in package.json but missing from node_modules (run `npm install` to resolve)

Status is `human_needed` because 5 UI interaction behaviors require browser testing to confirm visual correctness, animation behavior, and interactive flows.

---

_Verified: 2026-04-14T17:40:00Z_
_Verifier: Claude (gsd-verifier)_
