# Roadmap: Plant Minder

## Overview

Plant Minder is built in seven phases that mirror its natural dependency graph. The scaffold phase lays foundations that are impossible to retrofit cleanly. Authentication gives users an identity. The plant collection and room organization phase gives those users something to manage. The dashboard and watering core loop phase delivers the product's central value: seeing what needs care and logging it in one tap. Notes and search extend the collection. Reminders and demo mode add retention and discoverability. A final polish and accessibility phase ensures the product is calm, usable, and inclusive by default.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scaffold and Foundations** - Project scaffolding, database schema, auth config, and never-retrofit decisions
- [ ] **Phase 2: Authentication and Onboarding** - Users can create accounts, log in, and complete minimal onboarding
- [ ] **Phase 3: Plant Collection and Rooms** - Users can manage a plant collection, use catalog presets, and organize by room
- [ ] **Phase 4: Dashboard and Watering Core Loop** - Users can see which plants need care today and log watering in one tap
- [ ] **Phase 5: Notes, Search, and Filters** - Users can annotate plants and find any plant quickly
- [ ] **Phase 6: Reminders and Demo Mode** - Users get in-app reminders; visitors can explore without signing up
- [ ] **Phase 7: Polish and Accessibility** - App is responsive, accessible, and edge-case hardened

## Phase Details

### Phase 1: Scaffold and Foundations
**Goal**: A working Next.js 16 project exists with the correct foundational decisions baked in — schema, singleton, auth config, middleware, and test harness — so nothing needs to be retrofitted
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure phase — enables all subsequent requirements)
**Success Criteria** (what must be TRUE):
  1. The app runs locally with `npm run dev` and passes a smoke test request with no errors
  2. The Prisma schema is applied to a local PostgreSQL database and uses `TIMESTAMPTZ` for all timestamp columns
  3. The `lib/db.ts` Prisma singleton exists and prevents connection pool exhaustion in dev and serverless environments
  4. NextAuth v5 is configured with the credentials provider and JWT session strategy; `proxy.ts` middleware rejects unauthenticated requests to protected routes
  5. Vitest and Playwright are configured and a single passing test exists for each
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js 16, Prisma schema (7 entities, TIMESTAMPTZ), db singleton, design tokens, directory structure
- [x] 01-02-PLAN.md — NextAuth v5 split config (auth.config.ts + auth.ts), proxy.ts route protection, API route handler
- [x] 01-03-PLAN.md — Test harness (Vitest + Playwright), shadcn/ui initialization with 7 base components, Prisma schema push to PostgreSQL

### Phase 2: Authentication and Onboarding
**Goal**: Users can create accounts, log in securely, and complete minimal onboarding before reaching their dashboard
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can register with email and password and is redirected to onboarding
  2. User can log in and their session persists across full browser refresh without re-authenticating
  3. User can log out from any page and is redirected to the public login page
  4. After first login, user is prompted for plant count and reminder preference before reaching the dashboard
  5. Unauthenticated users visiting protected routes are redirected to the login page
**Plans:** 4 plans

Plans:
- [x] 02-00-PLAN.md — Wave 0: Test stubs and fixtures for all Phase 2 behaviors (Nyquist compliance)
- [x] 02-01-PLAN.md — Auth infrastructure: Prisma onboarding fields, Zod schemas, session callbacks, Server Actions, shadcn form+sonner, schema push
- [x] 02-02-PLAN.md — Auth UI: Login form and register form with RHF+Zod validation, inline errors, toast notifications, cross-links
- [x] 02-03-PLAN.md — Dashboard shell: Root redirect, authenticated nav with logout, onboarding banner, dashboard page with empty state

### Phase 3: Plant Collection and Rooms
**Goal**: Users can build and manage a personal plant collection, select from a seeded catalog, and organize plants by room
**Depends on**: Phase 2
**Requirements**: PLNT-01, PLNT-02, PLNT-03, PLNT-04, PLNT-05, PLNT-06, PLNT-07, PLNT-08, ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05
**Success Criteria** (what must be TRUE):
  1. User can add a plant by selecting from the catalog (auto-filling species and suggested interval) or entering custom details, and it appears in their collection
  2. User can edit any plant's details after creation and the changes are reflected immediately
  3. User can archive a plant and it disappears from the active collection and dashboard; user can permanently delete a plant after a confirmation dialog
  4. User can view a plant's detail page showing species, care info, status, next watering date, history, and notes
  5. User can create rooms with custom names (or select from presets), assign plants to rooms, filter the collection by room, and view a room summary page
**Plans:** 6 plans
**UI hint**: yes

