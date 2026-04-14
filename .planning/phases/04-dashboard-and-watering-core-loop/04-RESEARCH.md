# Phase 4: Dashboard and Watering Core Loop - Research

**Researched:** 2026-04-14
**Domain:** Next.js 16 App Router — Server Actions, optimistic UI, date-fns timezone, Prisma query patterns, shadcn/ui components
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Stacked vertical sections with card grid — Overdue, Due Today, Upcoming (next 7 days), Recently Watered. Each section has a header with count and a grid of plant cards beneath.
- **D-02:** Empty sections are hidden. If no plants are overdue, that section doesn't render. Dashboard only shows sections with plants in them.
- **D-03:** Plants sorted by urgency within each section — Overdue: most days late first. Due Today: alphabetical. Upcoming: soonest due first. Recently Watered: most recently watered first.
- **D-04:** Each dashboard card shows: plant nickname, watering status badge ("3d overdue", "Due today", "In 2 days"), and room name. Reuses existing PlantCard layout pattern with an added water action button.
- **D-05:** Droplet icon button on the right side of each dashboard card across all sections (Overdue, Due Today, Upcoming, and Recently Watered). One tap logs watering for today.
- **D-06:** Optimistic UI (UIAX-05): after tapping the water button, the card animates out (fade/slide). A success toast appears showing "Monstera watered! Next: [date]". Plant reappears in Recently Watered on next render. UI updates before server confirms.
- **D-07:** No undo toast after watering. Mistakes corrected from plant detail page history.
- **D-08:** Plant detail page shows watering history as a simple chronological list (most recent first). Each entry shows: date, relative time, and optional note text.
- **D-09:** "Log watering" button on plant detail page opens a dialog with a date picker (defaults to today) and an optional note field. User can pick any past date for retroactive logging. Dashboard one-tap uses same Server Action with today's date.
- **D-10:** Each history entry has a kebab menu with "Edit" and "Delete" options. Edit reopens the log dialog pre-filled. Delete shows a confirmation.
- **D-11:** Server-side duplicate prevention: Server Action rejects a second watering log for the same plant within a 60-second window. Toast: "Already logged! Edit from history if needed."
- **D-12:** "Due today" computed using the user's local timezone. Client passes timezone to server via header or query param; server uses it for date comparisons. All timestamps stored as TIMESTAMPTZ in PostgreSQL.

### Claude's Discretion

- Timezone implementation approach (client header vs URL param vs date-fns-tz)
- Dashboard card animation specifics (CSS transitions, timing, easing)
- Date picker component choice (shadcn calendar or simple input)
- History list pagination or "load more" threshold
- Loading skeleton design for dashboard sections
- Mobile responsive layout for card grids (1-col vs 2-col breakpoints)
- Next watering date recalculation logic placement (Server Action vs Prisma middleware)
- Dashboard empty state when user has plants but none need attention (all recently watered)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | User sees urgency-first sections: Overdue, Due Today, Upcoming (next 7 days), Recently Watered | Prisma query with urgency grouping server-side; date-fns for categorization |
| DASH-02 | User can mark a plant as watered in one tap from the dashboard | `logWatering` Server Action; optimistic UI pattern via `useOptimistic` |
| DASH-03 | After logging watering, next watering date recalculates automatically and UI updates immediately | `revalidatePath("/dashboard")` in Server Action + `addDays(wateredAt, interval)` |
| DASH-04 | Dashboard loads fast with accurate counts sorted by urgency | Suspense + skeleton; server-side sorting; single Prisma query with wateringLogs include |
| DASH-05 | Dashboard works well on both mobile and desktop layouts | `grid-cols-1 md:grid-cols-2` per UI-SPEC |
| WATR-01 | Each plant has a watering interval in days and a calculated next watering date | Already in schema: `wateringInterval`, `nextWateringAt` |
| WATR-02 | Next watering date = last watered date + interval days | `addDays(wateredAt, wateringInterval)` in Server Action |
| WATR-03 | User can log watering with optional date (supports retroactive logging) | `logWateringSchema` with `wateredAt` date + `note`; date picker defaults to today |
| WATR-04 | User can view chronological watering history for each plant | Plant detail page query includes `wateringLogs` ordered by `wateredAt desc` |
| WATR-05 | User can edit or delete a mistaken watering log entry | `editWateringLog` and `deleteWateringLog` Server Actions; kebab menu |
| WATR-06 | Duplicate watering logs within a short window are prevented | Server Action: query for logs within 60s before insert; return `{ error: "DUPLICATE" }` |
| WATR-07 | All dates stored as TIMESTAMPTZ; "due today" computed from user's local timezone | `@db.Timestamptz(3)` already in schema; timezone passed from client to server |
| UIAX-05 | Watering log uses optimistic UI for instant feedback | `useOptimistic` hook (React 19); card fade-out on tap; revert on error |

