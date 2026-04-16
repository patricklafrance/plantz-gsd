---
phase: 05-notes-search-and-filters
plan: 01
subsystem: notes-data-layer
tags: [prisma, server-actions, timeline, tests, zod]
dependency_graph:
  requires:
    - "04-03: Plant detail page with watering history (plantId routes exist)"
    - "prisma/schema.prisma: Plant model with id, userId"
  provides:
    - "Note model in database (PostgreSQL, Note table created)"
    - "createNote, updateNote, deleteNote Server Actions with IDOR protection"
    - "getTimeline query: interleaved WateringLog + Note sorted by timestamp desc"
    - "mergeTimeline pure function for testable timeline merge logic"
    - "TimelineEntry discriminated union type"
    - "createNoteSchema, updateNoteSchema Zod v4 schemas"
    - "Test stubs for SRCH-01, SRCH-02, SRCH-03 (plants-search.test.ts)"
  affects:
    - "prisma/schema.prisma: Plant model gains notes Note[] relation"
    - "src/generated/prisma: Prisma client regenerated with Note type"
tech_stack:
  added: []
  patterns:
    - "ownership-check-via-plant-relation: db.note.findFirst({ where: { id, plant: { userId } } })"
    - "fetch-all-then-slice: getTimeline fetches all logs+notes then slices for pagination"
    - "pure-function-for-testing: mergeTimeline exported separately from DB-coupled getTimeline"
key_files:
  created:
    - prisma/schema.prisma (Note model added)
    - src/types/timeline.ts
    - src/features/notes/schemas.ts
    - src/features/notes/actions.ts
    - src/features/notes/queries.ts
    - tests/notes.test.ts
    - tests/timeline.test.ts
    - tests/plants-search.test.ts
  modified:
    - prisma/schema.prisma (Plant model gains notes Note[] relation)
decisions:
  - "mergeTimeline exported as pure function separate from getTimeline to enable unit testing without DB mocks"
  - "fetch-all-then-slice pagination strategy for timeline (per RESEARCH A1: <200 entries acceptable at plant scale)"
  - "No character limit on note content (per D-06)"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-15T03:30:00Z"
  tasks_completed: 2
  files_created: 8
---

# Phase 05 Plan 01: Note Data Layer, Timeline Types, and Test Stubs — Summary

**One-liner:** Note model added to Prisma schema, CRUD Server Actions with IDOR protection, mergeTimeline pure function with full test coverage, and search/filter test stubs scaffolded.

## What Was Built

### Task 1: Note model, Zod schemas, timeline types, and test stubs

- Added `Note` model to `prisma/schema.prisma` with `id`, `plantId`, `content`, `createdAt`, `updatedAt` and `@@index([plantId])`
- Added `notes Note[]` relation to `Plant` model
- Ran `npx prisma db push` — Note table created in PostgreSQL (Neon)
- Ran `npx prisma generate` — Prisma client regenerated with Note type
- Created `src/types/timeline.ts` with `TimelineEntry` discriminated union (`"watering"` | `"note"`) and `NoteData` type
- Created `src/features/notes/schemas.ts` with `createNoteSchema` and `updateNoteSchema` (no `.max()` on content — D-06)
- Created `tests/notes.test.ts` with 6 passing schema validation tests + 7 action `test.todo` stubs
- Created `tests/timeline.test.ts` with 5 `test.todo` stubs for merge and sort behavior
- Created `tests/plants-search.test.ts` with 11 `test.todo` stubs for SRCH-01, SRCH-02, SRCH-03

**Commit:** `7483258`

### Task 2: Note Server Actions and timeline query function

- Created `src/features/notes/actions.ts` with `createNote`, `updateNote`, `deleteNote`
  - All actions call `auth()` first — unauthenticated requests return `{ error: "Not authenticated." }`
  - `createNote`: ownership check via `db.plant.findFirst({ where: { id, userId } })`
  - `updateNote`/`deleteNote`: ownership check via `db.note.findFirst({ where: { id, plant: { userId } } })` (T-05-01 mitigation)
  - All actions call `revalidatePath("/plants/" + plantId)` after mutation
