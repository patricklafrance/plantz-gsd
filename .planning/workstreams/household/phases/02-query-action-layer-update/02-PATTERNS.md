# Phase 2: Query + Action Layer Update - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 38 new/modified files
**Analogs found:** 38 / 38

All files in Phase 2 are either (a) in-place migrations of existing v1 code or (b) new files that compose primitives already shipped by Phase 1. Every item has at least a role-match analog; most have exact analogs in the existing repo.

---

## File Classification

### New files (household feature + layout tree + legacy bridges)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/household/actions.ts` | mutator (Server Action) | CRUD + transaction | `src/features/auth/actions.ts` lines 12-102 (`registerUser`) | exact |
| `src/features/household/context.ts` | reader (cached helper) | request-response | `src/features/household/guards.ts` lines 31-51 (`requireHouseholdAccess`) | role-match |
| `src/features/household/queries.ts` (extend) | reader | request-response | existing file — extends with `getUserHouseholds` | exact |
| `src/features/household/schema.ts` (extend) | schema (Zod) | — | `src/features/plants/schemas.ts` lines 1-16 (`createPlantSchema`) | exact |
| `src/app/(main)/h/[householdSlug]/layout.tsx` | layout chokepoint | request-response | `src/app/(main)/layout.tsx` lines 14-22 (session check in layout) | role-match |
| `src/app/(main)/h/[householdSlug]/error.tsx` | error boundary (Client) | — | `src/components/plants/add-plant-dialog.tsx` lines 1-5 ("use client" pattern); no existing error.tsx in repo | partial — no analog |
| `src/app/(main)/h/[householdSlug]/not-found.tsx` | 404 boundary | — | no existing `not-found.tsx` in repo | no analog (Next.js-standard) |
| `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` | page (Server Component) | request-response | `src/app/(main)/dashboard/page.tsx` | exact — move + rewire |
| `src/app/(main)/h/[householdSlug]/dashboard/loading.tsx` | loading skeleton | — | `src/app/(main)/dashboard/loading.tsx` | exact — move |
| `src/app/(main)/h/[householdSlug]/plants/page.tsx` | page | request-response | `src/app/(main)/plants/page.tsx` | exact — move + rewire |
| `src/app/(main)/h/[householdSlug]/plants/loading.tsx` | loading skeleton | — | `src/app/(main)/plants/loading.tsx` | exact — move |
| `src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx` | dynamic page | request-response | `src/app/(main)/plants/[id]/page.tsx` | exact — move + rewire |
| `src/app/(main)/h/[householdSlug]/rooms/page.tsx` | page | request-response | `src/app/(main)/rooms/page.tsx` | exact — move + rewire |
| `src/app/(main)/h/[householdSlug]/rooms/loading.tsx` | loading skeleton | — | `src/app/(main)/rooms/loading.tsx` | exact — move |
| `src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx` | dynamic page | request-response | `src/app/(main)/rooms/[id]/page.tsx` | exact — move + rewire |
| `src/app/(main)/dashboard/page.tsx` (replace) | legacy redirect stub | request-response | `src/app/(main)/dashboard/page.tsx` lines 111-115 (auth + redirect pattern) | role-match |
| `src/app/(main)/plants/page.tsx` (replace) | legacy redirect stub | request-response | same as above | role-match |
| `src/app/(main)/plants/[id]/page.tsx` (replace) | legacy dynamic redirect stub | request-response | same as above | role-match |
| `src/app/(main)/rooms/page.tsx` (replace) | legacy redirect stub | request-response | same as above | role-match |
| `src/app/(main)/rooms/[id]/page.tsx` (replace) | legacy dynamic redirect stub | request-response | same as above | role-match |

### Modified files (query + action migration)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/plants/actions.ts` | mutator | CRUD | `src/features/household/guards.ts` + self (extend in place) | exact |
| `src/features/plants/queries.ts` | reader | CRUD | self (swap `userId` → `householdId`) | exact |
| `src/features/plants/schemas.ts` | schema (Zod) | — | self (extend with `householdId` field) | exact |
| `src/features/rooms/actions.ts` | mutator | CRUD | self + `plants/actions.ts` migration pattern | exact |
| `src/features/rooms/queries.ts` | reader | CRUD | self | exact |
| `src/features/rooms/schemas.ts` | schema (Zod) | — | self (extend with `householdId`) | exact |
| `src/features/watering/actions.ts` | mutator | CRUD + nested-relation check | self + `plants/actions.ts` migration pattern | exact |
| `src/features/watering/queries.ts` | reader | nested-relation CRUD | self (swap `plant: { userId }` → `plant: { householdId }`) | exact |
| `src/features/watering/schemas.ts` | schema (Zod) | — | self (extend with `householdId`) | exact |
| `src/features/notes/actions.ts` | mutator | CRUD + nested-relation check | self + `plants/actions.ts` migration pattern | exact |
| `src/features/notes/queries.ts` | reader | nested-relation CRUD | self | exact |
| `src/features/notes/schemas.ts` | schema (Zod) | — | self (extend with `householdId`) | exact |
| `src/features/reminders/actions.ts` | mutator | CRUD + nested-relation check | self + `plants/actions.ts` migration pattern | exact |
| `src/features/reminders/queries.ts` | reader | nested-relation aggregation | self | exact |
| `src/features/reminders/schemas.ts` | schema (Zod) | — | self (extend with `householdId`) | exact |
| `src/features/demo/actions.ts` | bootstrap mutator | transactional CRUD | `src/features/auth/actions.ts` lines 44-86 (`$transaction` + slug loop) | role-match |
| `src/features/auth/actions.ts` (opportunistic) | mutator | — | self (1-line `isDefault: true` add on line 78-85) | exact |
| `auth.ts` (opportunistic WR-01 fix) | JWT/session callback | — | self line 39 | exact |
| `prisma/schema.prisma` (additive migration) | schema | — | `prisma/schema.prisma` existing fields (additive) | exact |

