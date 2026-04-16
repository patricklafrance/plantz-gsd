---
phase: 05-notes-search-and-filters
plan: 02
subsystem: ui
tags: [react, timeline, notes, watering, client-components, base-ui, date-fns]

dependency_graph:
  requires:
    - "05-01: Note model, Server Actions (createNote/updateNote/deleteNote), getTimeline query, TimelineEntry type"
    - "03-xx: Plant detail page at /plants/[id] with PlantDetail component"
  provides:
    - "NoteInput component: inline note add form with Enter key and Add button"
    - "TimelineEntry component: polymorphic watering/note rendering with kebab menu for notes"
    - "Timeline component: unified entry list with Load more pagination and empty state"
    - "DropdownMenu UI component based on @base-ui/react/menu"
    - "Tooltip UI component based on @base-ui/react/tooltip"
    - "Plant detail page shows single Timeline card replacing old Watering history + Notes cards"
  affects:
    - "05-03: Search and filters (shares plant detail page context)"
    - "04-xx: Watering feature (plant detail page now uses Timeline instead of WateringHistory)"

tech-stack:
  added: []
  patterns:
    - "base-ui-component-wrapper: DropdownMenu and Tooltip wrap @base-ui/react primitives following same pattern as Alert Dialog and Dialog"
    - "client-component-for-interactivity: plant-detail.tsx promoted to use client because Timeline is a client component"
    - "loadMore-server-action-pattern: loadMoreTimeline Server Action handles auth and delegates to getTimeline query"
    - "polymorphic-entry-component: TimelineEntryComponent switches on entry.type for watering vs note rendering"

key-files:
  created:
    - src/components/timeline/note-input.tsx
    - src/components/timeline/timeline-entry.tsx
    - src/components/timeline/timeline.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/tooltip.tsx
  modified:
    - src/components/plants/plant-detail.tsx
    - src/app/(main)/plants/[id]/page.tsx
    - src/features/notes/actions.ts

key-decisions:
  - "Watering entry kebab omitted: LogWateringDialog and deleteWateringLog don't exist yet (Phase 4 not done). Watering entries render display-only. The acceptance criteria only requires the note kebab."
  - "Tooltip wrapper removed from kebab trigger: base-ui TooltipTrigger doesn't support asChild pattern; aria-label='Note options' covers accessibility. Tooltip can be added when API is confirmed."
  - "plant-detail.tsx promoted to use client: necessary because Timeline (client component) is rendered directly inside PlantDetail."
  - "DropdownMenu and Tooltip UI components added: required by timeline-entry.tsx; built using @base-ui/react/menu and @base-ui/react/tooltip matching existing component patterns."

patterns-established:
  - "base-ui-wrapper: new UI components follow alert-dialog.tsx/dialog.tsx pattern using @base-ui/react primitives with render prop for polymorphic rendering"
  - "timeline-refetch-on-mutate: handleRefetch calls loadMoreTimeline(plantId, 0) to reload from start after note add/edit/delete"

requirements-completed:
  - NOTE-01
  - NOTE-02
  - NOTE-03

duration: 15min
completed: 2026-04-15
---

# Phase 05 Plan 02: Unified Timeline UI Summary

**Timeline component suite replacing separate Watering history + Notes cards with a single interleaved chronological view, inline note add/edit/delete with kebab menu, and Load more pagination**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-15T03:28:00Z
- **Completed:** 2026-04-15T03:43:05Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Unified Timeline card on plant detail page: watering logs (Droplets icon) and notes (Pencil icon) interleaved in reverse chronological order
- NoteInput component: inline text input with Enter key shortcut and Add button, calls createNote Server Action
- TimelineEntry: polymorphic rendering for watering vs note entries; notes have kebab menu with inline Edit (textarea with Save/Discard) and Delete (AlertDialog confirmation)
- Timeline: load more pagination via loadMoreTimeline Server Action (20 entries at a time), empty state illustration
- DropdownMenu and Tooltip UI components added using @base-ui/react primitives

## Task Commits

