# Phase 5: Household Notifications - Research

**Researched:** 2026-04-19
**Domain:** Assignee-scoped in-app notifications (reminder gate + banners + unified bell) on Next.js 16 App Router + Prisma 7 + React 19.2
**Confidence:** HIGH (all decisions are pre-locked in CONTEXT.md; research verifies the codebase contract, library mechanics, and test patterns supporting each decision).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema extensions (one additive migration):**
- **D-01:** Add `readAt DateTime?` column to `HouseholdNotification`. Type `@db.Timestamptz(3)`. Nullable — unread by default.
- **D-02:** Add `@@index([recipientUserId, readAt])` on `HouseholdNotification` to serve badge-count query.
- **D-03:** No `payload Json?` column. Banner copy derives at read time from joins.
- **D-04:** No `dismissedAt` column. `readAt` covers "I've seen this" semantic.
- **D-05:** No new notification types. Render the five Phase 3 emits (`cycle_started`, `cycle_reassigned_manual_skip`, `cycle_reassigned_auto_skip`, `cycle_reassigned_member_left`, `cycle_fallback_owner`). All have non-null `cycleId` — roadmap IN-01 is a no-op.
- **D-06:** Previous-assignee banner-clearing is derivational (filter by `notification.cycleId === currentActiveCycle.id`), not stored.

**Assignee reminder gate:**
- **D-07:** `getReminderCount` and `getReminderItems` gain a `userId: string` parameter (after `householdId`): `getReminderCount(householdId, userId, todayStart, todayEnd)`. Two layout call sites updated.
- **D-08:** Gate shape = pre-check with `getCurrentCycle` + early-return. No relation-filter nesting.
- **D-09:** Paused-cycle branch = count-everyone fallback (every member sees full household reminder count). Deliberate deviation from Pitfall 13.
- **D-10:** No-active-cycle branch = 0 for all (should not happen post-Phase-3).

**Banner architecture (dashboard-only, four components under `src/components/household/`):**
- **D-11:** All banners render in `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` only.
- **D-12:** Four separate components — `cycle-start-banner.tsx` (HNTF-02), `reassignment-banner.tsx` (HNTF-03), `passive-status-banner.tsx` (HNTF-04), `fallback-banner.tsx` (AVLB-05).
- **D-13:** Render order: FallbackBanner → CycleStartBanner OR ReassignmentBanner → PassiveStatusBanner → existing dashboard sections.
- **D-14:** Next-assignee preview uses `findNextAssignee` walker from `src/features/household/cycle.ts`.
- **D-15:** FallbackBanner = first-in-order, inline, warning-amber styling.
- **D-16:** Banners are read-only UI — they do NOT write to the DB on render.

**Unified NotificationBell + mobile surface rework:**
- **D-17:** Single `NotificationBell` component, position-responsive. Top-nav (desktop) + BottomTabBar rightmost slot (mobile). "Alerts" concept deleted.
- **D-18:** Merged dropdown feed — plant reminders + current-cycle HouseholdNotification rows; order: overdue → due-today → unread cycle events (newest first) → read cycle events (muted).
- **D-19:** Badge count = `reminderCount + unreadCycleEventCount` (one unified number).
- **D-20:** Mark-read-on-open via `markNotificationsRead` Server Action. `updateMany({ where: { id: { in: ids }, recipientUserId, readAt: null }, data: { readAt: new Date() } })`. Calls `revalidatePath` on household root.
- **D-21:** BottomTabBar tab set stays at 4: Dashboard | Plants | Rooms | Bell.
- **D-22:** Shared dropdown extracted. `src/components/reminders/notification-bell.tsx` becomes canonical bell. BottomTabBar renders `<NotificationBell variant="mobile" />`; desktop renders `<NotificationBell variant="desktop" />`.

**Test strategy:**
- **D-23:** Assignee reminder gate = mocked Prisma, four branches.
- **D-24:** `markNotificationsRead` authz test = mocked Prisma.
- **D-25:** Banner rendering tests = React component unit tests; one file per banner.
- **D-26:** No real-Prisma integration test this phase.

**Query file layout:**
- **D-27:** Reminder query body rewrite in-place at `src/features/reminders/queries.ts`.
- **D-28:** `getUnreadCycleEventCount(householdId, userId): Promise<number>` lives in `src/features/household/queries.ts`.
- **D-29:** `getCycleNotificationsForViewer(householdId, userId, cycleId)` lives in `src/features/household/queries.ts`.

### Claude's Discretion

- Exact Tailwind color tokens for the four banner variants (prefer existing semantic tokens).
- `getUnreadCycleEventCount` + `getCycleNotificationsForViewer` as two functions or one (recommend two — different call sites, different lifecycles).
- Copy strings for the five reassignment banner variants.
- Exact `useTransition` wiring on bell dropdown open (recommend `onOpenChange` on `DropdownMenu` + `startTransition`).
- Input shape of `markNotificationsRead`: `{ householdId, notificationIds[] }` vs `{ householdId, cycleId }` — recommend `notificationIds[]`.
- Passive status banner suppression for single-member households.
- BottomTabBar mobile bell placement: in-flow (recommended) vs FAB.
- Whether to opportunistically fix adjacent v1 tech debt — recommend skip.

### Deferred Ideas (OUT OF SCOPE)