### Test files (new + filled-in todos)

| Test File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/household-create.test.ts` (new) | unit test (mocked Prisma) | — | `tests/notes.test.ts` lines 1-24 (mock setup) + `tests/household.test.ts` lines 155-220 (transactional source-shape pattern) | role-match |
| `tests/plants.test.ts` (fill todos) | unit test (mocked Prisma) | — | `tests/notes.test.ts` lines 88-138 (action-under-test pattern) | exact |
| `tests/rooms.test.ts` (fill todos) | unit test | — | same | exact |
| `tests/watering.test.ts` (extend) | unit test | — | self lines 1-42 (mock setup, already thorough) | exact |
| `tests/notes.test.ts` (extend) | unit test | — | self lines 1-24 | exact |
| `tests/reminders.test.ts` (fill todos) | unit test | — | `tests/notes.test.ts` action-under-test pattern | role-match |
| `tests/household.test.ts` (extend) | schema-shape test | — | self lines 25-133 (fs.readFileSync → regex match pattern) | exact |

---

## Pattern Assignments

### `src/features/household/actions.ts` (Server Action, CRUD + transaction) — `createHousehold`

**Analog:** `src/features/auth/actions.ts` lines 12-102 (`registerUser`)

**Imports pattern** (`src/features/auth/actions.ts` lines 1-10):
```typescript
"use server";

import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import bcryptjs from "bcryptjs";
import { registerSchema } from "./schemas";
import { onboardingSchema } from "./schemas";
import { generateHouseholdSlug } from "@/lib/slug";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
```
For `createHousehold` drop `signIn`, `bcryptjs`, `isRedirectError`; add `createHouseholdSchema` from `./schema` (note: singular, not `./schemas` — the `household` feature folder uses `schema.ts` per Phase 1).

**Auth + demo gate pattern** (`src/features/plants/actions.ts` lines 10-12):
```typescript
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };
if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };
```
First three lines of `createHousehold`. Exact verbatim.

**`$transaction` + slug-collision loop** (`src/features/auth/actions.ts` lines 44-86):
```typescript
await db.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: parsed.data.email, passwordHash },
  });

  // Slug collision loop (D-10). Statistically near-impossible to collide
  // with 54^8 ≈ 72 trillion possible slugs, but defend anyway.
  let slug: string;
  let attempts = 0;
  do {
    slug = generateHouseholdSlug();
    const existing = await tx.household.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) break;
    if (++attempts > 10) {
      throw new Error("Slug generation failed after 10 attempts");
    }
  } while (true);

  const household = await tx.household.create({
    data: {
      name: "My Plants",
      slug,
      timezone: detectedTimezone,
      cycleDuration: 7,
      rotationStrategy: "sequential",
    },
  });

  await tx.householdMember.create({
    data: {
      userId: user.id,
      householdId: household.id,
      role: "OWNER",
      rotationOrder: 0,
    },
  });
});
```
For `createHousehold` drop the `tx.user.create` call (user already exists from session); keep the slug loop + household.create + householdMember.create verbatim. New member row additionally sets `isDefault: false` (per Q7 recommendation in RESEARCH — user's original auto-created household remains the default).

**Zod safeParse pattern** (`src/features/plants/actions.ts` lines 14-15):
```typescript
const parsed = createPlantSchema.safeParse(data);
if (!parsed.success) return { error: "Invalid input." };
```
Same line right after the demo guard.

**Return shape** (`src/features/plants/actions.ts` line 41):
```typescript
return { success: true, plantId: plant.id };
```
`createHousehold` returns `{ success: true, household }` (the full Household row, not just id — consumers will need name + slug for redirect in Phase 6).

---

### `src/features/household/queries.ts` — extend with `getUserHouseholds` (reader, request-response)

**Analog:** `src/features/rooms/queries.ts` lines 1-9 (`getRooms`) and existing `resolveHouseholdBySlug` in same file (lines 13-18)

**Imports + module pattern** (existing file lines 1-18):
```typescript
import { db } from "@/lib/db";

export async function resolveHouseholdBySlug(slug: string) {
  return db.household.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
}
```
Append `getUserHouseholds` below it. No "use server" needed — queries are plain server functions consumed by Server Components.

**`findMany` with include + sort** (`src/features/rooms/queries.ts` lines 3-9):
```typescript
export async function getRooms(userId: string) {
  return db.room.findMany({
    where: { userId },
    include: { _count: { select: { plants: true } } },
    orderBy: { createdAt: "asc" },
  });
}
```
`getUserHouseholds(userId)` calls `db.householdMember.findMany({ where: { userId }, include: { household: true }, orderBy: { createdAt: "asc" } })`, then maps to `{ household, role, isDefault, joinedAt: createdAt }[]`. Sort by `createdAt` asc (D-08).

---

### `src/features/household/context.ts` (NEW — reader, cached helper)

**Analog:** `src/features/household/guards.ts` lines 31-51 (`requireHouseholdAccess`) — composes it

**Pattern source:** RESEARCH.md §Pattern 1 / §Code Examples "Cached household resolution" — verbatim target. No existing `cache()` usage in this repo (first consumer), so this file establishes the pattern for Phase 5+6.

**Imports pattern** (matches `guards.ts` lines 1-2 for db access):
```typescript
import { cache } from "react";
import { notFound } from "next/navigation";
import { resolveHouseholdBySlug } from "./queries";
import { requireHouseholdAccess } from "./guards";
```

**Body — copy from RESEARCH.md §Pattern 1 verbatim:**
```typescript
/**
 * Per-request cached: resolves slug → householdId → membership context.
 * Called from layout (mandatory) and from any nested Server Component
 * that needs the household. React.cache() ensures the DB round-trips
 * happen at most once per request.
 *
 * Per D-03/D-18: this is per-request, NOT cross-request — a user
 * removed mid-session sees the change on their next page load.
 * Does NOT cross Server-Component → Server-Action boundary;
 * every mutating action still hits the live DB via requireHouseholdAccess.
 */
