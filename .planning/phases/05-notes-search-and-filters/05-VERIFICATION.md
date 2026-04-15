---
phase: 05-notes-search-and-filters
verified: 2026-04-15T00:10:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Open a plant detail page. Type a note in the input field and press Enter."
    expected: "Note appears at the top of the Timeline within ~1 second with a Pencil icon and timestamp. Toast shows 'Note added.'"
    why_human: "Server Action + revalidatePath round-trip and real-time UI update cannot be verified statically."
  - test: "On a note entry, click the kebab menu (three dots). Select Edit. Modify text and click Save note."
    expected: "Note content updates in place. Toast shows 'Note updated.' Timestamp shows '(edited)' indicator."
    why_human: "Inline edit mode, save/discard state, and textarea interaction require live browser session."
  - test: "On a note entry, click the kebab menu. Select Delete. Confirm in the AlertDialog."
    expected: "Note disappears from the timeline. Toast shows 'Note deleted.'"
    why_human: "AlertDialog interaction and timeline refresh after deletion require live browser session."
  - test: "On the /plants page, type 'monstera' in the search bar. Wait 300ms."
    expected: "Plant grid filters to show only plants with 'monstera' in nickname or species. URL updates to ?search=monstera."
    why_human: "Debounced URL navigation and grid re-render require live browser session."
  - test: "Click 'Overdue' status pill. Then select a room filter."
    expected: "Plant grid shows only overdue plants in that specific room (AND logic). Both filter params appear in URL."
    why_human: "Composed filter state and grid update require live browser session."
  - test: "Navigate to /plants with no plants at all vs. /plants with plants but a search that matches nothing."
    expected: "Zero-collection case shows original 'No plants yet' empty state with AddPlant CTA. Filter-no-results case shows 'No plants found' with Clear search/filters CTA."
    why_human: "Two different empty states with distinct messaging and CTAs require live browser session to distinguish."
---

# Phase 5: Notes, Search, and Filters — Verification Report

**Phase Goal:** Users can annotate individual plants with timestamped notes and quickly find any plant in their collection
**Verified:** 2026-04-15T00:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add a timestamped text note to any plant and view it in the plant detail history timeline alongside watering events | VERIFIED | `NoteInput` calls `createNote` SA; `getTimeline` fetches both `wateringLog` and `note` in parallel; `TimelineEntry` renders both types. Plant detail page passes `timelineEntries` to `Timeline`. |
| 2 | User can edit or delete their own notes | VERIFIED | `TimelineEntryComponent` has inline edit mode (textarea + Save note / Discard changes) calling `updateNote` SA, and AlertDialog delete confirmation calling `deleteNote` SA. Both actions verify ownership via `plant: { userId: session.user.id }`. |
| 3 | User can search plants by nickname or species name and see results immediately | VERIFIED | `SearchBar` debounces 300ms then pushes `?search=` URL param. `getPlants` uses `{ nickname: { contains: search, mode: "insensitive" } } OR { species: ... }`. 3 tests verify search, case-insensitivity. |
| 4 | User can filter plants by room, watering status (overdue, due today, upcoming), and archived state, and can sort by next watering date, name, or recently added | VERIFIED | `StatusFilter` sets `?status=` param; `SortDropdown` sets `?sort=`; `RoomFilter` (existing) sets `?room=`. `getPlants` applies all as Prisma where/orderBy. 8 tests verify status + sort combinations. Room+status composes via spread into same where clause. |

**Score:** 4/4 truths verified

### Plan-Level Must-Haves