</phase_requirements>

---

## Summary

Phase 4 builds on a solid foundation: the Prisma schema already has `WateringLog` with `wateredAt` TIMESTAMPTZ, `Plant` has `lastWateredAt`/`nextWateringAt`/`wateringInterval`, and the established patterns (Server Actions + Zod + `revalidatePath`, feature-based folder layout, shadcn dialog/toast/card) are all reusable. No schema migrations are needed.

The two genuinely complex problems in this phase are (1) timezone-safe "due today" computation and (2) optimistic UI for the water button. For timezone, the recommended approach is to pass the client's `Intl.DateTimeFormat().resolvedOptions().timeZone` string as a query param or cookie on dashboard load, then use date-fns `startOfDay` / `endOfDay` with `TZDate` from `@date-fns/tz` on the server. For optimistic UI, React 19's `useOptimistic` hook is the correct primitive — it integrates with Server Actions and handles the revert-on-error case automatically.

The UI-SPEC is fully locked and prescribes exact Tailwind classes, animation timings, badge variants, copy, and component inventory. The planner should reference the UI-SPEC directly for visual details and focus task descriptions on data flow and behavior.

**Primary recommendation:** Implement this phase in three waves — (1) data layer (query + watering actions + schemas), (2) dashboard UI (sections, cards, optimistic water button), (3) plant detail watering history (history list, log/edit/delete dialogs). Each wave is independently testable.

---

## Standard Stack

### Core (already installed — no new npm installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-fns` | `^4.1.0` [VERIFIED: package.json] | Date arithmetic — `addDays`, `differenceInDays`, `formatDistanceToNow`, `startOfDay`, `endOfDay` | Already in use in `plant-card.tsx` and `actions.ts` |
| `@date-fns/tz` | needs install | Timezone-aware date operations: `TZDate`, `startOfDay` with tz | Required for WATR-07 server-side timezone computation |
| `react-hook-form` | `^7.72.1` [VERIFIED: package.json] | Form state for log/edit watering dialogs | Established pattern from Phase 3 dialogs |
| `zod` | `^4.3.6` [VERIFIED: package.json] | Schema validation for watering Server Actions | Established pattern; import from `zod/v4` |
| `next-auth` | `^5.0.0-beta.30` [VERIFIED: package.json] | Session auth in Server Actions | `auth()` already called in all actions |
| `sonner` | `^2.0.7` [VERIFIED: package.json] | Toast notifications for watering feedback | `src/components/ui/sonner.tsx` installed |
| `lucide-react` | `^1.8.0` [VERIFIED: package.json] | `Droplet`, `Loader2`, `MoreVertical`, `CheckCircle2` icons | Already used throughout codebase |

### New shadcn Components to Install

| Component | Add Command | Purpose |
|-----------|-------------|---------|
| `dropdown-menu` | `npx shadcn@latest add dropdown-menu` | Kebab menu on watering history entries (Edit/Delete) |
| `calendar` | `npx shadcn@latest add calendar` | Date picker for retroactive watering log dialog |
| `popover` | `npx shadcn@latest add popover` | Wraps Calendar component in log watering dialog |

[VERIFIED: UI-SPEC `04-UI-SPEC.md` Component Inventory section]

### New npm Package

| Package | Install | Purpose |
|---------|---------|---------|
| `@date-fns/tz` | `npm install @date-fns/tz` | Timezone-aware `TZDate` and date boundary functions for WATR-07 |