export const getCurrentHousehold = cache(async (slug: string) => {
  const summary = await resolveHouseholdBySlug(slug);
  if (!summary) notFound();
  return await requireHouseholdAccess(summary.id);
});
```

---

### `src/features/household/schema.ts` — extend with `createHouseholdSchema`

**Analog:** `src/features/plants/schemas.ts` lines 1-16 (`createPlantSchema`) — same Zod v4 shape style + existing file `schema.ts` lines 1-16 (already uses `zod/v4` import path)

**Existing file imports and pattern** (`src/features/household/schema.ts` lines 1-16):
```typescript
import { z } from "zod/v4";

export const householdRoleSchema = z.enum(["OWNER", "MEMBER"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

export const rotationStrategySchema = z.enum(["sequential"]);
export type RotationStrategy = z.infer<typeof rotationStrategySchema>;
```

**Append `createHouseholdSchema`** — pattern from `src/features/plants/schemas.ts` lines 3-16:
```typescript
export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required.").max(80),
  timezone: z.string().optional(),          // optional; defaults to "UTC" in action body
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
```
Exact field shape is Claude's discretion (CONTEXT D-06 says name + default timezone; cycleDuration/rotationStrategy are not user-input in v1).

---

### `src/app/(main)/h/[householdSlug]/layout.tsx` (NEW — layout chokepoint)

**Analog:** `src/app/(main)/layout.tsx` lines 14-22 (async layout + session check) — role-match; inner layout is thinner because the outer `(main)/layout.tsx` still runs first

**Async layout + params pattern** (`src/app/(main)/plants/[id]/page.tsx` lines 14-22, the closest existing `params: Promise<...>` consumer):
```typescript
export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  // ...
}
```

**Body — copy from RESEARCH.md §Pattern 2 verbatim**, minus session check (outer layout already gates — keep only the household-scope chokepoint):
```typescript
import { getCurrentHousehold } from "@/features/household/context";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdSlug: string }>;
}) {
  const { householdSlug } = await params;
  await getCurrentHousehold(householdSlug);  // 404/403 from here
  return <>{children}</>;
}
```

**Note on chrome relocation (Q11 recommendation):** This plan assumes the outer `(main)/layout.tsx` KEEPS the chrome (top nav, NotificationBell, BottomTabBar). The inner layout is a pure chokepoint — no UI. RESEARCH Q11 flags Option A (move chrome inward) as the ideal end-state, but that is Claude's discretion; a defensible Phase 2 implementation can keep the chrome in `(main)/layout.tsx` and defer the chrome refactor to Phase 6 where the switcher lands. Whichever is chosen, the inner layout MUST call `getCurrentHousehold` unconditionally.

---

### `src/app/(main)/h/[householdSlug]/error.tsx` (NEW — Client error boundary)

**Analog:** No existing `error.tsx` in repo. Use RESEARCH.md §Code Examples "Error boundary for ForbiddenError" verbatim.

**"use client" + props pattern** (from `src/components/plants/add-plant-dialog.tsx` line 1):
```typescript
"use client";
```

**Body** (RESEARCH.md §Code Examples "Error boundary for ForbiddenError" — copy verbatim):
```typescript
"use client";

import Link from "next/link";

export default function HouseholdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.name === "ForbiddenError") {
    return (
      <div className="space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold">You don&apos;t have access to this household</h1>
        <p className="text-muted-foreground">
          Ask the household owner to invite you, or switch to one of yours.
        </p>
        <Link href="/dashboard" className="text-accent underline">
          Go to my dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <button onClick={reset} className="text-accent underline">Try again</button>
    </div>
  );
}
```
Error check uses `error.name === "ForbiddenError"` (string comparison) because cross-module `instanceof` is already guaranteed by `Object.setPrototypeOf` in `guards.ts:16`, but the name-check is simpler for client-boundary serialization.

---

### `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` (MOVED + rewired)

**Analog:** `src/app/(main)/dashboard/page.tsx` (current file — the move target rewrites the data-fetch call shape)

**Current query call site** (`src/app/(main)/dashboard/page.tsx` lines 63-67):
```typescript
const [groups, plantCount] = await Promise.all([
  getDashboardPlants(userId, todayStart, todayEnd),
  db.plant.count({ where: { userId, archivedAt: null } }),
]);
```

**Rewired pattern** (Phase 2 — reads householdId from cached helper):
```typescript
// inside default export signature becomes: params: Promise<{ householdSlug: string }>
const { householdSlug } = await params;
const { household } = await getCurrentHousehold(householdSlug);  // CACHE HIT — no DB