Plans:
- [x] 03-00-PLAN.md — Wave 0: shadcn component installs (Dialog, AlertDialog, Select), Zod schemas, shared types, test stubs
- [x] 03-01-PLAN.md — Catalog data (40 houseplants), seed script, schema onDelete fix, database push + seed
- [x] 03-02-PLAN.md — Plant and room Server Actions (CRUD) and query functions
- [x] 03-03-PLAN.md — Plants collection page, plant card/grid components, two-step add-plant dialog
- [x] 03-04-PLAN.md — Plant detail page, edit dialog, archive/delete actions, nav + dashboard updates
- [x] 03-05-PLAN.md — Room management page, room detail page, room filter pill bar

### Phase 4: Dashboard and Watering Core Loop
**Goal**: Users can see at a glance which plants need watering today and log it in one tap — the core value of the product
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, WATR-01, WATR-02, WATR-03, WATR-04, WATR-05, WATR-06, WATR-07, UIAX-05
**Success Criteria** (what must be TRUE):
  1. Dashboard loads with plants grouped into Overdue, Due Today, Upcoming (next 7 days), and Recently Watered sections sorted by urgency
  2. User can mark a plant as watered in one tap from the dashboard; the UI updates immediately with optimistic feedback and the plant moves to the correct section
  3. Next watering date recalculates automatically after logging (last watered + interval days) and is correct relative to the user's local timezone
  4. User can view a chronological watering history for each plant and can log a retroactive watering date
  5. User can edit or delete a mistaken watering log; duplicate logs within a short window are prevented
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [ ] 04-01-PLAN.md — Watering data layer: Zod schemas, urgency classification query, Server Actions (log/edit/delete), types, tests, shadcn installs
- [ ] 04-02-PLAN.md — Dashboard UI: urgency sections, responsive card grid, optimistic water button, timezone sync, loading skeletons
- [ ] 04-03-PLAN.md — Plant detail watering: history list with pagination, log/edit/delete dialogs, date picker, kebab menus

### Phase 5: Notes, Search, and Filters
**Goal**: Users can annotate individual plants with timestamped notes and quickly find any plant in their collection
**Depends on**: Phase 3
**Requirements**: NOTE-01, NOTE-02, NOTE-03, SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. User can add a timestamped text note to any plant and view it in the plant detail history timeline alongside watering events
  2. User can edit or delete their own notes
  3. User can search plants by nickname or species name and see results immediately
  4. User can filter plants by room, watering status (overdue, due today, upcoming), and archived state, and can sort by next watering date, name, or recently added
**Plans**: TBD
**UI hint**: yes

### Phase 6: Reminders and Demo Mode
**Goal**: Signed-in users receive in-app reminders for plants needing attention; unauthenticated visitors can explore the full app experience with sample data
**Depends on**: Phase 4
**Requirements**: RMDR-01, RMDR-02, RMDR-03, RMDR-04, RMDR-05, DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. User sees a notification center in the nav with a badge count showing how many plants need attention; clicking it lists those plants
  2. User can enable or disable reminders globally and configure per-plant reminder preferences and frequency
  3. User can snooze a reminder by 1 day, 2 days, or a custom duration
  4. A visitor can navigate to the app and immediately explore with pre-loaded sample plants without creating an account; all write actions are blocked for the demo session
  5. During onboarding, a new user can optionally seed their collection with common starter plants
**Plans**: TBD
**UI hint**: yes

### Phase 7: Polish and Accessibility
**Goal**: The app is responsive and touch-friendly on mobile, meets WCAG AA accessibility standards, and handles all known edge cases gracefully
**Depends on**: Phase 6
**Requirements**: UIAX-01, UIAX-02, UIAX-03, UIAX-04
**Success Criteria** (what must be TRUE):
  1. App is fully usable on mobile (touch targets, layouts) and desktop without layout breakage or feature gaps
  2. App passes WCAG AA contrast checks and full keyboard navigation is possible throughout; all forms have proper labels and status is conveyed beyond color alone
  3. Screen reader users can navigate all major flows without encountering unlabeled interactive elements
  4. Empty states (no plants, no history, no rooms, no search results) show helpful guidance rather than blank screens
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold and Foundations | 0/3 | Planning complete | - |
| 2. Authentication and Onboarding | 0/4 | Planning complete | - |
| 3. Plant Collection and Rooms | 0/6 | Planning complete | - |
| 4. Dashboard and Watering Core Loop | 0/3 | Planning complete | - |
| 5. Notes, Search, and Filters | 0/? | Not started | - |
| 6. Reminders and Demo Mode | 0/? | Not started | - |
| 7. Polish and Accessibility | 0/? | Not started | - |
