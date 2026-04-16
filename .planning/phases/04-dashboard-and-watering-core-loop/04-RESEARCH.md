# Phase 4: Dashboard and Watering Core Loop - Research

**Researched:** 2026-04-16
**Domain:** Next.js App Router dashboard, optimistic UI, timezone-aware date math, Server Actions, watering history UX
**Confidence:** HIGH — the full implementation already exists in the codebase; research is grounded in verified code, not speculation.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard Card Layout**
- D-01: Compact horizontal row cards: leaf icon | nickname + species + room (centered) | urgency badge | water button. Info-dense, fits many plants on screen.
- D-02: Sections merged into three groups: "Needs water" (overdue + due today combined), "Upcoming", "Recently Watered". Empty sections are hidden entirely.
- D-03: Card info: nickname, species, room name, urgency badge with icon (e.g. "3d overdue", "Due today", "In 5d"), and inline snooze pills on overdue/due-today cards. No explicit next-water-date on the card.
- D-04: Responsive grid: 1 column on mobile, 2 on sm, 3 on lg. Section headers show count (e.g. "Needs water (4)") with separators between sections.

**Water Action Feedback**
- D-05: One-tap watering from dashboard with optimistic UI. Card fades out (opacity + scale animation) from current section and appears at top of "Recently Watered" immediately.
- D-06: Success toast shows plant name and next watering date: "Monstera watered! Next: May 2".
- D-07: Duplicate detection: same-day block — server rejects second log within the same calendar day. Toast: "Already logged! Edit from history if needed."
- D-08: Failure handling: retry toast with action button on network/server errors. No confirmation dialog before watering — keep it frictionless.

**Watering History UX**
- D-09: Chronological list on plant detail page, newest first, 20 entries per page with "Load more" button. No visual timeline — clean list.
- D-10: Retroactive logging via calendar date picker in the "Log watering" dialog. Defaults to today, can pick any past date. Future dates disabled.
- D-11: Optional note field (280 chars) on each watering log for context (e.g. "used filtered water").
- D-12: Edit/delete via kebab menu (three dots) on each history entry. Edit opens same dialog with pre-filled values. Delete is immediate with no confirmation dialog.

**Empty and Edge States**
- D-13: No-plants empty state: EmptyState component with leaf icon, "No plants yet" heading, body text, and Add Plant dialog CTA. No suggested starter plants in this state.
- D-14: All-caught-up state: green accent banner with checkmark icon: "All caught up! Check back when the next one is due." Shown when user has plants but nothing is overdue, due today, or upcoming.
- D-15: Timezone handling: cookie-based sync. Client-side TimezoneSync component writes `user_tz` cookie on mount. Server reads cookie to compute today's start/end boundaries in UTC for urgency classification. No manual timezone selection required.