const [groups, plantCount] = await Promise.all([
  getDashboardPlants(household.id, todayStart, todayEnd),
  db.plant.count({ where: { householdId: household.id, archivedAt: null } }),
]);
```

**Session check stays identical** (lines 111-115 of original) — session is still required outside of household checks to handle the `/login` redirect before `getCurrentHousehold` runs. Or rely on the `(main)` outer layout's existing redirect. Either works; keep consistent across pages.

**Import adjustments:**
- Drop: none (most imports stay)
- Add: `import { getCurrentHousehold } from "@/features/household/context";`

---

### `src/app/(main)/h/[householdSlug]/plants/page.tsx` (MOVED + rewired)

**Analog:** `src/app/(main)/plants/page.tsx` (current file)

**Current call site** (lines 43-56):
```typescript
const [plantsResult, catalog, rooms, totalPlantCount] = await Promise.all([
  getPlants(session.user.id, { /* ... */ }),
  getCatalog(),
  getRoomsForSelect(session.user.id),
  db.plant.count({ where: { userId: session.user.id, archivedAt: null } }),
]);
```

**Rewired pattern:**
```typescript
const { householdSlug } = await params;
const { household } = await getCurrentHousehold(householdSlug);
// ... getPlants(household.id, { /* opts */ })
// ... getRoomsForSelect(household.id)
// ... db.plant.count({ where: { householdId: household.id, archivedAt: null } })
```

**Redirect path fix** (lines 65-67):
```typescript
redirect(qs ? `/plants?${qs}` : "/plants");
```
becomes:
```typescript
redirect(qs ? `/h/${householdSlug}/plants?${qs}` : `/h/${householdSlug}/plants`);
```

**`basePath` prop on Pagination** (line 117):
```typescript
basePath="/plants"
```
becomes:
```typescript
basePath={`/h/${householdSlug}/plants`}
```

**`EmptyFilterState` clearUrl logic** (lines 165-195 — hardcodes `/plants`): substitute `/h/${householdSlug}/plants` everywhere.

---

### `src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx` (MOVED + rewired)

**Analog:** `src/app/(main)/plants/[id]/page.tsx` (current file)

**Multi-params pattern (Next.js 16):**
```typescript
export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ householdSlug: string; id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { householdSlug, id } = await params;
  const { household } = await getCurrentHousehold(householdSlug);

  const [plant, rooms, { entries: timelineEntries, total: timelineTotal }] =
    await Promise.all([
      getPlant(id, household.id),                   // CHANGED from session.user.id
      getRoomsForSelect(household.id),              // CHANGED
      getTimeline(id, household.id),                // CHANGED
    ]);
  // ...
}
```

**Back-link fix** (line 44):
```typescript
<Link href="/plants" ...>
```
becomes:
```typescript
<Link href={`/h/${householdSlug}/plants`} ...>
```

---

### `src/app/(main)/h/[householdSlug]/rooms/page.tsx` and `.../rooms/[id]/page.tsx` (MOVED + rewired)

**Analog:** `src/app/(main)/rooms/page.tsx` and `src/app/(main)/rooms/[id]/page.tsx`

Same pattern as plants: `params: Promise<{ householdSlug: string }>` + `getCurrentHousehold(householdSlug)` → substitute `household.id` into query calls (`getRooms`, `getRoom`).

**Note on `rooms/[id]/page.tsx` line 24:**
```typescript
room: { id: room.id, name: room.name, userId: room.userId, createdAt: ..., updatedAt: ... }
```
The literal `userId` reference will fail to compile after Phase 1's schema changes — Room no longer has `userId`. Replace with `householdId: room.householdId` when the page is rewired. **This is Pitfall 1 territory — the build is currently broken here.**

---

### `src/app/(main)/dashboard/page.tsx` (REPLACED — legacy redirect stub)

**Analog:** RESEARCH.md §Code Examples "Legacy redirect stub" — verbatim target.

**Pattern — also derived from `src/app/(main)/dashboard/page.tsx` lines 111-115 (auth+redirect):**
```typescript
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LegacyDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = session.user.activeHouseholdId;
  if (!id) redirect("/login");  // WR-01 defensive: handles null and undefined

  const household = await db.household.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!household) redirect("/login");

  redirect(`/h/${household.slug}/dashboard`);
}
```

**For `/plants/[id]` and `/rooms/[id]` stubs** — same pattern, but additionally `await params` to capture the id:
```typescript
const { id } = await params;
// ...
redirect(`/h/${household.slug}/plants/${id}`);
```

**Key reuse:** Every legacy stub is a direct copy of this template. Suffix changes are literal string substitutions.

---

### `src/features/plants/actions.ts` (MIGRATED in place — mutator, CRUD)

**Analog:** self (current file) + pattern from RESEARCH.md §Pattern 3 (`createPlant` post-migration)

**Current pattern — `createPlant`** (existing lines 9-42). Rewrite to:

**Imports add:**
```typescript
import { requireHouseholdAccess } from "@/features/household/guards";
```

**Step-by-step per D-12** (canonical 7-step Server Action template):
```typescript
export async function createPlant(data: unknown) {
  // 1. Session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // 2. Demo guard (unchanged verbatim)
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  // 3. Zod parse (schema now requires householdId)
  const parsed = createPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // 4. LIVE membership check — Pitfall 16
  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  // 5+6. Write with audit column + household scope
  const now = new Date();
  const nextWateringAt = addDays(now, parsed.data.wateringInterval);

  const plant = await db.plant.create({
    data: {
      nickname: parsed.data.nickname,
      species: parsed.data.species ?? null,
      roomId: parsed.data.roomId ?? null,
      wateringInterval: parsed.data.wateringInterval,
      careProfileId: parsed.data.careProfileId ?? null,
      householdId: household.id,                      // D-10 — REPLACES userId
      createdByUserId: session.user.id,               // D-11 audit (AUDT-02)
      lastWateredAt: now,
      nextWateringAt,
      reminders: {
        create: { userId: session.user.id, enabled: true },  // D-13 (per-user)
      },
    },
  });

  // 7. Revalidate with type param (Next.js 16 — Pitfall 3)
  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true, plantId: plant.id };
}
```

**Update/Archive/Unarchive/Delete patterns** — same migration shape, with the additional substitution at the ownership filter (lines 52-56, 92-95, 112-115, 132-135):
```typescript
// BEFORE
const existing = await db.plant.findFirst({
  where: { id: parsed.data.id, userId: session.user.id },
});