- `payload Json?` audit-trail snapshot
- `dismissedAt` column / manual dismiss button
- New notification types with `cycleId: null` (household announcements)
- Layout-wide banners (non-dashboard pages)
- One unified `CycleBanner` with internal type-branching
- Floating-action-button mobile bell
- Real-Prisma integration test for assignee gate
- Dot indicator on bell separate from count
- Notification history view (read rows from prior cycles)
- Email delivery (EMAIL-*)
- Per-user notification preferences
- Mark-unread action
- Opportunistic fix of unrelated v1 tech debt (unless same file touched)
- Next-assignee preview suppression for single-member household (Claude's Discretion)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HNTF-01 | Only the current assignee sees daily due+overdue reminder counts; non-assignees see 0 | D-07..D-10 gate; `getCurrentCycle` returns current Cycle (Phase 3); `plant.count` preserves Phase 2 filter unchanged. Four mocked-Prisma branch tests (D-23). |
| HNTF-02 | New assignee sees cycle-start banner on dashboard showing due-plant count + cycle end date | `cycle-start-banner.tsx` (D-12.1) reads unread `cycle_started` notification for current cycle; `getReminderCount` provides due count; `cycle.endDate` provides end date. |
| HNTF-03 | Mid-cycle reassignment routes reassignment banner to new assignee; previous assignee's banner clears on their next load | `reassignment-banner.tsx` (D-12.2) reads unread `cycle_reassigned_*` notification. D-06 derivational clearing: outgoing cycle's notifications stop matching `notification.cycleId === currentActiveCycle.id`. |
| HNTF-04 | Non-assignees see passive status banner with current and next assignee | `passive-status-banner.tsx` (D-12.3); `findNextAssignee` (Phase 3) provides next-up (D-14). |

All four requirements are met by Phase 5 scope; no deferred gaps.
</phase_requirements>

## Summary

Phase 5 is a **render-side completion** of infrastructure Phase 3 shipped. Phase 3 already writes `HouseholdNotification` rows inside every `transitionCycle` transaction (the five types in D-05 are emitted today, just never read). Phase 5 adds one nullable column (`readAt`), one index, one Server Action, two queries, four banner components, and a position-responsive refactor of `NotificationBell`. No new cycle-logic, no new Prisma tables, no email/push infrastructure.

The design has **three tightly-coupled behaviors** that must be implemented together to avoid regressions:

1. **Assignee gate** on `getReminderCount` / `getReminderItems` — closes Phase 2 D-15's deliberate temporary regression (every member currently sees the same reminder count). Pitfall 13 is the driving pitfall; D-09 carves out paused-cycle fallback behavior (count-everyone when no one is formally responsible).
2. **Four dashboard banners** driven by `(currentCycle, notification?, viewerRole, viewerIsAssignee, nextAssignee?)` — pure UI, no DB writes on render (D-16). Mark-read is moved to bell open (D-20), not banner mount.
3. **Unified position-responsive bell** — deletes the duplicate dropdown in `BottomTabBar` (lines 62-112 of `src/components/layout/bottom-tab-bar.tsx`), flips the desktop-only `sm:block` visibility off, and introduces one `NotificationBell` component with a `variant` prop. Fixes the two documented v1 tech-debt items simultaneously.

**Primary recommendation:** Follow the CONTEXT.md decisions verbatim; all contested alternatives were discussed and closed in 05-DISCUSSION-LOG.md. Wave 0 sets up the `readAt` migration + test stubs; Wave 1 implements the assignee gate + queries (D-07..D-10, D-28, D-29); Wave 2 implements `markNotificationsRead` + the four banners + the unified bell refactor; Wave 3 wires the dashboard render + layout bell-badge update; Wave 4 closes phase tests and Chrome DevTools UI validation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assignee gate (who sees reminder counts) | API / Server (Prisma) | — | Authz-sensitive; computed from Cycle row + session user id inside Server Components. Never trust client. |
| `readAt` mutation (mark-read on bell open) | API / Server Action (`markNotificationsRead`) | Browser/Client (fires via `useTransition`) | Server Action writes; client only triggers. Idempotent. |
| Banner rendering | Frontend Server (React Server Component) | — | Server Components fetch Cycle + notifications + nextAssignee on the dashboard page; no client-side data fetching. |
| Bell dropdown interactivity | Browser/Client | Frontend Server (feeds data as props) | `DropdownMenu` (`@base-ui/react`) requires client; data flows server → client as props. |
| Badge count arithmetic | Frontend Server (layout SC) | — | Summed in the household layout Server Component; `Promise.all` three queries. |
| `HouseholdNotification` persistence | Database (Postgres) | — | `readAt Timestamptz(3)` column + composite index `[recipientUserId, readAt]`. |
| Cycle-based filter (current-cycle only) | API / Server (Prisma) | — | Filter `notification.cycleId === currentActiveCycle.id` is a WHERE clause, not a client check. |
| Revalidation after mark-read | Frontend Server (`revalidatePath`) | — | Server Action calls `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")` so the next navigation recomputes the badge. |

No capability belongs in the browser tier beyond the bell's open-state management and the `useTransition` trigger. Banners are Server Components; gate logic is server-side only.

## Standard Stack

### Core (all already installed — no new deps)

| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 (latest) | App Router + Server Actions + Server Components + `revalidatePath` | Project is on next 16.2.2; bell UI + banners + `markNotificationsRead` conform to the App Router pattern. [VERIFIED: `npm view next version` → 16.2.4] |
| React | 19.2.4 | `useTransition` for non-blocking bell-open mark-read | `useTransition` returns `[isPending, startTransition]`; `startTransition(() => markNotificationsReadAction(...))` is the idiomatic Next 16 pattern for firing a mutation from a client UI event without blocking the UI. [VERIFIED: package.json `react: 19.2.4`] |
| Prisma | 7.7.0 (client + CLI) | `updateMany`, `count`, `findMany` against `HouseholdNotification` | Existing ORM; `updateMany` with `{ where: { readAt: null }, data: { readAt: new Date() } }` is the idempotent pattern (D-20). [VERIFIED: package.json `@prisma/client: ^7.7.0`] |
| `@base-ui/react` | 1.4.0 | `DropdownMenu` primitive (already used by `NotificationBell` + `BottomTabBar`) | Exposes `DropdownMenu.onOpenChange` for the mark-read trigger. [VERIFIED: installed `1.4.0`] |
| `zod/v4` | 4.3.6 | Input schema for `markNotificationsRead` | v4 subpath convention, matches Phase 1 D-04 patterns. [VERIFIED: package.json `zod: ^4.3.6`] |
| `lucide-react` | 1.8.0 | `Bell` icon, banner icons (AlertCircle, UserCheck, Users) | Already used by existing bell component. [VERIFIED: package.json] |
| Vitest | 4.1.4 | Mocked-Prisma unit tests (D-23, D-24, D-25) | Phase 2-4 precedent; the four-branch shape test is the standard form. [VERIFIED: package.json] |
| `@testing-library/react` | 16.3.2 | Banner component unit tests (D-25) | Props-driven render + assertion on visible text / selected branch. [VERIFIED: package.json] |

### Supporting (all already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | 4.1.0 | `differenceInDays` for "X days overdue" copy | Already used by `getReminderItems`. No new usage. |
| `@date-fns/tz` | 1.4.1 | TZDate for cycle boundary math | Reused by `findNextAssignee` / `transitionCycle`. No Phase 5 changes. |
| `react-hook-form` | 7.72.1 | Not needed — `markNotificationsRead` fires from `startTransition`, not a `<form>` | If future need emerges, follow Phase 2 D-04 hidden-field pattern. |

### Alternatives Considered (already closed in DISCUSSION-LOG)

| Instead of | Could Use | Tradeoff (why NOT chosen) |
|------------|-----------|----------|
| `readAt DateTime?` column | Derive from `cycleId === currentCycle.id` only | Rejected Area 4 Q3 — merged-feed bell needs inbox semantics; count dot without `readAt` is redundant with "am I assignee?". |
| One `CycleBanner` with type branching | Four separate components (D-12) | Rejected Area 3 Q2 — grep-ability + per-case tests favor four components. |
| `middleware.ts` for auth on `markNotificationsRead` | Direct `auth()` + `requireHouseholdAccess` inside action | Server Actions enforce authz inline (Phase 2 D-12 7-step template). Route-level middleware is not the right tier. |
| In-memory reminder cache | `React.cache()` on query + `revalidatePath` | React 19 `cache()` already used by `getCurrentHousehold`; explicit revalidation is the Server Component idiom. |

### No new installations

All libraries needed are in `package.json`. [VERIFIED: `npm view` on next, vitest, @base-ui/react on 2026-04-19]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  REQUEST: GET /h/[householdSlug]/dashboard                              │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Household Layout (Server Component)                                     │
│ src/app/(main)/h/[householdSlug]/layout.tsx                             │
│                                                                         │
│  1. getCurrentHousehold(slug) → household + member + role (cached)      │
│  2. auth() → sessionUser.id                                             │
│  3. compute todayStart / todayEnd from user_tz cookie                   │
│  4. Promise.all([                                                       │
│       getReminderCount(household.id, sessionUser.id, ts, te),          │
│       getReminderItems(household.id, sessionUser.id, ts, te),          │
│       getUnreadCycleEventCount(household.id, sessionUser.id),          │
│     ])                                                                  │
│  5. badgeCount = reminderCount + unreadCycleEventCount        (D-19)    │
│  6. Render: <NotificationBell variant="desktop" badge={count}           │
│                               items={mergedFeed} />                     │
│             <BottomTabBar> → <NotificationBell variant="mobile" ... />  │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼ (children render)
┌─────────────────────────────────────────────────────────────────────────┐
│ Dashboard Page (Server Component)                                       │
│ src/app/(main)/h/[householdSlug]/dashboard/page.tsx                     │
│                                                                         │
│  1. getCurrentCycle(household.id) → cycle (active | paused)             │
│  2. getCycleNotificationsForViewer(household.id, userId, cycle.id)     │
│     → viewer's notifications for this cycle (with joins)                │
│  3. if passive view: findNextAssignee(tx, household.id, members, cycle) │
│                                                                         │
│  Render order (D-13):                                                   │
│    [FallbackBanner]         — if cycle.status==='paused' OR             │
│                               cycle.transitionReason===                 │
│                               'all_unavailable_fallback'                │
│    [CycleStartBanner]       — viewerIsAssignee && unread                │
│       OR                       'cycle_started' for cycle                │
│    [ReassignmentBanner]     — viewerIsAssignee && unread                │
│                               'cycle_reassigned_*' for cycle            │
│    [PassiveStatusBanner]    — !viewerIsAssignee && no assignee banner   │
│    <existing urgency sections>                                          │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼ (client mounts)
┌─────────────────────────────────────────────────────────────────────────┐
│ NotificationBell (Client Component, variant="desktop"|"mobile")         │
│                                                                         │
│  <DropdownMenu onOpenChange={(open) => {                                │
│     if (open && unreadIds.length > 0) {                                 │
│       startTransition(() =>                                             │
│         markNotificationsRead({ householdId, notificationIds }));       │
│     }                                                                   │
│  }}>                                                                    │
│   [reminder rows]                                                       │
│   [unread cycle events]                                                 │
│   [read cycle events — muted]                                           │
│  </DropdownMenu>                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                │ (onOpen fires)
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Server Action: markNotificationsRead                                    │
│ src/features/household/actions.ts  (7-step template, Phase 2 D-12)      │
│                                                                         │
│  1. auth() → session.user.id                                            │
│  2. demo guard                                                          │
│  3. Zod parse ({ householdId, notificationIds })                        │
│  4. requireHouseholdAccess(householdId)  →  Forbidden if not member     │
│  5. (no role check — any member can mark their own as read)             │
│  6. db.householdNotification.updateMany({                               │
│       where: { id: { in: ids }, recipientUserId: session.user.id,       │
│                readAt: null },                                          │
│       data: { readAt: new Date() }                                      │
│     })                                                                  │
│  7. revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")                   │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 (already deployed) — write path context                         │
│ transitionCycle($transaction) emits HouseholdNotification rows.         │
│ Phase 5 does NOT modify this path. Phase 5 reads those rows.            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
prisma/
├── schema.prisma             # +readAt column, +@@index([recipientUserId, readAt])
└── migrations/
    └── 2026041X_add_household_notification_read_at/
        └── migration.sql     # ALTER TABLE + CREATE INDEX

src/
├── app/(main)/h/[householdSlug]/
│   ├── layout.tsx            # CHANGE: pass sessionUser.id to reminder queries;
│   │                         #         add getUnreadCycleEventCount; compute
│   │                         #         merged feed + unified badge
│   └── dashboard/page.tsx    # CHANGE: render 4 banners above existing sections;
│                             #         call getCurrentCycle + getCycleNotificationsForViewer
│
├── components/
│   ├── household/                     # NEW four banners (D-12)
│   │   ├── cycle-start-banner.tsx
│   │   ├── reassignment-banner.tsx
│   │   ├── passive-status-banner.tsx
│   │   └── fallback-banner.tsx
│   │   (sibling: destructive-leave-dialog.tsx — already exists)
│   ├── layout/bottom-tab-bar.tsx      # CHANGE: delete inline dropdown (lines 62-112);
│   │                                  #         render <NotificationBell variant="mobile" />
│   └── reminders/notification-bell.tsx # CHANGE: add variant prop, merged feed items,
│                                      #         onOpenChange → markNotificationsRead
│
├── features/
│   ├── household/
│   │   ├── actions.ts        # CHANGE: + markNotificationsRead (7-step; D-20, D-24)
│   │   ├── queries.ts        # CHANGE: + getUnreadCycleEventCount (D-28),
│   │   │                     #         + getCycleNotificationsForViewer (D-29)
│   │   └── schema.ts         # CHANGE: + markNotificationsReadSchema (Zod v4)
│   └── reminders/
│       ├── queries.ts        # CHANGE: body rewrite of getReminderCount +
│       │                     #         getReminderItems per D-07..D-10
│       └── types.ts          # CHANGE (optional): extend ReminderItem to a
│                             #         discriminated union or add a sibling
│                             #         CycleEventFeedItem type

tests/
└── phase-05/                 # NEW per workstream pattern
    ├── fixtures.ts           # EMAIL_PREFIX helper (mirror phase-04/fixtures.ts)
    ├── reminder-gate.test.ts          # D-23 four branches (mocked Prisma)
    ├── mark-notifications-read.test.ts # D-24 authz (mocked Prisma)
    ├── get-unread-cycle-event-count.test.ts # D-28 mocked Prisma
    ├── get-cycle-notifications-for-viewer.test.ts # D-29 mocked Prisma
    ├── cycle-start-banner.test.tsx    # D-25 component test
    ├── reassignment-banner.test.tsx   # D-25 component test
    ├── passive-status-banner.test.tsx # D-25 component test
    ├── fallback-banner.test.tsx       # D-25 component test
    └── notification-bell.test.tsx     # merged-feed + onOpenChange trigger
```

### Pattern 1: Pre-check assignee gate with early return (D-08)

**What:** The reminder query fetches the current cycle first, then decides whether to run the plant query based on cycle state + caller identity. The plant query's `where` clause is unchanged.

**When to use:** Any query whose result depends on the caller's role in a domain state (assignee, owner, etc.) and where the role-check is cheap relative to the underlying query.

**Example:**
```typescript
// Source: CONTEXT.md D-08; existing pattern from src/features/reminders/queries.ts body
// Phase 5 body rewrite
export async function getReminderCount(
  householdId: string,
  userId: string,              // D-07: new param
  todayStart: Date,
  todayEnd: Date,
): Promise<number> {
  const cycle = await getCurrentCycle(householdId);
  if (!cycle) return 0;                                        // D-10
  if (cycle.status === "paused") {
    // D-09: count-everyone fallback — deliberate deviation from Pitfall 13
  } else if (cycle.assignedUserId !== userId) {
    return 0;                                                  // D-08 core
  }

  // existing plant.count query unchanged ↓
  const now = new Date();
  const [overdue, dueToday] = await Promise.all([
    db.plant.count({ where: { householdId, archivedAt: null,
      nextWateringAt: { lt: todayStart },
      reminders: { some: { enabled: true,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] } } } }),
    db.plant.count({ where: { /* due-today shape */ } }),
  ]);
  return overdue + dueToday;
}
```

### Pattern 2: Server Action with 7-step template + updateMany (D-20, Phase 2 D-12)

**Example:**
```typescript
// Source: Phase 2 D-12 7-step template (see src/features/household/actions.ts:40-128 createHousehold)
"use server";