#### Plan 01 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Note model exists in Prisma schema with plantId, content, createdAt, updatedAt | VERIFIED | `prisma/schema.prisma` lines 65–74: model Note with all required fields + `@@index([plantId])`. Plant model line 50: `notes Note[]` relation. |
| 2 | createNote Server Action creates a note for a plant owned by the authenticated user | VERIFIED | `actions.ts` line 9: `auth()` check, line 17: `db.plant.findFirst({ where: { id, userId: session.user.id } })`, line 22: `db.note.create`. Test confirms auth failure + ownership failure + success. |
| 3 | updateNote Server Action edits a note with ownership check via plant.userId | VERIFIED | `actions.ts` line 42: `db.note.findFirst({ where: { id, plant: { userId: session.user.id } } })`. Test verifies ownership gate. |
| 4 | deleteNote Server Action removes a note with ownership check via plant.userId | VERIFIED | `actions.ts` line 66: same ownership pattern. Test verifies gate. |
| 5 | getTimeline query returns interleaved watering logs and notes sorted by timestamp descending | VERIFIED | `queries.ts` line 49: `Promise.all` with 4 DB queries; lines 61–88: merge into `TimelineEntry[]`, sort descending by `getTime()`. 5 timeline tests confirm merge, pagination, empty cases. |
| 6 | Test stubs exist for notes, timeline, and plants-search behaviors | VERIFIED | All 3 test files exist with real passing tests (not stubs). Notes: 13 tests. Timeline: 5 tests. Plants-search: 11 tests. |

#### Plan 02 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Plant detail page shows a single Timeline card instead of separate Watering history and Notes cards | VERIFIED | `plant-detail.tsx` line 156: Timeline card only. "Watering history" and "Notes will be available" strings absent. |
| 2 | Timeline entries display watering logs and notes interleaved in reverse chronological order | VERIFIED | `TimelineEntryComponent` branches on `entry.type === "watering"` vs `"note"`. `getTimeline` sorts descending. `Timeline` renders the sorted list. |
| 3 | User can add a note by typing in the inline input and pressing Enter or clicking Add | VERIFIED | `NoteInput` line 41: `if (e.key === "Enter")` handler. Add button calls same submit function. |
| 4 | User can edit a note inline via kebab menu Edit action | VERIFIED | `timeline-entry.tsx` line 63: `handleEdit` sets `editMode = true`, reveals textarea. Line 68: `updateNote` called on save. |
| 5 | User can delete a note via kebab menu Delete action with AlertDialog confirmation | VERIFIED | `timeline-entry.tsx` line 241: AlertDialog title "Delete note?". Line 90: `deleteNote(entry.id)` on confirm. |
| 6 | Load more button appears when total entries exceed 20 and loads next 20 on click | VERIFIED | `timeline.tsx`: `hasMore = entries.length < total`. "Load 20 more" button calls `loadMoreTimeline(plantId, entries.length)`. |