// AFTER — householdId replaces userId in the ownership filter
const existing = await db.plant.findFirst({
  where: { id: parsed.data.id, householdId: parsed.data.householdId },
});
```
`requireHouseholdAccess(parsed.data.householdId)` runs BEFORE the `findFirst`, so the household id is already validated as a member the user belongs to.

---

### `src/features/plants/queries.ts` (MIGRATED — reader, CRUD)

**Analog:** self

**Current pattern** (lines 5-79, 81-86):
Signature: `getPlants(userId: string, options)` and `getPlant(plantId, userId)`

**Post-migration:**
```typescript
export async function getPlants(
  householdId: string,                                  // CHANGED from userId
  options: { /* ... unchanged ... */ } = {}
) {
  // ... options handling unchanged
  const where = {
    householdId,                                        // CHANGED from userId
    ...archivedFilter,
    ...(roomId ? { roomId } : {}),
    // ... rest unchanged
  };
  // ... rest unchanged
}

export async function getPlant(plantId: string, householdId: string) {   // CHANGED
  return db.plant.findFirst({
    where: { id: plantId, householdId },                // CHANGED
    include: { room: true, careProfile: true },
  });
}
```
`getCatalog()` needs no change (not user- or household-scoped).

---

### `src/features/plants/schemas.ts` (EXTENDED — Zod schema)

**Analog:** self

**Pattern extension:**
```typescript
export const createPlantSchema = z.object({
  householdId: z.string().min(1),                       // NEW — accepted from hidden field
  nickname: z.string().min(1, "Nickname is required.").max(40),
  species: z.string().optional(),
  roomId: z.string().optional(),
  wateringInterval: z.number().int().min(1).max(365),
  careProfileId: z.string().optional(),
});

export const editPlantSchema = z.object({
  householdId: z.string().min(1),                       // NEW
  id: z.string().min(1),
  // ... rest unchanged
});
```
**Validation rationale:** RESEARCH §Pattern 3 uses `z.string().min(1)`; RESEARCH suggests `z.string().cuid()` would be tighter but Prisma cuid prefixes change across versions — `min(1)` + the `requireHouseholdAccess` DB lookup is sufficient (the action's live check rejects unknown ids).

---

### `src/features/rooms/actions.ts` + queries.ts + schemas.ts (MIGRATED — same pattern as plants/)

**Analogs:**
- `src/features/rooms/actions.ts` self + `plants/actions.ts` post-migration pattern
- `src/features/rooms/queries.ts` self

**Notable substitutions:**

In `actions.ts`:
```typescript
// createRoom line 17 BEFORE
const room = await db.room.create({
  data: { name: parsed.data.name, userId: session.user.id },
});

// AFTER
const { household } = await requireHouseholdAccess(parsed.data.householdId);
const room = await db.room.create({
  data: {
    name: parsed.data.name,
    householdId: household.id,                        // D-10
    createdByUserId: session.user.id,                 // D-11 audit
  },
});

revalidatePath("/h/[householdSlug]/rooms", "page");
revalidatePath("/h/[householdSlug]/plants", "page");
```

In `queries.ts` (all 3 functions):
```typescript
// BEFORE: where: { userId }
// AFTER:  where: { householdId }
```

---

### `src/features/watering/actions.ts` + queries.ts + schemas.ts (MIGRATED — nested-relation)

**Analogs:**
- `src/features/watering/actions.ts` self — uses `plant: { userId }` nested filter (lines 86, 136)
- `src/features/watering/queries.ts` self — uses `plant: { userId }` (lines 159, 168)

**Nested-relation filter swap pattern** (RESEARCH §Pattern 4 — direct nested syntax):
```typescript
// BEFORE (existing line 83-88)
const log = await db.wateringLog.findFirst({
  where: {
    id: parsed.data.logId,
    plant: { userId: session.user.id },       // CHANGED
  },
  include: { plant: true },
});

