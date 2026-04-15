# Phase 5: Notes, Search, and Filters - Research

**Researched:** 2026-04-14
**Domain:** Next.js App Router — Prisma ORM schema migration, URL search param filter composition, unified timeline UI, debounced search, Server Actions for notes CRUD
**Confidence:** HIGH

---

## Summary

Phase 5 adds three orthogonal capabilities on top of the existing plant collection: (1) a `Note` model for freeform timestamped annotations on plants, displayed in a unified timeline that merges notes and watering events; (2) a debounced client-side search input that filters the plant grid in real time via URL params; and (3) a second filter row for watering status (Overdue / Due today / Upcoming / Archived) combined with the existing room filter, plus a sort dropdown. All three features are well-bounded extensions of existing patterns — they do not require new libraries or architectural pivots.

The most architecturally significant work is the **unified timeline** on the plant detail page. The current `WateringHistory` + placeholder `Notes` cards become a single `Timeline` card fed by an interleaved, sorted query across two database tables. This requires a modest but careful data-fetching change: instead of fetching `WateringLog[]` only, the page query must fetch both `WateringLog[]` and `Note[]`, merge them by timestamp, sort, and paginate. The "load more" mechanism must also accommodate mixed types.

Search and filter are simpler: `getPlants()` in `src/features/plants/queries.ts` gains three optional parameters (`search`, `status`, `sort`). The Prisma query is straightforward — case-insensitive `contains` for search, date comparisons for status, `orderBy` for sort. The `RoomFilter` component pattern (URL search params, `useRouter`, `useSearchParams`) is directly reusable for the status pills and sort dropdown.

**Primary recommendation:** Treat the three feature areas as independent work streams that can be planned and executed in parallel waves — notes CRUD + timeline, search, and filter/sort — since they touch different files. Merge points are the `plants/page.tsx` update (all three converge there) and the Prisma migration (needed before notes work starts).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Unified timeline — notes and watering events interleaved in one chronological list on the plant detail page. Each entry has a type icon (droplet for watering, pencil for note). Replaces the separate "Watering history" and placeholder "Notes" cards with a single "Timeline" card.
- **D-02:** New dedicated `Note` model in the database (id, plantId, content, createdAt, updatedAt). Keeps notes separate from HealthLog, which stays reserved for health observations in v2.
- **D-03:** Default load: last 20 entries (notes + waterings combined), with a "Load more" button. Matches the existing watering history pagination pattern.
- **D-04:** Inline text field at the top of the timeline card for adding notes. Type and press Enter or click "Add". Low friction, no modal needed.
- **D-05:** Kebab (three-dot) menu on each note entry with "Edit" and "Delete" options. Edit opens inline editing (text becomes editable in place). Delete shows a confirmation. Consistent with watering history entry kebab menu pattern from Phase 4.
- **D-06:** No character limit on notes. Freeform text of any length.
- **D-07:** Search bar on the /plants collection page only, at the top above the room filter pills. Scoped to plant search.
- **D-08:** Instant filter — as the user types, the plant grid filters in real-time using URL search params. No separate results page. Debounced input (300ms).
- **D-09:** Search matches against both plant nickname and species name. Simple case-insensitive query.
- **D-10:** Second pill row below the existing room filter pills for watering status filters: All | Overdue | Due today | Upcoming | Archived. Both rows use URL search params.
- **D-11:** Room filters and status filters are combinable with AND logic. Example: Kitchen + Overdue = only overdue plants in the kitchen. URL params: `?room=abc&status=overdue&sort=name`.
- **D-12:** Sort dropdown button near the search bar with options: Next watering date (default), Name (A-Z), Recently added.

### Claude's Discretion