export async function markNotificationsRead(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = markNotificationsReadSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access (Pitfall 16)
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: (no role check — any member may mark their own rows)

  // Step 6: write — idempotent updateMany; readAt:null predicate makes replays zero-count
  await db.householdNotification.updateMany({
    where: {
      id: { in: parsed.data.notificationIds },
      recipientUserId: session.user.id,           // row-level filter
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  // Step 7: revalidate so next nav recomputes badge
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true };
}
```

### Pattern 3: `useTransition` on `DropdownMenu.onOpenChange` (React 19.2 + @base-ui/react)

**Example:**
```typescript
// Source: React 19.2 useTransition; @base-ui/react DropdownMenu onOpenChange
// Recommended wiring per CONTEXT.md Claude's Discretion
"use client";
import { useTransition } from "react";
import { markNotificationsRead } from "@/features/household/actions";

export function NotificationBell({ householdId, unreadCycleIds, ... }: Props) {
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unreadCycleIds.length > 0) {
          // Snapshot ids before render; updateMany is idempotent so repeat opens are safe
          startTransition(() => {
            void markNotificationsRead({
              householdId,
              notificationIds: unreadCycleIds,
            });
          });
        }
      }}
    >
      {/* trigger + content */}
    </DropdownMenu>
  );
}
```

### Pattern 4: Position-responsive component via `variant` prop (D-17, D-22)

**Example:**
```typescript
// Source: CONTEXT.md D-17/D-22; recommended component shape
interface NotificationBellProps {
  variant: "desktop" | "mobile";
  householdId: string;
  householdSlug: string;
  badge: number;
  reminderItems: ReminderItem[];
  cycleEvents: CycleEventFeedItem[];
  unreadCycleEventIds: string[];
}