#### Plan 03 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can type in the search bar and the plant grid filters by nickname or species in real time | VERIFIED | `SearchBar` debounce 300ms → `params.set("search", query)` → `router.push`. `getPlants` applies OR search. |
| 2 | User can click status filter pills (All, Overdue, Due today, Upcoming, Archived) and the grid shows matching plants | VERIFIED | `StatusFilter` has all 5 pills. Clicking sets/deletes `?status=` param. `getPlants` maps status to Prisma date filters. |
| 3 | Room filter and status filter combine with AND logic | VERIFIED | `getPlants` spreads `roomId ? { roomId } : {}` and `statusFilter` into same Prisma `where` object — Prisma AND by default. |
| 4 | User can sort plants by Next watering date, Name (A-Z), or Recently added via dropdown | VERIFIED | `SortDropdown` with 3 options, sets `?sort=`. `getPlants` maps to `nickname:asc`, `createdAt:desc`, `nextWateringAt:asc`. |
| 5 | Default view (no params) excludes archived plants and sorts by next watering date | VERIFIED | `archivedFilter` defaults to `{ archivedAt: null }`. `orderBy` defaults to `{ nextWateringAt: "asc" }`. |
| 6 | Empty state shows context-aware message when search/filter returns no results | VERIFIED | `plants/page.tsx`: 5 empty state cases with distinct headings and Link CTAs: archived, search-only, status-only, room+status, catch-all. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | Note model with plantId relation, @@index([plantId]) | VERIFIED | Lines 65–74. Plant model notes Note[] at line 50. |
| `src/types/timeline.ts` | TimelineEntry discriminated union type | VERIFIED | Exports `TimelineEntry`, `NoteData`. Lines 12–14. |
| `src/features/notes/schemas.ts` | Zod schemas for note create and update | VERIFIED | Exports `createNoteSchema`, `updateNoteSchema`. Imports from `zod/v4`. No .max() on content (D-06). |
| `src/features/notes/actions.ts` | Note CRUD Server Actions + loadMoreTimeline | VERIFIED | Exports createNote, updateNote, deleteNote, loadMoreTimeline. "use server" directive present. |
| `src/features/notes/queries.ts` | Timeline query function | VERIFIED | Exports getTimeline, mergeTimeline, loadMoreTimeline. Promise.all for parallel fetch. |
| `tests/notes.test.ts` | Tests for NOTE-01, NOTE-03 | VERIFIED | 13 passing tests — 6 schema validation + 7 action tests (auth, ownership, success paths). |
| `tests/timeline.test.ts` | Tests for NOTE-02 timeline merge | VERIFIED | 5 passing tests — merge, pagination (skip/take), total count, empty cases. |
| `tests/plants-search.test.ts` | Tests for SRCH-01, SRCH-02, SRCH-03 | VERIFIED | 11 passing tests — search, status, sort. All test.todo converted to real assertions. |
| `src/components/timeline/timeline.tsx` | Unified timeline with note input, entry list, load more | VERIFIED | Exports Timeline. NoteInput + Separator + entries list + Load 20 more. |
| `src/components/timeline/timeline-entry.tsx` | Polymorphic entry rendering with kebab menu | VERIFIED | Exports TimelineEntry. Branches on entry.type. Pencil+Droplets icons. Kebab menu with Edit/Delete. AlertDialog for delete. |
| `src/components/timeline/note-input.tsx` | Inline note add form | VERIFIED | Exports NoteInput. Enter key handler. Add button. aria-label="Note text". |
| `src/components/plants/plant-detail.tsx` | Refactored to use Timeline | VERIFIED | Imports Timeline. PlantDetailProps has timelineEntries + timelineTotal. No WateringHistory import. |
| `src/app/(main)/plants/[id]/page.tsx` | Fetches getTimeline | VERIFIED | Imports getTimeline from `@/features/notes/queries`. Passes timelineEntries + timelineTotal to PlantDetail. |
| `src/features/plants/queries.ts` | Extended getPlants with search, status, sort | VERIFIED | Options object with roomId, search, status, sort, todayStart, todayEnd. Contains/insensitive OR search. |
| `src/components/plants/search-bar.tsx` | Debounced search input | VERIFIED | Exports SearchBar. 300ms debounce. aria-labels. placeholder="Search plants...". |
| `src/components/plants/status-filter.tsx` | Status filter pill row | VERIFIED | Exports StatusFilter. 5 pills: All/Overdue/Due today/Upcoming/Archived. |
| `src/components/plants/sort-dropdown.tsx` | Sort dropdown | VERIFIED | Exports SortDropdown. 3 options: Next watering/Name (A-Z)/Recently added. |
| `src/app/(main)/plants/page.tsx` | Plants page with search, filters, sort | VERIFIED | Reads all 4 params. Timezone dates. Calls getPlants with options. Renders SearchBar/StatusFilter/SortDropdown. Context-aware empty state. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/timeline/note-input.tsx` | `src/features/notes/actions.ts` | createNote Server Action call | WIRED | Line 7: import. Line 22: `await createNote({ plantId, content })`. Response handled (toast on success/error). |
| `src/components/timeline/timeline-entry.tsx` | `src/features/notes/actions.ts` | updateNote, deleteNote calls | WIRED | Line 32: import. Lines 68, 90: called with real arguments. Success/error handling present. |
| `src/app/(main)/plants/[id]/page.tsx` | `src/features/notes/queries.ts` | getTimeline call in parallel fetch | WIRED | Line 5: import. Line 25: `getTimeline(id, session.user.id)` in Promise.all. Result destructured as timelineEntries + timelineTotal. |
| `src/features/notes/actions.ts` | `prisma.note` | Prisma client db.note.create/update/delete | WIRED | Line 22: db.note.create. Line 51: db.note.update. Line 74: db.note.delete. All in production paths. |
| `src/features/notes/queries.ts` | `prisma.wateringLog + prisma.note` | Parallel fetch, merge, sort by timestamp | WIRED | Line 49: Promise.all with 4 queries including both models. Merged and sorted in lines 61–88. |
| `src/components/plants/search-bar.tsx` | URL search params | useRouter push with search param | WIRED | Line 29: `params.set("search", query)`. Line 31: `params.delete("search")`. Line 33: `router.push`. |
| `src/components/plants/status-filter.tsx` | URL search params | useRouter push with status param | WIRED | Line 23: `params.set("status", status)`. Line 25: `params.delete("status")`. |
| `src/app/(main)/plants/page.tsx` | `src/features/plants/queries.ts` | getPlants call with extended options | WIRED | Line 43: `getPlants(session.user.id, { roomId, search, status, sort, todayStart, todayEnd })`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `timeline.tsx` | `entries` (TimelineEntry[]) | `initialEntries` prop → `getTimeline` DB query (wateringLog + note findMany) | Yes — real Prisma queries with userId where clause | FLOWING |
| `timeline.tsx` | Load more entries | `loadMoreTimeline` SA → `getTimeline` with skip param | Yes — same DB query with skip/take | FLOWING |
| `plant-detail.tsx` | `timelineEntries`, `timelineTotal` | `getTimeline(id, session.user.id)` in page server component | Yes — parallel Promise.all DB fetch | FLOWING |
| `plants/page.tsx` | `plants` array | `getPlants(session.user.id, options)` → `db.plant.findMany` with dynamic where | Yes — real Prisma query; options affect where/orderBy | FLOWING |
| `search-bar.tsx` | URL `?search=` param | User input (controlled state) → debounced router.push | n/a — filter input | FLOWING |
| `status-filter.tsx` | URL `?status=` param | Button click → router.push | n/a — filter input | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Notes test suite passes | `npm test -- tests/notes.test.ts` | 13/13 pass | PASS |
| Timeline merge tests pass | `npm test -- tests/timeline.test.ts` | 5/5 pass | PASS |
| Plants search tests pass | `npm test -- tests/plants-search.test.ts` | 11/11 pass | PASS |
| Full test suite clean | `npm test` | 42 passed, 0 failed, 58 todo | PASS |
| All 6 phase commits present | `git log --oneline` | 7483258, eb60eac, 1a37990, d26af41, dfa95ff, 6ffaacf confirmed | PASS |
| getTimeline queries real DB | grep db.note.findMany in queries.ts | Found at line 54 with userId where clause | PASS |
| getPlants queries real DB | grep db.plant.findMany in queries.ts | Found at line 42 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOTE-01 | 05-01, 05-02 | User can add a timestamped text note to any plant | SATISFIED | createNote SA + NoteInput component + getTimeline query + Timeline UI. |
| NOTE-02 | 05-01, 05-02 | User can view notes in the plant detail history timeline alongside watering events | SATISFIED | getTimeline merges both types. TimelineEntry renders both. Plant detail page uses Timeline card. |
| NOTE-03 | 05-01, 05-02 | User can edit or delete their own notes | SATISFIED | updateNote + deleteNote SAs with IDOR protection. Inline edit mode and AlertDialog delete in TimelineEntry. |
| SRCH-01 | 05-01, 05-03 | User can search plants by nickname or species name | SATISFIED | SearchBar 300ms debounce → ?search= param. getPlants OR search with mode:insensitive on nickname+species. |
| SRCH-02 | 05-01, 05-03 | User can filter plants by room, watering status, and archived | SATISFIED | StatusFilter for watering status + archived. RoomFilter (existing) for room. getPlants applies all with AND logic. |
| SRCH-03 | 05-01, 05-03 | User can sort plants by next watering date, name, or recently added | SATISFIED | SortDropdown with 3 options → ?sort= param. getPlants maps to Prisma orderBy. |

**All 6 requirements satisfied by implementation artifacts and verified by passing tests.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `timeline-entry.tsx` | (watering branch) | Watering entries are display-only — no edit/delete kebab for watering logs | Info | LogWateringDialog and deleteWateringLog don't exist yet (Phase 4 not complete). Documented deviation in 05-02-SUMMARY. Watering log mutations are not a Phase 5 requirement (WATR-05 is Phase 4). No blocker. |

No placeholder text, TODO comments, or empty return stubs found in any Phase 5 production files.

### Human Verification Required

#### 1. Note Add — End-to-End Flow

**Test:** Navigate to any plant detail page. Type "Leaves looking healthy" in the "Add a note..." input. Press Enter.
**Expected:** Note appears at the top of the Timeline within ~1 second with a Pencil icon and today's timestamp. Toast notification shows "Note added."
**Why human:** Server Action + revalidatePath cache invalidation + UI state update require a live browser session.

#### 2. Note Inline Edit

**Test:** On an existing note, click the kebab menu (three horizontal dots). Select Edit. Change the text. Click Save note.
**Expected:** Note content updates in place without page reload. Toast shows "Note updated." The entry shows "(edited)" next to the timestamp.
**Why human:** Inline edit state machine (editMode boolean, textarea, save/discard) and server round-trip require live interaction.

#### 3. Note Delete with AlertDialog

**Test:** On an existing note, click the kebab menu. Select Delete. Click "Delete note" in the confirmation dialog.
**Expected:** Note disappears from the timeline. Toast shows "Note deleted." Entry count decreases.
**Why human:** AlertDialog interaction and timeline refresh after mutation require live browser session.

#### 4. Search — Real-Time Filtering

**Test:** On /plants with at least 2 plants, type part of one plant's nickname or species name. Wait 300ms without typing.
**Expected:** Plant grid updates to show only matching plants. URL updates to include ?search=. Clearing the input shows all plants again.
**Why human:** Debounced URL navigation, grid re-render, and visual feedback require live browser session.

#### 5. Composed Filter — Room + Status

**Test:** Click a room filter pill, then click "Overdue" status pill.
**Expected:** Grid shows only overdue plants in that room (both filters active simultaneously). URL contains both ?room= and ?status=overdue.
**Why human:** Combined URL param state and filtered grid rendering require live browser session to confirm AND logic works as expected.

#### 6. Empty State Differentiation

**Test A:** Log in with a fresh account with zero plants. Navigate to /plants.
**Expected:** "Get started by adding your first plant" (original empty state) with AddPlantDialog CTA.
**Test B:** Add a plant named "Orchid". Search for "monstera". 
**Expected:** "No plants match 'monstera'" with "Clear search" link — not the original empty state.
**Why human:** Two visually distinct empty states with different CTAs require live browser session to confirm correct branching.

### Gaps Summary

No blocking gaps were found. All 4 roadmap success criteria are verified by existing code and passing tests. The one noted deviation — watering entries in the Timeline being display-only without a kebab menu — is an intentional, documented decision because Phase 4 (Dashboard and Watering Core Loop) has not yet been executed. This is not a Phase 5 requirement; WATR-05 (edit/delete watering logs) is assigned to Phase 4.

Human verification items are the only outstanding check before this phase can be marked fully complete.

---

_Verified: 2026-04-15T00:10:00Z_
_Verifier: Claude (gsd-verifier)_
