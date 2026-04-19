# Phase 5: Household Notifications - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (additive migration) | migration | CRUD | `prisma/schema.prisma` existing `HouseholdNotification` block | exact |
| `src/features/reminders/queries.ts` (body rewrite) | service | request-response | itself (Phase 2 body) + `src/features/household/queries.ts` | exact |
| `src/features/household/queries.ts` (extended) | service | request-response | itself (existing `getCurrentCycle`, `getHouseholdMembers`) | exact |
| `src/features/household/schema.ts` (extended) | utility | transform | itself (existing `skipCurrentCycleSchema`, `leaveHouseholdSchema`) | exact |
| `src/features/household/actions.ts` (extended) | service | request-response | itself (`skipCurrentCycle`, `revokeInvitation` actions) | exact |
| `src/app/(main)/h/[householdSlug]/layout.tsx` (modified) | provider | request-response | itself (existing Promise.all + NotificationBell render) | exact |
| `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` (modified) | component | request-response | itself (existing banner region: `allCaughtUp`, `OnboardingBanner`, `TimezoneWarning`) | exact |
| `src/components/reminders/notification-bell.tsx` (modified) | component | event-driven | itself (current shape) + `src/components/layout/bottom-tab-bar.tsx` (mobile dropdown) | exact |
| `src/components/layout/bottom-tab-bar.tsx` (modified) | component | event-driven | itself (existing 4-tab structure) | exact |
| `src/components/household/cycle-start-banner.tsx` (new) | component | request-response | `src/components/shared/timezone-warning.tsx`, `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` allCaughtUp block | role-match |
| `src/components/household/reassignment-banner.tsx` (new) | component | request-response | `src/components/shared/timezone-warning.tsx`, allCaughtUp block | role-match |
| `src/components/household/passive-status-banner.tsx` (new) | component | request-response | `src/components/shared/timezone-warning.tsx` | role-match |
| `src/components/household/fallback-banner.tsx` (new) | component | request-response | `src/components/shared/timezone-warning.tsx` (role="alert" variant) | exact |
| `src/features/reminders/types.ts` (extended) | utility | transform | itself + `src/features/reminders/types.ts` existing `ReminderItem` | exact |
| `tests/phase-05/reminder-gate.test.ts` (new) | test | request-response | `tests/reminders.test.ts` (mocked Prisma, branch-logic assertions) | exact |
| `tests/phase-05/mark-notifications-read.test.ts` (new) | test | request-response | `tests/phase-04/create-invitation.test.ts` (mocked Prisma, authz pattern) | exact |
| `tests/phase-05/banner-*.test.tsx` (four new) | test | request-response | `tests/reminders.test.ts` (component unit tests) | role-match |

---

## Pattern Assignments

### `prisma/schema.prisma` — additive migration

**Analog:** `prisma/schema.prisma` lines 234-247 (existing `HouseholdNotification` model)

**Existing model to extend** (lines 234-247):
```prisma
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

  @@unique([cycleId, recipientUserId, type])
  @@index([recipientUserId, createdAt])
}
```

**D-01/D-02 additions — copy existing `@db.Timestamptz(3)` convention from `createdAt`:**
```prisma
  readAt          DateTime? @db.Timestamptz(3)   // D-01: nullable, unread by default

  @@index([recipientUserId, readAt])              // D-02: serves badge-count query
```

---

### `src/features/reminders/queries.ts` — body rewrite (D-07..D-10)

**Analog:** itself (lines 1-54) + `src/features/household/queries.ts` `getCurrentCycle` pattern

**Imports pattern** (lines 1-3, keep as-is):
```typescript
import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import type { ReminderItem } from "./types";
```

**Add import for getCurrentCycle** (new):
```typescript
import { getCurrentCycle } from "@/features/household/queries";
```

**New signature shape** (D-07 — add `userId` param after `householdId`):
```typescript
export async function getReminderCount(
  householdId: string,
  userId: string,        // NEW — assignee gate
  todayStart: Date,
  todayEnd: Date
): Promise<number>
```