export function NotificationBell({ variant, ... }: NotificationBellProps) {
  const triggerClass = variant === "desktop"
    ? buttonVariants({ variant: "ghost", size: "icon", className: "relative p-2.5" })
    : "flex flex-1 flex-col items-center justify-center gap-0.5 ..."; // mobile tab-shape

  const contentAlign = variant === "desktop" ? "end" : "end";
  const contentSide  = variant === "desktop" ? "bottom" : "top";
  // shared content body
}
```

### Anti-Patterns to Avoid

- **Writing `readAt` on banner mount.** Rejected in D-16 — dashboard render is not acknowledgement. Only bell-open marks read.
- **Mixing `Reminder` (per-plant preferences) with `HouseholdNotification` (cycle events) in the data layer.** Pitfall 14 — the two models stay separate. The UI dropdown merges only at render time (D-18).
- **Nesting the assignee gate as a relation filter on `plant.count`.** Rejected in Area 2 Q3 — pre-check + early-return keeps branches grep-able and composes with the banner's cycle lookup.
- **Reading `auth()` inside `getReminderCount`.** Rejected Area 2 Q1 — keeps query pure, decouples tests from session mocking, and preserves the "caller passes userId" pattern used across Phase 2 queries.
- **Introducing a second notification surface ("Alerts" tab).** Deleted in D-17. Downstream agents must not re-add it.
- **Using `middleware.ts` for anything in this phase.** Note: Next.js 16 renamed `middleware.ts` → `proxy.ts` and the project already uses `proxy.ts`. Don't author new `middleware.ts` files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is the notification read?" flag | Separate `notificationReads` join table | `readAt DateTime?` null-vs-timestamp | D-04 — `readAt` is sufficient for "I've seen this"; no need for a many-to-many surface. |
| Idempotent mark-as-read | Read-then-write with existence check | `updateMany({ where: { readAt: null } })` | Atomic at the SQL level; zero-count on replays; no race-condition handling needed. |
| Badge recount after mark-read | Client-side state + imperative refetch | `revalidatePath()` from Server Action | The layout re-renders on next nav; the count comes from `Promise.all` in layout.tsx; no client refetch logic needed. |
| Non-blocking UI update on bell open | `useEffect` + local state + manual pending flag | `useTransition` from React 19 | `useTransition` is exactly the primitive for "fire and forget, don't block interaction." |
| Dropdown open detection | Manual state + onClick handler | `DropdownMenu.onOpenChange` from `@base-ui/react` | The primitive exposes `(open: boolean) => void` callback; idiomatic. |
| "Next assignee" preview logic | Custom rotation walker | `findNextAssignee` from Phase 3 (`src/features/household/cycle.ts:110`) | Already tested (7+ test files green); respects availability + owner fallback + single-member short-circuit. |
| "Current cycle" lookup | Ad-hoc `db.cycle.findFirst` | `getCurrentCycle` from `src/features/household/queries.ts:53` | Already exported, already returns active+paused. |
| "Clear previous-assignee's banner" | Bulk-clear write on cycle transition | Filter by `notification.cycleId === currentCycle.id` on read | D-06 — derivational clearing. When a new cycle becomes active, the outgoing cycle's rows naturally fall out of the filter. Zero write paths to maintain. |
| Banner dedupe guarantee | App-layer "at most one banner" logic | Phase 3 `@@unique([cycleId, recipientUserId, type])` | Phase 3 D-19 dedupe invariant means at most one transition-event notification exists per viewer per cycle — enforced at the DB. |

**Key insight:** Phase 3 already built everything Phase 5 needs on the write side. Phase 5's work is **pure render + one nullable column + one read-mutation path**. Resist any urge to add stored state ("dismissedAt", "payload snapshot", "seen by") — CONTEXT.md closed every one of those alternatives.

## Runtime State Inventory

Not applicable — Phase 5 is greenfield (additive) within the household workstream. The only stored data added is the `readAt` column on `HouseholdNotification`. No rename/refactor/migration of existing data.

- **Stored data:** None to migrate — the column is nullable, so all existing rows default to `NULL` (unread). Phase 3 already populated `HouseholdNotification` rows with non-null `cycleId`; those rows will now correctly render in Phase 5's merged feed as "unread cycle events."
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None new. `CRON_SECRET` stays Phase 3's concern.
- **Build artifacts:** None. Prisma generator output at `src/generated/prisma` will regenerate on `postinstall` (already scripted) — the new column will surface on the `HouseholdNotification` type and in `db.householdNotification.*` methods.

## Common Pitfalls

### Pitfall 1: Reminder query still shows counts to non-assignees (Pitfall 13 — binding)

**What goes wrong:** The query gets a `userId` parameter (D-07) but the gate is placed after the plant query runs — or is omitted on one of the two call sites in `src/app/(main)/h/[householdSlug]/layout.tsx`.
**Why it happens:** Phase 2 D-15 explicitly shipped a temporary regression — every member currently sees the same reminder count. That regression must end in Phase 5.
**How to avoid:** Pre-check cycle + early-return (Pattern 1). The four-branch mocked-Prisma test (D-23) is the gate: assignee path calls `plant.count`; non-assignee path does NOT (verified with `vi.mock` assertion `expect(plant.count).not.toHaveBeenCalled()`).
**Warning signs:** Badge shows same count to Alice and Bob on the same household dashboard.

### Pitfall 2: Duplicate notifications during reassignment (Pitfall 14 — binding)

**What goes wrong:** `HouseholdNotification` and `Reminder` get merged at the data layer — a developer extends `Reminder` to hold cycle events, or adds `HouseholdNotification` rows for per-plant overdue state.
**Why it happens:** Phase 5 introduces a merged UI feed (D-18). The temptation is to back it with one table.
**How to avoid:** D-18's merged feed is a **UI composition**, not a data-layer merge. `HouseholdNotification` stays cycle-only (D-05). `Reminder` stays per-plant user preference only (unchanged from Phase 2). `ReminderItem` and `CycleEventFeedItem` are distinct types merged at render time in `NotificationBell`.
**Warning signs:** Discriminated union ReminderItem shape leaks into query functions; `HouseholdNotification` gains a `plantId` FK.

### Pitfall 3: NULLS NOT DISTINCT regression (Phase 3 carry-over IN-01)

**What goes wrong:** The existing `@@unique([cycleId, recipientUserId, type])` constraint treats NULL as distinct (Postgres default). Phase 3 always writes non-null `cycleId`; Phase 5 D-05 continues to only render Phase 3's types — all with non-null `cycleId`. If an agent introduces a notification type with `cycleId: null` (e.g., a household-wide announcement), duplicate rows become possible per `(recipientUserId, type)`.
**Why it happens:** Plausible but out-of-scope extension (D-05 explicitly defers).
**How to avoid:** If anyone drafts a new notification type with `cycleId: null`, reject the migration in plan-check. The remediation is `NULLS NOT DISTINCT` on the unique index (Postgres 15+) or a partial unique index — neither is in this phase's scope.
**Warning signs:** Schema diff adds a `cycleId: null` insert path.

### Pitfall 4: Mark-read races when opening/closing dropdown rapidly

**What goes wrong:** User opens the dropdown, `onOpenChange(true)` fires, mark-read action starts. User closes + reopens before the first completes. Second call sends the same IDs. **This is SAFE** because the `where: { readAt: null }` predicate makes the second `updateMany` a zero-count no-op.
**Why it happens:** Normal user interaction.
**How to avoid:** Rely on the idempotent `updateMany`. Do NOT add a "pending" guard that blocks re-opens — the UX cost exceeds the DB cost (a zero-row UPDATE is cheap).
**Warning signs:** A `lastMarkedAt` client state variable; a `debounce` wrapper around `startTransition`.

### Pitfall 5: Badge count drift between desktop and mobile

**What goes wrong:** Desktop bell shows 5; mobile bell (same user, same household, different viewport) shows 3. Caused by two separate data-fetching sites with different arguments.
**Why it happens:** The layout computes `badgeCount` once per request, but if an agent re-computes it inside `BottomTabBar` or splits the count into two props (one for desktop, one for mobile) they will drift.
**How to avoid:** Compute `badgeCount` ONCE in the layout (`src/app/(main)/h/[householdSlug]/layout.tsx`) and thread the SAME value to both `<NotificationBell variant="desktop" />` and `<NotificationBell variant="mobile" />`. D-22's "shared dropdown content" extends to the props: both variants receive the same props.
**Warning signs:** Two `getReminderCount` calls in the layout; a `notificationCount` prop on `BottomTabBar` distinct from the one passed to the desktop bell.

### Pitfall 6: Dashboard renders stale banner after skipCurrentCycle

**What goes wrong:** Alice skips her cycle → `transitionCycle` runs → new Cycle #N+1 is created → Bob becomes assignee. Alice's dashboard still shows the old cycle-start banner until she manually refreshes.
**Why it happens:** `skipCurrentCycle` already calls `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")` (verified in actions.ts:177). Phase 5 banners on the dashboard will recompute on that revalidation. **This pitfall is already solved** — mentioned here to prevent a planner from adding redundant revalidation.
**How to avoid:** Trust the existing `revalidatePath` from Phase 3 `skipCurrentCycle`. Phase 5 does not need to add cross-action revalidation.
**Warning signs:** New `revalidatePath` calls in Phase 5 that duplicate Phase 3's.

