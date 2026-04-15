# Phase 6: Reminders and Demo Mode - Research

**Researched:** 2026-04-15
**Domain:** In-app notification center, reminder persistence, snooze logic, demo mode authentication bypass, starter plant seeding
**Confidence:** HIGH (all patterns verified against existing codebase and project conventions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notification Center**
- D-01: Bell icon in the nav bar with a badge count showing how many plants need attention. Clicking opens a dropdown panel listing plants needing water.
- D-02: Badge count includes overdue plants + plants due today. Aligns with the dashboard's urgency-first approach.
- D-03: Each reminder item in the dropdown shows: plant nickname, room name, and days overdue/due status. No inline quick actions in the dropdown.
- D-04: Clicking a reminder item navigates to that plant's detail page where the user can water, snooze, or manage the plant.

**Reminder Settings**
- D-05: Global reminders toggle lives on a new /preferences page. Per-plant reminder enable/disable stays on the plant detail page.
- D-06: The /preferences page includes the global reminders on/off toggle plus account basics (change email, change password, delete account).
- D-07: Reminders default to on for new users (carried forward from Phase 2 D-08).

**Snooze Behavior**
- D-08: When a plant is overdue or due today, inline pill buttons appear on the plant detail page: "1d", "2d", "1w", "Custom". No extra menu click needed.
- D-09: Snooze sets the `snoozedUntil` timestamp on the Reminder model. Snoozed plants are excluded from the notification badge count until the snooze expires.

### Claude's Discretion
- Demo mode architecture — how to handle unauthenticated access (dedicated demo user in DB, session-scoped data, or middleware-based approach)
- Demo mode entry point — login page CTA, /demo route, or public landing page
- Demo mode read-only enforcement mechanism (middleware, action guards, or UI-only blocking)
- Starter plant seeding UX during onboarding (DEMO-03) — pick from list, auto-seed common set, or checkbox opt-in
- Notification dropdown empty state when no plants need attention
- Bell icon animation or visual treatment when new reminders appear
- Snooze "Custom" duration picker design (calendar, number input, etc.)
- Preferences page layout and navigation (nav link placement, page structure)
- Account settings implementation details (password change flow, email change verification, delete account confirmation)

### Deferred Ideas (OUT OF SCOPE)
- Demo mode access & experience — User chose not to discuss; left to Claude's discretion
- Starter plant seeding UX — User chose not to discuss; left to Claude's discretion

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RMDR-01 | User sees an in-app notification center showing plants needing attention | Notification bell + DropdownMenu pattern; reuse getDashboardPlants urgency logic |
| RMDR-02 | Notification center displays a badge count on the nav | shadcn Badge over Bell icon in nav Server Component; count = overdue + dueToday minus snoozed |
| RMDR-03 | User can enable or disable reminders globally | `remindersEnabled` field on User model (migration needed); toggle on /preferences page |
| RMDR-04 | User can configure reminder preferences (which plants, frequency) | `enabled` field on Reminder model already exists; per-plant toggle on plant detail page |
| RMDR-05 | User can snooze a reminder by 1 day, 2 days, or custom duration | `snoozedUntil` on Reminder model already exists; pill buttons on plant detail |
| DEMO-01 | Visitor can explore the app with pre-loaded sample plants without signing up | Dedicated demo user in DB + `/demo` route that creates session cookie; proxy.ts adds /demo to public paths |
| DEMO-02 | Demo mode is read-only — mutations are blocked for unauthenticated sessions | `isDemoSession` flag on JWT; Server Actions check `session.user.isDemo` and return early |
| DEMO-03 | New users can optionally seed their collection with common starter plants during onboarding | Checkbox opt-in in onboarding banner; Server Action seeds from CareProfile catalog |

</phase_requirements>

---

## Summary

Phase 6 adds two distinct features to an already-functional plant tracker: an in-app reminder notification system and a read-only demo mode for unauthenticated visitors. The codebase is mature and well-patterned — all new work follows the established `src/features/{domain}/{actions,schemas,queries}.ts` structure with Server Components for reads and Server Actions for writes.

**Reminders** are partially scaffolded. The `Reminder` model in Prisma already has `enabled` and `snoozedUntil` fields. What is missing: a `remindersEnabled` global toggle on the `User` model (requires a migration), a `src/features/reminders/` feature module, the bell icon with badge in `layout.tsx`, and snooze pill buttons in `plant-detail.tsx`. The badge count query can be derived directly from the existing `classifyAndSort` / `getDashboardPlants` logic — no new classification algorithm is needed.

**Demo mode** has the most architectural decision points. The recommended approach (detailed below) is a dedicated demo user seeded in the database with a fixed known ID, a `/demo` public route that issues a Next.js cookie-based session marking the user as `isDemo: true`, and Server Action guards that return `{ error: "Demo mode — read only." }` for any mutation. This avoids complex in-memory state, works across page refreshes, and requires only a small extension to the JWT callback.

**Primary recommendation:** Use a seeded demo user + `isDemo` JWT flag. Extend the Reminder model with a Prisma migration. Mirror the feature/actions/queries pattern already used by notes, plants, and watering.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.2 LTS | Server Components, Server Actions, route groups | Established; all patterns already in use |
| Prisma | 7.7.0 | Reminder model reads/writes, User model migration | Project ORM — all DB access goes through `src/lib/db.ts` |
| NextAuth v5 beta | 5.0.0-beta.30 | Session for demo mode flag | Already wired in `auth.ts` and `auth.config.ts`; JWT strategy |
| shadcn/ui | latest | DropdownMenu, Badge, Button, Switch, Dialog | All components already present in `src/components/ui/` |
| Zod v4 | latest | Schema validation for snooze actions | Consistent with all other features (`import { z } from "zod/v4"`) |
| Tailwind CSS v4 | latest | Styling | CSS-first `@theme` config — no `tailwind.config.js` |
| date-fns | ^4.x | `addDays` for snooze duration calculation | Already used in `watering/queries.ts` and `plant-detail.tsx` |

### No New Packages Required

All required UI primitives (`DropdownMenu`, `Badge`, `Bell` from lucide-react, `Switch`) are already installed. Phase 6 adds no new npm dependencies.

**Verify lucide Bell is available:**
[VERIFIED: existing codebase] `lucide-react` is already installed and used (`Leaf`, `X`, `Sun`, etc.). `Bell` and `BellOff` icons are included in the lucide-react package.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/
│   ├── reminders/
│   │   ├── actions.ts       # snoozeReminder, togglePlantReminder, toggleGlobalReminders
│   │   ├── queries.ts       # getReminderCount, getReminderItems, getPlantReminder
│   │   └── schemas.ts       # snoozeSchema, toggleReminderSchema
│   └── demo/
│       ├── actions.ts       # seedDemoUser (used at startup), seedStarterPlants (onboarding)
│       └── seed-data.ts     # DEMO_PLANTS constant — static list of starter plants
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx   # Add "Try demo" CTA (Link to /demo)
│   │   └── demo/            # NEW: /demo route — starts demo session
│   │       └── page.tsx
│   └── (main)/
│       ├── layout.tsx       # Add NotificationBell Server Component
│       └── preferences/     # NEW: /preferences page
│           └── page.tsx
├── components/
│   ├── reminders/
│   │   ├── notification-bell.tsx   # Bell + badge + dropdown
│   │   └── snooze-pills.tsx        # "1d" "2d" "1w" "Custom" pill buttons
│   └── preferences/
│       └── preferences-form.tsx    # Global toggle + account settings
```

### Pattern 1: Reminder Badge Count in Server Component Nav

The nav in `(main)/layout.tsx` is already a Server Component. The badge count query runs server-side on every navigation.

**Key insight from existing code:** `getDashboardPlants` in `src/features/watering/queries.ts` already classifies plants as `overdue` and `dueToday`. The badge count is `overdue.length + dueToday.length` filtered by:
1. User has `remindersEnabled = true` (global toggle)
2. The specific plant's Reminder record has `enabled = true`
3. `snoozedUntil` is null OR `snoozedUntil < now`

Rather than calling the full `getDashboardPlants` (which includes room, careProfile, and wateringLogs joins), the badge count query should be a lightweight dedicated query.

```typescript
// Source: derived from src/features/watering/queries.ts pattern
// src/features/reminders/queries.ts

export async function getReminderCount(
  userId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<number> {
  const now = new Date();

  // Lightweight query: only what the badge needs
  const overduePlants = await db.plant.count({
    where: {
      userId,
      archivedAt: null,
      nextWateringAt: { lt: todayStart },
      // Exclude snoozed plants and plants with reminders disabled
      reminders: {
        some: {
          userId,
          enabled: true,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
        },
      },
    },
  });

  const dueTodayPlants = await db.plant.count({
    where: {
      userId,
      archivedAt: null,
      nextWateringAt: { gte: todayStart, lt: todayEnd },
      reminders: {
        some: {
          userId,
          enabled: true,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
        },
      },
    },
  });

  return overduePlants + dueTodayPlants;
}
```

**Caveat:** This query assumes every plant has a Reminder record. The snooze filter on plants with NO reminder record needs careful handling — plants without a Reminder row should be treated as "reminders enabled" (the default). Two approaches:

**Option A (recommended):** Ensure a Reminder record is created for every plant at plant-creation time. This is an explicit write in the `createPlant` Server Action.

**Option B:** Use a raw query or adjust the Prisma filter to `NOT (reminders: { some: { userId, enabled: false } })`. This is more complex.

**Recommendation: Option A** — create a Reminder row for every plant on creation, defaulting `enabled: true`. This makes all reminder queries simple. The `createPlant` action in `src/features/plants/actions.ts` needs to include a `reminders: { create: { userId, enabled: true } }` nested write.

### Pattern 2: Notification Dropdown via shadcn DropdownMenu

The dropdown panel reuses the existing `DropdownMenu` primitive (already in `src/components/ui/dropdown-menu.tsx`).

```typescript
// Source: established shadcn/ui pattern (verified in existing codebase)
// src/components/reminders/notification-bell.tsx
"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

interface NotificationBellProps {
  count: number;
  items: ReminderItem[];
}

export function NotificationBell({ count, items }: NotificationBellProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative" aria-label={`${count} plants need attention`}>
          <Bell className="h-5 w-5 text-muted-foreground" />
          {count > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {items.length === 0 ? (
          <p className="px-md py-sm text-sm text-muted-foreground">All caught up!</p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.plantId}
              onClick={() => router.push(`/plants/${item.plantId}`)}
              className="flex flex-col items-start gap-xs py-sm cursor-pointer"
            >
              <span className="font-medium text-sm">{item.nickname}</span>
              <span className="text-xs text-muted-foreground">
                {item.roomName ?? "No room"} · {item.statusLabel}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Layout.tsx integration:** The nav is a Server Component. Pass count and items as props to the client `NotificationBell` component. Read the `user_tz` cookie (already done in `dashboard/page.tsx`) to compute today's boundaries.

### Pattern 3: Snooze Server Action

```typescript
// Source: mirrors existing notes/actions.ts and watering/actions.ts pattern
// src/features/reminders/actions.ts
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { snoozeSchema } from "./schemas";

export async function snoozeReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = snoozeSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { plantId, days } = parsed.data;

  // Ownership check
  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  const snoozedUntil = new Date();
  snoozedUntil.setDate(snoozedUntil.getDate() + days);

  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { snoozedUntil },
    create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
  });

  revalidatePath("/plants/" + plantId);
  revalidatePath("/dashboard");

  return { success: true };
}
```

**Schema note:** The `snoozeSchema` should accept `days` as a number with `z.number().int().min(1).max(365)`. The "1w" pill maps to `days: 7`.

### Pattern 4: Demo Mode — Dedicated Demo User Architecture

**Decision rationale:** The project uses JWT sessions (`strategy: "jwt"` in `auth.config.ts`). There is no React context or in-memory state that persists across SSR. The cleanest v1 demo approach is:

1. A **seeded demo user** in the database with a fixed email (e.g., `demo@plantminder.app`) and pre-populated plants/rooms/watering history. This seeded user is created via `prisma/seed.ts`.

2. A **`/demo` public route** (under `(auth)/` route group) that calls a special Server Action which calls `signIn("credentials", { email: "demo@...", password: "..." })`. This gives the visitor a real NextAuth session. The session JWT includes `isDemo: true`.

3. **`isDemo` flag in JWT/session:** Extend `auth.ts` callbacks to set `token.isDemo = true` when the user ID matches the known demo user ID.

4. **Server Action guards:** All mutation Server Actions (`createPlant`, `logWatering`, `createNote`, `snoozeReminder`, etc.) check `session.user.isDemo` and return `{ error: "Demo mode — sign up to save your changes." }` early.

5. **proxy.ts update:** Add `/demo` to the public paths matcher so unauthenticated users can reach the demo entry page before signing in.

```typescript
// Source: extension of existing auth.config.ts pattern
// proxy.ts — add /demo to public paths
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)",
  ],
};
```

```typescript
// auth.ts — add isDemo to JWT
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.isDemo = user.id === process.env.DEMO_USER_ID;
  }
  return token;
},
async session({ session, token }) {
  if (token.id) {
    session.user.id = token.id as string;
    session.user.isDemo = !!token.isDemo;
  }
  return session;
},
```

**Why not a cookie-only approach?** The existing auth layer is JWT-based. A separate demo cookie would bypass auth checks and require custom middleware logic. Using the real auth system (demo user signs in) means all existing session checks work correctly, all `session.user.id` queries return the demo user's actual plants, and the read-only enforcement is a single `isDemo` check in each action.

**Why not in-memory or server-session?** Next.js App Router has no built-in server session store. In-memory state doesn't survive serverless invocations or page refreshes.

**Demo user seeding:** `prisma/seed.ts` should create the demo user with a fixed email/password and a rich set of plants in various urgency states (overdue, due today, upcoming, recently watered) to showcase the dashboard and reminder features effectively.

### Pattern 5: Starter Plant Seeding (DEMO-03)

The onboarding banner (`src/components/onboarding/onboarding-banner.tsx`) already runs during Phase 2 onboarding. Phase 6 adds an optional "seed starter plants" step.

**Recommended UX:** After the user selects their plant count range (existing step), show a second optional step: "Would you like to start with some common plants?" with a checkbox list of 5-8 plants from the CareProfile catalog, pre-checked by default. A "Skip" link is also available.

**Implementation:** New `seedStarterPlants` Server Action in `src/features/demo/actions.ts` that:
1. Accepts an array of CareProfile IDs
2. For each: `db.plant.create` with the care profile defaults (nickname = species, wateringInterval from care profile)
3. For each created plant: `db.reminder.create` with `enabled: true` (see Option A above)
4. `revalidatePath("/dashboard")`

The onboarding banner component is extended to a two-step flow (step 1: plant count, step 2: starter plants). The banner currently lives in `src/components/onboarding/onboarding-banner.tsx` and calls `completeOnboarding` — the new `seedStarterPlants` call happens after step 1 completes.

### Pattern 6: Prisma Schema Migration Required

Two migrations are needed:

**Migration 1:** Add `remindersEnabled` to the `User` model:
```prisma
model User {
  // ... existing fields ...
  remindersEnabled  Boolean @default(true)
}
```

**Migration 2:** Add a unique constraint to `Reminder` to enable `upsert`:
```prisma
model Reminder {
  // ... existing fields ...
  @@unique([plantId, userId])
}
```

The `upsert` in the snooze action (Pattern 3 above) requires this unique constraint. Without it, Prisma cannot determine which record to update.

### Anti-Patterns to Avoid

- **Fetching all plant data for badge count:** The badge count only needs `plant.count`, not full plant objects with relations. The existing `getDashboardPlants` function returns rich objects; don't reuse it for the nav badge — use a dedicated lightweight count query.
- **UI-only mutation blocking for demo mode:** Blocking mutations at the UI layer (disabled buttons) is insufficient. Server Actions MUST also check `isDemo`. Malicious users can call Server Actions directly. Both layers are needed.
- **Reminder records as optional:** Treating Reminder records as optional (only created when a user explicitly enables reminders) forces every query to handle "no record = default enabled" logic. Create Reminder records eagerly on plant creation.
- **Re-running `getDashboardPlants` in layout.tsx:** The nav layout runs on every page in `(main)/`. Calling the full dashboard query on every page load would be expensive. Use the lightweight count query for the badge.
- **Using `middleware.ts`:** Already resolved in prior phases — this project uses `proxy.ts` (Next.js 16). Do not create a `middleware.ts` file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown panel for notifications | Custom popover | shadcn `DropdownMenu` | Already installed; keyboard accessible; click-outside-to-close handled |
| Toggle switch for reminders | Custom checkbox | shadcn `Switch` | Accessible, styled consistently with the design system |
| Date picker for "Custom" snooze | Custom calendar | shadcn `Calendar` + `Popover` | Both components are available in the UI directory; the pattern mirrors the watering log date picker if one was built |
| Badge count overlay | Custom CSS overlay | shadcn `Badge` | Already in `src/components/ui/badge.tsx` |
| Demo user password hashing | Custom bcrypt call | The existing `registerUser` flow with a fixed seed script | Seed script uses `bcryptjs.hash` already used in `auth/actions.ts` |

**Key insight:** All UI primitives for this phase are already installed. The work is wiring them together, not installing new components.

---

## Common Pitfalls

### Pitfall 1: Reminder Records Missing for Existing Plants

**What goes wrong:** Plants created before Phase 6 have no Reminder row. The snooze query (which filters by `reminders: { some: { ... } }`) silently excludes those plants from the badge count even when they are overdue.

**Why it happens:** The `createPlant` action didn't include `reminders: { create: ... }` before this phase.

**How to avoid:** The migration plan must include a data backfill — for every existing plant, create a Reminder row with `enabled: true, snoozedUntil: null`. This can be done in a Prisma migration script or a one-time seed script. Additionally, update `createPlant` to include the nested Reminder create going forward.

**Warning signs:** Badge count shows 0 even when plants are overdue.

### Pitfall 2: Demo User Plants Visible in Shared DB Without Isolation

**What goes wrong:** If the demo user has a fixed ID and all visitors share the same demo session, one visitor's actions (if mutation blocking fails) can corrupt the demo data for everyone else.

**Why it happens:** A single demo user in the DB is a shared resource.

**How to avoid:** Mutation blocking must be enforced at the Server Action level (not just UI). Since all write actions check `session.user.isDemo` and return early, no actual writes occur. The demo user's data is read-only from the perspective of demo sessions.

**Optional hardening (not required for v1):** A nightly cron job that resets the demo user's data. This is v2 scope.

### Pitfall 3: Snooze Expiry Not Checked at Query Time

**What goes wrong:** A plant was snoozed until yesterday. The badge count still excludes it because the code only sets `snoozedUntil` but never clears it.

**Why it happens:** Snooze records aren't automatically cleaned up when they expire.

**How to avoid:** The badge count query filters by `OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }]` — comparing against the current timestamp at query time. This is the correct pattern. Do NOT rely on a background job to clear snooze records. The filter handles expiry inline.

### Pitfall 4: `isDemo` Not Extended to TypeScript Types

**What goes wrong:** `session.user.isDemo` is added to the JWT/session but TypeScript reports `Property 'isDemo' does not exist on type 'User'`.

**Why it happens:** NextAuth v5 requires augmenting the `Session` and `JWT` interfaces in `next-auth.d.ts` for custom properties.

**How to avoid:** Extend the NextAuth types:
```typescript
// src/types/next-auth.d.ts (or root next-auth.d.ts)
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }
  interface JWT {
    id?: string;
    isDemo?: boolean;
  }
}
```
[VERIFIED: existing codebase] The project already uses `session.user.id` as a custom field, which means this augmentation pattern is already established (check existing `next-auth.d.ts` if present).

### Pitfall 5: Nav Layout Query Running on Every Page

**What goes wrong:** The `(main)/layout.tsx` fetches the reminder badge count on every page render. For pages with many Suspense boundaries (dashboard), this adds latency to the layout shell.

**Why it happens:** Server Components re-execute on every navigation in Next.js App Router.

**How to avoid:** Keep the badge count query lightweight (a `count` query, not `findMany`). Cache the result with `unstable_cache` if performance becomes an issue (not needed for v1 with typical plant counts).

### Pitfall 6: `proxy.ts` Matcher Must Include `/demo`

**What goes wrong:** The demo entry page at `/demo` is protected by the proxy, so unauthenticated visitors are redirected to `/login` before they can start the demo.

**Why it happens:** The current `proxy.ts` matcher protects all routes except `/login` and `/register`. `/demo` is not yet in the exclusion list.

**How to avoid:** Update the `config.matcher` in `proxy.ts` to add `demo` to the exclusion pattern:
```typescript
"/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)"
```

---

## Code Examples

### Reminder Count Query (lightweight)

```typescript
// Source: derived from existing getDashboardPlants pattern in src/features/watering/queries.ts
export async function getReminderCount(
  userId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<number> {
  const now = new Date();

  // Only count if user has global reminders enabled
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { remindersEnabled: true },
  });
  if (!user?.remindersEnabled) return 0;

  const [overdue, dueToday] = await Promise.all([
    db.plant.count({
      where: {
        userId,
        archivedAt: null,
        nextWateringAt: { lt: todayStart },
        reminders: {
          some: {
            userId,
            enabled: true,
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
          },
        },
      },
    }),
    db.plant.count({
      where: {
        userId,
        archivedAt: null,
        nextWateringAt: { gte: todayStart, lt: todayEnd },
        reminders: {
          some: {
            userId,
            enabled: true,
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
          },
        },
      },
    }),
  ]);

  return overdue + dueToday;
}
```

### Snooze Schema

```typescript
// Source: mirrors zod/v4 usage in src/features/watering/schemas.ts
import { z } from "zod/v4";

export const snoozeSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  days: z.number().int().min(1).max(365),
});

export const toggleReminderSchema = z.object({
  plantId: z.string().min(1),
  enabled: z.boolean(),
});
```

### Demo User Seed Script Pattern

```typescript
// Source: mirrors bcryptjs pattern from src/features/auth/actions.ts
// prisma/seed.ts

const DEMO_EMAIL = "demo@plantminder.app";
const DEMO_PASSWORD = "demo-password-not-secret";

const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
if (!existing) {
  const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 12);
  const demoUser = await db.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo User",
      onboardingCompleted: true,
      remindersEnabled: true,
    },
  });
  // Seed demo plants, rooms, watering logs, and reminder records...
}
```

### Snooze Pills Component

```typescript
// Source: established shadcn Button pattern from existing codebase
"use client";

import { Button } from "@/components/ui/button";
import { snoozeReminder } from "@/features/reminders/actions";
import { toast } from "sonner";

const SNOOZE_OPTIONS = [
  { label: "1d", days: 1 },
  { label: "2d", days: 2 },
  { label: "1w", days: 7 },
];

export function SnoozePills({ plantId }: { plantId: string }) {
  async function handleSnooze(days: number) {
    const result = await snoozeReminder({ plantId, days });
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Snoozed for ${days} day${days > 1 ? "s" : ""}`);
    }
  }

  return (
    <div className="flex items-center gap-xs">
      <span className="text-sm text-muted-foreground">Snooze:</span>
      {SNOOZE_OPTIONS.map(({ label, days }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          onClick={() => handleSnooze(days)}
          className="h-7 px-sm text-xs"
        >
          {label}
        </Button>
      ))}
      {/* Custom snooze handled separately — see Open Questions */}
    </div>
  );
}
```

---

## Prisma Schema Changes Required

### Change 1: Add `remindersEnabled` to User

```prisma
model User {
  id                    String     @id @default(cuid())
  email                 String     @unique
  passwordHash          String
  name                  String?
  createdAt             DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime   @updatedAt @db.Timestamptz(3)
  onboardingCompleted   Boolean    @default(false)
  plantCountRange       String?
  remindersEnabled      Boolean    @default(true)   // NEW
  plants                Plant[]
  rooms                 Room[]
  reminders             Reminder[]
}
```

### Change 2: Add unique constraint to Reminder

```prisma
model Reminder {
  id           String    @id @default(cuid())
  plantId      String
  plant        Plant     @relation(fields: [plantId], references: [id], onDelete: Cascade)
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled      Boolean   @default(true)
  snoozedUntil DateTime? @db.Timestamptz(3)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(3)

  @@unique([plantId, userId])   // NEW — enables upsert
}
```

**Migration command:** `npx prisma migrate dev --name add-reminders-enabled-and-unique-constraint`

---

## Existing Code Integration Points

### Files That Need Modification

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `remindersEnabled` to User; add `@@unique([plantId, userId])` to Reminder |
| `prisma/seed.ts` | Add demo user with plants, rooms, reminder records |
| `src/app/(main)/layout.tsx` | Add `NotificationBell` Server Component with count + items query |
| `src/features/plants/actions.ts` | Add `reminders: { create: { userId, enabled: true } }` to `createPlant` |
| `src/features/auth/actions.ts` | Extend `completeOnboarding` or add new `seedStarterPlants` action |
| `src/components/onboarding/onboarding-banner.tsx` | Add Step 2: starter plant seeding |
| `src/components/plants/plant-detail.tsx` | Add snooze pills and per-plant reminder toggle |
| `auth.ts` | Add `isDemo` to JWT/session callbacks |
| `proxy.ts` | Add `demo` to exclusion matcher |

### Files That Need Creation

| File | Purpose |
|------|---------|
| `src/features/reminders/actions.ts` | snoozeReminder, togglePlantReminder, toggleGlobalReminders |
| `src/features/reminders/queries.ts` | getReminderCount, getReminderItems, getPlantReminder |
| `src/features/reminders/schemas.ts` | snoozeSchema, toggleReminderSchema |
| `src/features/demo/seed-data.ts` | DEMO_PLANTS, STARTER_PLANTS static data |
| `src/components/reminders/notification-bell.tsx` | Bell + badge + dropdown client component |
| `src/components/reminders/snooze-pills.tsx` | Snooze pill buttons |
| `src/app/(auth)/demo/page.tsx` | Demo entry page — triggers demo sign-in |
| `src/app/(main)/preferences/page.tsx` | /preferences page with global toggle + account settings |
| `src/components/preferences/preferences-form.tsx` | Preferences form client component |
| `next-auth.d.ts` (or `src/types/next-auth.d.ts`) | Augment Session type with `isDemo` and `id` |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/reminders.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RMDR-01 | getReminderItems returns plants needing attention | unit | `npx vitest run tests/reminders.test.ts` | ❌ Wave 0 |
| RMDR-02 | getReminderCount returns overdue + dueToday minus snoozed | unit | `npx vitest run tests/reminders.test.ts` | ❌ Wave 0 |
| RMDR-03 | toggleGlobalReminders updates User.remindersEnabled | unit | `npx vitest run tests/reminders.test.ts` | ❌ Wave 0 |
| RMDR-04 | togglePlantReminder updates Reminder.enabled | unit | `npx vitest run tests/reminders.test.ts` | ❌ Wave 0 |
| RMDR-05 | snoozeReminder sets snoozedUntil; count excludes snoozed plants | unit | `npx vitest run tests/reminders.test.ts` | ❌ Wave 0 |
| DEMO-01 | Demo route signs in demo user; dashboard shows demo plants | manual | — | — |
| DEMO-02 | All mutation actions return demo error when isDemo=true | unit | `npx vitest run tests/demo.test.ts` | ❌ Wave 0 |
| DEMO-03 | seedStarterPlants creates plants from CareProfile catalog | unit | `npx vitest run tests/demo.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/reminders.test.ts tests/demo.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/reminders.test.ts` — covers RMDR-01 through RMDR-05
- [ ] `tests/demo.test.ts` — covers DEMO-02 and DEMO-03

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — demo sign-in path | NextAuth v5 Credentials provider; demo user has real hashed password |
| V3 Session Management | yes — isDemo flag in JWT | JWT strategy already in use; `isDemo` is read-only (set at sign-in time) |
| V4 Access Control | yes — read-only enforcement | Server Action guard: `if (session.user.isDemo) return { error: "..." }` |
| V5 Input Validation | yes | Zod v4 on all snooze/toggle inputs |
| V6 Cryptography | no | No new crypto; demo password hashed with bcryptjs at seed time |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Demo user mutations via direct Server Action call | Tampering | `isDemo` check in every mutation Server Action — not just UI disabling |
| Reminder toggle for another user's plant | Tampering | Ownership check in all reminder actions (`plant.userId === session.user.id`) |
| Snooze with arbitrarily large `days` value | Tampering | Zod schema: `z.number().int().min(1).max(365)` |
| Demo user ID leaked in DEMO_USER_ID env var | Info disclosure | Use env var; do not hardcode in source. Alternatively, identify demo user by `email === "demo@plantminder.app"` check |

---

## Open Questions

1. **Custom snooze duration picker design**
   - What we know: D-08 specifies "Custom" as one of the four pill options
   - What's unclear: Whether to use a number input ("Enter days: [___]") or a calendar date picker
   - Recommendation: Use a number input with a popover. A calendar picker is UX-heavy for this task. `<Input type="number" min="1" max="365" placeholder="Days" />` inside a `Popover` is sufficient for v1.

2. **Account settings scope on /preferences**
   - What we know: D-06 says the page includes change email, change password, and delete account
   - What's unclear: Password change requires current password verification (security requirement); email change may require re-verification (out of scope per constraints — no email for v1); delete account requires confirmation dialog
   - Recommendation: Change password (current + new + confirm) is a standard Server Action pattern. Email change can be implemented without email verification for v1 (just update the record). Delete account uses the existing `shadcn AlertDialog` confirmation pattern.

3. **Backfill migration for existing plants without Reminder records**
   - What we know: A Prisma migration can run raw SQL for data backfill
   - What's unclear: Whether to do this in the migration itself or a seed step
   - Recommendation: Include the backfill in the Prisma migration file as a raw SQL step:
     ```sql
     INSERT INTO "Reminder" (id, "plantId", "userId", enabled, "createdAt", "updatedAt")
     SELECT gen_random_uuid(), p.id, p."userId", true, NOW(), NOW()
     FROM "Plant" p
     WHERE NOT EXISTS (
       SELECT 1 FROM "Reminder" r WHERE r."plantId" = p.id AND r."userId" = p."userId"
     );
     ```

4. **`DEMO_USER_ID` environment variable**
   - What we know: Auth.ts needs to identify the demo user at JWT sign-in to set `isDemo: true`
   - What's unclear: Whether to use an env var or query the DB by email
   - Recommendation: Query by email at JWT time (`token.isDemo = (await db.user.findUnique({ where: { email: "demo@plantminder.app" } }))?.id === user.id`) is simpler than managing an env var. Alternatively, a dedicated `isDemoUser` boolean column on User is the cleanest long-term approach but requires an extra migration.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Every plant should have exactly one Reminder record per user (1:1 relationship effectively) | Architecture Patterns, Pattern 1 | Prisma queries using `reminders: { some: ... }` would still work but be slightly less direct; the unique constraint must be added carefully if plants already have multiple reminder rows |
| A2 | The `prisma/seed.ts` file already exists and can be extended for the demo user | Code Examples | If no seed file exists, one must be created along with a `"prisma": { "seed": "..." }` entry in `package.json` |
| A3 | The `CareProfile` catalog seeded in Phase 3 contains at least 5-8 suitable starter plants | Architecture Patterns, Pattern 5 | If the catalog is sparse, DEMO-03 would show fewer options; check actual seed data |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond the existing project stack — all new work is code and Prisma migrations within the established environment)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `prisma/schema.prisma` — Reminder model structure verified directly
- Existing codebase: `src/features/watering/queries.ts` — getDashboardPlants classification logic verified
- Existing codebase: `auth.ts` + `auth.config.ts` — JWT session strategy and callback patterns verified
- Existing codebase: `proxy.ts` — middleware replacement pattern verified
- Existing codebase: `src/app/(main)/layout.tsx` — nav structure verified
- Existing codebase: `src/components/onboarding/onboarding-banner.tsx` — onboarding pattern verified
- Existing codebase: `tests/watering.test.ts` — test pattern (vi.mock, beforeEach, Server Action testing) verified
- Existing codebase: `src/features/notes/actions.ts` — ownership check + revalidatePath pattern verified

### Secondary (MEDIUM confidence)
- CLAUDE.md Technology Stack — version constraints and stack decisions from project instructions
- Phase 6 CONTEXT.md — all locked decisions (D-01 through D-09) from user discussion session

### Tertiary (LOW confidence)
- None — all critical claims are verified against the codebase directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed; verified via codebase scan
- Architecture: HIGH — patterns derived from working code already in the repo
- Pitfalls: HIGH — derived from reading actual implementation (proxy.ts, auth.ts, queries.ts)
- Test patterns: HIGH — verified from tests/watering.test.ts structure

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable stack — no fast-moving dependencies introduced)