- Created `src/features/notes/queries.ts` with:
  - `mergeTimeline` — pure function (no DB) for unit testing, exported alongside `getTimeline`
  - `getTimeline` — fetches WateringLog[] and Note[] in parallel via `Promise.all`, merges, sorts descending by timestamp, slices for pagination
  - `loadMoreTimeline` — alias of `getTimeline` for cursor-based pagination from UI
- Converted `tests/notes.test.ts` — all 7 action `test.todo` stubs converted to real passing tests
- Converted `tests/timeline.test.ts` — all 5 `test.todo` stubs converted to real passing tests using `mergeTimeline`

**Commit:** `eb60eac`

## Test Results

```
Test Files  7 passed | 3 skipped (10)
     Tests  31 passed | 69 todo (100)
```

- `tests/notes.test.ts`: 13 tests pass (6 schema + 7 action tests)
- `tests/timeline.test.ts`: 5 tests pass (merge, pagination, count, empty cases)
- `tests/plants-search.test.ts`: 11 test.todo (stubs for Plan 03)
- All pre-existing tests continue to pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DATABASE_URL error when importing queries module in timeline tests**

- **Found during:** Task 2 test run
- **Issue:** `tests/timeline.test.ts` imported `@/features/notes/queries` which triggered `@/lib/db` initialization at module level, causing `DATABASE_URL environment variable is not set` error
- **Fix:** Added `vi.mock("@/lib/db", ...)` and related mocks to `timeline.test.ts` before importing — mirrors pattern used in `notes.test.ts`
- **Files modified:** `tests/timeline.test.ts`
- **Commit:** `eb60eac`

**2. [Rule 3 - Blocking] Task 1 test stubs tried to import non-existent actions module**

- **Issue:** Initial `tests/notes.test.ts` included real action tests importing `@/features/notes/actions` which didn't exist yet in Task 1
- **Fix:** Reverted action tests to `test.todo` stubs for Task 1 commit; converted to real tests in Task 2 once actions.ts existed
- **Commit:** `7483258` (stubs), `eb60eac` (real tests)

**3. [Rule 3 - Blocking] .env.local not present in worktree for prisma db push**

- **Issue:** `npx prisma db push` failed with "datasource.url property is required" — `.env.local` was in main repo but not in worktree
- **Fix:** Copied `.env.local` from main repo to worktree directory before running push
- **Impact:** None on committed files; `.env.local` is gitignored

## Known Stubs

`tests/plants-search.test.ts` contains 11 `test.todo` stubs for SRCH-01, SRCH-02, SRCH-03. These are intentional stubs — Plan 03 (search and filters implementation) will implement the `getPlants` query with search/status/sort parameters and fill these tests in.

## Threat Surface Scan

All three threat register entries (T-05-01, T-05-02, T-05-03) are mitigated as planned:

- **T-05-01** (IDOR on updateNote/deleteNote): `db.note.findFirst({ where: { id, plant: { userId: session.user.id } } })` — ownership verified through plant relation
- **T-05-02** (Tampering on createNote/updateNote): Zod v4 schema validates non-empty string; `auth()` called at top of every action
- **T-05-03** (Info disclosure in getTimeline): `plant: { userId }` in where clause — only returns authenticated user's data

No new threat surface introduced beyond what the plan's threat model covers.

## Self-Check: PASSED

- [x] `prisma/schema.prisma` — FOUND (Note model, notes Note[], @@index([plantId]))
- [x] `src/types/timeline.ts` — FOUND (TimelineEntry export)
- [x] `src/features/notes/schemas.ts` — FOUND (createNoteSchema, updateNoteSchema)
- [x] `src/features/notes/actions.ts` — FOUND (createNote, updateNote, deleteNote)
- [x] `src/features/notes/queries.ts` — FOUND (getTimeline, mergeTimeline, loadMoreTimeline)
- [x] `tests/notes.test.ts` — FOUND (13 passing tests)
- [x] `tests/timeline.test.ts` — FOUND (5 passing tests)
- [x] `tests/plants-search.test.ts` — FOUND (11 test.todo stubs)
- [x] Commit `7483258` — FOUND
- [x] Commit `eb60eac` — FOUND
- [x] `npm test` exits with code 0 — PASSED (31 pass, 69 todo)
- [x] `npx prisma db push` exited with code 0 — Note table in PostgreSQL