### Pitfall 7: Server Action called with stale notification IDs after revalidation

**What goes wrong:** Dropdown opens with unread IDs [A, B, C]. User navigates away (revalidation runs — A is now read). User comes back; dropdown has stale unread set [A, B, C] in a closure. Mark-read fires against A again.
**Why it happens:** Client state outlives server truth across navigations.
**How to avoid:** Idempotent `updateMany` with `readAt: null` filter makes this a zero-count no-op — same principle as Pitfall 4. Do not over-engineer.
**Warning signs:** A client-side "read IDs" cache.

## Code Examples

### Prisma schema additions (D-01, D-02)

```prisma
// Source: CONTEXT.md D-01, D-02; existing prisma/schema.prisma:234-247 HouseholdNotification model
model HouseholdNotification {
  id              String    @id @default(cuid())
  householdId     String
  household       Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  recipientUserId String
  recipient       User      @relation("HouseholdNotificationRecipient", fields: [recipientUserId], references: [id], onDelete: Cascade)
  type            String
  cycleId         String?
  cycle           Cycle?    @relation(fields: [cycleId], references: [id], onDelete: SetNull)
  createdAt       DateTime  @default(now()) @db.Timestamptz(3)
  readAt          DateTime? @db.Timestamptz(3)          // NEW (D-01)

  @@unique([cycleId, recipientUserId, type])
  @@index([recipientUserId, createdAt])
  @@index([recipientUserId, readAt])                    // NEW (D-02)
}
```

**Migration SQL (generated, verify before committing):**
```sql
-- prisma/migrations/{timestamp}_add_household_notification_read_at/migration.sql
ALTER TABLE "HouseholdNotification"
  ADD COLUMN "readAt" TIMESTAMPTZ(3);

CREATE INDEX "HouseholdNotification_recipientUserId_readAt_idx"
  ON "HouseholdNotification"("recipientUserId", "readAt");
```

### `getUnreadCycleEventCount` (D-28)

```typescript
// Source: CONTEXT.md D-28; Prisma 7 count API
// File: src/features/household/queries.ts (append)
/**
 * D-19 badge component: count of viewer's unread cycle events for the current
 * cycle only. Phase 5 callers: layout badge compute.
 *
 * "Current cycle" = the most recent active-or-paused cycle, matching
 * getCurrentCycle. If no current cycle, returns 0. Filtering by cycle.status
 * keeps the count aligned with the bell's dropdown filter (D-18).
 */
export async function getUnreadCycleEventCount(
  householdId: string,
  userId: string,
): Promise<number> {
  return db.householdNotification.count({
    where: {
      householdId,
      recipientUserId: userId,
      readAt: null,
      cycle: { status: { in: ["active", "paused"] } },
    },
  });
}
```

### `getCycleNotificationsForViewer` (D-29)

```typescript
// Source: CONTEXT.md D-29
// File: src/features/household/queries.ts (append)
/**
 * D-18 bell feed + D-13 banner source. Returns notifications for the viewer
 * scoped to the given cycle only, with joins needed by banners:
 *   - cycle.assignedUserId → prior/current assignee lookup
 *   - cycle.household.members → name resolution for reassignment copy
 *
 * Ordered: unread first (readAt IS NULL), then most-recent first.
 * Per D-18 the bell dropdown orders by bucket; the banner consumer only needs
 * the single most-recent unread row per type (dedupe invariant from Phase 3 D-19).
 */
export async function getCycleNotificationsForViewer(
  householdId: string,
  userId: string,
  cycleId: string,
) {
  return db.householdNotification.findMany({
    where: {
      householdId,
      recipientUserId: userId,
      cycleId,
    },
    include: {
      cycle: {
        include: {
          household: {
            include: {
              members: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
          },
        },
      },
    },
    orderBy: [
      { readAt: "asc" },     // NULLs first in PG asc by default
      { createdAt: "desc" },
    ],
  });
}
```