**Gate pattern** (D-08 — pre-check + early-return before existing plant.count queries):
```typescript
// D-08: assignee gate — pre-check with getCurrentCycle + early-return
const cycle = await getCurrentCycle(householdId);

// D-10: no active cycle → return 0 for all (defensive; should not happen post-Phase-3)
if (!cycle) return 0;

// D-09: paused cycle → count-everyone fallback (deliberate deviation from Pitfall 13)
// Active cycle non-assignee still sees 0; paused = no one responsible = plants shouldn't go silent
if (cycle.status === "paused") {
  // fall through to the existing plant.count queries below (no gate applied)
}

// D-08: active cycle non-assignee → return 0
if (cycle.status === "active" && cycle.assignedUserId !== userId) return 0;

// existing plant.count queries follow unchanged ...
```

**Existing core plant.count pattern** (lines 24-53, unchanged — copy verbatim):
```typescript
const now = new Date();
const [overdue, dueToday] = await Promise.all([
  db.plant.count({
    where: {
      householdId,
      archivedAt: null,
      nextWateringAt: { lt: todayStart },
      reminders: {
        some: {
          enabled: true,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
        },
      },
    },
  }),
  db.plant.count({ /* ...due-today shape */ }),
]);
return overdue + dueToday;
```

---

### `src/features/household/queries.ts` — extended with two new functions (D-28, D-29)

**Analog:** itself (lines 53-61 `getCurrentCycle`, lines 200-222 `getHouseholdMembers`)

**Imports pattern** (lines 1-3, keep as-is):
```typescript
import { db } from "@/lib/db";
import type { Cycle, Availability } from "@/generated/prisma/client";
import { hashInvitationToken } from "@/lib/crypto";
```

**`getUnreadCycleEventCount` pattern** (D-28 — modeled on `getCurrentCycle` simple count shape):
```typescript
/**
 * D-28: Count unread HouseholdNotification rows for the viewer in the current
 * active cycle. Consumed by layout chokepoint alongside getReminderCount
 * for the unified badge total (D-19).
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
      cycle: { status: "active" },
    },
  });
}
```

**`getCycleNotificationsForViewer` pattern** (D-29 — modeled on `getHouseholdInvitations` include shape, lines 174-186):
```typescript
/**
 * D-29: Viewer's HouseholdNotification rows for a specific cycle, with
 * joins needed by the four banner components (prior assignee name,
 * household member list for next-assignee lookup).
 * cycleId is the current active cycle's id, already fetched by caller.
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
              members: {
                include: { user: { select: { name: true, email: true } } },
                orderBy: { rotationOrder: "asc" },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

---

### `src/features/household/schema.ts` — extended (D-20 `markNotificationsRead` input)

**Analog:** itself, lines 83-87 (`skipCurrentCycleSchema`) and lines 104-109 (`revokeInvitationSchema`)

**Import line** (line 1, unchanged):
```typescript
import { z } from "zod/v4";
```

**New schema pattern** (append after existing schemas — copy `skipCurrentCycleSchema` shape):
```typescript
/**
 * D-20: markNotificationsRead input. notificationIds[] is explicit for
 * grep-ability (preferred over { cycleId } shorthand per Claude's Discretion).
 * recipientUserId is NOT accepted from input — actions.ts reads from session.
 */
export const markNotificationsReadSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  notificationIds: z.array(z.cuid()).min(1),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
```

---

### `src/features/household/actions.ts` — extended with `markNotificationsRead` (D-20, D-24)

**Analog:** itself — `skipCurrentCycle` action (lines 134-179) is the closest structural match (single-resource write, `requireHouseholdAccess` + row-level guard, `revalidatePath` at Step 7)

**7-step template** (copy from `skipCurrentCycle` lines 134-179):
```typescript
"use server";   // already at top of file