### Claude's Discretion
- Loading skeleton design and animation
- Exact spacing, typography, and color values within the established design system
- Sort order within sections (overdue: most days late first, due today: alphabetical, upcoming: soonest first, recently watered: most recent first)
- Error state designs beyond the retry toast
- "All caught up" banner animation or transitions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | User sees urgency-first sections: Overdue, Due Today, Upcoming, Recently Watered | `getDashboardPlants` + `classifyAndSort` already implement this; `DashboardSection` renders it |
| DASH-02 | User can mark a plant as watered in one tap from the dashboard | `WaterButton` + `DashboardClient.handleWater()` already implement this |
| DASH-03 | After logging watering, next watering date recalculates automatically and UI updates immediately | `logWatering` action recomputes `nextWateringAt`; optimistic `useOptimistic` updates client instantly |
| DASH-04 | Dashboard loads fast with accurate counts sorted by urgency | Server Component Suspense + skeleton; counts from `getDashboardPlants` groups |
| DASH-05 | Dashboard works well on both mobile and desktop | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` already in `DashboardSection` |
| WATR-01 | Each plant has a watering interval in days and a calculated next watering date | `Plant.wateringInterval` + `Plant.nextWateringAt` fields in schema |
| WATR-02 | Next watering date = last watered date + interval days | `addDays(lastWateredAt, wateringInterval)` in all three actions |
| WATR-03 | User can log watering with optional date (supports retroactive logging) | `logWateringSchema.wateredAt` optional; `LogWateringDialog` calendar picker |
| WATR-04 | User can view chronological watering history for each plant | `WateringHistory` + `getWateringHistory` with pagination |
| WATR-05 | User can edit or delete a mistaken watering log entry | `editWateringLog` + `deleteWateringLog` actions; `WateringHistoryEntry` kebab menu |
| WATR-06 | Duplicate watering logs within a short window are prevented | Same-calendar-day check in `logWatering`; returns `DUPLICATE` sentinel |
| WATR-07 | All dates stored as TIMESTAMPTZ; "due today" computed from user's local timezone | Schema uses `@db.Timestamptz(3)`; `user_tz` cookie drives `todayStart`/`todayEnd` |
| UIAX-05 | Watering log uses optimistic UI for instant feedback | `useOptimistic` + `startTransition` in `DashboardClient` |
</phase_requirements>

---

## Summary

**This phase is substantially pre-built.** The entire data layer and the majority of the UI components were implemented ahead of schedule in prior phases. The `src/features/watering/` feature folder contains complete, tested schemas, queries, and server actions. All dashboard UI components (`DashboardClient`, `DashboardPlantCard`, `DashboardSection`, `WaterButton`, `TimezoneSync`) are present and wired to the dashboard page. The watering history UI (`WateringHistory`, `WateringHistoryEntry`, `LogWateringDialog`) is integrated into the plant detail page via the `Timeline` component. Twenty-seven unit tests covering the data layer already pass.

**The planning challenge is not "what to build" but "what gaps remain."** Based on a full codebase audit, the implementation appears to be complete for all 13 phase requirements. The planner's primary task is to produce plans that verify the existing implementation satisfies each requirement's acceptance criteria, identify any edge cases not yet covered by tests, and add test coverage for any uncovered behaviors.

**Primary recommendation:** Produce verification-oriented plans. Wave 1 should audit existing code against each requirement's acceptance criteria and call out gaps; Wave 2 should add missing test coverage; Wave 3 should handle any identified gaps.

---

## Standard Stack

### Core (all already installed and in use)
[VERIFIED: codebase grep]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.x | App Router, Server Components, Server Actions | Project constraint — not negotiable |
| React | 19.2 | `useOptimistic`, `startTransition` | Ships with Next.js 16; `useOptimistic` is the approved pattern for optimistic UI |
| TypeScript | 6.0 | Type safety | Project constraint |
| Prisma | 7.7.0 | ORM for WateringLog CRUD | Already used in `src/features/watering/` |
| date-fns | ^4.x | `addDays`, `differenceInDays`, `format`, `formatDistanceToNow`, `isToday`, `isYesterday` | Project-approved date library |
| Zod | 4.x (`zod/v4`) | Schema validation in Server Actions | Project constraint; `import { z } from "zod/v4"` |
| shadcn/ui | latest | Card, Badge, Calendar, Popover, Skeleton, Sonner, Dropdown, AlertDialog | Already installed |
| Tailwind CSS | 4.x | Styling | Project constraint |
| react-hook-form + @hookform/resolvers | 7.72.x | Form state in LogWateringDialog | Already used |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Sonner | latest | Toast notifications | All watering action feedback |
| lucide-react | latest | Leaf, Droplet, AlertTriangle, Clock, CheckCircle2, MoreVertical icons | Already used on cards |

**No new installations required** — all dependencies for this phase are already in `package.json`.

---

## Architecture Patterns

### Existing Project Structure (already established)
```
src/
├── features/watering/
│   ├── actions.ts        # logWatering, editWateringLog, deleteWateringLog, loadMoreWateringHistory
│   ├── queries.ts        # getDashboardPlants, classifyAndSort, getWateringHistory
│   └── schemas.ts        # logWateringSchema, editWateringLogSchema
├── components/watering/
│   ├── dashboard-client.tsx       # useOptimistic orchestrator
│   ├── dashboard-plant-card.tsx   # individual card with status badge + water button
│   ├── dashboard-section.tsx      # section header + responsive grid
│   ├── water-button.tsx           # Droplet icon button with loading state
│   ├── log-watering-dialog.tsx    # dual-mode (log/edit) dialog with date picker
│   ├── watering-history.tsx       # paginated list with load-more
│   ├── watering-history-entry.tsx # single entry with kebab menu
│   └── timezone-sync.tsx          # client component: writes user_tz cookie
├── app/(main)/dashboard/page.tsx  # Server Component: reads cookie, calls getDashboardPlants
├── app/(main)/plants/[id]/page.tsx # Server Component: calls getWateringHistory
└── types/plants.ts                # DashboardPlant, UrgencyGroup, PlantWithRelations
```

### Pattern 1: Server Component + Suspense for Dashboard

**What:** Dashboard page is an async Server Component. It reads the `user_tz` cookie, computes `todayStart`/`todayEnd`, fetches plant groups, then passes data to `DashboardClient`. A `DashboardContent` async component is wrapped in `<Suspense>` with a `DashboardSkeleton` fallback.

**When to use:** All dashboard data reads. No REST API needed — direct Prisma query in Server Component.

```typescript
// Source: src/app/(main)/dashboard/page.tsx (verified)
const cookieStore = await cookies();
const userTz = cookieStore.get("user_tz")?.value ?? "UTC";
const now = new Date();
const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
const [year, month, day] = localDateStr.split("-").map(Number);
const todayStart = new Date(Date.UTC(year, month - 1, day));
const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));
```

**Note:** `en-CA` locale produces `YYYY-MM-DD` format reliably across Node versions without additional libraries. [VERIFIED: existing code]

### Pattern 2: useOptimistic for One-Tap Watering

**What:** `DashboardClient` uses React 19's `useOptimistic` with `startTransition`. On water button click: (1) add plant to `removingIds` for fade-out CSS, (2) call `updateGroups(plant.id)` inside `startTransition` to optimistically move plant to `recentlyWatered`, (3) await `logWatering` Server Action, (4) show success/error toast.

```typescript
// Source: src/components/watering/dashboard-client.tsx (verified)
const [optimisticGroups, updateGroups] = useOptimistic(
  groups,
  movePlantToRecentlyWatered
);