### `markNotificationsRead` action + schema (D-20, D-24)

```typescript
// Source: CONTEXT.md D-20; Phase 2 D-12 7-step template
// File: src/features/household/schema.ts (append)
export const markNotificationsReadSchema = z.object({
  householdId: z.cuid(),
  notificationIds: z.array(z.cuid()).min(1).max(50),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

// File: src/features/household/actions.ts (append) — see Pattern 2 for full body
```

### Dashboard page banner slot (D-11, D-13)

```typescript
// Source: CONTEXT.md D-11, D-13
// File: src/app/(main)/h/[householdSlug]/dashboard/page.tsx
// Inserted in the DashboardPage render, ABOVE the existing dashboard sections

const cycle = await getCurrentCycle(household.id);
const viewerIsAssignee = cycle?.assignedUserId === session.user.id;
const notifications = cycle
  ? await getCycleNotificationsForViewer(household.id, session.user.id, cycle.id)
  : [];
const unread = notifications.filter((n) => n.readAt === null);
const unreadStart = unread.find((n) => n.type === "cycle_started");
const unreadReassign = unread.find((n) => n.type.startsWith("cycle_reassigned_"));

const isFallback = cycle?.transitionReason === "all_unavailable_fallback"
                || cycle?.status === "paused";

// D-14: only compute when needed (passive + non-single-member)
const nextAssignee = (!viewerIsAssignee && cycle && cycle.status === "active")
  ? await findNextAssigneeForPreview(household.id, cycle)
  : null;

return (
  <div className="space-y-6">
    {isFallback && <FallbackBanner cycle={cycle!} isOwner={role === "OWNER"} />}
    {viewerIsAssignee && unreadStart && <CycleStartBanner ... />}
    {viewerIsAssignee && !unreadStart && unreadReassign && <ReassignmentBanner ... />}
    {!viewerIsAssignee && !isFallback && cycle && cycle.status === "active" && (
      <PassiveStatusBanner currentAssignee={...} nextAssignee={nextAssignee} />
    )}
    {/* existing dashboard sections below */}
  </div>
);
```

### Four-branch mocked Prisma gate test (D-23)

