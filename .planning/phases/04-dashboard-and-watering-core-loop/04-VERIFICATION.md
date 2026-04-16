---
phase: 04-dashboard-and-watering-core-loop
verified: 2026-04-16T12:25:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the dashboard with a plant collection. Verify that plants appear in Overdue, Due Today, Upcoming, and Recently Watered sections with the correct urgency badges."
    expected: "Sections are present, counts are accurate, badges display correct labels (e.g., '3d overdue', 'Due today', 'In 5d', 'Watered X ago'). Section headers show counts in format 'Needs water (3)'."
    why_human: "Urgency grouping depends on live DB timestamps and the user_tz cookie. Cannot be verified without a running server and real data."
  - test: "Tap the water-drop button on a plant card. Observe the UI before the server response."
    expected: "Card immediately moves to the Recently Watered section with a fade/scale animation (transition-all duration-300). A success toast appears: '{name} watered! Next: {Month Day}'. The WaterButton shows a Loader2 spinner while pending."
    why_human: "Optimistic UI behavior requires live interaction. The animation (opacity-0 scale-95 on isRemoving) and transition ordering cannot be verified statically."
  - test: "Tap the water-drop button on a plant that was already watered today."
    expected: "Toast appears: 'Already logged! Edit from history if needed.' Card does NOT move to Recently Watered again."
    why_human: "Duplicate detection relies on live UTC day boundary check and toast rendering."
  - test: "Navigate to a plant detail page. Open the Timeline. Verify watering history entries appear newest-first with date, relative time, and optional note. Use the kebab menu to edit a log, then delete it with the confirmation dialog."
    expected: "History shows newest first. Edit opens 'Edit watering log' dialog pre-filled with existing date/note. Delete shows AlertDialog titled 'Delete watering log?' with cancel 'Keep log' and action 'Delete log'. After deletion, next watering date recalculates."
    why_human: "Dialog interaction, date pre-population, and cascade recalculation require live server state."
  - test: "On a plant detail page, click Log watering. Select a date in the past (e.g., 3 days ago). Verify the calendar blocks future dates. Submit and confirm the next watering date reflects the most recent log, not the retroactive one."
    expected: "Calendar prevents future date selection. After retroactive log, if a newer log already exists, nextWateringAt is based on the newer log. Success toast: '{name} watered on {Month Day}. Next: {Month Day}'."
    why_human: "Retroactive logging calendar UX and nextWateringAt recalculation outcome require live server actions and DB state."
  - test: "Test the dashboard on a narrow viewport (mobile, ~375px) and a wide viewport (>1024px)."
    expected: "Mobile: single-column card grid. Mid: 2-column grid (sm). Desktop: 3-column grid (lg). Cards have horizontal flex layout with leaf icon, plant info, badge, and water button. Touch targets are 44px minimum."
    why_human: "Responsive layout requires browser rendering. Tailwind breakpoints (sm:grid-cols-2 lg:grid-cols-3) cannot be verified by static analysis alone."
---

# Phase 4: Dashboard and Watering Core Loop Verification Report