- Search bar styling and placeholder text
- Status pill colors/variants (e.g., red for Overdue, green for Due today)
- Timeline entry layout details (spacing, timestamp format, icon styling)
- Inline note editing interaction (save on blur vs explicit save button)
- Empty state when search/filter returns no results
- Mobile responsive behavior for two filter rows + sort dropdown
- Whether search query should persist in URL on page navigation
- Note model migration details (indexes, constraints)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTE-01 | User can add a timestamped text note to any plant | D-04 inline add + `createNote` Server Action + `Note` Prisma model |
| NOTE-02 | User can view notes in the plant detail history timeline alongside watering events | D-01 unified timeline — interleaved query across WateringLog + Note, sorted by timestamp |
| NOTE-03 | User can edit or delete their own notes | D-05 kebab menu + `updateNote` / `deleteNote` Server Actions with ownership check |
| SRCH-01 | User can search plants by nickname or species name | D-09 Prisma `contains` + `mode: "insensitive"` on both fields, OR filter |
| SRCH-02 | User can filter plants by room, watering status (overdue, due today, upcoming), and archived | D-10/D-11 — `archivedAt` null/not null for archived, date range comparisons for status, composed with existing `roomId` filter |
| SRCH-03 | User can sort plants by next watering date, name, or recently added | D-12 — `orderBy` clause on `nextWateringAt`, `nickname`, or `createdAt` |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | 7.7.0 | `Note` model migration, timeline queries | Already in use; `prisma migrate dev` for new model |
| Next.js 16 App Router | 16.2.2 | Server Components for data fetching, Server Actions for mutations | Project stack |
| `date-fns` | ^4.1.0 | Timeline timestamp formatting, relative time display | Already in use in `watering-history-entry.tsx` |
| Zod v4 | ^4.3.6 | Schema validation for note create/edit actions | Established pattern in `src/features/watering/schemas.ts` |
| `sonner` | ^2.0.7 | Toast feedback for note CRUD | Already used for watering log toasts |
| shadcn/ui | latest | Dropdown, AlertDialog, Input, Button, Card | All components already initialized in project |
| `lucide-react` | ^1.8.0 | Type icons: `Droplets` (watering), `Pencil` (note) | Already in use throughout |