```typescript
// Source: CONTEXT.md D-23; Phase 2 D-16/D-17 precedent (see tests/reminders.test.ts)
// File: tests/phase-05/reminder-gate.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: { count: vi.fn(), findMany: vi.fn() },
    cycle: { findFirst: vi.fn() },
  },
}));

describe("getReminderCount assignee gate (D-07/D-08/D-09/D-10)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("D-08: returns count from plant query when viewer is active-cycle assignee", async () => {
    const { db } = await import("@/lib/db");
    (db.cycle.findFirst as any).mockResolvedValue({
      id: "c1", assignedUserId: "alice", status: "active",
    });
    (db.plant.count as any).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const { getReminderCount } = await import("@/features/reminders/queries");
    const count = await getReminderCount("h1", "alice", new Date(), new Date());
    expect(count).toBe(5);
    expect(db.plant.count).toHaveBeenCalledTimes(2);
  });

  it("D-08: returns 0 without calling plant.count when viewer is non-assignee on active cycle", async () => {
    const { db } = await import("@/lib/db");
    (db.cycle.findFirst as any).mockResolvedValue({
      id: "c1", assignedUserId: "alice", status: "active",
    });
    const { getReminderCount } = await import("@/features/reminders/queries");
    const count = await getReminderCount("h1", "bob", new Date(), new Date());
    expect(count).toBe(0);
    expect(db.plant.count).not.toHaveBeenCalled();
  });

  it("D-09: returns household-wide count for all viewers on paused cycle", async () => {
    const { db } = await import("@/lib/db");
    (db.cycle.findFirst as any).mockResolvedValue({
      id: "c1", assignedUserId: null, status: "paused",
    });
    (db.plant.count as any).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const { getReminderCount } = await import("@/features/reminders/queries");
    const count = await getReminderCount("h1", "bob", new Date(), new Date());
    expect(count).toBe(5);
    expect(db.plant.count).toHaveBeenCalledTimes(2);
  });

  it("D-10: returns 0 when no current cycle exists", async () => {
    const { db } = await import("@/lib/db");
    (db.cycle.findFirst as any).mockResolvedValue(null);
    const { getReminderCount } = await import("@/features/reminders/queries");
    const count = await getReminderCount("h1", "alice", new Date(), new Date());
    expect(count).toBe(0);
    expect(db.plant.count).not.toHaveBeenCalled();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for auth/proxying | `proxy.ts` (Next.js 16) | Next.js 16 (Oct 2025) | Project already uses `proxy.ts`. Do NOT introduce `middleware.ts`. |
| React 18 `useTransition` (no pending in callback) | React 19.2 `useTransition` (supports async functions natively) | React 19 (Dec 2024) | Direct `startTransition(() => serverAction(...))` pattern is idiomatic. |
| Pages Router reminder pattern (getServerSideProps + client fetch) | App Router Server Components + Server Actions | Next.js 13+ | Banner data fetches inline in the Server Component; no client-side data-fetch lib. |
| Prisma 6 with Rust binary | Prisma 7 (Rust-free TypeScript client) | Prisma 7.0 (Nov 2025) | Project on 7.7.0; faster cold starts; same API. |
| Tailwind `tailwind.config.js` | Tailwind v4 `@theme` CSS directive | Tailwind v4 (Jan 2025) | Banner components use existing CSS tokens; no config changes. |

**Deprecated/outdated:**
- `middleware.ts` — superseded by `proxy.ts` in Next.js 16.
- `date-fns-tz` (marnusw) — incompatible with date-fns v4; `@date-fns/tz` is the standard (see STATE.md decision).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `HouseholdNotification.@@unique([cycleId, recipientUserId, type])` continues to enforce at-most-one transition-event notification per viewer per cycle, so the banner render can safely pick "the first unread `cycle_reassigned_*` notification" without worrying about ties. | Pitfall 3, Pattern 3 | If wrong, banner could pick the wrong variant copy; mitigation is to sort by createdAt desc. | [VERIFIED via schema.prisma:245] — so this is actually VERIFIED, not assumed. |
| A2 | `@base-ui/react` `DropdownMenu.onOpenChange` fires synchronously when the menu opens. | Pattern 3 | If wrong, mark-read could miss the initial open. Verify at implementation time by reading `@base-ui/react` docs or testing. [ASSUMED] |
| A3 | Postgres `ORDER BY readAt ASC` places NULL first by default (PG default is NULLS LAST for ASC in some configs). | `getCycleNotificationsForViewer` code example | If wrong, unread rows land after read rows. Mitigation: use explicit `NULLS FIRST`. Verify at implementation time with raw SQL EXPLAIN or integration test. [ASSUMED] |

**Note on A3:** Postgres's documented default is `NULLS LAST` for ASC and `NULLS FIRST` for DESC. The example above is INCORRECT as written — the planner should use `orderBy: [{ readAt: "asc" }]` with an explicit `nulls: "first"` option, OR flip the order logic. Prisma 7 supports `{ readAt: { sort: "asc", nulls: "first" } }`. This is an implementation detail the planner should call out as a Wave 1 verification point.

## Open Questions

1. **Should the passive status banner be suppressed when the viewer is the sole member of a single-member household?**
   - What we know: CONTEXT.md §Claude's Discretion says "Recommend hiding the 'is next' line when `memberCount === 1`; consider suppressing the whole banner when you're the sole member and you're the assignee."
   - What's unclear: Whether a single-member household should show the banner at all.
   - Recommendation: Suppress `PassiveStatusBanner` entirely when `memberCount === 1`. In a single-member household, the sole member is always the assignee, so the passive banner path is never hit (viewer is always the assignee, gets the cycle-start/reassignment banner instead). The `findNextAssignee` Phase 3 short-circuit (sole member = self, fallback:false) means "next up" is also self — not informative. Document this in the PassiveStatusBanner JSDoc.

2. **For the merged dropdown feed (D-18), what's the tie-breaker between "unread cycle event (newest)" and "due-today plant (alphabetical)" when both fall in adjacent ordering buckets?**
   - What we know: D-18 specifies order: overdue → due-today → unread cycle events (newest first) → read cycle events (muted). Buckets are discrete.
   - What's unclear: Nothing — buckets do not overlap. Planner can follow D-18 verbatim.
   - Recommendation: No issue. Document the ordering in the NotificationBell JSDoc and add a test that seeds one of each and asserts order.

3. **Should `getCycleNotificationsForViewer` join all the way to `members.user` (name resolution), or should the banner components call a separate query?**
   - What we know: D-29 says "with relevant joins (cycle, cycle.household.members)" — suggests join in one query.
   - What's unclear: Whether the join bloats the query meaningfully. For a typical household (< 10 members), one query is cleaner.
   - Recommendation: Do the join in `getCycleNotificationsForViewer`. The banner components receive a fully-resolved shape and do no additional queries. If a large-household perf issue emerges in Phase 7 demo testing, split later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (dev) | Prisma migrate + integration tests | ✓ (assumed — prior phases use it) | — | — |
| Node.js 20+ | Next.js 16 + Vitest 4 | ✓ (Phase 3 executed) | — | — |
| npm | Package manager | ✓ | — | — |
| Chrome DevTools MCP | UI validation (CLAUDE.md mandatory) | ✓ (mentioned in CLAUDE.md; used by prior phases) | — | If unavailable, state explicitly per CLAUDE.md — don't claim UI works. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Phase 5 adds no new external dependencies. All work is code/schema.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | (no explicit config; project uses `vite-tsconfig-paths` + root defaults) — confirm at Wave 0 |
| Quick run command | `npm run test -- tests/phase-05` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HNTF-01 | Assignee sees count; non-assignee sees 0 (active cycle) | unit (mocked Prisma) | `npm run test -- tests/phase-05/reminder-gate.test.ts` | ❌ Wave 0 |
| HNTF-01 | Paused cycle falls back to count-everyone | unit (mocked Prisma) | same file | ❌ Wave 0 |
| HNTF-01 | No-cycle branch returns 0 | unit (mocked Prisma) | same file | ❌ Wave 0 |
| HNTF-02 | CycleStartBanner renders when assignee has unread `cycle_started` | component unit | `npm run test -- tests/phase-05/cycle-start-banner.test.tsx` | ❌ Wave 0 |
| HNTF-02 | CycleStartBanner shows due-plant count + end date | component unit | same file | ❌ Wave 0 |
| HNTF-03 | ReassignmentBanner renders for each of 3 reassignment types | component unit | `npm run test -- tests/phase-05/reassignment-banner.test.tsx` | ❌ Wave 0 |
| HNTF-03 | Previous-assignee banner clears on new cycle (derivational) | integration — manual UAT | Chrome DevTools MCP navigation + dashboard snapshot | ❌ Wave 4 |
| HNTF-04 | PassiveStatusBanner shows current + next assignee | component unit | `npm run test -- tests/phase-05/passive-status-banner.test.tsx` | ❌ Wave 0 |
| HNTF-04 | FallbackBanner renders when `transitionReason === 'all_unavailable_fallback'` OR status === 'paused' | component unit | `npm run test -- tests/phase-05/fallback-banner.test.tsx` | ❌ Wave 0 |
| D-20 | `markNotificationsRead` authz: non-member forbidden | unit (mocked Prisma) | `npm run test -- tests/phase-05/mark-notifications-read.test.ts` | ❌ Wave 0 |
| D-20 | `markNotificationsRead` updates readAt for recipient rows only | unit (mocked Prisma) | same file | ❌ Wave 0 |
| D-20 | `markNotificationsRead` idempotent on replay (zero rows on re-call) | unit (mocked Prisma) | same file | ❌ Wave 0 |
| D-28 | `getUnreadCycleEventCount` filters by readAt IS NULL, recipientUserId, current cycle status | unit (mocked Prisma) | `npm run test -- tests/phase-05/get-unread-cycle-event-count.test.ts` | ❌ Wave 0 |
| D-29 | `getCycleNotificationsForViewer` scopes by cycleId + viewer | unit (mocked Prisma) | `npm run test -- tests/phase-05/get-cycle-notifications-for-viewer.test.ts` | ❌ Wave 0 |
| D-17/D-22 | Bell merges feed; `onOpenChange(true)` fires mark-read | component unit | `npm run test -- tests/phase-05/notification-bell.test.tsx` | ❌ Wave 0 |
| D-17/D-22 | Mobile bell renders correctly in BottomTabBar slot | UAT — Chrome DevTools | MCP navigation + snapshot + click behavior | ❌ Wave 4 |
| Phase gate | Full suite green + phase build | `npm test && npm run build` | — | ✓ (existing) |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/phase-05` (phase-local fast feedback)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** `npm test && npm run build` green before `/gsd-verify-work`; Chrome DevTools MCP UAT pass per CLAUDE.md

### Wave 0 Gaps

- [ ] `tests/phase-05/fixtures.ts` — minimal; since D-26 rejects real-DB integration tests, fixtures may be simpler than phase-03/04 (no EMAIL_PREFIX required unless a future real-DB test is added). Create the file anyway for consistency + parity with phase-03/04.
- [ ] `tests/phase-05/reminder-gate.test.ts` — 4 `it.todo` stubs for D-07/D-08/D-09/D-10 branches.
- [ ] `tests/phase-05/mark-notifications-read.test.ts` — 3 `it.todo` stubs (authz forbidden, recipient-filter updates, idempotent replay).
- [ ] `tests/phase-05/get-unread-cycle-event-count.test.ts` — 3 `it.todo` stubs (active cycle only, recipient scoping, readAt null predicate).
- [ ] `tests/phase-05/get-cycle-notifications-for-viewer.test.ts` — 3 `it.todo` stubs (cycleId scoping, viewer scoping, join shape).
- [ ] `tests/phase-05/cycle-start-banner.test.tsx` — 2 `it.todo` stubs (renders when unread, hides when read).
- [ ] `tests/phase-05/reassignment-banner.test.tsx` — 3 `it.todo` stubs (manual_skip copy, auto_skip copy, member_left copy).
- [ ] `tests/phase-05/passive-status-banner.test.tsx` — 2 `it.todo` stubs (renders with names, hides on single-member per resolution of Open Question 1).
- [ ] `tests/phase-05/fallback-banner.test.tsx` — 2 `it.todo` stubs (owner variant, non-owner variant).
- [ ] `tests/phase-05/notification-bell.test.tsx` — 3 `it.todo` stubs (merged feed order, variant prop renders both shapes, onOpenChange fires mark-read).
- [ ] Framework install: none — Vitest 4.1.4 + @testing-library/react 16.3.2 already installed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | NextAuth v5 `auth()` inside `markNotificationsRead` Step 1 (session check) |
| V3 Session Management | yes | JWT session via NextAuth cookie; `auth()` resolution |
| V4 Access Control | yes | `requireHouseholdAccess` (guards.ts) + row-level filter `recipientUserId === session.user.id` on `updateMany` |
| V5 Input Validation | yes | `zod/v4` `markNotificationsReadSchema` (`householdId: cuid`, `notificationIds: cuid[]` bounded 1..50) |
| V6 Cryptography | no | No crypto in this phase (token generation is Phase 4) |

