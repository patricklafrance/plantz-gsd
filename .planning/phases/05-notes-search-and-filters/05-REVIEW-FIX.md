---
phase: 05-notes-search-and-filters
fixed_at: 2026-04-14T12:15:00Z
review_path: .planning/phases/05-notes-search-and-filters/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-04-14T12:15:00Z
**Source review:** .planning/phases/05-notes-search-and-filters/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: deleteNote accepts raw string without Zod validation

**Files modified:** `src/features/notes/schemas.ts`, `src/features/notes/actions.ts`, `src/components/timeline/timeline-entry.tsx`
**Commit:** c053853
**Applied fix:** Added `deleteNoteSchema` to schemas.ts with `noteId: z.string().min(1)` validation. Changed `deleteNote` signature from `(noteId: string)` to `(data: unknown)` with Zod safeParse validation, consistent with `createNote` and `updateNote`. Updated the call site in `timeline-entry.tsx` to pass `{ noteId: entry.id }` instead of a raw string.

### WR-02: loadMoreTimeline server action does not validate skip parameter

**Files modified:** `src/features/notes/actions.ts`, `src/components/timeline/timeline.tsx`
**Commit:** 3c5f9a9
**Applied fix:** Added inline `loadMoreTimelineSchema` with `plantId: z.string().min(1)` and `skip: z.number().int().min(0)` validation. Changed `loadMoreTimeline` signature from `(plantId: string, skip: number)` to `(data: unknown)` with Zod safeParse. Updated both call sites in `timeline.tsx` to pass `{ plantId, skip: ... }` objects.

### WR-03: Duplicate merge logic between mergeTimeline and getTimeline

**Files modified:** `src/features/notes/queries.ts`
**Commit:** d9cf1f0
**Applied fix:** Refactored `getTimeline` to delegate to the existing `mergeTimeline` pure function instead of reimplementing the merge-and-sort logic inline. Removed the two redundant `db.count()` queries since `mergeTimeline` computes the total from array lengths.

### WR-04: SearchBar debounce closure may become stale on rapid param changes

**Files modified:** `src/components/plants/search-bar.tsx`
**Commit:** 17da36c
**Applied fix:** Replaced `useCallback` + `[searchParams]` dependency with a `useRef` to hold the latest `searchParams` and `useMemo` with an empty dependency array for a stable debounce function. This ensures the debounce timer always reads the current searchParams from the ref, eliminating stale closure issues. Removed the `eslint-disable-next-line` comment that was suppressing the hooks dependency warning.

### WR-05: Note content has no max-length validation

**Files modified:** `src/features/notes/schemas.ts`, `tests/notes.test.ts`
**Commit:** a99983a
**Applied fix:** Added `.max(5000, "Note is too long.")` to the `content` field in both `createNoteSchema` and `updateNoteSchema`. Updated the existing test that asserted 10,000-character content would pass -- it now asserts 5,000 characters pass and added a new test asserting 5,001 characters are rejected.

## Skipped Issues

None -- all findings were fixed.

---

_Fixed: 2026-04-14T12:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