// AFTER
const log = await db.wateringLog.findFirst({
  where: {
    id: parsed.data.logId,
    plant: { householdId: parsed.data.householdId },   // D-10
  },
  include: { plant: true },
});
```

**`logWatering` ownership check** (lines 19-25): plant lookup now filters by `householdId` not `userId`:
```typescript
const plant = await db.plant.findFirst({
  where: {
    id: parsed.data.plantId,
    householdId: parsed.data.householdId,     // CHANGED
    archivedAt: null,
  },
});
```

**`loadMoreWateringHistory` (line 181)** — signature changes from `(plantId, skip)` to `(plantId, householdId, skip)`:
```typescript
return getWateringHistory(plantId, householdId, skip, 20);
```

**Audit column write** — `logWatering`'s `db.wateringLog.create` (lines 46-52) gains `performedByUserId: session.user.id` (AUDT-01):
```typescript
await db.wateringLog.create({
  data: {
    plantId: plant.id,
    wateredAt,
    note: parsed.data.note ?? null,
    performedByUserId: session.user.id,       // NEW — Phase 1 D-05 audit
  },
});
```

**Revalidate paths** — all 3 `revalidatePath` blocks update:
```typescript
// BEFORE
revalidatePath("/dashboard");
revalidatePath("/plants/" + log.plantId);

// AFTER
revalidatePath("/h/[householdSlug]/dashboard", "page");
revalidatePath("/h/[householdSlug]/plants/[id]", "page");
```

---

### `src/features/notes/actions.ts` + queries.ts + schemas.ts (MIGRATED — nested-relation)

**Analogs:** self — identical shape to `watering/` actions+queries pattern. Same nested-relation swap (`plant: { userId }` → `plant: { householdId }`) at `actions.ts:20, 48, 76` and `queries.ts:51, 55`.

**Audit column on `db.note.create`** (line 24-28):
```typescript
const note = await db.note.create({
  data: {
    plantId: plant.id,
    content: parsed.data.content,
    performedByUserId: session.user.id,       // NEW — Phase 1 D-05 audit
  },
});
```

**`loadMoreTimeline` (line 100)** signature extends:
```typescript
return getTimeline(parsed.data.plantId, parsed.data.householdId, parsed.data.skip, 20);
```

---

### `src/features/reminders/actions.ts` + queries.ts (MIGRATED — nested-relation)

**Analogs:** self — plant ownership checks at `actions.ts:25-27, 55-57, 83-85` swap to `householdId`; queries migrate `userId` filters on `plant` to `plant: { householdId }` plus keep Reminder.userId (per-user).

**`getReminderCount` / `getReminderItems`** — signature stable per D-14:
```typescript
// BEFORE
export async function getReminderCount(userId: string, todayStart: Date, todayEnd: Date)

// AFTER
export async function getReminderCount(householdId: string, todayStart: Date, todayEnd: Date)
// Body: where: { householdId, archivedAt: null, reminders: { some: { enabled: true, ... } } }
```
The `reminders.some.userId === userId` clause is REMOVED this phase (D-15 — regression accepted). Phase 5 re-adds assignee gating.

**`getPlantReminder(plantId, userId)`** — keep signature as-is. Reminder rows are per-user-per-plant; the "who sees this reminder" read does not change.

**`toggleGlobalReminders`** (line 100-117) — no changes. It writes to `User.remindersEnabled` which is per-user, not household-scoped.

**Snooze actions** — `requireHouseholdAccess` is now the live check; the `db.plant.findFirst({ where: { id, userId } })` pre-check pattern (line 25-28) becomes `{ where: { id: plantId, householdId: parsed.data.householdId } }`.

---

### `src/features/demo/actions.ts` (MIGRATED — bootstrap mutator)

**Analog:** `src/features/auth/actions.ts` lines 44-86 (`$transaction` block for the register flow) — role-match; same multi-step createUser→household→member pattern applies.

**Current pattern** (lines 13-68 of `demo/actions.ts`): creates demo User, then Room (line 33: `userId: demoUser.id`), then Plant (line 56: `userId: demoUser.id`). Both Room and Plant no longer have `userId` columns — build is broken.

**Post-migration:** wrap the demo-user seeding in a `$transaction` that ALSO creates a Household + HouseholdMember:
```typescript
// Inside the existing `if (!existing) { ... }` block:
const { demoUser, household } = await db.$transaction(async (tx) => {
  const demoUser = await tx.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo User",
      onboardingCompleted: true,
      remindersEnabled: true,
    },
  });

  // slug loop (mirror auth/actions.ts:54-66)
  let slug: string;
  let attempts = 0;
  do {
    slug = generateHouseholdSlug();
    const existing = await tx.household.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    if (++attempts > 10) throw new Error("Slug generation failed");
  } while (true);

  const household = await tx.household.create({
    data: { name: "Demo Plants", slug, timezone: "UTC", cycleDuration: 7, rotationStrategy: "sequential" },
  });

  await tx.householdMember.create({
    data: { userId: demoUser.id, householdId: household.id, role: "OWNER", rotationOrder: 0, isDefault: true },
  });

  return { demoUser, household };
});
```

Then the existing room + plant creates substitute `userId: demoUser.id` → `householdId: household.id` plus `createdByUserId: demoUser.id` (audit). `reminders.create.userId: demoUser.id` stays verbatim (per-user reminder).

**Scope note:** RESEARCH Q18 explicitly flags `startDemoSession` as in-scope for Phase 2 (part of the broken-build set). Phase 7 will enhance seeding, not replace this.

---

### `src/features/auth/actions.ts` (OPPORTUNISTIC — `isDefault: true` add)

**Analog:** self (lines 78-85) — 1-line addition per Q7 backfill strategy

**Current pattern** (lines 78-85):
```typescript
await tx.householdMember.create({
  data: {
    userId: user.id,
    householdId: household.id,
    role: "OWNER",
    rotationOrder: 0,
  },
});
```

**Post-migration** — add `isDefault: true`:
```typescript
await tx.householdMember.create({
  data: {
    userId: user.id,
    householdId: household.id,
    role: "OWNER",
    rotationOrder: 0,
    isDefault: true,        // Q7: register flow creates user's default household
  },
});
```

---

### `auth.ts` (OPPORTUNISTIC — WR-01 null/undefined normalization)

**Analog:** self line 39

**Current pattern** (line 39):
```typescript
session.user.activeHouseholdId = token.activeHouseholdId as string | undefined;
```

**Post-migration — Q12 recommendation:**
```typescript
session.user.activeHouseholdId =
  typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined;