### Known Threat Patterns for Next.js 16 + Prisma 7

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — mark another user's notification as read | Tampering / Information Disclosure | Row-level filter: `updateMany({ where: { id: { in: ids }, recipientUserId: session.user.id } })` ensures hostile IDs silently don't match (zero-count update, no info leak). D-20 makes this explicit. |
| Cross-household IDOR — mark notification in a household you're not in | Tampering | `requireHouseholdAccess(householdId)` in Step 4 throws `ForbiddenError` before DB write. Live DB check, not JWT (Pitfall 16). |
| Mass assignment via ZOD-bypass | Tampering | `markNotificationsReadSchema` explicitly allow-lists fields; extra keys rejected by Zod `.safeParse`. |
| Server Action CSRF | Spoofing | Next.js 16 Server Actions have built-in CSRF protection (action-id hashing); no manual token needed. [VERIFIED: Next.js 16 standard behavior] |
| Demo-mode write bypass | Elevation of Privilege | Step 2 demo guard (`session.user.isDemo`) returns error. Reused verbatim from Phase 2 actions. |
| Unbounded notificationIds list | DoS | Zod `.max(50)` caps payload size; DB `updateMany` is O(n) but bounded. |
| Stale JWT — user removed mid-session | Broken Access Control | `requireHouseholdAccess` hits the live `HouseholdMember` table (Pitfall 16). Phase 2 D-17 already validates this pattern for 17 actions; Phase 5 inherits. |
| Information disclosure via timing | Information Disclosure | `updateMany` with `readAt: null` predicate always executes the same SQL path; no branch-timing difference between "already read" and "doesn't exist." |

## Sources

### Primary (HIGH confidence)

- **CONTEXT.md** (`.planning/workstreams/household/phases/05-household-notifications/05-CONTEXT.md`) — Authoritative 29 decisions (D-01..D-29) + Claude's Discretion + Deferred Ideas. Drives this entire research.
- **DISCUSSION-LOG.md** (same dir) — Audit trail showing D-09 paused-cycle deviation was deliberate, D-01 readAt reversal was deliberate, and the merged-feed model is locked.
- **REQUIREMENTS.md** §HNTF-01/02/03/04 — Four requirement IDs this phase must address.
- **ROADMAP.md** §Phase 5 — Success criteria + pitfall flags 13, 14, v1 tech debt, IN-01.
- **PITFALLS.md** §13, §14 (`.planning/research/PITFALLS.md`) — Binding pitfalls driving D-08 and D-18 separation.
- **prisma/schema.prisma** — Verified current `HouseholdNotification` shape (lines 234-247); unique constraint + index.
- **src/features/reminders/queries.ts** — Verified current body of `getReminderCount` / `getReminderItems` (already `householdId`-scoped, no assignee gate yet per D-15).
- **src/features/household/queries.ts** — Verified `getCurrentCycle` export (line 53).
- **src/features/household/cycle.ts** — Verified `findNextAssignee` export (line 110), `transitionCycle` single-write-path, D-19 unique invariant writing path.
- **src/features/household/constants.ts** — Verified 5 NOTIFICATION_TYPES (D-05) + 6 TRANSITION_REASONS.
- **src/features/household/guards.ts** — Verified `requireHouseholdAccess` contract for D-20 authz.
- **src/features/household/paths.ts** — Verified `HOUSEHOLD_PATHS.dashboard` for `revalidatePath`.
- **src/components/reminders/notification-bell.tsx** — Verified current shape (desktop-only `sm:block`, `{ householdSlug, count, items }` props).
- **src/components/layout/bottom-tab-bar.tsx** — Verified inline dropdown at lines 62-112 (D-22 deletion target) + current 4-tab layout.
- **src/app/(main)/h/[householdSlug]/layout.tsx** — Verified chokepoint pattern, existing `Promise.all` shape, `NotificationBell` + `BottomTabBar` render sites.
- **src/app/(main)/h/[householdSlug]/dashboard/page.tsx** — Verified banner insertion target (between header and `DashboardSkeleton`).
- **src/features/household/actions.ts** — Verified 7-step template examples for `markNotificationsRead` parity (createHousehold lines 40-128; skipCurrentCycle lines 134-179).
- **tests/phase-03/household-notification.test.ts** + **tests/reminders.test.ts** — Verified mocked-Prisma test pattern precedent.
- **package.json** — Verified all required libs installed at current versions (React 19.2.4, Next 16.2.x, Prisma 7.7.0, Vitest 4.1.4, @base-ui/react 1.4.0, zod 4.3.6).
- **`npm view next version` (executed 2026-04-19)** → 16.2.4 confirms project at current LTS.
- **`npm view vitest version`** → 4.1.4 matches installed.

### Secondary (MEDIUM confidence)

- CLAUDE.md §Technology Stack — Stack recommendations verified against project state; Next.js 16 proxy.ts convention noted.
- CLAUDE.md §Validating UI Output — Chrome DevTools MCP mandatory for UI changes; Phase 5 has UI so this applies.
- STATE.md §Decisions — Historical decisions (URL-scoped routing, cron strategy, invitation token) not directly relevant but provide workstream context.

### Tertiary (LOW confidence / needs verification at implementation time)

- Postgres `NULLS FIRST` / `NULLS LAST` default for ORDER BY readAt — verify with Prisma 7 docs at Wave 1 (Assumption A3).
- `@base-ui/react` `DropdownMenu.onOpenChange` exact firing semantics — verify at Wave 2 implementation (Assumption A2).

## Metadata

**Confidence breakdown:**
- User constraints (CONTEXT.md): HIGH — verbatim copy, 29 decisions pre-locked, no interpretation.
- Standard stack: HIGH — all libs installed at verified current versions (npm view executed 2026-04-19).
- Architecture: HIGH — pattern is well-established in the codebase (Phase 2 layout chokepoint, Phase 3 single-write-path, Phase 2 7-step action template all verified via direct file reads).
- Pitfalls 1-7: HIGH — pitfalls 13 & 14 are binding from PITFALLS.md; pitfalls 3-7 are derivative of decisions locked in CONTEXT.md.
- Test strategy: HIGH — mocked-Prisma precedent verified in tests/reminders.test.ts and tests/phase-03/household-notification.test.ts.
- Open questions: MEDIUM — three minor implementation-detail questions flagged; none block planning.
- Assumptions: A2/A3 are LOW and MUST be verified at implementation time (planner should call these out as Wave 1 gates).

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack; revisit if Next.js 17 or Prisma 8 ships)