1. **Task 1: Timeline component suite** - `1a37990` (feat)
2. **Task 2: Wire timeline into plant detail page** - `d26af41` (feat)

## Files Created/Modified

- `src/components/timeline/note-input.tsx` - Inline note add form
- `src/components/timeline/timeline-entry.tsx` - Polymorphic entry with note kebab menu
- `src/components/timeline/timeline.tsx` - Entry list with load more and empty state
- `src/components/ui/dropdown-menu.tsx` - DropdownMenu built on @base-ui/react/menu
- `src/components/ui/tooltip.tsx` - Tooltip built on @base-ui/react/tooltip
- `src/components/plants/plant-detail.tsx` - Refactored to use Timeline card, promoted to use client
- `src/app/(main)/plants/[id]/page.tsx` - Fetches getTimeline instead of getWateringHistory
- `src/features/notes/actions.ts` - Added loadMoreTimeline Server Action

## Decisions Made

1. **Watering entry kebab omitted** — `LogWateringDialog` and `deleteWateringLog` don't exist (Phase 4 watering feature not yet built). Watering timeline entries render display-only with date and relative time. This is correct for current phase scope.

2. **Tooltip wrapper skipped on kebab trigger** — base-ui's `TooltipTrigger` uses `render` prop composition not `asChild`. Nesting it with `DropdownMenuTrigger` requires careful composition; `aria-label="Note options"` already provides full accessibility. Deferred until tooltip API usage is validated.

3. **plant-detail.tsx promoted to "use client"** — Timeline is a client component that manages state (entry list, load more). PlantDetail renders Timeline directly, requiring client boundary promotion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created DropdownMenu and Tooltip UI components**
- **Found during:** Task 1 (Timeline component suite)
- **Issue:** Plan referenced shadcn DropdownMenu and Tooltip components that didn't exist in the codebase. Project uses @base-ui/react, not @radix-ui.
- **Fix:** Created `src/components/ui/dropdown-menu.tsx` and `src/components/ui/tooltip.tsx` following the same @base-ui/react wrapper pattern as existing `alert-dialog.tsx` and `dialog.tsx`.
- **Files modified:** src/components/ui/dropdown-menu.tsx, src/components/ui/tooltip.tsx
- **Verification:** TypeScript check passes with no new errors in timeline files.
- **Committed in:** `1a37990` (Task 1 commit)

**2. [Rule 1 - Bug] Watering entry kebab omitted (LogWateringDialog/deleteWateringLog missing)**
- **Found during:** Task 1 (TimelineEntry watering branch)
- **Issue:** Plan's watering kebab requires `LogWateringDialog` and `deleteWateringLog` from a watering feature that doesn't exist yet (Phase 4 not complete). Adding placeholder imports would cause build failures.
- **Fix:** Rendered watering entries display-only (date + relative time + optional note). No kebab menu for watering entries. This matches the current codebase state.
- **Files modified:** src/components/timeline/timeline-entry.tsx
- **Verification:** No TypeScript errors; acceptance criteria only requires note kebab menu.
- **Committed in:** `1a37990` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug/missing dependency)
**Impact on plan:** Both fixes necessary for correctness given current codebase state. No scope creep. Watering kebab can be wired when Phase 4 delivers LogWateringDialog.

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None — Timeline renders real data from getTimeline query. NoteInput calls real createNote Server Action. All data paths are wired.

## Threat Surface Scan

No new trust boundaries introduced. Note content is rendered as `{noteData.content}` in JSX text nodes (React escapes by default, per T-05-04 mitigation). The DropdownMenu and AlertDialog components don't expose new network endpoints.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Timeline card is ready on the plant detail page
- NoteInput, TimelineEntry, Timeline components available for reuse
- Phase 4 (watering feature) can wire LogWateringDialog into TimelineEntry's watering kebab when available
- Phase 05-03 (search and filters) can proceed independently

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk. Both task commits (1a37990, d26af41) confirmed in git history.

---
*Phase: 05-notes-search-and-filters*
*Completed: 2026-04-15*