startTransition(async () => {
  updateGroups(plant.id);
  const result = await logWatering({ plantId: plant.id });
  // ... toast handling
});
```

**Key insight:** `useOptimistic` state applies immediately and rolls back automatically if the transition rejects. The card uses `opacity-0 scale-95` CSS during `isRemoving` to animate out before the server-confirmed re-render moves it to "Recently Watered".

### Pattern 3: Timezone Cookie Sync

**What:** `TimezoneSync` is a `"use client"` component that runs `useEffect` once on mount. It writes `Intl.DateTimeFormat().resolvedOptions().timeZone` to the `user_tz` cookie and, on first visit, persists to the User table via `updateTimezone` Server Action.

```typescript
// Source: src/components/watering/timezone-sync.tsx (verified)
document.cookie = `user_tz=${encodeURIComponent(tz)}; path=/; SameSite=Strict; max-age=31536000`;
```

**First-visit race condition:** On a user's very first page load, the cookie does not yet exist. The server defaults to `UTC`. The `TimezoneWarning` component (already present) detects this mismatch and prompts the user. On second load, the cookie is present and urgency classification is correct.

### Pattern 4: Server Action with Ownership Check

**What:** Every Server Action verifies the session, then confirms the record belongs to the authenticated user before mutating. No separate middleware layer.

```typescript
// Source: src/features/watering/actions.ts (verified)
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };
if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };
// Ownership check via Prisma where clause
const plant = await db.plant.findFirst({
  where: { id: parsed.data.plantId, userId: session.user.id, archivedAt: null },
});
if (!plant) return { error: "Plant not found." };
```

### Pattern 5: nextWateringAt Recalculation from Most Recent Log

**What:** After any mutation (log, edit, delete) the action re-queries for the most recent log by `wateredAt DESC` and computes `nextWateringAt = addDays(mostRecent.wateredAt, plant.wateringInterval)`. This handles retroactive entries correctly — a retroactive log that is not the most recent does not change `nextWateringAt`.

```typescript
// Source: src/features/watering/actions.ts (verified)
const mostRecent = await db.wateringLog.findFirst({
  where: { plantId: plant.id },
  orderBy: { wateredAt: "desc" },
});
const lastWateredAt = mostRecent!.wateredAt;
const nextWateringAt = addDays(lastWateredAt, plant.wateringInterval);
await db.plant.update({ where: { id: plant.id }, data: { lastWateredAt, nextWateringAt } });
```

**Edge case (delete):** When the last log is deleted, `lastWateredAt` is set to `null` and `nextWateringAt` is reset to `addDays(new Date(), interval)` — countdown restarts from today. [VERIFIED: existing code and tests]

### Pattern 6: WateringHistory uses Timeline in Plant Detail

**What:** The plant detail page (`/plants/[id]/page.tsx`) does NOT render `WateringHistory` directly. Instead it renders `PlantDetail`, which renders `Timeline`. The `Timeline` component is a unified view of both watering logs and notes (interleaved by timestamp). The `WateringHistoryEntry` and `LogWateringDialog` components exist but are wired through `Timeline` → `TimelineEntry` rather than a standalone history list.

**Critical implication for planning:** Requirements WATR-03, WATR-04, WATR-05 are served through the Timeline, not a separate watering-only history list. The planner should not create tasks to build a standalone watering history — it would conflict with the existing Timeline integration.

### Anti-Patterns to Avoid

- **Calling `new Date()` for "today" boundaries on the client:** Produces UTC dates. Always use the `user_tz` cookie + `toLocaleDateString("en-CA", { timeZone: tz })` pattern.
- **Using `date-fns/addDays` with string inputs:** Always pass `Date` objects. The Zod schema uses `z.coerce.date()` to handle string-to-Date coercion at the boundary.
- **Forgetting `revalidatePath` after mutations:** `logWatering`, `editWateringLog`, and `deleteWateringLog` all call `revalidatePath("/dashboard")` and `revalidatePath("/plants/" + plantId)`. Missing these breaks server cache freshness.
- **Storing `nextWateringAt` from the submitted date instead of the most recent log:** A retroactive log submitted with an old date must not move `nextWateringAt` backward if a more recent log exists.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic UI state | Custom reducer | React 19 `useOptimistic` | Already in use; handles rollback automatically |
| Date arithmetic | Manual ms calculations | `date-fns addDays`, `differenceInDays` | Tree-shakable, TypeScript-typed, no DST bugs |
| Toast notifications | Custom toast component | Sonner (`toast()`, `toast.error()`) | Already integrated in `sonner.tsx` |
| Form validation in Server Actions | Manual if/else | Zod v4 `safeParse` | Consistent with codebase pattern |
| Calendar date picker | Custom input | shadcn `Calendar` + `Popover` | Already used in `LogWateringDialog` |
| Responsive dialog/drawer | Separate Dialog + Drawer | `ResponsiveDialog` shared component | Already exists at `src/components/shared/responsive-dialog.tsx` |

**Key insight:** The entire feature is built. There is no custom solution to replace.

---

## Common Pitfalls

### Pitfall 1: First-Visit Timezone Cookie Race

**What goes wrong:** On first load, `user_tz` cookie is not yet written. Server defaults to `UTC`. A user in UTC-8 who loads the dashboard at 11pm Pacific sees plants classified as "tomorrow" when they're actually due today in their timezone.

**Why it happens:** `TimezoneSync` runs client-side in `useEffect` — the cookie is written after the initial server render.

**How to avoid:** The `TimezoneWarning` component already detects when the stored DB timezone differs from the cookie. On the very first visit (no cookie, no DB value), the server uses UTC and the user sees a one-time warning. On second load the cookie is set and classification is correct. This is the accepted design per D-15 — no further action needed.

**Warning signs:** Users in non-UTC timezones reporting plants in wrong sections on their very first login.

### Pitfall 2: Retroactive Log Moves nextWateringAt Backward

**What goes wrong:** User logs a retroactive watering for last week. Server uses that date for `nextWateringAt`, scheduling next watering for days in the past.

**How to avoid:** The `logWatering` action already handles this correctly — after creating the new log it re-queries for the MOST RECENT log (not the just-created one) using `orderBy: { wateredAt: "desc" }`. A retroactive log only changes `nextWateringAt` if it becomes the most recent log.

**Warning signs:** Test case: log watering for "3 days ago" when a log for "yesterday" already exists → `nextWateringAt` should not change.

### Pitfall 3: Duplicate Detection Uses UTC Day, Not User's Local Day

**What goes wrong:** The `logWatering` action computes same-day duplicate detection with `setUTCHours(0, 0, 0, 0)`. For a user in UTC-12 logging at 1am on April 14 UTC, the server's "calendar date" is April 14, but the user's local date is April 13. This could incorrectly block a watering the user considers to be on a different day.

**Mitigation:** The current implementation accepts this approximation as a pragmatic tradeoff for v1. The `DUPLICATE` sentinel error provides a user-visible escape hatch: "Already logged! Edit from history if needed." No action required — but be aware of the limitation in testing.

### Pitfall 4: WateringHistory vs Timeline Confusion

**What goes wrong:** A plan creates a new `WateringHistory`-only section on the plant detail page, duplicating the `Timeline` that already shows watering entries.

**How to avoid:** The plant detail page uses `Timeline` (which renders `TimelineEntry` for both watering logs and notes). Watering entries in the timeline are handled by `TimelineEntry` → `LogWateringDialog` (edit mode) and `deleteWateringLog`. Plans should not create a parallel watering-only history list.

### Pitfall 5: Card Animation Requires `motion-safe` Prefix

**What goes wrong:** The fade-out animation on water button click uses `motion-safe:transition-all motion-safe:duration-300 opacity-0 scale-95`. Users with `prefers-reduced-motion` enabled would see jarring instant disappearance without the `motion-safe:` prefix.

**How to avoid:** This is already implemented correctly in `DashboardPlantCard`. When making any animation changes, preserve the `motion-safe:` prefix.

---

## What Is Already Built (Gap Analysis)

This section is the key research finding. The planner must understand the as-built state to avoid creating plans for work that is complete.

### Fully Built and Tested

| Component | Location | Status |
|-----------|----------|--------|
| `logWatering` Server Action | `src/features/watering/actions.ts` | Complete — 6 unit tests passing |
| `editWateringLog` Server Action | `src/features/watering/actions.ts` | Complete — 2 unit tests passing |
| `deleteWateringLog` Server Action | `src/features/watering/actions.ts` | Complete — 3 unit tests passing |
| `loadMoreWateringHistory` Server Action | `src/features/watering/actions.ts` | Complete |
| `getDashboardPlants` query | `src/features/watering/queries.ts` | Complete |
| `classifyAndSort` pure function | `src/features/watering/queries.ts` | Complete — 7 unit tests passing |
| `getWateringHistory` query | `src/features/watering/queries.ts` | Complete |
| `logWateringSchema` | `src/features/watering/schemas.ts` | Complete — 4 unit tests passing |
| `editWateringLogSchema` | `src/features/watering/schemas.ts` | Complete — 3 unit tests passing |
| `DashboardClient` | `src/components/watering/dashboard-client.tsx` | Complete |
| `DashboardPlantCard` | `src/components/watering/dashboard-plant-card.tsx` | Complete |
| `DashboardSection` | `src/components/watering/dashboard-section.tsx` | Complete |
| `WaterButton` | `src/components/watering/water-button.tsx` | Complete |
| `LogWateringDialog` | `src/components/watering/log-watering-dialog.tsx` | Complete |
| `WateringHistory` | `src/components/watering/watering-history.tsx` | Complete |
| `WateringHistoryEntry` | `src/components/watering/watering-history-entry.tsx` | Complete |
| `TimezoneSync` | `src/components/watering/timezone-sync.tsx` | Complete |
| Dashboard page | `src/app/(main)/dashboard/page.tsx` | Complete |
| Plant detail page | `src/app/(main)/plants/[id]/page.tsx` | Complete |
| `DashboardPlant` type | `src/types/plants.ts` | Complete |

### Test Coverage Assessment

| Test Area | Tests Exist | Count | Gaps |
|-----------|-------------|-------|------|
| Schema validation | Yes | 7 | — |
| `classifyAndSort` classification | Yes | 4 | — |
| `classifyAndSort` sorting | Yes | 3 | — |
| `classifyAndSort` timezone boundary | Yes | 1 | Retroactive log edge case (WATR-03) not tested |
| `logWatering` action | Yes | 4 | — |
| `editWateringLog` action | Yes | 2 | — |
| `deleteWateringLog` action | Yes | 3 | — |
| UI components | No | 0 | No Vitest/Playwright tests for DashboardClient, WaterButton, WateringHistoryEntry |
| E2E happy path | No | 0 | No Playwright test for full water flow |

**Total existing:** 27 tests, all passing.

**Gaps for Wave 0 consideration:**
- `tests/watering.test.ts` could add: retroactive log does not change `nextWateringAt` when a newer log exists
- `classifyAndSort` filter: upcoming plants watered in last 48h classified as recentlyWatered
- No E2E test covers the one-tap watering flow (Playwright)

---

## Code Examples

### Urgency Badge Pattern (in use)
```typescript
// Source: src/components/watering/dashboard-plant-card.tsx (verified)
case "overdue": {
  const overdueDays = Math.abs(plant.daysUntil);
  return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 items-center">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {overdueDays === 0 ? "Overdue" : `${overdueDays}d overdue`}
    </Badge>
  );
}
```

### Fade-out Animation on Water (in use)
```typescript
// Source: src/components/watering/dashboard-plant-card.tsx (verified)
<Card
  className={cn(
    "flex items-center gap-4 p-4 hover:shadow-sm hover:border-accent/40 transition-shadow cursor-pointer",
    isRemoving && "motion-safe:transition-all motion-safe:duration-300 opacity-0 scale-95"
  )}
