---
phase: 07-polish-and-accessibility
plan: 04
subsystem: ui
tags: [pagination, empty-states, character-limits, timezone, prisma, next.js]

# Dependency graph
requires:
  - phase: 07-03
    provides: WCAG AA accessibility foundations (landmarks, headings, focus management)
provides:
  - Server-side pagination for plants collection at 20/page
  - Shared EmptyState component for consistent empty states across all pages
  - Character limits enforced at schema and input level (nickname 40, room 40, notes 1000)
  - Timezone mismatch warning banner on dashboard
  - Pagination component with Previous/Next and param preservation
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side pagination with Promise.all([findMany, count]) pattern"
    - "Shared EmptyState component with icon/heading/body/action slots"
    - "Dual validation: Zod schema max + HTML maxLength on inputs"
    - "Character count display when within 20 chars of limit"
    - "Client-side timezone detection comparing Intl.DateTimeFormat vs cookie"

key-files:
  created:
    - src/components/shared/pagination.tsx
    - src/components/shared/empty-state.tsx
    - src/components/shared/timezone-warning.tsx
  modified:
    - src/features/plants/queries.ts
    - src/features/plants/schemas.ts
    - src/features/rooms/schemas.ts
    - src/features/notes/schemas.ts
    - src/app/(main)/plants/page.tsx
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/rooms/page.tsx
    - src/app/(main)/rooms/[id]/page.tsx
    - src/components/plants/add-plant-dialog.tsx
    - src/components/plants/edit-plant-dialog.tsx
    - src/components/rooms/create-room-dialog.tsx
    - src/components/timeline/note-input.tsx
    - src/components/reminders/notification-bell.tsx

key-decisions:
  - "Pagination uses URL params (not client state) for server-side rendering and shareability"
  - "EmptyState component uses iconVariant accent/muted to distinguish call-to-action vs informational empty states"
  - "Timezone warning uses sessionStorage for dismissal (resets each browser session)"
  - "Character limits tightened from original values (nickname 100->40, room 50->40, notes 5000->1000) per UI-SPEC D-14"

patterns-established:
  - "Pagination pattern: getPlants returns {plants, totalCount, totalPages, currentPage} object"
  - "EmptyState pattern: shared component replaces inline empty state JSX across all pages"
  - "Character limit pattern: Zod .max() + HTML maxLength + character count display near limit"

requirements-completed: [UIAX-04]

# Metrics
duration: 8min
completed: 2026-04-16
---

# Phase 07 Plan 04: Edge Case Hardening Summary

**Server-side pagination at 20/page, shared EmptyState component, character limits (40/40/1000), and timezone mismatch warning banner**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-16T01:50:54Z
- **Completed:** 2026-04-16T01:59:08Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Server-side pagination for plants collection with Previous/Next navigation preserving all URL params
- Shared EmptyState component standardizing empty states across dashboard, plants, rooms, room detail, and notification bell
- Character limits enforced at both Zod schema and HTML input level with character count display near limits
- Timezone mismatch warning on dashboard comparing browser IANA timezone vs cookie, dismissible per session

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side pagination for plants collection page** - `de2e98e` (feat)
2. **Task 2: Character limits, shared EmptyState, empty state standardization, timezone warning** - `50e2e2b` (feat)

## Files Created/Modified
- `src/components/shared/pagination.tsx` - Pagination nav with Previous/Next, page count, URL param preservation
- `src/components/shared/empty-state.tsx` - Shared component with icon, heading, body, action slot
- `src/components/shared/timezone-warning.tsx` - Client component detecting timezone mismatch via cookie comparison
- `src/features/plants/queries.ts` - Added pagination (page param, skip/take, Promise.all with count)
- `src/features/plants/schemas.ts` - Nickname max reduced from 100 to 40
- `src/features/rooms/schemas.ts` - Room name max reduced from 50 to 40
- `src/features/notes/schemas.ts` - Note content max reduced from 5000 to 1000
- `src/app/(main)/plants/page.tsx` - Page param parsing, Pagination component, EmptyState usage, out-of-range redirect
- `src/app/(main)/dashboard/page.tsx` - EmptyState for no-plants, TimezoneWarning after onboarding banner
- `src/app/(main)/rooms/page.tsx` - EmptyState for no-rooms with CreateRoomDialog action
- `src/app/(main)/rooms/[id]/page.tsx` - EmptyState for no-plants-in-room
- `src/components/plants/add-plant-dialog.tsx` - maxLength={40} on nickname input with character count
- `src/components/plants/edit-plant-dialog.tsx` - maxLength={40} on nickname input with character count
- `src/components/rooms/create-room-dialog.tsx` - maxLength={40}, client validation updated 50->40, character count
- `src/components/timeline/note-input.tsx` - maxLength={1000} with character count near limit
- `src/components/reminders/notification-bell.tsx` - Empty copy updated to match UI-SPEC
- `tests/plants-search.test.ts` - Fixed pagination mock (count), fixed pre-existing default sort test bug
- `tests/notes.test.ts` - Updated note character limit tests from 5000 to 1000

## Decisions Made
- Pagination uses server-side URL params rather than client state for SSR compatibility and shareable URLs
- EmptyState component uses iconVariant (accent/muted) to visually distinguish primary call-to-action empty states from informational ones
- Timezone warning uses sessionStorage for dismissal so it reappears each browser session (in case user travels)
- Character limits tightened per UI-SPEC D-14 requirements rather than keeping original generous limits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing default sort test assertion**
- **Found during:** Task 1 (Server-side pagination)
- **Issue:** Test asserted default sort was `nextWateringAt: "asc"` but code has always used `nickname: "asc"` as default
- **Fix:** Updated test assertion to match actual code behavior (`nickname: "asc"`)
- **Files modified:** tests/plants-search.test.ts
- **Verification:** `npx vitest run` passes all 77 tests
- **Committed in:** de2e98e (Task 1 commit)

**2. [Rule 1 - Bug] Added db.plant.count mock for pagination compatibility**
- **Found during:** Task 1 (Server-side pagination)
- **Issue:** getPlants now calls db.plant.count in Promise.all; existing tests only mocked findMany
- **Fix:** Added `vi.mocked(db.plant.count).mockResolvedValue(0)` to beforeEach
- **Files modified:** tests/plants-search.test.ts
- **Verification:** All search/filter/sort tests pass with pagination changes
- **Committed in:** de2e98e (Task 1 commit)

**3. [Rule 1 - Bug] Updated note character limit test from 5000 to 1000**
- **Found during:** Task 2 (Character limits)
- **Issue:** Test expected 5000 chars to be valid but schema was tightened to 1000
- **Fix:** Updated test to use 1000/1001 character boundaries
- **Files modified:** tests/notes.test.ts
- **Verification:** `npx vitest run` passes all 77 tests
- **Committed in:** 50e2e2b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 - Bug fixes in tests)
**Impact on plan:** All auto-fixes necessary for test compatibility with planned changes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 07 edge case hardening complete
- All empty states standardized with shared component
- Pagination ready for any future list pages
- Character limits enforced consistently across all text inputs

## Self-Check: PASSED

All created files exist. All commit hashes verified. SUMMARY.md present.

---
*Phase: 07-polish-and-accessibility*
*Completed: 2026-04-16*