```
Coerces `null` → `undefined`, preventing legacy-redirect crash class (Pitfall 5). Update `next-auth.d.ts` if needed to narrow the type.

---

### `prisma/schema.prisma` (ADDITIVE migration — `HouseholdMember.isDefault`)

**Analog:** Phase 1's additive migration pattern from `tests/household.test.ts:128-132` (schema shape expectation) + any existing `Boolean @default(false)` column in schema.

**Pattern** (from RESEARCH Q7):
```prisma
model HouseholdMember {
  // ... existing fields ...
  rotationOrder Int       @default(0)
  isDefault     Boolean   @default(false)        // NEW
  createdAt     DateTime  @default(now()) @db.Timestamptz(3)
  // ... existing indexes ...
}
```

**Migration command:** `npx prisma migrate dev --name add_household_member_is_default`

**Optional backfill SQL** appended to migration.sql (Q7 rationale — single membership per user post-Phase-1):
```sql
UPDATE "HouseholdMember" SET "isDefault" = true;
```

---

## Test Patterns

### `tests/household-create.test.ts` (NEW)

**Analog:** `tests/notes.test.ts` lines 1-24 (mock setup) + `tests/household.test.ts` lines 155-220 (transactional source-shape patterns)

**Mock setup pattern** (`tests/notes.test.ts` lines 1-24 — copy verbatim, adjust models):
```typescript
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    household: { findUnique: vi.fn(), create: vi.fn() },
    householdMember: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });
```

**`$transaction` mock pattern** (adapted from `tests/household.test.ts:155-220` — the test captures `tx.*` calls via `tx` callback argument):
```typescript
test("createHousehold creates household + OWNER member in a transaction", async () => {
  const { auth } = await import("../auth");
  const { db } = await import("@/lib/db");
  vi.mocked(auth).mockResolvedValueOnce({
    user: { id: "user_1", isDemo: false },
  } as Awaited<ReturnType<typeof auth>>);

  // mock $transaction to invoke the callback with a tx that has the methods the action calls
  const txMock = {
    household: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "hh_new", slug: "x", name: "Test" }) },
    householdMember: { create: vi.fn().mockResolvedValue({}) },
  };
  vi.mocked(db.$transaction).mockImplementation(async (cb) => cb(txMock as never));

  const { createHousehold } = await import("@/features/household/actions");
  const result = await createHousehold({ name: "Test", timezone: "America/New_York" });

  expect(result).toMatchObject({ success: true });
  expect(txMock.household.create).toHaveBeenCalled();
  expect(txMock.householdMember.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ role: "OWNER", rotationOrder: 0 }),
  }));
});
```

**`getUserHouseholds` test pattern** — copy RESEARCH §Code Examples "Cross-household isolation test" shape; mock `db.householdMember.findMany` to return two memberships, assert the mapped result shape.

---

### D-16: Cross-household isolation tests (added into each feature test file)

**Analog:** RESEARCH §Code Examples "Cross-household isolation test" — verbatim target, already specified. Source pattern from `tests/notes.test.ts:88-138`.

**Template — copy into `tests/plants.test.ts` replacing `test.todo` at lines 79-83:**
```typescript
describe("getPlants honors householdId scope (D-10, D-16)", () => {
  test("includes householdId in every findMany where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.plant.count).mockResolvedValueOnce(0);
    const { getPlants } = await import("@/features/plants/queries");
    await getPlants("hh_TEST");
    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
    expect(db.plant.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
  });
});
```
**Replicate for:** `getPlant`, `getRooms`, `getRoom`, `getWateringHistory` (nested — `plant: { householdId }`), `getTimeline` (nested), `getReminderCount`, `getReminderItems`.

---

### D-17: ForbiddenError tests on mutating actions (13+ tests)

**Analog:** RESEARCH §Code Examples "ForbiddenError test on a Server Action" + `tests/household.test.ts` lines 256-326 (existing ForbiddenError throw pattern already in repo)

**Mock `requireHouseholdAccess`** (from RESEARCH §Code Examples verbatim):
```typescript
vi.mock("@/features/household/guards", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/guards")>(
    "@/features/household/guards"
  );
  return {
    ...actual,
    requireHouseholdAccess: vi.fn(),
  };
});
```

**Parameterized test pattern** (copy RESEARCH §Code Examples verbatim). Apply across the 13 actions: `createPlant`, `updatePlant`, `archivePlant`, `unarchivePlant`, `deletePlant`, `logWatering`, `editWateringLog`, `deleteWateringLog`, `createRoom`, `updateRoom`, `deleteRoom`, `createNote`, `deleteNote`, plus `snoozeReminder`, `snoozeCustomReminder`, `togglePlantReminder` (total 16).

**Test-file organization (Q19f):** Inline into the existing `tests/{feature}.test.ts` files, replacing relevant `test.todo` stubs. No `tests/phase-02/` directory.

---

## Shared Patterns

### Auth gate (first 3 lines of every mutating Server Action)

**Source:** `src/features/plants/actions.ts` lines 10-12
**Apply to:** All mutating Server Actions (post-migration)
```typescript
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };
if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };
```
Unchanged verbatim. Do NOT wrap in try/catch — `redirect()` and `ForbiddenError` must propagate (Pitfall 7).

### Live household guard (first 2 lines after Zod parse)

**Source:** `src/features/household/guards.ts` lines 31-51
**Apply to:** All mutating Server Actions after Zod parse succeeds
```typescript
const parsed = schema.safeParse(data);
if (!parsed.success) return { error: "Invalid input." };