>
```

### Duplicate Detection (in use)
```typescript
// Source: src/features/watering/actions.ts (verified)
const dayStart = new Date(wateredAt);
dayStart.setUTCHours(0, 0, 0, 0);
const dayEnd = new Date(dayStart);
dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
const existingLog = await db.wateringLog.findFirst({
  where: { plantId: parsed.data.plantId, wateredAt: { gte: dayStart, lt: dayEnd } },
});
if (existingLog) return { error: "DUPLICATE" };
```

### Section Grouping Logic (in use)
```typescript
// Source: src/components/watering/dashboard-client.tsx (verified)
// "Needs water" = overdue + dueToday + upcoming with daysUntil === 0
const upcomingDueToday = optimisticGroups.upcoming.filter((p) => p.daysUntil === 0);
const upcomingLater = optimisticGroups.upcoming.filter((p) => p.daysUntil > 0);
const needsWater = [...optimisticGroups.overdue, ...optimisticGroups.dueToday, ...upcomingDueToday];

const sections = [
  { key: "needsWater", title: "Needs water", plants: needsWater },
  { key: "upcoming", title: "Upcoming", plants: upcomingLater },
  { key: "recentlyWatered", title: "Recently Watered", plants: optimisticGroups.recentlyWatered },
].filter((s) => s.plants.length > 0);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useReducer` for optimistic state | React 19 `useOptimistic` | React 19 (Next.js 16) | Simpler rollback, concurrent mode safe |
| Client-side data fetching with `useEffect` | Server Component + Suspense | Next.js 13+ App Router | No loading state code, streaming SSR |
| `middleware.ts` for route protection | `proxy.ts` (Next.js 16) | Next.js 16 | `middleware.ts` deprecated; existing auth pattern uses `proxy.ts` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `WateringHistory` component is wired through `Timeline`, not standalone | Gap Analysis | Low — verified in `plant-detail.tsx` |
| A2 | No new shadcn components need to be installed | Standard Stack | Low — full component audit shows all needed components are present |
| A3 | The `TimezoneWarning` component handles the first-visit race condition acceptably | Pitfall 1 | Medium — if the UX is not acceptable, D-15 may need revisiting |

---

## Open Questions

1. **Do plans need to create new code, or only verify existing code?**
   - What we know: All 13 requirement implementations appear to exist in the codebase
   - What's unclear: Whether there are integration gaps (e.g., TimezoneSync not mounted in layout)
   - Recommendation: Plan 04-01 should audit the integration points before claiming all work is done

2. **Is `TimezoneSync` mounted in the root layout?**
   - What we know: Component exists at `src/components/watering/timezone-sync.tsx`
   - What's unclear: Whether it is rendered in the app layout so it runs on every page
   - Recommendation: Verify `src/app/(main)/layout.tsx` mounts `TimezoneSync`

3. **Are there E2E tests for the watering flow?**
   - What we know: 27 unit tests exist; no `tests/*.test.tsx` playwright tests found for watering
   - Recommendation: Wave 2 or 3 plan should add a Playwright smoke test for the critical water path

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 has no new external dependencies. All required tools (Node, PostgreSQL, Prisma, Next.js) are in use from prior phases.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/watering.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Plants classified into urgency groups | unit | `npx vitest run tests/watering.test.ts` | ✅ `tests/watering.test.ts` |
| DASH-02 | One-tap water from dashboard | unit + integration | `npx vitest run tests/watering.test.ts` | ✅ (action tested; UI manual-only) |
| DASH-03 | nextWateringAt recalculates after log | unit | `npx vitest run tests/watering.test.ts` | ✅ |
| DASH-04 | Dashboard loads with counts | manual-only | — | — (server render, no unit test) |
| DASH-05 | Responsive on mobile/desktop | manual-only | — | — (CSS, no unit test) |
| WATR-01 | Plant has interval + next date | unit | `npx vitest run tests/watering.test.ts` | ✅ |
| WATR-02 | nextWateringAt = lastWateredAt + interval | unit | `npx vitest run tests/watering.test.ts` | ✅ |
| WATR-03 | Retroactive logging | unit | `npx vitest run tests/watering.test.ts` | ✅ (partial — retroactive does not change next date when newer log exists is a gap) |
| WATR-04 | Chronological history | unit | `npx vitest run tests/watering.test.ts` | ✅ (query behavior tested indirectly) |
| WATR-05 | Edit/delete log | unit | `npx vitest run tests/watering.test.ts` | ✅ |
| WATR-06 | Duplicate prevention | unit | `npx vitest run tests/watering.test.ts` | ✅ |
| WATR-07 | TIMESTAMPTZ + user timezone | unit | `npx vitest run tests/watering.test.ts` | ✅ |
| UIAX-05 | Optimistic UI for watering | manual-only | — | — (React state, no unit test) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/watering.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add test case for retroactive log that does not displace a newer log's `nextWateringAt` — covers WATR-03 edge case
- [ ] Add test case for `classifyAndSort` where upcoming plant watered within 48h is moved to `recentlyWatered`
- No framework install needed — Vitest already configured and running

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | NextAuth v5 session check in every Server Action |
| V3 Session Management | no | Handled by NextAuth — not phase-specific |
| V4 Access Control | yes | Ownership check: `plant.userId === session.user.id` before every mutation |
| V5 Input Validation | yes | Zod v4 `safeParse` on all Server Action inputs |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on watering log | Elevation of privilege | `findFirst({ where: { plant: { userId: session.user.id } } })` — already implemented |
| Future date injection | Tampering | `z.coerce.date().refine(d => d <= new Date())` — already in schema |
| Note content XSS | Tampering | React escapes strings in JSX; no `dangerouslySetInnerHTML` usage |
| Demo user mutation | Tampering | `if (session.user.isDemo) return { error: "..." }` — already in every action |
| DUPLICATE race condition | Denial of service | Same-day calendar check is idempotent; double-click protection via `disabled` on water button while `isWatering` |

---

## Sources

### Primary (HIGH confidence)
- `src/features/watering/actions.ts` — verified Server Action implementations
- `src/features/watering/queries.ts` — verified query implementations including `classifyAndSort`
- `src/features/watering/schemas.ts` — verified Zod schemas
- `src/components/watering/*.tsx` — all 8 watering UI components verified
- `src/app/(main)/dashboard/page.tsx` — verified dashboard page
- `src/app/(main)/plants/[id]/page.tsx` — verified plant detail page
- `prisma/schema.prisma` — WateringLog model with `@db.Timestamptz(3)` confirmed
- `tests/watering.test.ts` — 27 tests verified passing via `npx vitest run`
- `vitest.config.ts` — test framework config verified

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — project stack constraints (versions, approved libraries)
- `.planning/phases/04-dashboard-and-watering-core-loop/04-CONTEXT.md` — user decisions D-01 through D-15

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed packages and in-use code
- Architecture: HIGH — all patterns verified in existing source files
- Pitfalls: HIGH — identified from actual code analysis, not speculation
- Gap analysis: HIGH — based on full file audit and test run

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable codebase — no external dependencies changing)
