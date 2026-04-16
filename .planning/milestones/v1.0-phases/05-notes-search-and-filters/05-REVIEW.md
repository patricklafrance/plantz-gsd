---
phase: 05-notes-search-and-filters
reviewed: 2026-04-14T12:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - prisma/schema.prisma
  - src/types/timeline.ts
  - src/features/notes/schemas.ts
  - src/features/notes/actions.ts
  - src/features/notes/queries.ts
  - src/features/plants/queries.ts
  - src/components/timeline/note-input.tsx
  - src/components/timeline/timeline-entry.tsx
  - src/components/timeline/timeline.tsx
  - src/components/plants/search-bar.tsx
  - src/components/plants/status-filter.tsx
  - src/components/plants/sort-dropdown.tsx
  - src/components/plants/plant-detail.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/plants/page.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/components/ui/tooltip.tsx
  - tests/notes.test.ts
  - tests/timeline.test.ts
  - tests/plants-search.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 5 adds three features: plant notes (CRUD on a timeline), search/filter/sort on the plants page, and a unified timeline merging watering logs with notes. Overall the code is well-structured with proper authentication checks, ownership verification on all mutations, Zod validation, and clean component decomposition.

No critical issues were found. The security model is solid -- every server action checks session auth and verifies plant ownership before mutating. The main concerns are around missing input validation on the `deleteNote` server action parameter, a redundant duplicate of merge logic in queries, potential stale debounce closure in SearchBar, and missing max-length validation that could allow very large payloads.

## Warnings

### WR-01: deleteNote accepts raw string without Zod validation

**File:** `src/features/notes/actions.ts:61`
**Issue:** The `deleteNote` action accepts `noteId: string` directly without schema validation. While `createNote` and `updateNote` both validate through Zod schemas, `deleteNote` trusts the caller to provide a well-formed string. Since this is a `"use server"` function, it is publicly callable -- a malicious client could pass any value (empty string, extremely long string, or non-string type if TypeScript types are bypassed at runtime). The ownership check mitigates exploitation, but the missing validation is inconsistent with the pattern used by the other two actions.
**Fix:**
```typescript
// In schemas.ts, add:
export const deleteNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required."),
});

// In actions.ts, update deleteNote:
export async function deleteNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = deleteNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const note = await db.note.findFirst({
    where: {
      id: parsed.data.noteId,
      plant: { userId: session.user.id },
    },
  });
  if (!note) return { error: "Note not found." };

  await db.note.delete({ where: { id: parsed.data.noteId } });
  revalidatePath("/plants/" + note.plantId);
  return { success: true };
}
```

### WR-02: loadMoreTimeline server action does not validate skip parameter

**File:** `src/features/notes/actions.ts:81-85`
**Issue:** The `loadMoreTimeline` server action accepts `plantId: string` and `skip: number` without any validation. Since server actions are public endpoints, a caller could pass a negative skip value, NaN, Infinity, or a non-number type. While the downstream `mergeTimeline` uses `Array.slice()` which handles some edge cases gracefully, negative skip values would produce unexpected results (slice with a negative start index reads from the end of the array).
**Fix:**
```typescript
export async function loadMoreTimeline(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = z.object({
    plantId: z.string().min(1),
    skip: z.number().int().min(0),
  }).safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  return getTimeline(parsed.data.plantId, session.user.id, parsed.data.skip, 20);
}
```

### WR-03: Duplicate merge logic between mergeTimeline and getTimeline

**File:** `src/features/notes/queries.ts:9-34` and `src/features/notes/queries.ts:62-81`
**Issue:** The timeline merge-and-sort logic is implemented twice: once in the exported `mergeTimeline` pure function (lines 9-34) and again inline in `getTimeline` (lines 62-81). The two implementations are functionally equivalent but the duplication means a future bug fix or behavior change must be applied in two places. The `mergeTimeline` function was explicitly created for testability, yet `getTimeline` does not call it.
**Fix:** Refactor `getTimeline` to use the existing `mergeTimeline` function:
```typescript
export async function getTimeline(
  plantId: string,
  userId: string,
  skip = 0,
  take = 20
): Promise<{ entries: TimelineEntry[]; total: number }> {
  const [wateringLogs, notes] = await Promise.all([
    db.wateringLog.findMany({
      where: { plantId, plant: { userId } },
      orderBy: { wateredAt: "desc" },
    }),
    db.note.findMany({
      where: { plantId, plant: { userId } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return mergeTimeline(wateringLogs, notes, skip, take);
}
```
This also eliminates the now-unnecessary `wCount` and `nCount` queries, since `mergeTimeline` already computes the total from the array lengths.

### WR-04: SearchBar debounce closure may become stale on rapid param changes