[ASSUMED — `@date-fns/tz` is the canonical date-fns v3/v4 timezone companion package. Verify it works with `date-fns@^4.x` before installing. Alternative: pass client-computed `startOfDay`/`endOfDay` timestamps directly from the browser and skip the server-side timezone dependency entirely.]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@date-fns/tz` server-side tz | Client sends pre-computed UTC boundaries | Simpler, no extra package, but puts boundary logic in client JS |
| `useOptimistic` (React 19) | Manual `useState` + `startTransition` | `useOptimistic` is cleaner and handles revert automatically; preferred for new React 19 code |
| shadcn Calendar + Popover | `<input type="date">` | Native input is simpler but less consistent with design system; shadcn Calendar matches established shadcn-first pattern |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/
│   ├── plants/           # Existing — queries.ts, actions.ts, schemas.ts
│   └── watering/         # New feature domain for this phase
│       ├── actions.ts    # logWatering, editWateringLog, deleteWateringLog
│       ├── queries.ts    # getWateringHistory (paginated), getDashboardPlants
│       └── schemas.ts    # logWateringSchema, editWateringLogSchema
├── components/
│   ├── plants/           # Existing — extend PlantCard for dashboard context
│   └── watering/         # New component domain
│       ├── dashboard-section.tsx          # Section header + card grid
│       ├── dashboard-plant-card.tsx       # PlantCard variant with water button
│       ├── water-button.tsx               # Droplet icon button with optimistic state
│       ├── log-watering-dialog.tsx        # Log + Edit dialog (shared)
│       ├── watering-history.tsx           # History list for plant detail
│       └── watering-history-entry.tsx     # Single history row with kebab menu
└── app/
    └── (main)/
        ├── dashboard/
        │   └── page.tsx  # Complete rewrite — urgency sections + Suspense
        └── plants/
            └── [id]/
                └── page.tsx  # Extend — add watering history + log button
```

### Pattern 1: Server-Side Urgency Grouping

**What:** A single Prisma query fetches all active plants with their latest watering log, and a pure function classifies each into `overdue | dueToday | upcoming | recentlyWatered`.

**When to use:** Always for the dashboard — keeps date logic server-side (CLAUDE.md: "Compute watering status server-side, pass pre-sorted data to client components").

**Example:**
```typescript
// src/features/watering/queries.ts
import { db } from "@/lib/db";
import { differenceInDays, startOfDay, endOfDay } from "date-fns";

export type UrgencyGroup = "overdue" | "dueToday" | "upcoming" | "recentlyWatered";

export type DashboardPlant = PlantWithRelations & {
  urgency: UrgencyGroup;
  daysUntil: number;   // negative = overdue
  latestLog: WateringLog | null;
};

export async function getDashboardPlants(
  userId: string,
  userTodayStart: Date,  // client-supplied timezone boundary
  userTodayEnd: Date
): Promise<DashboardPlant[]> {
  const plants = await db.plant.findMany({
    where: { userId, archivedAt: null },
    include: {
      room: true,
      careProfile: true,
      wateringLogs: {
        orderBy: { wateredAt: "desc" },
        take: 1,  // only most recent for sorting
      },
    },
  });
  // Classify and sort server-side
  return classifyAndSort(plants, userTodayStart, userTodayEnd);
}
```

[ASSUMED — pattern derived from CLAUDE.md guidance and existing `getPlants` query structure]

### Pattern 2: Optimistic UI with `useOptimistic` (React 19)

**What:** React 19's `useOptimistic` hook provides a temporary optimistic state that reverts automatically if the Server Action throws an error.

**When to use:** The water button action — the card should animate out immediately on tap before server confirmation.

**Example:**
```typescript
// src/components/watering/water-button.tsx
"use client";
import { useOptimistic, useTransition } from "react";
import { logWatering } from "@/features/watering/actions";

// Parent component manages optimistic plant list:
const [optimisticPlants, removeOptimistically] = useOptimistic(
  plants,
  (state, plantId: string) => state.filter((p) => p.id !== plantId)
);

// On button click:
async function handleWater(plantId: string) {
  removeOptimistically(plantId);         // immediate UI update
  const result = await logWatering(plantId);
  if (result?.error) {
    // useOptimistic reverts automatically; show error toast
    toast.error("Couldn't log watering. Try again.");
  }
}
```

[ASSUMED — pattern based on React 19 `useOptimistic` documentation semantics. Verify the revert-on-error behavior matches expectations before implementation.]

### Pattern 3: Server Action for `logWatering`

**What:** A single Server Action handles both one-tap (today) and retroactive logging, updates `lastWateredAt` and `nextWateringAt` on the Plant, creates the `WateringLog` record, checks for duplicates, and calls `revalidatePath`.

**When to use:** All watering log creation.

