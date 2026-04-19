# Phase 5: Household Notifications - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Workstream:** `household`

<domain>
## Phase Boundary

Deliver the render side + assignee gate for the notifications surface Phase 3 stubbed: (1) modify `getReminderCount` / `getReminderItems` bodies to gate on the current Cycle's assignee so only the assignee sees badge counts and dropdown items; (2) render four dashboard banners (cycle-start, reassignment, passive status with next-up preview, all-unavailable fallback) driven by the current Cycle row + the `HouseholdNotification` rows Phase 3 emits; (3) unify `NotificationBell` + `BottomTabBar` Alerts into one position-responsive component whose dropdown merges plant reminders with current-cycle notifications; (4) add the `HouseholdNotification.readAt` column Phase 3 D-17 explicitly scheduled for this phase, and wire a mark-read-on-open path so the bell behaves like an inbox.

**Explicitly not in this phase:** new notification types; cycle-event `payload` snapshots; `dismissedAt` column; notification history surface (viewing read/old rows); in-layout banners on non-dashboard pages; email delivery; any change to the Phase 3 transition writer logic; any new Prisma tables.

</domain>

<decisions>
## Implementation Decisions

### Schema extensions (one additive migration)

- **D-01:** **Add `readAt DateTime?`** column to `HouseholdNotification` (Phase 3 D-17 execution). Type `@db.Timestamptz(3)` matching the `createdAt` convention. Nullable — unread by default.
- **D-02:** **Add `@@index([recipientUserId, readAt])`** on `HouseholdNotification` to serve the badge-count query (`count WHERE recipientUserId = :me AND readAt IS NULL AND cycleId = :currentCycleId`).
- **D-03:** **No `payload Json?` column.** Banner copy pulls prior/next assignee names via `cycle.household.members` joins; cycle end date is `cycle.endDate` on the row; due-plant count is computed dynamically by `getReminderCount`. Read-time derivation is adequate for v1 — we explicitly reject snapshotting. Defers the "audit trail of what the banner said at emit time" use case.
- **D-04:** **No `dismissedAt` column.** `readAt` covers the "I've seen this" semantic. No separate manual-dismiss flow; the dropdown open event is the implicit acknowledgement.
- **D-05:** **No new notification types this phase.** Render the five types Phase 3 already emits: `cycle_started`, `cycle_reassigned_manual_skip`, `cycle_reassigned_auto_skip`, `cycle_reassigned_member_left`, `cycle_fallback_owner`. All have non-null `cycleId`, so roadmap IN-01 (NULLS NOT DISTINCT concern on `@@unique([cycleId, recipientUserId, type])`) is a no-op for this phase.
- **D-06:** **Previous-assignee banner-clearing is derivational, not stored.** Banners render when `notification.cycleId === currentActiveCycle.id`. When a new cycle transitions in, the outgoing cycle's notifications stop matching the filter naturally — no bulk-clear, no trigger, no extra write path.

### Assignee reminder gate (Phase 2 D-14 body rewrite)

- **D-07:** **`getReminderCount` and `getReminderItems` signatures get a new `userId: string` parameter**, placed after `householdId`. Two call sites in `src/app/(main)/h/[householdSlug]/layout.tsx` pass `sessionUser.id`. Signature becomes `getReminderCount(householdId, userId, todayStart, todayEnd)` and `getReminderItems(householdId, userId, todayStart, todayEnd)`. Phase 2 D-14's "callers unchanged structurally" intent is preserved — same file, same call shape, one more argument. Pure function, no hidden `auth()` coupling.
- **D-08:** **Gate shape = pre-check with `getCurrentCycle`, early-return.**
  ```ts
  const cycle = await getCurrentCycle(householdId);
  if (!cycle || cycle.status === 'paused') return <paused branch>;
  if (cycle.assignedUserId !== userId) return 0;
  // existing plant.count query unchanged
  ```
  No relation-filter nesting on the plant query's where-clause. Keeps the existing reminder filter readable, keeps branch logic grep-able, composes with the banner that already needs the cycle.
