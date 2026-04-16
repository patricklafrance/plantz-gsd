---
phase: 03-plant-collection-and-rooms
plan: "04"
subsystem: plant-detail-and-navigation
tags: [plant-detail, edit, archive, delete, navigation, dashboard]
dependency_graph:
  requires:
    - "03-03: PlantCard, PlantGrid, AddPlantDialog, plants page"
    - "03-02: Server Actions (updatePlant, archivePlant, unarchivePlant, deletePlant), queries (getPlant)"
    - "03-00: shadcn components (Dialog, AlertDialog, Card, Badge, Form, Select)"
  provides:
    - "Plant detail page at /plants/[id]"
    - "Edit plant modal (EditPlantDialog)"
    - "Archive with undo toast (PlantActions)"
    - "Delete with confirmation AlertDialog (PlantActions)"
    - "Nav links: Plants and Rooms"
    - "Dashboard Add plant button and empty state CTA"
  affects:
    - "src/app/(main)/layout.tsx"
    - "src/app/(main)/dashboard/page.tsx"
tech_stack:
  added: []
  patterns:
    - "Next.js 16 async params pattern (params: Promise<{id}>, await params)"
    - "Server Component data fetch with Promise.all for parallel queries"
    - "AlertDialog controlled open state for delete confirmation"
    - "Sonner toast with action button for archive undo"
key_files:
  created:
    - src/app/(main)/plants/[id]/page.tsx
    - src/components/plants/plant-detail.tsx
    - src/components/plants/edit-plant-dialog.tsx
    - src/components/plants/plant-actions.tsx
  modified:
    - src/app/(main)/layout.tsx
    - src/app/(main)/dashboard/page.tsx
decisions:
  - "Used controlled AlertDialog open state (useState) for delete confirmation so we can run async deletePlant before navigating away"
  - "Watering status logic: <0 days = overdue, 0 days = due-today, >0 days = upcoming, null = not-scheduled"
  - "Light requirement icons: Sun=bright, CloudSun=medium, Cloud=low using lucide-react"
  - "Nav layout: logo | Plants | Rooms spacer | [complete setup] email logout — separates primary nav from user controls"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 3 Plan 4: Plant Detail Page, Edit/Archive/Delete Actions, Nav and Dashboard Updates Summary

**One-liner:** Plant detail page with four card sections (Status, Care info, History, Notes), pre-filled edit modal, instant archive with Sonner undo toast, AlertDialog delete confirmation, plus Plants/Rooms nav links and dashboard Add plant button.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Plant detail page, edit dialog, and action buttons | 03c86e4 | plants/[id]/page.tsx, plant-detail.tsx, edit-plant-dialog.tsx, plant-actions.tsx |
| 2 | Update nav with Plants/Rooms links and dashboard with Add plant button | 995c82c | layout.tsx, dashboard/page.tsx |

## What Was Built

### Plant Detail Page (`src/app/(main)/plants/[id]/page.tsx`)
Server Component that awaits async params (Next.js 16 pattern), checks auth, fetches plant and rooms in parallel via Promise.all, calls notFound() if plant doesn't belong to the user, and renders PlantDetail + EditPlantDialog + PlantActions.

### PlantDetail Component (`src/components/plants/plant-detail.tsx`)
Four Card sections:
- **Status card**: Computes watering status (overdue/due-today/upcoming/not-scheduled) using differenceInDays from date-fns. Shows destructive Badge for overdue, default Badge for due-today, date + days countdown for upcoming.
- **Care info card**: Species, watering interval, light requirement (Sun/CloudSun/Cloud icon + label), room assignment.
- **History card**: Intentional stub — "No waterings logged yet. Watering history will appear here." (watering log feature is Phase 4+).
- **Notes section**: Intentional stub — "No notes yet. Notes will be available in a future update."

### EditPlantDialog (`src/components/plants/edit-plant-dialog.tsx`)
Client component with controlled Dialog open state. Pre-fills form from plant props using react-hook-form + zodResolver + editPlantSchema. Room dropdown includes "No room" option (empty string) to clear room assignment. Calls updatePlant Server Action on submit, shows "Changes saved." toast on success.

### PlantActions (`src/components/plants/plant-actions.tsx`)
Client component with two action buttons:
- Archive: Calls archivePlant, navigates to /plants, shows Sonner toast with Undo action that calls unarchivePlant.
- Delete: Uses controlled AlertDialog with "Delete plant?" title, interpolated plant nickname in description, AlertDialogAction (destructive variant) calls deletePlant then navigates to /plants.

### Layout Nav Update (`src/app/(main)/layout.tsx`)
Added Plants and Rooms nav links between the logo and the user controls section. Links use `text-sm font-medium text-muted-foreground hover:text-foreground` styling.

### Dashboard Update (`src/app/(main)/dashboard/page.tsx`)
Added getCatalog and getRoomsForSelect data fetches via Promise.all alongside the existing user query. Added Dashboard heading + AddPlantDialog in a flex header row. Added second AddPlantDialog as empty state CTA below the "No plants yet" copy.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| "No waterings logged yet. Watering history will appear here." | src/components/plants/plant-detail.tsx | ~143 | WateringLog model and log action are Phase 4 scope; history card is intentionally empty per plan |
| "No notes yet. Notes will be available in a future update." | src/components/plants/plant-detail.tsx | ~156 | HealthLog/notes feature is future scope; notes section is intentionally stubbed per plan |

Both stubs are documented in the plan's `must_haves.truths` as acceptable empty states. They do not prevent the plan's goal (plant detail page with card sections) from being achieved.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers. All trust boundaries (URL param to Server Component, client to Server Actions) are handled per the threat register:
- T-03-04-01: getPlant queries with both plantId AND userId (ownership check before data reveal)
- T-03-04-02: editPlantSchema validates input; updatePlant verifies ownership
- T-03-04-03: archivePlant/deletePlant verify ownership via findFirst with userId
- T-03-04-04: AlertDialog requires explicit confirmation before destructive delete

## Self-Check: PASSED

Files exist:
- FOUND: src/app/(main)/plants/[id]/page.tsx
- FOUND: src/components/plants/plant-detail.tsx
- FOUND: src/components/plants/edit-plant-dialog.tsx
- FOUND: src/components/plants/plant-actions.tsx
- FOUND: src/app/(main)/layout.tsx (modified)
- FOUND: src/app/(main)/dashboard/page.tsx (modified)

Commits exist:
- FOUND: 03c86e4
- FOUND: 995c82c