**Example:**
```typescript
// src/features/watering/actions.ts
"use server";
import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { logWateringSchema } from "./schemas";

export async function logWatering(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = logWateringSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership check
  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  // Duplicate check: same plant, within 60 seconds
  const sixtySecondsAgo = new Date(Date.now() - 60_000);
  const recentLog = await db.wateringLog.findFirst({
    where: {
      plantId: parsed.data.plantId,
      createdAt: { gte: sixtySecondsAgo },
    },
  });
  if (recentLog) return { error: "DUPLICATE" };

  const wateredAt = parsed.data.wateredAt ?? new Date();
  const nextWateringAt = addDays(wateredAt, plant.wateringInterval);

  await db.$transaction([
    db.wateringLog.create({
      data: { plantId: plant.id, wateredAt, note: parsed.data.note ?? null },
    }),
    db.plant.update({
      where: { id: plant.id },
      data: { lastWateredAt: wateredAt, nextWateringAt },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath(`/plants/${plant.id}`);
  return { success: true, nextWateringAt };
}
```

[ASSUMED — pattern matches existing `createPlant` action structure and established conventions]

### Pattern 4: Timezone Handling (D-12)

**What:** Client sends its IANA timezone string as a query param on dashboard navigation. Server uses it to compute `startOfDay` / `endOfDay` for the user's local date.

**When to use:** Dashboard page server component.