- **D-09:** **Paused-cycle branch = count-everyone fallback.** When the household's current Cycle has `status = 'paused'` (all-unavailable + owner also unavailable, per Phase 3 D-20 reconciliation), every member sees the full household reminder count / items — i.e., Phase 2 D-15 pre-gate behavior resumes. Deliberate deviation from a strict reading of Pitfall 13 ("non-assignee gets 0") which applies only to active cycles. Justification: a paused cycle means no one is formally responsible, plants shouldn't go silent, someone needs to step up and the badge is the prompt. Active-cycle non-assignees still see 0.
- **D-10:** **No-active-cycle branch = 0 for all.** If `getCurrentCycle` returns null (should not happen post-Phase-3 since cycle #1 is bootstrapped at household creation, but defensive), return 0 / empty. Does not use the paused fallback.

### Banner architecture (dashboard-only, four components)

- **D-11:** **All banners render inside `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` only.** Not in the layout, not on `/plants`, not on `/rooms`, not on plant detail pages. Matches HNTF-02's literal "cycle-start banner notification on their dashboard" wording and keeps other pages calm.
- **D-12:** **Four separate banner components**, all under `src/components/household/`:
  1. `cycle-start-banner.tsx` — renders when viewer has an unread `cycle_started` notification for the current active cycle. Shows due-plant count (from `getReminderCount`) and cycle end date (from `cycle.endDate`). (HNTF-02)
  2. `reassignment-banner.tsx` — renders when viewer has an unread `cycle_reassigned_*` notification for the current cycle. Type-branched copy: "Alice skipped — you're up", "Alice is away — you're up", "Alice left — you're up". Uses joined member names for prior assignee. (HNTF-03)
  3. `passive-status-banner.tsx` — renders for non-assignees whenever the active cycle exists and no personal event is shown above. Shows "[Assignee] is responsible this week" and "[Next] is next". (HNTF-04)
  4. `fallback-banner.tsx` — renders when `cycle.transitionReason === 'all_unavailable_fallback'` OR when `cycle.status === 'paused'`. Warning-amber styling. Owner variant: "Everyone's unavailable this week — you're covering." Non-owner variant: "No one's available — [Owner] is covering." (AVLB-05)
- **D-13:** **Render order on the dashboard Server Component** (top to bottom): `FallbackBanner` (if applicable) → `CycleStartBanner` OR `ReassignmentBanner` (mutually exclusive per recipient; at most one unread transition event per cycle, per Phase 3 D-19's unique index) → `PassiveStatusBanner` (only if no assignee-role banner is shown AND not assignee) → existing dashboard urgency-first sections.
- **D-14:** **Next-assignee preview (HNTF-04) uses `findNextAssignee` walker** from `src/features/household/cycle.ts` (Phase 3 D-20 export). Called at render time with the current cycle context; returns the member who would become assignee at the next boundary given today's availability state. Truthful preview — skipped members show correctly, owner fallback surfaces when all-unavailable. Phase 3 D-20 short-circuit behavior (single-member = self, fallback:false) applies.
- **D-15:** **FallbackBanner placement = first-in-order, inline, warning color.** Inside the dashboard page's banner region, renders above all other banners with amber/warning variant styling. Not sticky, scrolls with content. No new UI primitive — Tailwind warning palette on the existing banner shell. Matches the visual precedent set by the demo-mode strip in the outer layout.
- **D-16:** **Banners are read-only UI — they do NOT write to the DB on render.** Mark-read-on-open lives on the bell (D-19), not on banner mount. Rationale: dashboard render != acknowledgement; users scroll past banners all the time. Unread state persists until the bell dropdown opens.

### Unified NotificationBell + mobile surface rework

- **D-17:** **Single `NotificationBell` component, position-responsive.** Rendered in top-nav (desktop) next to `UserMenu`, and in the BottomTabBar's rightmost slot (mobile) where the "Alerts" tab used to live. The "Alerts" concept as a separate surface is deleted. One component, two placements, same dropdown content.
- **D-18:** **Merged dropdown feed.** Dropdown content combines plant reminders (from `getReminderItems`) and current-cycle `HouseholdNotification` rows for the viewer, ordered: overdue plants → due-today plants → unread cycle events (newest first) → read cycle events for the current cycle (muted styling). Alphabetical fallback for same-bucket sorts. Cycle events from prior cycles never appear (filter: `notification.cycleId === currentActiveCycle.id`).
- **D-19:** **Badge count = `reminderCount + unreadCycleEventCount`.** One unified number. `unreadCycleEventCount = db.householdNotification.count({ where: { recipientUserId, readAt: null, household: { id: currentHouseholdId }, cycle: { status: 'active' } } })`. No separate dot indicator. Badge honest: "things in this bell I haven't watered or read."
- **D-20:** **Mark-read-on-open via `markNotificationsRead` Server Action.** When the dropdown opens on the client, fire `markNotificationsRead(householdId, notificationIds[])` via `useTransition`. Server Action: standard 7-step template, authz = `requireHouseholdAccess` + `recipientUserId === session.user.id` row-filter, writes `updateMany({ where: { id: { in: ids }, recipientUserId, readAt: null }, data: { readAt: new Date() } })`, calls `revalidatePath` on the household's root path so the badge recounts on next navigation. Idempotent on re-open (already-read rows are filtered out by the `readAt: null` predicate; updateMany zero-counts safely).
- **D-21:** **BottomTabBar tab set stays at 4:** Dashboard | Plants | Rooms | Bell. The "Alerts" tab is refactored to become the bell — same slot, same DropdownMenu primitive, same trigger button hit-target — but rendered by the shared `NotificationBell` component instead of duplicated inline dropdown code.
- **D-22:** **Shared dropdown content extracted.** `src/components/reminders/notification-bell.tsx` becomes the canonical bell component. The inline dropdown code currently living in `src/components/layout/bottom-tab-bar.tsx` (lines 62-112) is deleted; BottomTabBar imports and renders `<NotificationBell variant="mobile" />`. Desktop top-nav renders `<NotificationBell variant="desktop" />`. The `variant` prop tweaks styling (trigger button shape, dropdown alignment) but the content and data-fetching are identical.

### Test strategy (mocked Prisma, consistent with Phase 2 D-16/D-17)

- **D-23:** **Assignee reminder gate tests = mocked Prisma, four branches** (Phase 2 D-16 / D-17 precedent — same-shape branch-logic assertions):
  1. Active cycle, viewer is assignee → `plant.count` called with expected where-clause; returns non-zero.
  2. Active cycle, viewer is non-assignee → `plant.count` NOT called; returns 0 (or `[]` for items).
  3. Paused cycle → `plant.count` called regardless of viewer (count-everyone fallback); returns household-wide count.
  4. No active cycle (null) → returns 0 / `[]` for all viewers.
- **D-24:** **`markNotificationsRead` authz test = mocked Prisma** (Phase 2 D-17 precedent): non-member viewer gets `ForbiddenError`; member-but-not-recipient gets zero rows updated (filtered by `recipientUserId`); authenticated recipient path updates `readAt` on expected rows.
- **D-25:** **Banner rendering tests = React component unit tests**. For each of the four banner components: assert correct branch selection given `{ cycle, notification?, viewerRole, viewerIsAssignee, nextAssignee? }` inputs. One test file per banner. No real DB — props drive the render.
- **D-26:** **No real-Prisma integration test this phase.** Unlike Phase 4 D-23 (concurrency) or D-27 (cross-row transitions), Phase 5's gate is TypeScript branch logic over read queries. Adding a real-DB test doesn't pay for itself here. Revisit only if audit surfaces a SQL-semantics gap.

### Query file layout

- **D-27:** **`getReminderCount` / `getReminderItems` body rewrite lives in-place** at `src/features/reminders/queries.ts`. No file moves. The cycle-gate helper (if extracted from the body) stays local to the same file — it's reminder-side logic, not household-side.
- **D-28:** **Unread-cycle-event count helper lives in `src/features/household/queries.ts`**: `getUnreadCycleEventCount(householdId, userId)` returning `number`. Consumed by the layout alongside `getReminderCount` to compute the badge (D-19). Keeps reminder queries free of `HouseholdNotification` imports; keeps household queries free of `Plant`/`Reminder` imports.
- **D-29:** **Banner-feeding query lives in `src/features/household/queries.ts`**: `getCycleNotificationsForViewer(householdId, userId, cycleId)` returning the viewer's notifications for the given cycle with relevant joins (`cycle`, `cycle.household.members`). Consumed by the dashboard Server Component to render the four banners; the cycle is already fetched by the layout via `getCurrentCycle` and passed through.

### Claude's Discretion

- Exact Tailwind color tokens for the four banner variants. Use existing semantic tokens where possible (accent, destructive, muted, warning-amber); pick new ones only if the palette is missing a fit.
- Whether `getUnreadCycleEventCount` and `getCycleNotificationsForViewer` are two functions or one function that returns both (count + rows). Recommend two — count is consumed by the layout's bell-badge Promise.all; rows are consumed by the dashboard Server Component. Different call sites, different lifecycles.
- Copy strings for the five notification-type variants in the reassignment banner. Content-only.
- Exact `useTransition` wiring on bell dropdown open. Recommended: `onOpenChange` handler on `DropdownMenu` fires `startTransition(() => markNotificationsReadAction(...))` with the notification id list snapshotted before the state update. Alternatives (useEffect, form action) are equivalent.
- Whether `markNotificationsRead` takes `notificationIds[]` or `{ cycleId }` as its input. Recommend `notificationIds[]` for explicit grep-ability; `{ cycleId }` is a one-liner shorthand that couples the action to the caller's cycle-filter choice.
- Whether the passive status banner shows the next assignee for single-member households (it's always self). Recommend hiding the "is next" line when `memberCount === 1`; the passive banner copy also becomes less interesting in that case (consider suppressing the whole banner when you're the sole member and you're the assignee).
- Exact BottomTabBar mobile placement of the bell — replacing the Alerts button in-flow (recommended, preserves tab spacing) vs floating-action-button at bottom-right corner (more visual weight, z-index concerns). Recommend in-flow replacement per D-21.
- Whether to fix any adjacent v1 tech debt (`completeOnboarding` missing `revalidatePath('/plants')`, dueToday boundary using `<` instead of `<=` — PROJECT.md known-tech-debt list) opportunistically in this phase. Recommend: skip unless touching the same file; Phase 5 is already compound.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/workstreams/household/ROADMAP.md` §Phase 5 — Goal, success criteria, pitfall flags (13, 14), v1 tech-debt scope note, IN-01 NULLS-NOT-DISTINCT carry-over flag
- `.planning/workstreams/household/REQUIREMENTS.md` §Assignee-scoped notifications — HNTF-01, HNTF-02, HNTF-03, HNTF-04

### Pitfalls (binding)
- `.planning/research/PITFALLS.md` §Pitfall 13 — `getReminderCount` assignee gate; drives D-07, D-08, D-09, D-23 (with D-09's paused-cycle deviation documented)
- `.planning/research/PITFALLS.md` §Pitfall 14 — `HouseholdNotification` separate from `Reminder` at the data-model layer (UI dropdown merge in D-18 is distinct and compliant)

### Prior phase binding decisions (foundation this phase builds on)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-02 — `Cycle` schema fields (`assignedUserId`, `startDate`, `endDate`, `status`); banner data source
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-16..D-20 — `requireHouseholdAccess` guard contract for `markNotificationsRead` authz (D-24)
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-03 — layout chokepoint `src/app/(main)/h/[householdSlug]/layout.tsx`; bell + reminder queries already wired here
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-12 — 7-step Server Action template (binding for `markNotificationsRead` — D-20)
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-14 — reminder interface stability mandate; Phase 5 adds `userId` param (D-07) but preserves call-site structure
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-15 — pre-gate temporary regression; ended by D-08 with D-09 paused-cycle carve-out
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-16, D-17 — mocked-Prisma unit test precedent (binding for D-23, D-24)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-15 — "Phase 3 emits, Phase 5 renders" contract; binding for D-12, D-13
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-16 — single notification row per transition to incoming assignee; previous-assignee clearing is derivational; binding for D-06, D-13
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-17 — `HouseholdNotification` bare-minimum schema; Phase 5 adds `readAt` per scheduled extension (D-01)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-18 — five notification types emitted; Phase 5 renders all five without adding new ones (D-05)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-19 — `@@unique([cycleId, recipientUserId, type])` dedupe invariant; binding for D-13 (at most one transition-event banner per viewer per cycle)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-20 — `findNextAssignee` export; single-member short-circuit; owner-fallback reconciliation — binding for D-14 next-assignee preview and D-09/D-12-fallback paused/fallback branches
- `.planning/workstreams/household/phases/04-invitation-system/04-CONTEXT.md` §D-16 — `leaveHousehold` / `removeMember` call `transitionCycle(..., 'member_left')`; Phase 5 renders the `cycle_reassigned_member_left` row that write emits

### Project & tech stack
- `.planning/PROJECT.md` §Known tech debt — "NotificationBell hidden on mobile; BottomTabBar Alerts links to /dashboard"; v1 item addressed by D-17, D-21, D-22
- `.planning/PROJECT.md` §Current Milestone — "Assignee-scoped in-app notifications — daily due/overdue alerts routed to current assignee only; cycle-start and reassignment banners"
- `CLAUDE.md` §Technology Stack — Next.js 16 App Router (Server Components + Server Actions), Prisma 7, React 19.2 (`useTransition`), Zod v4
- `CLAUDE.md` §Stack Patterns — Server Components call Prisma directly; Server Actions + Zod + Prisma writes; `revalidatePath` on mutation

### Existing codebase anchor points
- `prisma/schema.prisma` §`model HouseholdNotification` (from Phase 3 migration) — Phase 5 adds `readAt DateTime? @db.Timestamptz(3)` + `@@index([recipientUserId, readAt])` (D-01, D-02)
- `src/features/reminders/queries.ts` — `getReminderCount` and `getReminderItems` bodies rewritten per D-07, D-08, D-09, D-10. Signature adds `userId` param.
- `src/features/household/queries.ts` — extended with `getUnreadCycleEventCount` (D-28) and `getCycleNotificationsForViewer` (D-29); `getCurrentCycle` (Phase 3 export) consumed by the gate
- `src/features/household/cycle.ts` — `findNextAssignee` (Phase 3 export) consumed by `PassiveStatusBanner` (D-14)
- `src/features/household/actions.ts` — extended with `markNotificationsRead` Server Action (D-20, D-24)
- `src/features/household/schema.ts` — Zod v4 schema for `markNotificationsRead` input (`{ householdId, notificationIds[] }` or `{ householdId, cycleId }` per Discretion)
- `src/features/household/guards.ts` — `requireHouseholdAccess` consumed by `markNotificationsRead`
- `src/app/(main)/h/[householdSlug]/layout.tsx` — call sites for reminder queries updated to pass `userId` (D-07); badge-count compute extended to sum `unreadCycleEventCount` (D-19); `NotificationBell` render slot unchanged
- `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` — banner region added; renders the four banner components in D-13 order; consumes `getCurrentCycle` + `getCycleNotificationsForViewer` + `findNextAssignee`
- `src/components/reminders/notification-bell.tsx` — becomes the canonical bell; gains `variant: "desktop" | "mobile"` prop (D-22); accepts merged feed items (reminders + cycle events); fires `markNotificationsRead` on open (D-20); mobile visibility flipped (D-17)
- `src/components/layout/bottom-tab-bar.tsx` — inline Alerts dropdown (current lines 62-112) deleted; Alerts tab slot renders `<NotificationBell variant="mobile" />` (D-21, D-22)
- `src/components/household/cycle-start-banner.tsx` — new (D-12)
- `src/components/household/reassignment-banner.tsx` — new (D-12)
- `src/components/household/passive-status-banner.tsx` — new (D-12)
- `src/components/household/fallback-banner.tsx` — new (D-12, D-15)
- `src/features/reminders/types.ts` — `ReminderItem` may be extended to a discriminated union over `"reminder" | "cycle_event"` for the merged feed, or a sibling type added; planner decides

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 3 `findNextAssignee`** (`src/features/household/cycle.ts`) — already tested; returns the next member respecting availability and owner-fallback. Consumed by `PassiveStatusBanner` (D-14).
- **Phase 3 `getCurrentCycle`** (`src/features/household/queries.ts`) — one-query lookup of the household's current active/paused cycle. Consumed by the assignee gate (D-08) and the dashboard Server Component.
- **Phase 1/3 `HouseholdNotification` model** — already has `recipientUserId`, `type`, `cycleId`, `createdAt`, `@@unique([cycleId, recipientUserId, type])`, `@@index([recipientUserId, createdAt])`. Phase 5 only adds `readAt` + one index.
- **Phase 2 `getReminderCount` / `getReminderItems`** (`src/features/reminders/queries.ts`) — existing body filters by `householdId` with enabled/snoozed reminder filter. Phase 5 wraps with assignee gate; plant query logic unchanged.
- **Phase 2 layout chokepoint** (`src/app/(main)/h/[householdSlug]/layout.tsx`) — already fetches user + today window + reminder count + items. Phase 5 adds `sessionUser.id` pass-through + `unreadCycleEventCount` + passes merged feed to `<NotificationBell />`.
- **Existing `NotificationBell`** (`src/components/reminders/notification-bell.tsx`) — current shape accepts `{ householdSlug, count, items }`. Phase 5 extends to accept cycle-event items and a `variant` prop (D-22).
- **Existing `BottomTabBar`** (`src/components/layout/bottom-tab-bar.tsx`) — 4-tab layout. Phase 5 refactors the 4th tab slot to render `<NotificationBell variant="mobile" />` and deletes the inline dropdown (D-21, D-22).
- **Demo-mode guard** (`if (session.user.isDemo) return { error }`) — carried into `markNotificationsRead` verbatim (Phase 7 will consolidate).
- **`useTransition`** (React 19.2, already available) — used to fire `markNotificationsRead` on bell open without blocking the UI (D-20).

### Established Patterns
- **Feature-folder pattern** — `src/features/household/` absorbs server-side additions; `src/features/reminders/` stays owner of `getReminderCount` / `getReminderItems` body rewrite (D-27, D-28, D-29).
- **Server Actions: 7-step template** (Phase 2 D-12) — `markNotificationsRead` conforms.
- **Hidden-field `householdId` form pattern** (Phase 2 D-04) — if `markNotificationsRead` is ever reached from a form (not the recommended useTransition path), the hidden-field convention applies.
- **`revalidatePath` on `/h/[slug]/`** — `markNotificationsRead` revalidates the household root so the bell badge recounts on next nav.
- **String status/type columns (not Prisma enums)** — `HouseholdNotification.type` stays a string, consistent with Phase 3 D-18.
- **Mocked-Prisma unit tests for shape/branch assertions** (Phase 2 D-16/D-17) — binding for D-23, D-24, D-25.
- **Server Component dashboard composition** — dashboard already renders Server Components; banners follow same pattern.

### Integration Points
- **Assignee gate integration** — `src/app/(main)/h/[householdSlug]/layout.tsx` threads `sessionUser.id` into both reminder calls; signature change is localized (D-07). Any other future call sites must pass `userId` too.
- **Bell badge compute** — layout's existing Promise.all becomes a 3-way parallel: `[getReminderCount, getReminderItems, getUnreadCycleEventCount]`; badge count = `reminderCount + unreadCycleEventCount` (D-19).
- **Dashboard banner region** — `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` renders banners above the existing urgency-first sections; cycle + viewer + notifications are fetched at the dashboard level.
- **`markNotificationsRead` call flow** — client bell component's `DropdownMenu.onOpenChange` handler captures visible unread ids → `startTransition(() => markNotificationsReadAction(...))` → Server Action updates rows + revalidates. Next navigation re-renders with updated `readAt`.
- **BottomTabBar composition** — tabs stay at 4: Dashboard | Plants | Rooms | Bell. Bell slot imports `NotificationBell` from `src/components/reminders/notification-bell.tsx` with `variant="mobile"` (D-21, D-22).
- **Phase 6 consumer interface** — `markNotificationsRead`, `getUnreadCycleEventCount`, `getCycleNotificationsForViewer`, the four banner components, and the unified `NotificationBell` are all consumed by Phase 6's dashboard polish + settings surfaces. Signatures locked this phase.
- **Phase 7 demo seeding** — demo household needs at least one `HouseholdNotification` row for the demo user to exercise the banner + merged feed. Phase 7 handles; Phase 5 leaves the type values stable (D-05) so demo copy doesn't drift.

</code_context>

<specifics>
## Specific Ideas

- **"One bell, position-responsive, merged feed"** — user-driven model established during Area 4 discussion. Mental anchor: Gmail/Slack/Linear have one notifications surface; this app should too. "Alerts" as a distinct concept is deleted from the app entirely. Downstream agents should not reintroduce a second notification surface.
- **`readAt` was scheduled for Phase 5, not reopened** — Phase 3 D-17 wrote "Phase 5 extends with `readAt`, `payload Json?`, dismissal columns." This phase executes the `readAt` piece and explicitly rejects `payload` and `dismissedAt`. Downstream agents should read D-01 through D-06 as executing D-17, not as adding unplanned schema.
- **Paused-cycle fallback (D-09)** — user-directed deviation from a strict reading of Pitfall 13. Justification captured in decision body: paused cycle = no one responsible = plants shouldn't go silent = count-everyone. Active-cycle non-assignee still sees 0. Do NOT re-litigate in planning.
- **Banner count is four, by viewer role × event type, not by data model** — four components because rendering logic differs meaningfully per case (different copy, different color, different data-source joins). The underlying store (`HouseholdNotification` + `Cycle`) is unified; the UI split is for grep-ability and per-case testing (D-12, D-25).
- **Badge unification matters** — `reminderCount + unreadCycleEventCount` is one number because users read the bell as one inbox. A separate dot would require either redundant signal or `readAt` semantics we already have for counting — so the unified count is both simpler and more honest (D-19).
- **Mark-read on bell open, NOT on banner render** (D-16, D-20). Dashboard render is not acknowledgement; bell-open is. This distinction matters because banners live on the dashboard which users scroll past frequently without engaging the bell.

</specifics>

<deferred>
## Deferred Ideas

- **`payload Json?` snapshot on HouseholdNotification** — rejected in favor of read-time derivation (D-03). Revisit only if audit-trail reconstruction of "what the banner said at emit time" becomes a requirement.
- **`dismissedAt` column / manual dismiss button** — rejected; `readAt` is sufficient for the "I've seen this" semantic (D-04). Revisit if users report they want to hide still-unread banners.
- **New notification types with `cycleId: null`** (household announcements unrelated to cycles) — out of scope (D-05). Would require the `NULLS NOT DISTINCT` carry-over (roadmap IN-01) to prevent duplicate rows.
- **Banners in layout (every page)** — rejected in favor of dashboard-only (D-11). Revisit if user feedback indicates reassignments are being missed.
- **One unified `CycleBanner` component with internal type-branching** — rejected in favor of four separate components (D-12) for grep-ability and per-case testing.
- **Floating-action-button (FAB) mobile bell** — rejected in favor of in-flow BottomTabBar slot replacement (D-21). FAB adds z-index complexity and steals real estate.
- **Real-Prisma integration test for the assignee gate** — rejected; gate is TypeScript branch logic, not SQL semantics (D-26). Revisit if audit surfaces a gap.
- **Dot indicator on bell separate from count badge** — rejected (D-19). Would need `readAt` semantics to be meaningful, which is exactly what the count gives us already.
- **Notification history view** (read rows from prior cycles) — out of phase scope. `readAt` enables it later; Phase 5 ships only the current-cycle filter.
- **Email delivery of cycle events** — deferred milestone (EMAIL-*).
- **Per-user notification preferences** (mute cycle events, opt into only reassignments, etc.) — deferred milestone (EMAIL-04 adjacent).
- **Mark-unread action** — no. Revisit if users ask.
- **Opportunistic fix of unrelated v1 tech debt** (completeOnboarding revalidatePath, dueToday boundary `<` vs `<=`) — deferred to a cleanup pass unless Phase 5 happens to touch the same file.
- **Next-assignee preview suppression for single-member households** — Claude's Discretion; recommended behavior captured but final call is the planner's.

</deferred>

---

*Phase: 05-household-notifications*
*Workstream: household*
*Context gathered: 2026-04-19*