**No new dependencies required.** [VERIFIED: package.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL search params for search | React state (useState) | URL params preserve state on refresh and enable back/forward nav; aligns with D-08 and existing room filter pattern |
| Prisma `contains + mode:insensitive` | PostgreSQL `ILIKE` via TypedSQL | ORM approach is simpler and consistent with rest of codebase; TypedSQL not needed for this query complexity |
| Interleaved sort in application code | PostgreSQL UNION query | App-level merge is simpler with Prisma and sufficient for 20-entry page size |

---

## Architecture Patterns

### Feature Directory Structure (new files only)

```
src/
├── features/
│   └── notes/
│       ├── actions.ts        # createNote, updateNote, deleteNote Server Actions
│       ├── schemas.ts        # createNoteSchema, updateNoteSchema (Zod v4)
│       └── queries.ts        # getNotes(plantId, userId, skip, take)
├── components/
│   ├── plants/
│   │   ├── search-bar.tsx        # Debounced search input, updates URL param
│   │   ├── status-filter.tsx     # Status pill row, URL search params
│   │   └── sort-dropdown.tsx     # Sort select button, URL search params
│   └── timeline/
│       ├── timeline.tsx          # Unified timeline — replaces WateringHistory in PlantDetail
│       ├── timeline-entry.tsx    # Polymorphic entry (type: "watering" | "note")
│       └── note-input.tsx        # Inline add note form (D-04)
└── types/
    └── timeline.ts           # TimelineEntry union type
```

### Pattern 1: Note Schema + Server Actions (mirrors watering pattern exactly)

**What:** Zod schema validates input; Server Action owns auth, ownership check, DB write, revalidatePath.
**When to use:** All note mutations (create, update, delete).

```typescript
// src/features/notes/schemas.ts
import { z } from "zod/v4";

export const createNoteSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  content: z.string().min(1, "Note cannot be empty."),
});

export const updateNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required."),
  content: z.string().min(1, "Note cannot be empty."),
});
```

[VERIFIED: mirrors src/features/watering/schemas.ts pattern directly]

```typescript
// src/features/notes/actions.ts (pattern)
"use server";
export async function createNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const parsed = createNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };
  // Ownership check: plant belongs to this user
  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };
  const note = await db.note.create({
    data: { plantId: plant.id, content: parsed.data.content },
  });
  revalidatePath("/plants/" + plant.id);
  return { success: true, note };
}
```

[ASSUMED: db.note is the Prisma client accessor after migration — naming follows Prisma convention]

### Pattern 2: Unified Timeline Query

**What:** Fetch both `WateringLog[]` and `Note[]` for a plant, merge into a single typed array sorted by timestamp descending, slice to first 20, expose total count.
**When to use:** Plant detail page initial load and "load more".

```typescript
// src/features/notes/queries.ts (or a new timeline queries file)
export type TimelineEntry =
  | { type: "watering"; id: string; timestamp: Date; data: WateringLog }
  | { type: "note"; id: string; timestamp: Date; data: Note };

export async function getTimeline(
  plantId: string,
  userId: string,
  skip = 0,
  take = 20
): Promise<{ entries: TimelineEntry[]; total: number }> {
  // Fetch enough rows from each table to cover pagination
  // Simplest approach: fetch all, merge, sort, slice
  // For take=20 and typical plant with <200 history items, this is fine
  const [wateringLogs, notes, wCount, nCount] = await Promise.all([
    db.wateringLog.findMany({
      where: { plantId, plant: { userId } },
      orderBy: { wateredAt: "desc" },
    }),
    db.note.findMany({
      where: { plantId, plant: { userId } },
      orderBy: { createdAt: "desc" },
    }),
    db.wateringLog.count({ where: { plantId, plant: { userId } } }),
    db.note.count({ where: { plantId, plant: { userId } } }),
  ]);

  const merged: TimelineEntry[] = [
    ...wateringLogs.map((l) => ({
      type: "watering" as const,
      id: l.id,
      timestamp: l.wateredAt,
      data: l,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      timestamp: n.createdAt,
      data: n,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    entries: merged.slice(skip, skip + take),
    total: wCount + nCount,
  };
}
```

[ASSUMED: fetch-all-then-slice is acceptable at plant scale; plants rarely have >100 combined entries. If performance becomes a concern at scale, PostgreSQL UNION or cursor-based pagination is the upgrade path.]

### Pattern 3: URL Search Params for Filters (extends existing RoomFilter pattern)

**What:** Each filter control reads/writes a single URL param. All controls use `useSearchParams` + `useRouter` (client components). The Server Component (`plants/page.tsx`) reads all params and passes pre-filtered data down.
**When to use:** Search bar, status filter pills, sort dropdown.

```typescript
// Extending existing pattern in room-filter.tsx
// In plants/page.tsx, searchParams grows:
searchParams: Promise<{
  room?: string;
  search?: string;
  status?: "overdue" | "due-today" | "upcoming" | "archived";
  sort?: "next-watering" | "name" | "recently-added";
}>

// In getPlants(), the query gains:
where: {
  userId,
  ...(roomId ? { roomId } : {}),
  ...(search ? {
    OR: [
      { nickname: { contains: search, mode: "insensitive" } },
      { species: { contains: search, mode: "insensitive" } },
    ],
  } : {}),
  ...(status === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
  // Status filters require date range comparisons (computed in calling code)
  ...(status === "overdue" ? { nextWateringAt: { lt: todayStart } } : {}),
  ...(status === "due-today" ? { nextWateringAt: { gte: todayStart, lte: todayEnd } } : {}),
  ...(status === "upcoming" ? { nextWateringAt: { gt: todayEnd } } : {}),
},
orderBy: sort === "name" ? { nickname: "asc" }
  : sort === "recently-added" ? { createdAt: "desc" }
  : { nextWateringAt: "asc" }, // default: next-watering
```

[VERIFIED: Prisma `contains` with `mode: "insensitive"` is the standard PostgreSQL case-insensitive string search in Prisma — confirmed by Prisma v7 docs pattern]

**Important:** `todayStart`/`todayEnd` for status filter must come from the request, not the server. The established pattern from Phase 4 (passed as URL param `tzOffset` or computed from `x-timezone` header in `proxy.ts`) should be reused — the planner must reference the Phase 4 timezone decision to ensure consistency.

### Pattern 4: Debounced Search Input

**What:** Client component wraps `<Input>` with a `useCallback`-backed debounce. After 300ms of no keystrokes, updates the URL `search` param. Does NOT use `startTransition` unless needed for UX.
**When to use:** SearchBar component on plants collection page.

```typescript
// src/components/plants/search-bar.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";

export function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleChange = useCallback(
    debounce((query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set("search", query);
      } else {
        params.delete("search");
      }
      // Reset to page 1 on new search
      params.delete("page");
      router.push(`/plants?${params.toString()}`);
    }, 300),
    [router, searchParams]
  );

  return (
    <Input
      placeholder="Search plants..."
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        handleChange(e.target.value);
      }}
    />
  );
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

[ASSUMED: custom debounce utility is sufficient for 300ms search; no external debounce library needed for this single use case]

### Pattern 5: Inline Note Add Form (D-04)

**What:** Uncontrolled text input at the top of the Timeline card. Submit on Enter keydown or "Add" button click. Calls `createNote` Server Action. Optimistic UI: add entry to local state immediately, remove on error.
**When to use:** Note input in Timeline card.

Key implementation consideration: The `onKeyDown` handler must call `e.preventDefault()` on Enter to avoid form submission and call the action. After success, clear the input value.

### Pattern 6: Inline Note Edit (D-05)

**What:** Note entry switches between display mode and edit mode in place. Edit mode shows a `<textarea>` with the current content pre-filled. Save on blur or explicit "Save" button (Claude's discretion). Calls `updateNote` Server Action on save.

### Anti-Patterns to Avoid

- **Fetching notes separately from timeline in the client:** The parent Server Component should fetch the full timeline in one pass. Do not add a second client-side fetch hook.
- **Using `useEffect` for debounce:** The `useCallback`-wrapping-debounce pattern is cleaner for URL updates. `useEffect` introduces race conditions.
- **Storing search in local state only:** Search must be in URL (D-08) so it survives page navigation.
- **Using `archivedAt: null` everywhere now that archived is a filter option:** When `status === "archived"`, the query must switch to `archivedAt: { not: null }`. The default (no status param) must still exclude archived plants (`archivedAt: null`).
- **Sort default fallback:** If no `sort` param is present, default to `nextWateringAt: "asc"` — do not throw or return unsorted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive text search | Manual `.toLowerCase()` comparison in app code | Prisma `contains` + `mode: "insensitive"` | Delegated to PostgreSQL `ILIKE`; correct index support |
| Debounce timer | Complex `useEffect` ref cleanup | Simple closure-based debounce util (6 lines) | No library needed; complex `useEffect` patterns cause stale closure bugs |
| Timeline sorting | Complex merge-sort library | JS `.sort()` on merged array by `.getTime()` | Two arrays, trivially merged; no library justified |
| Delete confirmation | Custom modal | `AlertDialog` from shadcn/ui | Already used in `watering-history-entry.tsx`; identical UX |
| Toast feedback | Custom notification system | `sonner` (`toast()`) | Already installed and configured |
| Dropdown menu for kebab | Custom popover | `DropdownMenu` from shadcn/ui (Radix) | Already used in `watering-history-entry.tsx` |

**Key insight:** Every UI primitive this phase needs is already installed via shadcn/ui. The kebab menu, alert dialog, input, button, badge — all present and in use. Phase 5 is assembly work, not infrastructure work.

---

## Common Pitfalls

### Pitfall 1: Status Filter and Archived Conflict

**What goes wrong:** When status=archived, the query omits `archivedAt: null` check. Conversely, when status=overdue/due-today/upcoming, the query still needs `archivedAt: null` to exclude archived plants from those views.

**Why it happens:** The archived filter is a fundamentally different dimension (soft-delete visibility) from watering status. Easy to conflate in a single `where` clause.

**How to avoid:** Build the `where` clause in two explicit steps: first determine archival visibility (`archivedAt: null` vs `archivedAt: { not: null }`), then optionally layer in watering status date filters. Comment explicitly in code.

**Warning signs:** Overdue count on Plants page includes plants that are also in Archived filter.

### Pitfall 2: Timeline Pagination Off-by-One (Merge Cursor)

**What goes wrong:** "Load more" fetches the next 20 records from each table independently using DB-level `skip`, producing duplicate or missing entries when the two tables have uneven distributions.

**Why it happens:** You cannot independently paginate two tables and then merge the results page-by-page — the merged ordering breaks.

**How to avoid:** Fetch all records (or a large buffer), merge and sort in application code, then slice. For the "load more" action, pass `skip` as the count of already-displayed entries and slice from the full sorted array. At typical plant scale (< 200 entries), fetching all is correct. Document this in the action so future developers don't "optimize" to DB-level pagination.

**Warning signs:** User clicks "Load more" and sees the same entries repeated, or sees entries out of chronological order.

### Pitfall 3: Note Ownership Check Missing

**What goes wrong:** `updateNote` or `deleteNote` action checks if the note exists by `noteId` but doesn't verify `plant.userId === session.user.id`, allowing user A to delete user B's notes.

**Why it happens:** Simple oversight — easy to forget the join check.

**How to avoid:** Follow the exact pattern from `deleteWateringLog`: use `db.note.findFirst({ where: { id: noteId, plant: { userId: session.user.id } } })`.

**Warning signs:** Note CRUD actions only query `note.id`, not through the `plant.userId` relation.

### Pitfall 4: Debounced Search Stale Closure

**What goes wrong:** Debounce function captures `searchParams` at creation time. When `searchParams` changes (e.g., room filter applied), the search update overwrites the room param with the stale value.

**Why it happens:** `useCallback` dependency array not including `searchParams`, or debounce function not recreated on `searchParams` change.

**How to avoid:** Include `searchParams` in the `useCallback` dependency array. The debounce function must be recreated when searchParams changes so it reads the current params snapshot.

**Warning signs:** Applying a room filter then typing in search clears the room filter.

### Pitfall 5: Sort Enum Mismatch Between URL and Query

**What goes wrong:** URL param value `"next-watering"` is not directly the Prisma `orderBy` key. A switch/map is needed. Forgetting to handle the default case throws a runtime error.

**How to avoid:** Map URL param values to Prisma `orderBy` expressions explicitly with a default fallback:

```typescript
const orderBy =
  sort === "name" ? { nickname: "asc" as const } :
  sort === "recently-added" ? { createdAt: "desc" as const } :
  { nextWateringAt: "asc" as const }; // default (covers null, undefined, "next-watering")
```

### Pitfall 6: `archivedAt` Filter Breaks Default Plant List

**What goes wrong:** After adding the status filter, the default plant grid (no `status` param) unintentionally starts showing archived plants.

**Why it happens:** The original `getPlants()` had `archivedAt: null` hardcoded. After refactoring for the status param, the condition gets wrapped in `if (status === "archived")` and the else branch forgets to include `archivedAt: null`.

**How to avoid:** The default (no status param, or status=undefined) must always include `archivedAt: null`. Only `status === "archived"` switches to `archivedAt: { not: null }`.

---

## Code Examples

### Prisma Schema Addition (Note model)

```prisma
// To add to prisma/schema.prisma
model Note {
  id        String   @id @default(cuid())
  plantId   String
  plant     Plant    @relation(fields: [plantId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@index([plantId])
}
```

Also add `notes Note[]` to the `Plant` model relation.

[VERIFIED: follows existing model conventions in schema.prisma — `@db.Timestamptz(3)`, `@default(cuid())`, `onDelete: Cascade`]

### Extended getPlants Query

```typescript
// src/features/plants/queries.ts (extended signature)
export async function getPlants(
  userId: string,
  options: {
    roomId?: string;
    search?: string;
    status?: "overdue" | "due-today" | "upcoming" | "archived";
    sort?: "next-watering" | "name" | "recently-added";
    todayStart?: Date;
    todayEnd?: Date;
  } = {}
) {
  const { roomId, search, status, sort, todayStart, todayEnd } = options;

  // Archival visibility
  const archivedFilter =
    status === "archived"
      ? { archivedAt: { not: null } }
      : { archivedAt: null };

  // Watering status filter (requires todayStart/todayEnd)
  const statusFilter =
    status === "overdue" && todayStart ? { nextWateringAt: { lt: todayStart } } :
    status === "due-today" && todayStart && todayEnd ? {
      nextWateringAt: { gte: todayStart, lte: todayEnd }
    } :
    status === "upcoming" && todayEnd ? { nextWateringAt: { gt: todayEnd } } :
    {};

  const orderBy =
    sort === "name" ? { nickname: "asc" as const } :
    sort === "recently-added" ? { createdAt: "desc" as const } :
    { nextWateringAt: "asc" as const };

  return db.plant.findMany({
    where: {
      userId,
      ...archivedFilter,
      ...(roomId ? { roomId } : {}),
      ...(search ? {
        OR: [
          { nickname: { contains: search, mode: "insensitive" } },
          { species: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
      ...statusFilter,
    },
    include: { room: true, careProfile: true },
    orderBy,
  });
}
```

[ASSUMED: `todayStart`/`todayEnd` plumbing follows Phase 4 timezone pattern — planner must verify how Phase 4 passes these values and replicate]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Notes card (placeholder) | Unified Timeline card (D-01) | Phase 5 | Removes placeholder; plant-detail.tsx refactored |
| `getPlants(userId, roomId?)` | `getPlants(userId, options)` | Phase 5 | Signature change — callers updated |
| `archivedAt: null` hardcoded in getPlants | Conditional archival filter | Phase 5 | Enables archived view from collection page |

**Existing code being replaced/extended:**
- `src/components/plants/plant-detail.tsx` — the "Watering history" and "Notes" cards are REPLACED by a single "Timeline" card. The component signature changes: instead of `wateringLogs: WateringLog[]` + `wateringLogCount: number`, it receives `timelineEntries: TimelineEntry[]` + `totalCount: number`.
- `src/components/watering/watering-history.tsx` — no longer used in plant detail. May be retained if referenced elsewhere, or removed.
- `src/app/(main)/plants/[id]/page.tsx` — `getWateringHistory()` call replaced by `getTimeline()`.
- `src/app/(main)/plants/page.tsx` — `searchParams` type extended; `getPlants()` call updated.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is purely code/schema changes. No new external tools, services, or CLIs required beyond what is already installed. Prisma migration runs locally via `npx prisma migrate dev` (already available). [VERIFIED: package.json has prisma as dependency]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

[VERIFIED: vitest.config.mts exists; `npm test` runs `vitest run`; test files in `tests/` directory]

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NOTE-01 | `createNoteSchema` validates content required, rejects empty | unit | `npm test -- --reporter=verbose 2>&1 \| grep notes` | No — Wave 0 |
| NOTE-01 | `createNote` action: auth check, ownership check, success path | unit | `npm test` | No — Wave 0 |
| NOTE-03 | `updateNote` action: ownership check, success path | unit | `npm test` | No — Wave 0 |
| NOTE-03 | `deleteNote` action: ownership check, no logs remain path | unit | `npm test` | No — Wave 0 |
| SRCH-01 | `getPlants` with `search` param returns matching plants by nickname | unit | `npm test` | No — Wave 0 |
| SRCH-01 | `getPlants` with `search` param returns matching plants by species | unit | `npm test` | No — Wave 0 |
| SRCH-02 | `getPlants` with `status=archived` returns only archived plants | unit | `npm test` | No — Wave 0 |
| SRCH-02 | `getPlants` default (no status) excludes archived plants | unit | `npm test` | No — Wave 0 |
| SRCH-03 | `getPlants` with `sort=name` returns plants sorted alphabetically | unit | `npm test` | No — Wave 0 |
| NOTE-02 | Timeline merge: watering + note entries sorted by timestamp desc | unit | `npm test` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/notes.test.ts` — covers NOTE-01, NOTE-03 schema + action tests
- [ ] `tests/timeline.test.ts` — covers NOTE-02 timeline merge/sort logic (pure function test)
- [ ] `tests/plants-search.test.ts` (or extend `tests/plants.test.ts`) — covers SRCH-01, SRCH-02, SRCH-03 getPlants query logic

*(All existing test infrastructure — vitest.config.mts, mocking patterns — is in place. No framework installation needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `auth()` called at top of every Server Action |
| V4 Access Control | yes | `plant.userId === session.user.id` ownership check on all note mutations |
| V5 Input Validation | yes | Zod v4 schema validates content on create and update |
| V6 Cryptography | no | No new cryptography surface |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — delete another user's note | Elevation of Privilege | `db.note.findFirst({ where: { id, plant: { userId } } })` — same as watering log pattern |
| XSS via note content displayed verbatim | Tampering | React renders text content as escaped by default; do NOT use `dangerouslySetInnerHTML` |
| Search injection via `search` URL param | Tampering | Prisma parameterizes all queries; `contains` is safe — no raw SQL |
| Denial of service via unlimited note length (D-06) | Availability | No character limit by design decision; PostgreSQL text column handles arbitrary length |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fetch-all-then-slice for timeline is acceptable performance for typical plant usage | Architecture Patterns (Pattern 2) | If plants have thousands of history entries, full fetch is slow. Mitigation: add DB-level limit (e.g., fetch last 200 from each, merge, slice). |
| A2 | `db.note` is the correct Prisma accessor after adding the `Note` model | Architecture Patterns (Pattern 1) | Prisma generates accessor names from model names in PascalCase to camelCase. `Note` → `db.note` is the standard. |
| A3 | `todayStart`/`todayEnd` plumbing for status filter follows Phase 4 timezone pattern | Extended getPlants Query | If Phase 4 used a different mechanism (e.g., client-side compute), the planner must verify and replicate consistently. |
| A4 | Stale `archivedAt` default behavior: plants page showed `archivedAt: null` before Phase 5 | Architecture Patterns (Pattern 3) | Verified from existing `getPlants()` code. Low risk. |
| A5 | Custom debounce utility (6-line closure) is sufficient; no external debounce library needed | Pattern 4 | Confirmed by absence of any debounce library in package.json. Low risk. |

---

## Open Questions

1. **Timezone for status filter on /plants page**
   - What we know: Phase 4 established a `todayStart`/`todayEnd` pattern passed to `getDashboardPlants()` via the page (from the request URL's `tz` param or a server-side timezone header).
   - What's unclear: Exactly how the timezone offset reaches `plants/page.tsx` (Server Component). Dashboard page may use a different mechanism (e.g., URL param `?tz=offset` set by client-side JS on first render).
   - Recommendation: Planner should read `src/app/(main)/dashboard/page.tsx` to see how it resolves `todayStart`/`todayEnd`, and replicate that exact pattern in `plants/page.tsx`. Do not invent a new approach.

2. **WateringHistory component fate**
   - What we know: `watering-history.tsx` and `watering-history-entry.tsx` currently render on the plant detail page. Phase 5 replaces them with the unified Timeline.
   - What's unclear: Whether `WateringHistory` is used anywhere else (e.g., a room detail page).
   - Recommendation: Grep for `WateringHistory` imports before removing. If only used in `plant-detail.tsx`, delete both files after the Timeline is wired up. If used elsewhere, retain.

3. **"Load more" action for timeline**
   - What we know: Current `loadMoreWateringHistory` Server Action is in `src/features/watering/actions.ts`.
   - What's unclear: Whether a new `loadMoreTimeline` Server Action should live in `src/features/notes/` or a new `src/features/timeline/` directory.
   - Recommendation: Create `src/features/timeline/` with a `loadMoreTimeline` action that calls `getTimeline(plantId, userId, skip, 20)`. This keeps the timeline query logic co-located.

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — Verified existing model conventions (Timestamptz, cuid, Cascade)
- `src/features/watering/actions.ts` — Verified Server Action pattern (auth, ownership check, revalidatePath)
- `src/features/watering/schemas.ts` — Verified Zod v4 schema pattern
- `src/components/plants/room-filter.tsx` — Verified URL search params pattern (useRouter, useSearchParams)
- `src/app/(main)/plants/page.tsx` — Verified searchParams shape and getPlants call
- `src/components/plants/plant-detail.tsx` — Verified current card structure being replaced
- `src/components/watering/watering-history-entry.tsx` — Verified kebab menu + AlertDialog + toast pattern
- `vitest.config.mts` — Verified test configuration (jsdom, tests/ directory)
- `package.json` — Verified installed dependencies, no new packages required

### Secondary (MEDIUM confidence)
- CLAUDE.md §Technology Stack — Stack decisions, version constraints, pattern guidance
- CONTEXT.md decisions D-01 through D-12 — Locked implementation choices

### Tertiary (LOW confidence)
- None — all claims are either VERIFIED from codebase or ASSUMED (see Assumptions Log above)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json; no new dependencies
- Architecture: HIGH — all patterns are direct extensions of verified existing code
- Pitfalls: HIGH — derived from direct code inspection of existing patterns and identified edge cases
- Timeline merge approach: MEDIUM — performance assumption at scale (see A1)

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack, no breaking changes expected in this window)