export async function markNotificationsRead(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard (carried verbatim — Phase 7 will consolidate)
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = markNotificationsReadSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5/6: row-level authz baked into updateMany predicate (D-20)
  // `recipientUserId: session.user.id` in the where prevents cross-user writes.
  // `readAt: null` makes the operation idempotent (re-open fires again safely).
  await db.householdNotification.updateMany({
    where: {
      id: { in: parsed.data.notificationIds },
      recipientUserId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  // Step 7: revalidate household root so badge recounts on next navigation
  revalidatePath(HOUSEHOLD_PATHS.root, "layout");  // or dashboard path
  return { success: true as const };
}
```

**Import to add** (lines 6-20, add `markNotificationsReadSchema` to schema imports):
```typescript
import { markNotificationsReadSchema } from "./schema";
```

---

### `src/app/(main)/h/[householdSlug]/layout.tsx` — modified (D-07, D-19, D-22)

**Analog:** itself (lines 1-114)

**Current Promise.all** (lines 53-56 — replace with 3-way parallel):
```typescript
// BEFORE (Phase 2):
const [reminderCount, reminderItems] = await Promise.all([
  getReminderCount(household.id, todayStart, todayEnd),
  getReminderItems(household.id, todayStart, todayEnd),
]);

// AFTER (Phase 5 — D-07 userId param + D-19 unified badge):
const [reminderCount, reminderItems, unreadCycleEventCount] = await Promise.all([
  getReminderCount(household.id, sessionUser.id, todayStart, todayEnd),
  getReminderItems(household.id, sessionUser.id, todayStart, todayEnd),
  getUnreadCycleEventCount(household.id, sessionUser.id),
]);
const totalCount = reminderCount + unreadCycleEventCount;
```

**NotificationBell render slot** (lines 93-98 — pass `variant="desktop"` + merged count):
```typescript
// Pass totalCount (unified badge) and extended items to bell
<NotificationBell
  householdSlug={householdSlug}
  count={totalCount}
  items={reminderItems}
  variant="desktop"
/>
```

**BottomTabBar render** (lines 107-111 — pass `totalCount`):
```typescript
<BottomTabBar
  householdSlug={householdSlug}
  notificationCount={totalCount}
  reminderItems={reminderItems}
/>
```

---

### `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` — modified (D-11..D-15)

**Analog:** itself (lines 114-162) + `src/components/shared/timezone-warning.tsx` (banner placement model)

**Banner region insertion** (insert between `TimezoneWarning` and the dashboard header `<div>` at line 144):
```typescript
// In DashboardPage (Server Component):
const [user, catalog, rooms, currentCycle, cycleNotifications] = await Promise.all([
  db.user.findUnique({ ... }),
  getCatalog(),
  getRoomsForSelect(household.id),
  getCurrentCycle(household.id),
  getCycleNotificationsForViewer(household.id, session.user.id, /* cycleId fetched after */),
]);

// Banner render order (D-13): FallbackBanner → CycleStart/Reassignment → PassiveStatus
return (
  <div className="space-y-6">
    {!user?.onboardingCompleted && <OnboardingBanner ... />}
    <TimezoneWarning storedTimezone={user?.timezone ?? null} />

    {/* Banner region — D-11: dashboard-only */}
    {currentCycle && (
      <div className="space-y-4">
        {/* Layer 1: FallbackBanner (D-15: first, warning color) */}
        {(currentCycle.status === "paused" ||
          currentCycle.transitionReason === "all_unavailable_fallback") && (
          <FallbackBanner ... />
        )}
        {/* Layer 2: assignee-role event (mutually exclusive per D-19 unique index) */}
        {/* Layer 3: PassiveStatusBanner (only if no unread event and non-assignee) */}
      </div>
    )}

    {/* Existing dashboard header */}
    <div className="flex items-center justify-between">
      <h1 ...>Dashboard</h1>
      ...
    </div>
    <Suspense ...>
      <DashboardContent ... />
    </Suspense>
  </div>
);
```

---

### `src/components/reminders/notification-bell.tsx` — modified (D-17, D-18, D-19, D-20, D-22)

**Analog:** itself (lines 1-75) + `src/components/layout/bottom-tab-bar.tsx` lines 62-111 (mobile dropdown pattern)

**Current props interface** (lines 15-19 — extend):
```typescript
// BEFORE:
interface NotificationBellProps {
  householdSlug: string;
  count: number;
  items: ReminderItem[];
}

// AFTER (D-22: variant prop; D-18: cycleEvents; D-20: markNotificationsRead):
interface NotificationBellProps {
  householdSlug: string;
  count: number;
  items: ReminderItem[];
  cycleEvents?: CycleEventItem[];         // merged feed (D-18)
  variant?: "desktop" | "mobile";         // D-22: position-responsive
}
```

**Badge harmonization** (line 76 in bottom-tab-bar.tsx — replace `bg-destructive` with `bg-accent`):
```typescript
// BEFORE (mobile):
<span className="...bg-destructive text-white">
  {notificationCount > 9 ? "9+" : notificationCount}
</span>

// AFTER (D-19: harmonize to 99+ cap, bg-accent):
<Badge className="absolute -top-1 -right-1 ... bg-accent px-1 py-0 ... text-accent-foreground">
  {count > 99 ? "99+" : count}
</Badge>
```

**`useTransition` wiring for mark-read** (D-20 — new):
```typescript
"use client";
import { useTransition } from "react";
import { markNotificationsRead } from "@/features/household/actions";

// Inside component:
const [, startTransition] = useTransition();

// On dropdown open:
<DropdownMenu
  onOpenChange={(open) => {
    if (open && unreadIds.length > 0) {
      startTransition(() => {
        markNotificationsRead({
          householdId,
          householdSlug,
          notificationIds: unreadIds,  // snapshotted before state update
        });
      });
    }
  }}
>
```

**Unread cycle-event row styling** (D-18 — new in dropdown items):
```typescript
// Unread cycle event: border-l-2 border-accent stripe
<DropdownMenuItem
  className={cn(
    "group/item flex cursor-pointer flex-col items-start gap-1 py-2",
    !event.readAt && "border-l-2 border-accent pl-3",
    event.readAt && "opacity-60"
  )}
>
```

**Mobile variant trigger** (copy from bottom-tab-bar.tsx lines 65-82):
```typescript
// variant="mobile": flex-col, min-h-[44px], "Alerts" label, side="top"
// variant="desktop": size="icon" ghost button, p-2.5, align="end"
```

---

### `src/components/layout/bottom-tab-bar.tsx` — modified (D-21, D-22)

**Analog:** itself (lines 1-115)

**Change:** Delete inline dropdown (lines 62-111). Replace the `<DropdownMenu>` block with:
```typescript
import { NotificationBell } from "@/components/reminders/notification-bell";

// In the render — 4th tab slot (replaces lines 62-111):
<NotificationBell
  householdSlug={householdSlug}
  count={notificationCount}
  items={reminderItems}
  variant="mobile"
/>
```

**Props interface** (lines 15-19 — unchanged structurally, `reminderItems` stays):
```typescript
interface BottomTabBarProps {
  householdSlug: string;
  notificationCount: number;
  reminderItems: ReminderItem[];
}
```

---

### `src/components/household/cycle-start-banner.tsx` (new)

**Analog:** `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` lines 101-107 (allCaughtUp banner block) + `src/components/shared/timezone-warning.tsx` (outer shell with role="status")

**Banner shell contract** (from UI-SPEC — shared across all four banners):
```tsx
// Accent variant: bg-accent/10, border-accent/30
// Precedent: allCaughtUp div (dashboard/page.tsx line 102) + OnboardingBanner Card (border-accent/30 bg-accent/15)
<div
  role="status"
  className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3"
>
  <Sparkles className="h-5 w-5 shrink-0 text-accent mt-0.5" aria-hidden="true" />
  <div className="flex-1 space-y-1">
    <p className="text-sm text-foreground">
      You&apos;re up this cycle.
    </p>
    <p className="text-xs text-muted-foreground">
      {dueCount > 0
        ? `${dueCount} plants due · Cycle ends ${formattedEndDate}`
        : `No plants due right now · Cycle ends ${formattedEndDate}`}
    </p>
  </div>
</div>
```

**Props:**
```typescript
interface CycleStartBannerProps {
  assigneeName: string;
  dueCount: number;
  cycleEndDate: Date;
}
```

**Date formatting** (use `date-fns` `format` — same import as `actions.ts` line 6):
```typescript
import { format } from "date-fns";
const formattedEndDate = format(cycleEndDate, "EEE MMM d");
```

---

### `src/components/household/reassignment-banner.tsx` (new)

**Analog:** `src/components/shared/timezone-warning.tsx` (shell) + `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` allCaughtUp (accent tokens)

**Same banner shell as CycleStartBanner** (accent variant), with type-branched copy:
```typescript
interface ReassignmentBannerProps {
  priorAssigneeName: string;
  reassignType: "manual_skip" | "auto_skip" | "member_left";
  dueCount: number;
  cycleEndDate: Date;
}

// Subject copy per type:
const subject = {
  manual_skip: `${priorAssigneeName} skipped — you're covering this cycle.`,
  auto_skip:   `${priorAssigneeName} is unavailable — you're covering this cycle.`,
  member_left: `${priorAssigneeName} left the household — you're covering this cycle.`,
}[reassignType];
```

**Name rendering convention** (from `resolveInvitationByToken` lines 138-140):
```typescript
const ownerName = ownerMember?.user.name ?? ownerMember?.user.email ?? "An owner";
// Pattern: name ?? email — no separate fallback needed
```

**Icon:** `UserCheck` (same as used for cycle-event dropdown items per UI-SPEC)

---

### `src/components/household/passive-status-banner.tsx` (new)

**Analog:** `src/components/shared/timezone-warning.tsx` (muted variant — `bg-muted/50 border-border`)

**Muted variant shell:**
```tsx
<div
  role="status"
  className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
>
  <Users className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
  ...
</div>
```

**Props:**
```typescript
interface PassiveStatusBannerProps {
  assigneeName: string;
  nextAssigneeName?: string;  // undefined when memberCount === 1 (suppress whole banner)
  memberCount: number;
}
// Suppress banner entirely when memberCount === 1 (Claude's Discretion, UI-SPEC line 142)
```

**Next-assignee source:** `findNextAssignee` from `src/features/household/cycle.ts` line 110 — called at render time in the dashboard Server Component, passed as prop.

---

### `src/components/household/fallback-banner.tsx` (new)

**Analog:** `src/components/shared/timezone-warning.tsx` — exact pattern. Both use `role="alert"`, `AlertTriangle`, `text-muted-foreground` on muted background. Phase 5 uses `bg-destructive/10 border-destructive/30` variant instead.

**Destructive variant shell** (UI-SPEC: reuses `text-destructive` + `AlertTriangle` precedent from TimezoneWarning and `destructive-leave-dialog.tsx`):
```tsx
<div
  role="alert"   // "alert" not "status" — matches TimezoneWarning for urgent state
  className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
>
  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
  <div className="flex-1 space-y-1">
    <p className="text-sm text-foreground">
      <span className="font-semibold">{subjectLine}</span>
    </p>
    <p className="text-xs text-muted-foreground">{metaLine}</p>
  </div>
</div>
```

**Props + copy branching:**
```typescript
interface FallbackBannerProps {
  viewerIsOwner: boolean;
  ownerName: string;
  isPaused: boolean;  // cycle.status === "paused" vs transitionReason === "all_unavailable_fallback"
}

// Copy variants (UI-SPEC copywriting contract):
// Viewer is owner: "Nobody's available — you're covering this cycle."
// Viewer is non-owner: `Nobody's available — ${ownerName} is covering this cycle.`
// Paused (strict): "This week's rotation is paused."
```

---

### `src/features/reminders/types.ts` — extended (D-18 merged feed)

**Analog:** itself (lines 1-7)

**Current type:**
```typescript
export interface ReminderItem {
  plantId: string;
  nickname: string;
  roomName: string | null;
  statusLabel: string;
  daysOverdue: number;
}
```

**Addition — new sibling type for cycle events** (D-18 discriminated feed, planner decides union vs sibling):
```typescript
// Sibling type approach (recommended — keeps ReminderItem stable, avoids breaking callers):
export interface CycleEventItem {
  notificationId: string;
  type: string;              // "cycle_started" | "cycle_reassigned_*" | "cycle_fallback_owner"
  createdAt: Date;
  readAt: Date | null;
  priorAssigneeName?: string;  // for reassignment types
}
```

---

### `tests/phase-05/reminder-gate.test.ts` (new)

**Analog:** `tests/reminders.test.ts` (lines 1-148) — mocked Prisma, householdId-scoped branch assertions

**Mock header pattern** (copy from `tests/reminders.test.ts` lines 1-30):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: { count: vi.fn(), findMany: vi.fn() },
    cycle: { findFirst: vi.fn() },
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });
```

**Four branch test structure** (D-23 — copy assertion style from `tests/reminders.test.ts` lines 103-147):
```typescript
describe("getReminderCount — assignee gate (D-08, D-09, D-10)", () => {
  it("active cycle, viewer IS assignee → plant.count called, returns non-zero", async () => {
    // mock cycle.findFirst → { status: "active", assignedUserId: "user_A" }
    // mock plant.count → [3, 2]
    // call getReminderCount("hh", "user_A", start, end)
    // expect(db.plant.count).toHaveBeenCalled()
    // expect(result).toBe(5)
  });
  it("active cycle, viewer is NOT assignee → plant.count NOT called, returns 0", async () => {});
  it("paused cycle → plant.count called for ALL viewers (D-09 fallback)", async () => {});
  it("no active cycle (null) → returns 0 without calling plant.count", async () => {});
});
```

---

### `tests/phase-05/mark-notifications-read.test.ts` (new)

**Analog:** `tests/phase-04/create-invitation.test.ts` (lines 1-110) — exact authz test pattern

**Mock header pattern** (copy from `tests/phase-04/create-invitation.test.ts` lines 1-36):
```typescript
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    householdNotification: { updateMany: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});
```

**D-24 test cases** (three branches):
```typescript
describe("markNotificationsRead (D-24)", () => {
  test("non-member viewer → requireHouseholdAccess throws ForbiddenError", async () => {});
  test("member-but-not-recipient → updateMany called with recipientUserId filter, zero rows updated", async () => {
    // verify updateMany was called with { where: { ..., recipientUserId: session.user.id } }
  });
  test("authenticated recipient → updateMany called with notificationIds + readAt: new Date()", async () => {});
});
```

---

### `tests/phase-05/banner-*.test.tsx` (four new files — one per banner)

**Analog:** No exact component test analog exists in the codebase. Closest structural precedent is `tests/reminders.test.ts` (props-driven, branch assertions).

**Component test structure** (D-25 — React component unit tests, no real DB):
```typescript
// Example: tests/phase-05/banner-cycle-start.test.tsx
import { render, screen } from "@testing-library/react";
import { CycleStartBanner } from "@/components/household/cycle-start-banner";

describe("CycleStartBanner", () => {
  it("renders 'You're up this cycle.' subject", () => {
    render(<CycleStartBanner assigneeName="Alice" dueCount={3} cycleEndDate={new Date("2026-04-23")} />);
    expect(screen.getByText(/You're up this cycle/)).toBeInTheDocument();
  });
  it("zero-due variant shows 'No plants due right now'", () => {});
  it("has role='status' (not alert)", () => {
    const { container } = render(<CycleStartBanner ... />);
    expect(container.querySelector("[role='status']")).toBeTruthy();
  });
});
```

---

## Shared Patterns

### Authentication (7-step Server Action template)
**Source:** `src/features/household/actions.ts` `skipCurrentCycle` lines 134-179
**Apply to:** `markNotificationsRead` in `src/features/household/actions.ts`
```typescript
// Step 1: session check
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };

// Step 2: demo-mode guard
if (session.user.isDemo) {
  return { error: "Demo mode — sign up to save your changes." };
}

// Step 3: Zod parse
const parsed = schema.safeParse(data);
if (!parsed.success) return { error: "Invalid input." };

// Step 4: live household access
try {
  await requireHouseholdAccess(parsed.data.householdId);
} catch (err) {
  if (err instanceof ForbiddenError) return { error: err.message };
  throw err;
}

// Steps 5-6: business logic + DB write

// Step 7: revalidatePath + return { success: true as const }
```

### ForbiddenError + requireHouseholdAccess
**Source:** `src/features/household/guards.ts` lines 1-51
**Apply to:** `markNotificationsRead` action, `getCycleNotificationsForViewer` caller (layout already guards via `getCurrentHousehold`)
```typescript
import { requireHouseholdAccess, ForbiddenError } from "./guards";
```

### Banner shell structure (four banners)
**Source:** `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` lines 101-107 (allCaughtUp); `src/components/shared/timezone-warning.tsx` lines 28-51
**Apply to:** all four banner components under `src/components/household/`

Canonical shell:
```tsx
<div
  role="status"           // "alert" for FallbackBanner only
  className="flex items-start gap-3 rounded-lg border {variant-border} {variant-bg} px-4 py-3"
>
  <{Icon} className="h-5 w-5 shrink-0 {variant-icon-color} mt-0.5" aria-hidden="true" />
  <div className="flex-1 space-y-1">
    <p className="text-sm text-foreground">
      <span className="font-semibold">{subject}</span>
    </p>
    <p className="text-xs text-muted-foreground">{meta}</p>
  </div>
</div>
```

Token assignments:
| Banner | `{variant-bg}` | `{variant-border}` | `{variant-icon-color}` |
|--------|---------------|--------------------|------------------------|
| `CycleStartBanner` | `bg-accent/10` | `border-accent/30` | `text-accent` |
| `ReassignmentBanner` | `bg-accent/10` | `border-accent/30` | `text-accent` |
| `PassiveStatusBanner` | `bg-muted/50` | `border-border` | `text-muted-foreground` |
| `FallbackBanner` | `bg-destructive/10` | `border-destructive/30` | `text-destructive` |

### Zod v4 schema pattern
**Source:** `src/features/household/schema.ts` lines 1 and 83-87
**Apply to:** new `markNotificationsReadSchema` in same file
```typescript
import { z } from "zod/v4";
// cuid() for id fields, string().min(1) for slugs, array(z.cuid()).min(1) for id arrays
```

### `name ?? email` display name pattern
**Source:** `src/features/household/queries.ts` `resolveInvitationByToken` lines 138-140
**Apply to:** all four banners when rendering assignee/member names
```typescript
const displayName = member.user.name ?? member.user.email ?? "A member";
```

### Date formatting (cycle end date)
**Source:** `src/features/household/actions.ts` line 6 (`format as formatDate`)
**Apply to:** All banners that render `cycleEndDate`
```typescript
import { format } from "date-fns";
format(cycleEndDate, "EEE MMM d")  // → "Tue Apr 23"
```

### Mocked Prisma test header (authz tests)
**Source:** `tests/phase-04/create-invitation.test.ts` lines 1-36
**Apply to:** `tests/phase-05/mark-notifications-read.test.ts`, `tests/phase-05/reminder-gate.test.ts`
```typescript
vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/phase-05/banner-*.test.tsx` (component tests) | test | request-response | No existing React component unit tests in the codebase — all tests in `tests/` are either mocked-Prisma service tests or real-DB integration tests. Component render tests are a new pattern this phase. Standard `@testing-library/react` + Vitest setup applies. |

---

## Metadata

**Analog search scope:** `src/features/household/`, `src/features/reminders/`, `src/components/reminders/`, `src/components/layout/`, `src/components/shared/`, `src/components/onboarding/`, `src/app/(main)/h/[householdSlug]/`, `tests/`, `prisma/`
**Files scanned:** 18 source files read directly
**Pattern extraction date:** 2026-04-19