const { household } = await requireHouseholdAccess(parsed.data.householdId);
```
**Do NOT** wrap `await requireHouseholdAccess` in try/catch. `ForbiddenError` must propagate to `error.tsx` (Q14 recommendation).

### Zod v4 import path (non-negotiable per CLAUDE.md)

**Source:** `src/features/plants/schemas.ts` line 1
```typescript
import { z } from "zod/v4";
```
Apply to every new/modified schema file. NEVER use `import { z } from "zod"` (v3 compat path).

### Audit column writes (AUDT-01 / AUDT-02)

**Source:** Phase 1 CONTEXT D-05 (columns shipped); Phase 2 D-12 step 6 (writes wired here)
**Apply to:**
- Plant.create / Room.create → `createdByUserId: session.user.id`
- WateringLog.create → `performedByUserId: session.user.id`
- Note.create → `performedByUserId: session.user.id`

Audit columns are **write-only** — never read in filter clauses (D-11).

### Feature-folder convention (from CLAUDE.md §Architecture insights in CONTEXT.md)

**Source:** existing `src/features/{domain}/{actions,queries,schema,guards}.ts` across all folders
**Apply to:** `src/features/household/` — add `actions.ts`, extend `queries.ts` + `schema.ts`, add `context.ts`. Phase 2 treats `context.ts` as the cached-read companion to `guards.ts` (auth boundary) + `queries.ts` (raw reads).

### `revalidatePath` with type parameter (Next.js 16 — Pitfall 3)

**Source:** RESEARCH.md §Pattern 3 / Pitfall 3 — binding
**Apply to:** Every `revalidatePath` call in every migrated action file
```typescript
revalidatePath("/h/[householdSlug]/dashboard", "page");
revalidatePath("/h/[householdSlug]/plants", "page");
revalidatePath("/h/[householdSlug]/plants/[id]", "page");
revalidatePath("/h/[householdSlug]/rooms", "page");
revalidatePath("/h/[householdSlug]/rooms/[id]", "page");
```
Path MUST be the literal route pattern (with `[householdSlug]` token), not the resolved slug. Type parameter (`'page' | 'layout'`) is REQUIRED when the path has a dynamic segment.

### Mocked-Prisma test setup (for every test file)

**Source:** `tests/notes.test.ts` lines 1-24 — exact template
**Apply to:** New + extended test files
```typescript
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { /* per-test model mocks */ } }));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
```
Each test file declares its own `db` model mocks for the models it exercises. No shared `tests/_mocks.ts` file (Q19f recommendation).

---

## No Analog Found

| File | Role | Data Flow | Reason / Source |
|---|---|---|---|
| `src/app/(main)/h/[householdSlug]/not-found.tsx` | 404 boundary | — | No existing `not-found.tsx` in repo. Use Next.js 16 standard pattern: a Server Component that renders a simple "Household not found" message + Link home. No complex logic required. |
| `src/app/(main)/h/[householdSlug]/error.tsx` | Client error boundary | — | No existing `error.tsx` in repo. Use RESEARCH.md §Code Examples verbatim (listed above). |
| `src/features/household/context.ts` — the `cache()` wrapper | cached reader | — | No existing use of React `cache()` anywhere in repo. This file introduces the pattern. Use RESEARCH.md §Pattern 1 verbatim; establish the idiom for Phase 5+6 (`getCurrentAssignee`, `getCurrentMembers`). |

All three are still "exact targets" because RESEARCH provides verbatim code blocks for each, plus pre-existing Phase 1 primitives (`requireHouseholdAccess`, `resolveHouseholdBySlug`, `ForbiddenError`) they compose.

---

## Metadata

**Analog search scope:**
- `src/features/{auth,demo,household,plants,rooms,watering,notes,reminders}/{actions,queries,schemas,schema,guards}.ts` (all feature-folder source)
- `src/app/(main)/{dashboard,plants,plants/[id],rooms,rooms/[id]}/page.tsx` (current route tree)
- `src/app/(main)/layout.tsx` (outer chrome layout)
- `auth.ts`, `auth.config.ts`, `proxy.ts` (Auth.js v5 root wiring)
- `src/lib/slug.ts`, `src/lib/db.ts`, `src/lib/utils.ts`
- `src/components/plants/add-plant-dialog.tsx` (RHF integration example)
- `tests/{household,plants,rooms,watering,notes,reminders,auth,db,slug}.test.ts` (existing mocked-Prisma idiom)
- `.claude/skills/nextjs/SKILL.md` (project-skill validation rules)

**Files scanned:** ~35 source files + 10 test files.

**Pattern extraction date:** 2026-04-16

**Project-skill alignment notes:**
- `.claude/skills/nextjs/SKILL.md` validate rules confirm: async `params`/`searchParams` (lines 128-136), async `cookies()`/`headers()` (lines 118-126), `middleware` → `proxy` (lines 89-94). Phase 2 patterns honor all three. The `next-auth` warning (lines 137-143) is explicitly overridden by CLAUDE.md — keep Auth.js v5 beta.