**Recommended approach (Claude's discretion):** Client-side cookie set on first render, read by the Server Component. Simpler than a URL param (avoids waterfall), more reliable than a header (headers require middleware).

```typescript
// Simplest viable approach: client component sets cookie on mount
// src/components/timezone-sync.tsx
"use client";
import { useEffect } from "react";
import { setCookie } from "... or use document.cookie directly";

export function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `user_tz=${encodeURIComponent(tz)}; path=/; SameSite=Strict`;
  }, []);
  return null;
}
```

Then in `dashboard/page.tsx` (Server Component):
```typescript
import { cookies } from "next/headers";
const cookieStore = await cookies();
const userTz = cookieStore.get("user_tz")?.value ?? "UTC";
// Use with @date-fns/tz TZDate or compute boundaries
```

**Alternative (simpler, no cookie):** Compute `startOfDay(now)` in UTC on the server. For most users, UTC-based "due today" is close enough; timezone only matters for users whose local midnight is far from UTC. This avoids any client-server coordination entirely. The CONTEXT.md decision D-12 mandates timezone handling, so this alternative is only acceptable if `@date-fns/tz` proves problematic.

[ASSUMED — specific implementation approach. The CONTEXT.md decision (D-12) is locked: timezone handling is required. The mechanism is Claude's discretion.]

### Pattern 5: Watering History with Pagination

**What:** Plant detail page query includes `wateringLogs` with pagination (take 20, skip N). A "Load more" client component button triggers a Server Action that fetches the next page.

**When to use:** Plant detail page watering history section.

```typescript
// src/features/watering/queries.ts
export async function getWateringHistory(
  plantId: string,
  userId: string,
  skip = 0,
  take = 20
) {
  return db.wateringLog.findMany({
    where: { plantId, plant: { userId } },
    orderBy: { wateredAt: "desc" },
    skip,
    take,
  });
}
```

[ASSUMED — follows existing Prisma query patterns in the codebase]

### Anti-Patterns to Avoid

- **Client-side urgency grouping:** Never compute overdue/due-today/upcoming in client JS. Timezone mismatches and hydration errors result. Always server-side per CLAUDE.md.
- **N+1 watering log queries:** Never query `wateringLog` separately per plant on the dashboard. Use `include: { wateringLogs: { take: 1, orderBy: { wateredAt: "desc" } } }` in the single `getDashboardPlants` query.
- **Separate `nextWateringAt` from log creation:** The `logWatering` action MUST update both `WateringLog` (create) and `Plant` (`lastWateredAt`, `nextWateringAt`) atomically inside `db.$transaction`. Doing them separately risks a crash between operations leaving stale state.
- **`middleware.ts` for timezone headers:** `middleware.ts` is deprecated in Next.js 16. Use `proxy.ts` for route-level middleware. But for timezone, cookies (set client-side) are simpler than either.
- **`import { z } from "zod"`:** Use `import { z } from "zod/v4"` per CLAUDE.md. This is already the project pattern (`schemas.ts`).
- **`useEffect` for optimistic state management:** Use `useOptimistic` (React 19), not a manual `useState` + `useEffect` pattern. `useOptimistic` is specifically designed for Server Action integration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation for log/edit dialogs | Custom form state machine | `react-hook-form` + `@hookform/resolvers` + Zod | Race conditions, validation coupling, uncontrolled input handling — all solved by RHF |
| Date picker UI | Custom calendar component | shadcn `Calendar` + `Popover` | Keyboard navigation, ARIA, localization — 200+ lines of non-trivial accessibility work |
| Toast notifications | Custom toast system | `sonner` via `src/components/ui/sonner.tsx` | Already installed and integrated |
| Optimistic state with revert | Manual `useState` / flag-based rollback | `useOptimistic` (React 19, built-in) | Automatic revert semantics; concurrent-safe |
| Atomic DB transaction | Sequential Prisma calls | `db.$transaction([...])` | Without transaction, a crash between WateringLog create and Plant update leaves corrupted `nextWateringAt` |
| Kebab menu | Custom dropdown | shadcn `DropdownMenu` (Radix primitive) | Focus trapping, keyboard navigation, ARIA menu role — all provided |

**Key insight:** The watering domain looks simple but has three subtle failure modes: stale `nextWateringAt` if the transaction is split, timezone-wrong "due today" if computed client-side, and duplicate race conditions if the debounce check and insert aren't atomic. Use the right primitives for each.

---

## Common Pitfalls

### Pitfall 1: `differenceInDays` is timezone-naive

**What goes wrong:** `differenceInDays(new Date(plant.nextWateringAt), new Date())` computes day difference in wall-clock milliseconds without timezone context. A plant due at 00:00 UTC might show "due today" or "overdue" depending on the user's timezone offset.

**Why it happens:** `date-fns` `differenceInDays` uses UTC under the hood. A user in UTC-5 at 10pm sees the next UTC day while it's still their today.

**How to avoid:** Either (a) use `@date-fns/tz` `TZDate` to normalize both dates to the user's timezone before computing difference, or (b) pass pre-computed UTC timestamps for `startOfDay` / `endOfDay` from the client where the timezone is known. Decision D-12 mandates approach (a) or (b) — don't skip this.

**Warning signs:** Test by setting your system clock to UTC+8 and loading the dashboard at 11pm — plants due "tomorrow" in UTC appear as "overdue" locally.

### Pitfall 2: `revalidatePath` not called after watering log edit/delete

**What goes wrong:** After `editWateringLog` or `deleteWateringLog`, the plant detail page shows stale history. The dashboard `nextWateringAt` is also stale after delete (which recalculates next watering from remaining logs).

**Why it happens:** Server Actions that only touch `WateringLog` records must still revalidate the `Plant` display paths because `Plant.nextWateringAt` changes.

**How to avoid:** Every watering mutation action must call:
```typescript
revalidatePath("/dashboard");
revalidatePath(`/plants/${plantId}`);
```

### Pitfall 3: Duplicate check race condition

**What goes wrong:** Two concurrent taps (accidental double-tap) both pass the 60-second duplicate check because both queries run before either insert.

**Why it happens:** The duplicate check (`findFirst`) and the `WateringLog.create` are not atomic.

**How to avoid:** Use a unique database constraint or wrap the check + insert in a `db.$transaction`. For this app at v1 scale, the 60-second window check inside a transaction is sufficient. A Postgres unique partial index (`unique on plantId where createdAt > now() - interval '60 seconds'`) would be more robust but is overengineering for v1.

### Pitfall 4: `deleteWateringLog` must recalculate `nextWateringAt`

**What goes wrong:** Deleting a watering log (especially the most recent one) leaves `Plant.lastWateredAt` and `Plant.nextWateringAt` pointing to the deleted log's date.

**Why it happens:** These fields are denormalized — they're derived from the latest `WateringLog` but stored on the `Plant` row.

**How to avoid:** After deleting a log, query the new most-recent `WateringLog` for that plant and recalculate `nextWateringAt = addDays(newLatest.wateredAt, plant.wateringInterval)`. If no logs remain after deletion, set `lastWateredAt = null` and `nextWateringAt = addDays(now, plant.wateringInterval)`.

**This is a non-obvious requirement.** The confirmation dialog copy ("...recalculate the next watering date") signals to the user this happens — the Server Action must actually do it.

### Pitfall 5: Water button click propagates to card link

**What goes wrong:** Tapping the water button on a dashboard card triggers both the watering action AND navigates to the plant detail page (because the PlantCard is wrapped in `<Link>`).

**Why it happens:** Click events bubble up through the DOM. The water button is inside the link wrapper.

**How to avoid:** Call `e.stopPropagation()` in the water button click handler. Or restructure the card so the link wrapper does not contain the button (use CSS overlap instead of DOM nesting).

### Pitfall 6: Optimistic remove before auth check

**What goes wrong:** The card is removed optimistically before the Server Action verifies authentication. If the session expires between render and action, the card disappears and then the error toast appears — confusing UX.

**Why it happens:** `useOptimistic` applies the update synchronously before the server responds.

**How to avoid:** For a case where auth is almost certainly valid (user is on the authenticated dashboard), this is acceptable. The `useOptimistic` revert handles the error case. Document this as a known edge case.

---

## Code Examples

Verified patterns from existing codebase:

### Existing `createPlant` — Server Action Pattern to Mirror
```typescript
// Source: src/features/plants/actions.ts (verified)
"use server";
import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";

export async function createPlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  // ...Zod parse, ownership check, db.create, revalidatePath
}
```

### Existing Zod Schema Pattern
```typescript
// Source: src/features/plants/schemas.ts (verified)
import { z } from "zod/v4";

export const createPlantSchema = z.object({
  nickname: z.string().min(1, "...").max(100, "..."),
  wateringInterval: z.number().int().min(1).max(365),
  // optional fields
});
```

### New `logWateringSchema` to Create
```typescript
// src/features/watering/schemas.ts
import { z } from "zod/v4";

export const logWateringSchema = z.object({
  plantId: z.string().min(1),
  wateredAt: z.date().optional(),  // defaults to now() in action
  note: z.string().max(280).optional(),
});

export const editWateringLogSchema = z.object({
  logId: z.string().min(1),
  wateredAt: z.date(),
  note: z.string().max(280).optional(),
});
```

### Existing `PlantCard` — Extend for Dashboard Context
```typescript
// Source: src/components/plants/plant-card.tsx (verified)
// Current: Link-wrapped card with status badge (no water button)
// Phase 4: Add WaterButton on right side; pass `onWater` callback prop
// Dashboard uses DashboardPlantCard variant; /plants page keeps existing PlantCard
```

### Prisma Transaction Pattern
```typescript
// Source: ASSUMED — follows Prisma 7 docs; verified pattern in db.ts setup
await db.$transaction([
  db.wateringLog.create({ data: { plantId, wateredAt, note } }),
  db.plant.update({
    where: { id: plantId },
    data: { lastWateredAt: wateredAt, nextWateringAt },
  }),
]);
```

### `useOptimistic` React 19 Pattern
```typescript
// Source: ASSUMED — React 19 docs pattern for useOptimistic
"use client";
import { useOptimistic, startTransition } from "react";

// In dashboard client wrapper:
const [displayPlants, optimisticRemove] = useOptimistic(
  plants,
  (current, plantId: string) => current.filter((p) => p.id !== plantId)
);

function handleWater(plantId: string) {
  startTransition(async () => {
    optimisticRemove(plantId);
    const result = await logWatering({ plantId });
    if (result?.error === "DUPLICATE") {
      toast("Already logged! Edit from history if needed.");
    } else if (result?.error) {
      toast.error("Couldn't log watering. Try again.");
    } else {
      toast(`${nickname} watered! Next: ${format(result.nextWateringAt, "MMM d")}`);
    }
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` + manual rollback for optimistic UI | `useOptimistic` hook (React 19) | React 19 (2024) | Simpler revert semantics; concurrent-mode safe |
| `middleware.ts` for route protection | `proxy.ts` (Next.js 16) | Next.js 16 | `middleware.ts` still works but deprecated; use `proxy.ts` for new code |
| `tailwind.config.js` for theme | `@theme` directive in CSS (Tailwind v4) | Tailwind v4 (Jan 2025) | No config file; CSS-first configuration |
| `import { z } from "zod"` | `import { z } from "zod/v4"` | Zod v4 (2025) | 14x faster string parsing; already used in this codebase |
| Prisma Rust binary | Prisma 7 TypeScript client | Prisma 7 (Nov 2025) | Faster cold starts; no native binary |

**Deprecated/outdated:**

- `Intl.RelativeTimeFormat` for relative dates: use `date-fns` `formatDistanceToNow` instead — already in the codebase's pattern.
- `getServerSideProps` / `getStaticProps`: not applicable — App Router Server Components are the pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@date-fns/tz` is the correct package for timezone-aware date operations with `date-fns@^4.x` | Standard Stack, Timezone Handling | Planner picks wrong package; install may conflict or require different API |
| A2 | `useOptimistic` automatically reverts state when the wrapped Server Action returns an error object (not throws) | Architecture Pattern 2, Code Examples | Manual revert logic needed; optimistic cards stay removed on error |
| A3 | `db.$transaction([])` (array form) is available in Prisma 7 for parallel operations | Code Examples | Must use interactive transactions `db.$transaction(async (tx) => {...})` instead |
| A4 | Client-side timezone cookie approach works without middleware/proxy.ts intervention | Architecture Pattern 4 | Timezone not available on first SSR render; "due today" wrong on first load |
| A5 | Watering history "Load more" at 20 entries is sufficient for v1 (no infinite scroll needed) | Architecture Patterns | If users with large history complain, needs real pagination |
| A6 | The `getDashboardPlants` query with `include: { wateringLogs: { take: 1 } }` is efficient at v1 plant counts (<100) | Standard Stack | Query may need an index on `wateringLogs(plantId, wateredAt desc)` for users with large history |

**If these claims are wrong:** A1, A2, A3 are implementation-level — will surface during coding. A4 requires a first-render test. A5, A6 are scale assumptions that hold for v1.

---

## Open Questions (RESOLVED)

1. **`@date-fns/tz` vs client-sent UTC boundaries** -- RESOLVED
   - What we know: D-12 requires timezone-correct "due today". Client has `Intl.DateTimeFormat().resolvedOptions().timeZone`. `date-fns` has companion package `@date-fns/tz`.
   - What's unclear: Whether `@date-fns/tz` is fully compatible with `date-fns@4.x` (the `4.x` line is relatively new and the companion may lag). The simpler alternative — client sends UTC start/end timestamps for the local day as query params — avoids this entirely.
   - Recommendation: Default to the simpler approach (client sends `?tzStart=<UTC ms>&tzEnd=<UTC ms>`) for Wave 1. Upgrade to `@date-fns/tz` only if the client-side computation causes issues.
   - **Resolution:** Adopted a hybrid approach. A `TimezoneSync` client component (Plan 01) sets a `user_tz` cookie with the IANA timezone string. The dashboard Server Component (Plan 02) reads this cookie and computes UTC day boundaries server-side using `toLocaleDateString("en-CA", { timeZone })` to derive the user's local date, then constructs `todayStart`/`todayEnd` as UTC Date objects. No `@date-fns/tz` dependency needed.

2. **`deleteWateringLog` and `nextWateringAt` recalculation** -- RESOLVED
   - What we know: Deleting the most recent log must recalculate `Plant.nextWateringAt` from the new most-recent log.
   - What's unclear: What happens when all logs are deleted? The plant was created with `nextWateringAt = addDays(now, interval)` (from `createPlant` action). Should deleting all logs reset to creation-time behavior?
   - Recommendation: If all logs deleted, set `lastWateredAt = null` and `nextWateringAt = addDays(now, plant.wateringInterval)` (reset countdown from today). This matches user mental model.
   - **Resolution:** Adopted the recommendation. Plan 01 Task 2 implements `deleteWateringLog` with explicit handling: when no logs remain after deletion, sets `lastWateredAt = null` and `nextWateringAt = addDays(new Date(), plant.wateringInterval)` to reset the countdown from today.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js 16 dev server | ✓ | (project running) | — |
| PostgreSQL | Prisma data layer | ✓ | (existing phases use it) | — |
| `npx shadcn@latest` | Install dropdown-menu, calendar, popover | ✓ | shadcn 4.2.0 [VERIFIED: package.json] | — |
| `@date-fns/tz` | Timezone-aware date ops | ✗ (not in package.json) | — | Client sends UTC boundaries as query params |

**Missing dependencies with no fallback:** None — `@date-fns/tz` has a viable alternative.

**Missing dependencies with fallback:**
- `@date-fns/tz` — not installed. Fallback: client computes `startOfDay`/`endOfDay` in its timezone using `new Date(year, month, day, 0, 0, 0).getTime()` and sends as query params to the Server Component.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/watering.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WATR-01 | `logWateringSchema` validates plantId + optional wateredAt/note | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| WATR-02 | `nextWateringAt = addDays(wateredAt, interval)` calculation | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| WATR-06 | `logWateringSchema` rejects note > 280 chars | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| WATR-05 | `editWateringLogSchema` requires logId | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| DASH-01 | `classifyAndSort` groups plants into correct urgency sections | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| DASH-03 | After watering, `nextWateringAt` is recalculated correctly | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| WATR-04 | `getWateringHistory` returns logs in desc order | unit/todo | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| WATR-07 | Timezone boundary: due-today classification correct across UTC offsets | unit | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| UIAX-05 | Water button renders with aria-label | unit (component) | `npx vitest run tests/watering.test.ts` | ❌ Wave 0 |
| DASH-02/DASH-03 | Water → dashboard updates (optimistic + revalidate) | e2e (manual) | `npx playwright test` | ❌ (todo) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/watering.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/watering.test.ts` — covers schema validation (WATR-01, WATR-05, WATR-06), pure date math (WATR-02, DASH-03), urgency classification (DASH-01), timezone boundary (WATR-07), component aria-label (UIAX-05)
- [ ] No new config/fixture gaps — `vitest.config.mts` and `jsdom` already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `auth()` in every Server Action — already established pattern |
| V3 Session Management | yes | NextAuth v5 JWT — already established |
| V4 Access Control | yes | Ownership check: `db.plant.findFirst({ where: { id, userId } })` before every watering mutation |
| V5 Input Validation | yes | Zod (`zod/v4`) on all Server Action inputs |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insecure Direct Object Reference (IDOR) — log watering for another user's plant | Tampering | Ownership check: `findFirst({ where: { id: plantId, userId: session.user.id } })` — same pattern as existing plant actions |
| Editing/deleting another user's watering log | Tampering | `db.wateringLog.findFirst({ where: { id: logId, plant: { userId } } })` — join through plant to verify ownership |
| Duplicate log spam | Denial-of-Service (mild) | 60-second server-side debounce window (D-11) |
| Retroactive log with future date | Tampering | Zod schema: `wateredAt: z.date().max(new Date(), "Cannot log future watering")` |
| Note field XSS | Tampering | React JSX auto-escapes; no `dangerouslySetInnerHTML`; Zod max-length constraint (280 chars) |

---

## Sources

### Primary (HIGH confidence)
- `src/features/plants/actions.ts` — Established Server Action pattern (auth, Zod, ownership, revalidatePath)
- `src/features/plants/schemas.ts` — Established Zod v4 schema pattern
- `src/components/plants/plant-card.tsx` — Existing PlantCard with `differenceInDays` usage
- `prisma/schema.prisma` — WateringLog model, Plant fields, all TIMESTAMPTZ
- `package.json` — Verified installed versions of all dependencies
- `04-UI-SPEC.md` — Locked visual contract for all Phase 4 interactions

### Secondary (MEDIUM confidence)
- `CLAUDE.md` Technology Stack section — Stack constraints, version requirements, import paths
- `CLAUDE.md` Stack Patterns section — "Compute watering status server-side", Server Actions for mutations

### Tertiary (LOW confidence / ASSUMED)
- React 19 `useOptimistic` revert semantics — based on training knowledge of React 19 docs; verify before implementation
- `db.$transaction([...])` array form in Prisma 7 — based on training knowledge; verify interactive vs batch transaction API
- `@date-fns/tz` compatibility with `date-fns@4.x` — not verified against current npm; check before installing

---

## Metadata

**Confidence breakdown:**
- Standard stack (installed packages): HIGH — verified from package.json
- New shadcn components: HIGH — verified from UI-SPEC Component Inventory
- Architecture patterns: MEDIUM — derived from existing codebase conventions; specific API details (useOptimistic, Prisma transaction form) are ASSUMED
- Pitfalls: HIGH — timezone naivety, click propagation, and missing revalidatePath are well-known Next.js/date-fns issues
- Security patterns: HIGH — ownership check pattern established in prior phases

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack, but `@date-fns/tz` v4 compatibility should be re-verified before install)