**Phase Goal:** Users can see at a glance which plants need watering today and log it in one tap — the core value of the product
**Verified:** 2026-04-16T12:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard loads with plants grouped into Overdue, Due Today, Upcoming, and Recently Watered sections sorted by urgency | VERIFIED | `classifyAndSort` in `queries.ts` produces 4-group `DashboardResult`; `DashboardClient` merges overdue+dueToday+upcoming(daysUntil=0) into "Needs water", filters empty sections. `getDashboardPlants` called in `DashboardContent` with live `todayStart`/`todayEnd`. |
| 2 | User can mark a plant as watered in one tap from the dashboard; UI updates immediately with optimistic feedback and plant moves to correct section | VERIFIED | `DashboardClient.handleWater` uses `useOptimistic` + `startTransition`. `movePlantToRecentlyWatered` reducer with `alreadyInRecent` guard. `WaterButton` has `h-11 w-11`, `aria-label="Water {name}"`, `Loader2 animate-spin` during `isWatering`. `isRemoving` triggers `motion-safe:transition-all motion-safe:duration-300 opacity-0 scale-95`. |
| 3 | Next watering date recalculates automatically after logging (last watered + interval days) and is correct relative to user's local timezone | VERIFIED | All three actions (`logWatering`, `editWateringLog`, `deleteWateringLog`) call `addDays(mostRecent.wateredAt, plant.wateringInterval)` after re-querying `orderBy: { wateredAt: "desc" }`. `DashboardContent` computes `todayStart`/`todayEnd` via `toLocaleDateString("en-CA", { timeZone: userTz })`. `TimezoneSync` writes `user_tz` cookie; layout mounts it at line 53. |
| 4 | User can view a chronological watering history for each plant and can log a retroactive watering date | VERIFIED | `getTimeline(id, session.user.id)` in `plants/[id]/page.tsx` fetches `wateringLog.findMany` ordered `{ wateredAt: "desc" }`, merged with notes in `mergeTimeline`. `LogWateringDialog` Calendar has `disabled={(date) => date > new Date()}` with `weekStartsOn={1}` and defaults to `new Date()`. |
| 5 | User can edit or delete a mistaken watering log; duplicate logs within a short window are prevented | VERIFIED | `WateringHistoryEntry` has DropdownMenu with Edit (sets `editOpen`, opens `LogWateringDialog` in edit mode) and Delete (opens `AlertDialog` "Delete watering log?" / "Keep log" / "Delete log" variant="destructive"). `logWatering` duplicate check uses `setUTCHours(0,0,0,0)` UTC day boundary, returns `{ error: "DUPLICATE" }`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/features/watering/schemas.ts` | VERIFIED | Exports `logWateringSchema`, `editWateringLogSchema`, `LogWateringInput`, `EditWateringLogInput`. Correct `zod/v4` import. Both schemas have future-date refine and note max(280). |
| `src/features/watering/actions.ts` | VERIFIED | Exports `logWatering`, `editWateringLog`, `deleteWateringLog`, `loadMoreWateringHistory`. Auth check, demo block, ownership check, duplicate detection, retroactive-safe recalculation all present. |
| `src/features/watering/queries.ts` | VERIFIED | Exports `classifyAndSort`, `getDashboardPlants`, `getWateringHistory`. `classifyAndSort` is pure function with 4-group result, 48h override at lines 77-83. `getDashboardPlants` accepts `todayStart`/`todayEnd`. |
| `src/types/plants.ts` | VERIFIED | Exports `UrgencyGroup`, `DashboardPlant`, `PlantWithRelations`. `DashboardPlant` has `urgency: UrgencyGroup` and `daysUntil: number`. |
| `tests/watering.test.ts` | VERIFIED | 29 tests confirmed passing (via `npx vitest run`). Includes gap-closure tests: WATR-03 retroactive edge case and DASH-01 recentlyWatered classification. |
| `src/components/watering/dashboard-client.tsx` | VERIFIED | `useOptimistic(groups, movePlantToRecentlyWatered)` with `alreadyInRecent` guard. Three sections: "Needs water", "Upcoming", "Recently Watered". `.filter((s) => s.plants.length > 0)`. Imports and calls `logWatering`. |
| `src/components/watering/dashboard-plant-card.tsx` | VERIFIED | `flex items-center gap-4 p-4`, leaf avatar `h-10 w-10 bg-accent/10`, info block `flex-1 min-w-0 text-center truncate`, all 4 badge variants present, snooze pills `min-h-[44px] py-1.5`, `isRemoving` animation class. |
| `src/components/watering/dashboard-section.tsx` | VERIFIED | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`, `h2 text-base font-semibold` with count in `text-muted-foreground`, `Separator className="my-8"`. |
| `src/components/watering/water-button.tsx` | VERIFIED | `h-11 w-11` (44px), `aria-label="Water ${plantNickname}"`, `Loader2 animate-spin` when `isWatering`, disabled when loading. |
| `src/components/watering/timezone-sync.tsx` | VERIFIED | Sets `user_tz` cookie with `encodeURIComponent(tz)` via `document.cookie`. Also calls `updateTimezone` for DB persistence. Returns null (invisible client component). |
| `src/app/(main)/dashboard/page.tsx` | VERIFIED | `DashboardContent` reads `user_tz` cookie, computes `todayStart`/`todayEnd` via `toLocaleDateString("en-CA")`, calls `getDashboardPlants`, passes `groups` to `DashboardClient`. Wrapped in `<Suspense fallback={<DashboardSkeleton />}>`. Empty state "No plants yet" and `allCaughtUp` banner with `bg-accent/10`. |
| `src/app/(main)/layout.tsx` | VERIFIED | `<TimezoneSync />` mounted at line 53 (unconditionally inside layout, before header). |
| `src/components/watering/log-watering-dialog.tsx` | VERIFIED | Dual-mode (log/edit). Correct titles, cancel text ("Don't log"/"Discard changes"), submit text ("Log watering"/"Save changes"). Calendar `disabled={(date) => date > new Date()}`, `weekStartsOn={1}`. Input `maxLength={280}`, placeholder "Optional note (e.g. used filtered water)". DUPLICATE toast "Already logged! Edit from history if needed.". Edit success "Watering log updated." Submit button `bg-accent text-accent-foreground hover:bg-accent/90`. |
| `src/components/watering/watering-history.tsx` | VERIFIED | Paginated via `loadMoreWateringHistory(plantId, logs.length)`. "Load more" button conditional on `logs.length < total`. Renders `WateringHistoryEntry` with `key={log.id}`. |
| `src/components/watering/watering-history-entry.tsx` | VERIFIED | DropdownMenu with `MoreVertical` trigger `h-8 w-8`. "Edit" sets `editOpen`, "Delete" sets `deleteOpen`. AlertDialog "Delete watering log?" / "Keep log" / "Delete log" variant="destructive". Toast "Watering log deleted." Calls `deleteWateringLog`. |
| `src/app/(main)/plants/[id]/page.tsx` | VERIFIED | Calls `getTimeline(id, session.user.id)`, destructures `{ entries: timelineEntries, total: timelineTotal }`, passes to `PlantDetail`. Auth check, `notFound()` for missing plant. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `dashboard/page.tsx` | `queries.ts:getDashboardPlants` | Called in `DashboardContent` | WIRED | Line 65: `getDashboardPlants(userId, todayStart, todayEnd)` |
| `dashboard/page.tsx` | `dashboard-client.tsx:DashboardClient` | `groups` prop | WIRED | Line 106: `<DashboardClient groups={groups} isDemo={isDemo} />` |
| `dashboard-client.tsx` | `actions.ts:logWatering` | `handleWater` via `startTransition` | WIRED | Line 89: `const result = await logWatering({ plantId: plant.id })` |
| `layout.tsx` | `timezone-sync.tsx:TimezoneSync` | Mounted in layout JSX | WIRED | Line 53: `<TimezoneSync />` |
| `actions.ts` | `schemas.ts:logWateringSchema` | `safeParse` validation | WIRED | Line 15: `logWateringSchema.safeParse(data)` |
| `actions.ts` | `@/lib/db` | Prisma CRUD | WIRED | `db.wateringLog.create`, `db.wateringLog.findFirst`, `db.plant.update` all present |
| `queries.ts` | `types/plants.ts:DashboardPlant` | Return type | WIRED | `DashboardPlant` imported and used as array element type in `DashboardResult` |
| `plants/[id]/page.tsx` | `notes/queries.ts:getTimeline` | Timeline integration | WIRED | Line 27: `getTimeline(id, session.user.id)` — returns watering + notes unified |
| `watering-history-entry.tsx` | `log-watering-dialog.tsx` | `editLog` prop in edit mode | WIRED | `<LogWateringDialog editLog={{ id, wateredAt, note }} open={editOpen} onOpenChange={setEditOpen} />` |
| `watering-history-entry.tsx` | `actions.ts:deleteWateringLog` | Kebab delete handler | WIRED | `const result = await deleteWateringLog(log.id)` |
| `log-watering-dialog.tsx` | `actions.ts:logWatering` and `editWateringLog` | Form `onSubmit` | WIRED | Both actions imported and called in `onSubmit` based on `isEditMode` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `dashboard-client.tsx` | `groups` (DashboardPlant groups) | `getDashboardPlants(userId, todayStart, todayEnd)` in `DashboardContent` | Yes — `db.plant.findMany` with `include: { wateringLogs: { take: 1 } }` | FLOWING |
| `dashboard/page.tsx` | `todayStart`/`todayEnd` | `user_tz` cookie + `toLocaleDateString("en-CA")` | Yes — live computation from cookie | FLOWING |
| `watering-history.tsx` | `logs` / `total` | `initialLogs`/`totalCount` from `getTimeline` call site, `loadMoreWateringHistory` for pagination | Yes — `db.wateringLog.findMany` in `getTimeline` | FLOWING |
| `dashboard-plant-card.tsx` | `plant` (DashboardPlant) | Passed from `DashboardClient` `optimisticGroups` | Yes — originates from DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 29 watering unit tests pass | `npx vitest run tests/watering.test.ts` | 29 passed (1 file) | PASS |
| WATR-03 edge case: retroactive log uses newest existing log | Test: "retroactive log does not change nextWateringAt when a newer log exists" | Included in 29 passing | PASS |
| DASH-01 edge case: upcoming plant watered within 48h → recentlyWatered | Test: "upcoming plant watered within 48h is classified as recentlyWatered" | Included in 29 passing | PASS |
| `classifyAndSort` is a pure function (no DB required) | Verified by test structure — no DB mock needed for `classifyAndSort` tests | Confirmed | PASS |
| Dashboard page computes timezone boundaries from cookie | `todayStart = new Date(Date.UTC(year, month-1, day))` derived from `toLocaleDateString("en-CA", { timeZone: userTz })` | Verified in source | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DASH-01 | 04-01 | Urgency-first dashboard sections: Overdue, Due Today, Upcoming, Recently Watered | SATISFIED | `classifyAndSort` 4-group output; `DashboardClient` section grouping; `getDashboardPlants` wires DB to UI |
| DASH-02 | 04-02 | One-tap watering from dashboard | SATISFIED | `WaterButton` (44px), `handleWater`, `logWatering` action wired via `startTransition` |
| DASH-03 | 04-02 | Auto-recalculate + immediate UI update | SATISFIED | `useOptimistic` + `movePlantToRecentlyWatered`; `revalidatePath("/dashboard")` in `logWatering` |
| DASH-04 | 04-02 | Fast load with accurate counts | SATISFIED | `Suspense` + `DashboardSkeleton` (2 sections x 3 cards); section count in header `({plants.length})` |
| DASH-05 | 04-02 | Mobile and desktop responsive | SATISFIED | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` in `DashboardSection` |
| WATR-01 | 04-01 | Watering interval + calculated next watering date | SATISFIED | `Plant.wateringInterval Int`, `Plant.nextWateringAt DateTime? @db.Timestamptz(3)`; `DashboardPlant.daysUntil` |
| WATR-02 | 04-01 | next watering = last watered + interval | SATISFIED | `addDays(mostRecent.wateredAt, plant.wateringInterval)` in all 3 actions |
| WATR-03 | 04-01, 04-03 | Retroactive logging with optional date | SATISFIED | `logWateringSchema.wateredAt` optional; `logWatering` creates log then re-queries `orderBy: { wateredAt: "desc" }`; Calendar with future-date disable |
| WATR-04 | 04-03 | Chronological watering history per plant | SATISFIED | `getTimeline` queries `wateringLog.findMany` ordered `{ wateredAt: "desc" }`; `WateringHistory` with Load more; `plants/[id]/page.tsx` passes `timelineEntries` to `PlantDetail` |
| WATR-05 | 04-01, 04-03 | Edit/delete watering log | SATISFIED | `editWateringLog` + `deleteWateringLog` actions with ownership checks; `WateringHistoryEntry` kebab menu + `LogWateringDialog` edit mode + `AlertDialog` delete confirmation |
| WATR-06 | 04-01, 04-03 | Duplicate prevention | SATISFIED | UTC day boundary check (`setUTCHours(0,0,0,0)`), `{ error: "DUPLICATE" }` return; dialog toast "Already logged! Edit from history if needed." |
| WATR-07 | 04-01, 04-02 | TIMESTAMPTZ storage; timezone-aware "due today" | SATISFIED | `WateringLog.wateredAt @db.Timestamptz(3)`, `Plant.nextWateringAt @db.Timestamptz(3)`; `user_tz` cookie → `todayStart`/`todayEnd` UTC boundaries |
| UIAX-05 | 04-02 | Optimistic UI for watering log | SATISFIED | `useOptimistic` + `startTransition`; card fade/scale on `isRemoving`; spinner on `isWatering` |

**All 13 requirements satisfied.** No orphaned requirements (REQUIREMENTS.md maps exactly DASH-01..05, WATR-01..07, UIAX-05 to Phase 4).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `timezone-sync.tsx` | No error handling when `Intl.DateTimeFormat` fails (browser API) | Info | Extremely rare; defaults to UTC in `DashboardContent` anyway |
| `log-watering-dialog.tsx` | Success toast in log mode uses `format(wateredAt, "MMMM d")` — differs from dashboard toast `format(result.nextWateringAt, "MMM d")` | Info | Minor copywriting inconsistency between two watering paths; both are functional |

No stub patterns found. No hardcoded empty data arrays that flow to rendering. No `TODO`/`FIXME`/`PLACEHOLDER` comments in any of the 16 verified files.

### Human Verification Required

#### 1. Dashboard Urgency Sections with Real Data

**Test:** Open the dashboard with a plant collection (at least one overdue, one due today, one upcoming). Verify sections appear with correct titles, accurate counts, and correct badge labels.
**Expected:** Sections "Needs water (N)", "Upcoming (N)", "Recently Watered (N)" visible. Badges: "3d overdue", "Due today", "In 2d", "Watered 5 hours ago".
**Why human:** Requires live DB timestamps and `user_tz` cookie. Static verification cannot confirm classification boundaries at runtime.

#### 2. One-Tap Watering Optimistic UI

**Test:** Tap the water-drop button on a plant card. Observe the animation before the server response arrives.
**Expected:** Card immediately starts to fade and scale down (opacity-0 scale-95). Plant moves to Recently Watered section. Success toast: "{name} watered! Next: Apr 23".
**Why human:** Animation frame timing and optimistic state transition require browser rendering. Code paths are wired but visual behavior must be confirmed.

#### 3. Duplicate Detection Toast

**Test:** Tap the water-drop button on a plant already watered today (same UTC calendar day).
**Expected:** Toast: "Already logged! Edit from history if needed." Card does NOT animate or move.
**Why human:** UTC day boundary depends on live clock. Requires real data state.

#### 4. Watering History Edit and Delete via Kebab Menu

**Test:** Navigate to plant detail. In the Timeline, open the kebab (three-dot) menu on a watering entry. Edit the date and note; save. Then delete a different entry using the confirmation dialog.
**Expected:** Edit opens "Edit watering log" dialog pre-filled with existing date. Save shows "Watering log updated." toast. Delete shows AlertDialog titled "Delete watering log?", cancel "Keep log", confirm "Delete log" with destructive styling. Next watering date recalculates after deletion.
**Why human:** Dialog pre-population, cascade recalculation, and UI state after confirmation require live server interaction.

#### 5. Retroactive Logging via Calendar

**Test:** On plant detail, click "Log watering". Verify future dates are blocked (grayed out). Select a date 3 days ago and submit. Check the resulting next watering date.
**Expected:** Calendar grays out dates after today. Submit shows toast with log date and computed next date. If a newer log already exists, next watering date is based on the newest log, not the retroactive one.
**Why human:** Calendar UI interaction and retroactive recalculation outcome require live server actions and DB state verification.

#### 6. Responsive Layout at Mobile and Desktop Breakpoints

**Test:** Resize browser window from ~375px (mobile) to >1024px (desktop). Observe card grid columns and card layout.
**Expected:** Mobile: 1 column. Tablet (sm, ~640px): 2 columns. Desktop (lg, ~1024px): 3 columns. Card layout is horizontal (flex row): icon, text info, badge, water button.
**Why human:** Tailwind responsive breakpoints require browser rendering to confirm.

### Gaps Summary

No automated gaps found. All 5 roadmap success criteria are verified as present and correctly wired in the codebase. All 13 assigned requirements (DASH-01..05, WATR-01..07, UIAX-05) have supporting implementation evidence. The 29 unit tests pass. The 6 human verification items above are required before this phase can be marked fully complete — they cover behaviors that depend on browser rendering, live DB state, real-time UI transitions, and runtime cookie values that cannot be confirmed by static code analysis.

---

_Verified: 2026-04-16T12:25:00Z_
_Verifier: Claude (gsd-verifier)_