**File:** `src/components/plants/search-bar.tsx:24-36`
**Issue:** The `updateURL` callback wraps a `debounce` call inside `useCallback` with `[searchParams]` as its dependency. The `debounce` function creates a new timer reference each time `useCallback` re-creates the function (when `searchParams` changes). However, if `searchParams` changes while a debounce timer is still pending from the previous closure, that old timer will fire with the stale `searchParams` reference, potentially constructing an incorrect URL (e.g., losing a status filter param that was just added). The eslint-disable comment on line 24 suppresses the hook dependency warning, which is a signal this pattern needs attention.
**Fix:** Use a ref to hold the latest searchParams, avoiding the need to recreate the debounce on every param change:
```typescript
const searchParamsRef = useRef(searchParams);
searchParamsRef.current = searchParams;

const updateURL = useMemo(
  () =>
    debounce((query: string) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (query) {
        params.set("search", query);
      } else {
        params.delete("search");
      }
      router.push(`/plants?${params.toString()}`);
    }, 300),
  [] // stable — reads from ref
);
```

### WR-05: Note content has no max-length validation

**File:** `src/features/notes/schemas.ts:5` and `src/features/notes/schemas.ts:10`
**Issue:** Both `createNoteSchema` and `updateNoteSchema` validate that content is non-empty (`min(1)`), but do not enforce a maximum length. The Prisma schema maps `content` to `String` which becomes PostgreSQL `text` (unlimited). A malicious or accidental request could submit megabytes of text in a single note. The test file even explicitly tests that 10,000-character content passes (line 50-57 of `tests/notes.test.ts`), confirming no upper bound. While PostgreSQL `text` has no hard limit, unbounded user input can cause issues with rendering, storage, and bandwidth.
**Fix:**
```typescript
// In schemas.ts:
export const createNoteSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  content: z.string().min(1, "Note cannot be empty.").max(5000, "Note is too long."),
});

export const updateNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required."),
  content: z.string().min(1, "Note cannot be empty.").max(5000, "Note is too long."),
});
```

## Info

### IN-01: Redundant loadMoreTimeline export in queries module

**File:** `src/features/notes/queries.ts:89-96`
**Issue:** The `loadMoreTimeline` function in queries.ts is a trivial wrapper that just calls `getTimeline` with the same arguments. It is not imported anywhere (the server action in `actions.ts` also calls `getTimeline` directly). This appears to be dead code.
**Fix:** Remove the `loadMoreTimeline` function from `queries.ts` since the server action in `actions.ts` already directly calls `getTimeline`.

### IN-02: getTimeline fetches counts separately despite fetching all records

**File:** `src/features/notes/queries.ts:49-60`
**Issue:** `getTimeline` runs four parallel queries: two `findMany` (to get all records) and two `count` queries. The count queries are redundant because the total can be computed from the `findMany` results (`wateringLogs.length + notes.length`). This is two unnecessary DB round-trips per timeline load.
**Fix:** Remove the `wCount` and `nCount` queries and use `wateringLogs.length + notes.length` for the total (which is what `mergeTimeline` already does). If WR-03 is addressed, this is fixed automatically.

### IN-03: EmptyFilterState receives roomName but buildClearUrl needs room ID

**File:** `src/app/(main)/plants/page.tsx:140-144`
**Issue:** The `allParams` object in `EmptyFilterState` sets `room: roomName` (the display name), but `buildClearUrl` would preserve it as a query param value. This does not cause a bug currently because `buildClearUrl` is only used with `clearKeys` that would remove the room param in the relevant paths, and the "roomName" condition checks only check for truthiness. However, the comment on line 143 acknowledges the discrepancy. If a future code path called `buildClearUrl(allParams, ["search"])` (clearing only search while keeping room), the room param would be set to the name instead of the ID.
**Fix:** Pass the room ID instead of the room name:
```typescript
// In PlantsPage, pass roomId to EmptyFilterState:
<EmptyFilterState
  search={params.search}
  status={params.status}
  roomId={params.room}
  roomName={activeRoom?.name}
/>

// In EmptyFilterState, use roomId for URL building:
const allParams: Record<string, string | undefined> = {
  search,
  status,
  room: roomId,
};
```

### IN-04: Date comparison for "edited" indicator uses `>` on Date objects

**File:** `src/components/timeline/timeline-entry.tsx:137`
**Issue:** The line `const isEdited = noteData.updatedAt > noteData.createdAt;` uses `>` to compare Date objects. While this works in JavaScript (Date objects are compared by their numeric value via `valueOf()`), it relies on implicit type coercion. Additionally, if the data has been serialized and deserialized across the server/client boundary (e.g., via JSON in a server action response), `updatedAt` and `createdAt` may be strings rather than Date objects, which would make the comparison lexicographic instead of chronological. Depending on the date format, this could produce incorrect results.
**Fix:** Use explicit comparison to be safe against serialization:
```typescript
const isEdited = new Date(noteData.updatedAt).getTime() > new Date(noteData.createdAt).getTime();
```

---

_Reviewed: 2026-04-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
