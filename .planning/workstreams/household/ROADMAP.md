# Roadmap: Plant Minder — Milestone `household`

**Milestone:** Household and Rotation
**Workstream:** `household`
**Started:** 2026-04-16
**Requirements:** 35 across 8 categories

## Overview

This milestone retrofits the v1.0 single-user app into a multi-household, rotation-based plant care system. Every authenticated route moves under a URL-scoped `/h/[householdSlug]/` prefix. The build order is strict: the schema migration gates everything; the query/action update and rotation engine can parallelize after it; notifications require both those layers; the settings UI assembles all previous phases; demo compatibility seeds the final schema shape last.

## Phases

**Phase Numbering:**
- Integer phases (1–7): Planned milestone work, workstream-local numbering
- Decimal phases: Urgent insertions via `/gsd-insert-phase`

- [ ] **Phase 1: Schema Foundation + Data Migration** - New Prisma models, three-step backfill migration, JWT extension, and security helpers
- [ ] **Phase 2: Query + Action Layer Update** - Migrate all v1 queries/actions from `userId` to `householdId` ownership; household create/list
- [ ] **Phase 3: Rotation Engine + Availability** - Deterministic cycle engine, cron endpoint, availability periods, and skip logic
- [ ] **Phase 4: Invitation System** - CSPRNG join-link tokens, accept flow (logged-in + logged-out), revocation
- [ ] **Phase 5: Household Notifications** - Assignee-scoped reminder queries, cycle-start and reassignment banners
- [ ] **Phase 6: Settings UI + Switcher + Dashboard** - Household switcher, settings page, rotation reorder, availability form, cycle banner
- [ ] **Phase 7: Demo Mode Compatibility** - Seed demo household with members, cycle, and availability; read-only guard coverage

## Phase Details

### Phase 1: Schema Foundation + Data Migration
**Goal**: The database has all household models with valid data; every existing plant is reparented to its owner's auto-created solo household; JWT carries `activeHouseholdId`; household context helpers exist
**Depends on**: Nothing (first phase)
**Requirements**: HSLD-01, HSLD-04, HSLD-05, HSLD-06, AUDT-01, AUDT-02
**Success Criteria** (what must be TRUE):
  1. Every existing v1 plant is associated with exactly one household row — zero plants have a null `householdId` after migration
  2. A new user who signs up gets a solo household auto-created and is its owner
  3. `session.user.activeHouseholdId` resolves to a valid household for every authenticated user
  4. Plant and watering-log timeline entries carry `createdByUserId` / `performedByUserId` so authorship is recorded from this phase forward
  5. `requireHouseholdAccess()` guard exists and throws `Forbidden` when the user is not a member of the given household
**Plans**: 4 plans
  - [x] 01-01-PLAN.md — Slug utility + Wave 0 test scaffold + REQUIREMENTS.md HSLD-04 traceability
  - [x] 01-02-PLAN.md — Prisma schema (5 new models, reparented Plant/Room, indexes, cascades) + migration + WateringLog functional unique SQL + [BLOCKING] schema push
  - [x] 01-03-PLAN.md — JWT/session activeHouseholdId extension + register-form timezone wiring + transactional registerUser (User + Household + HouseholdMember(OWNER))
  - [x] 01-04-PLAN.md — requireHouseholdAccess guard + ForbiddenError + resolveHouseholdBySlug + household Zod v4 enums
**Pitfall flags**:
  - Pitfall 4: Three-step migration order (nullable add → backfill SQL → NOT NULL) is mandatory; single-step fails on existing rows
  - Pitfall 2: Change `Plant → User` and `Room → User` cascade to `SetNull` before migration runs; `onDelete: Cascade` would wipe household plants on user delete
  - Pitfall 1: Enumerate every query file touching Plant/Room/WateringLog/Note/Reminder before shipping; sign off that each has `householdId` in `where` clause
  - Pitfall 3: Add `@@index([householdId, archivedAt])` on Plant, `@@index([householdId, status])` on Cycle, `@@index([householdId])` on Room
  - Pitfall 15: Add DB-level unique index on `(plantId, date_trunc('day', wateredAt))` for WateringLog during this migration
  - Pitfall 17: URL-scoped household routing decision is implemented in this phase — slug on Household model, `/h/[householdSlug]/` routing prefix established

### Phase 2: Query + Action Layer Update
**Goal**: All application code reads and writes household-scoped data; users can create additional households and see all households they belong to; the codebase has zero remaining `plant.userId` ownership checks
**Depends on**: Phase 1
**Requirements**: HSLD-02, HSLD-03
**Success Criteria** (what must be TRUE):
  1. Dashboard, plants list, rooms, watering history, notes, and reminders all display only data belonging to the current household — a user in two households never sees data from the wrong one
  2. Owner can create a new household from settings (becomes owner; household appears in their membership list)
  3. User can view a list of all households they belong to with their role shown for each
  4. All Server Actions enforce live household membership check (`requireHouseholdAccess`) — stale JWT cannot access a household the user was removed from
**Plans**: 13 plans (revised 2026-04-16 after checker feedback — 02-03 split into 03a/03b/03c; 02-05 split into 05a/05b; 02-07 added for D-18 real-Prisma integration tests; 02-08/09/10 added 2026-04-17 as gap-closure plans for UAT-4/9/2+10)
  - [x] 02-01-PLAN.md — HouseholdMember.isDefault migration + getCurrentHousehold cached helper + WR-01 JWT normalization + Wave 0 test scaffolds
  - [x] 02-02-PLAN.md — createHousehold + getUserHouseholds + registerUser isDefault=true (HSLD-02/03 data layer — mocked Prisma unit tests)
  - [x] 02-04-PLAN.md — Query-layer migration across plants/rooms/watering/notes/reminders + D-16 isolation tests
  - [x] 02-05a-PLAN.md — Action-layer migration for plants + rooms (D-12 7-step; archive/unarchive/delete flip to data-blob signature); dialog + action-button components thread householdId
  - [x] 02-05b-PLAN.md — Action-layer migration for watering/notes/reminders/demo (nested plant.householdId + AUDT-01 audit columns + D-13 Reminder compound-key preserved); 9 client components thread householdId; updateNote + loadMoreWateringHistory + loadMoreTimeline included
  - [x] 02-07-PLAN.md — Real-Prisma integration tests for createHousehold + getUserHouseholds (D-18 — CONTEXT authoritative)
  - [x] 02-03a-PLAN.md — New /h/[householdSlug]/ route tree (layout chokepoint + error/not-found boundaries + moved pages with household-scoped queries)
  - [x] 02-03b-PLAN.md — Legacy redirect stubs (/dashboard, /plants, etc. → /h/[slug]/...); auth.config.ts post-login landing unchanged
  - [x] 02-03c-PLAN.md — Chrome relocation (Q11 Option A) — move header/NotificationBell/BottomTabBar into inner layout with householdSlug prop threading; slim outer (main)/layout.tsx
  - [x] 02-06-PLAN.md — ForbiddenError authz tests (D-17) for 17 mutating actions; full phase build gate
  - [ ] 02-08-PLAN.md — Gap closure UAT-4: thread householdSlug through PlantCard/DashboardPlantCard so plant links target /h/{slug}/plants/{id} directly
  - [ ] 02-09-PLAN.md — Gap closure UAT-9: diagnose + fix blank page on /h/{bogus}/dashboard so not-found.tsx content renders
  - [ ] 02-10-PLAN.md — Gap closure UAT-2 + UAT-10: diagnose fresh-JWT cold-start + seed-starter-plants silent failure; thread householdId from onboarding banner; surface seed errors; CR-01 guard preserved
**Pitfall flags**:
  - Pitfall 1: Audit checklist — plants/queries.ts, watering/queries.ts, notes/queries.ts, rooms/queries.ts, reminders/queries.ts all updated; integration test asserts cross-household reads return empty/404
  - Pitfall 16: Every Server Action uses live `householdMember.findFirst` check, not JWT alone
  - Pitfall 13: `getReminderCount` and `getReminderItems` updated to use `householdId`; assignee gate is wired in Phase 5 — coordinate interface now so Phase 5 only adds the Cycle join

### Phase 3: Rotation Engine + Availability
**Goal**: The household has a deterministic, timezone-aware, race-safe cycle engine; members can declare unavailability; manual and automatic skipping work; the cron endpoint advances cycles for all households
**Depends on**: Phase 1
**Requirements**: ROTA-02, ROTA-03, ROTA-04, ROTA-05, ROTA-06, ROTA-07, AVLB-01, AVLB-02, AVLB-03, AVLB-04, AVLB-05
**Success Criteria** (what must be TRUE):
  1. At any moment, exactly one member is the active cycle assignee per household — computed via `floor(daysSinceAnchor / cycleDuration) % memberCount`
  2. `/api/cron/advance-cycles` advances all expired cycles in one call, is idempotent, and rejects requests without the correct `CRON_SECRET` bearer header
  3. A member can set an unavailability period (date range with optional reason) and see it listed; when their turn arrives during that window the cycle auto-skips to the next available member
  4. The active assignee can manually skip their current cycle; responsibility immediately moves to the next available member
  5. When all members are unavailable, the household falls back to the owner as assignee and a fallback banner is surfaced
**Plans**: 5 plans
**Pitfall flags**:
  - Pitfall 5 + 6: All cycle date arithmetic uses `@date-fns/tz` TZDate; `endDate` is computed in household timezone before storing as UTC; DST-boundary unit test (March NY transition) is an acceptance gate
  - Pitfall 7: Every cycle transition (auto, skip, member-leave) goes through one function wrapped in `db.$transaction` with `SELECT ... FOR UPDATE SKIP LOCKED`
  - Pitfall 8: `findNextAssignee` returns `Member | null`; null path creates `status: 'paused'` cycle with owner fallback as per AVLB-05
  - Pitfall 9: Member-leave during active cycle immediately runs cycle transition with `reason: 'member_left'` audit flag
  - Pitfall 11: Overlapping availability periods — validate at creation; "is member unavailable" query uses `startDate <= X AND endDate >= X` range check
  - Pitfall 12: Availability `startDate` must be >= today; reject past start dates at the Server Action level
  - ROTA-04 uses external cron (cron-job.org) hitting `/api/cron/advance-cycles`; Vercel Cron is NOT used

Plans:
- [x] 03-01-PLAN.md — Wave 0: test stubs (14 files) + @date-fns/tz install + CRON_SECRET env + HOUSEHOLD_PATHS.settings
- [x] 03-02-PLAN.md — Prisma schema + [BLOCKING] migration (Cycle.transitionReason + HouseholdNotification model + back-relations) + proxy.ts matcher update
- [x] 03-03-PLAN.md — Cycle engine (constants.ts, availability.ts, cycle.ts with FOR UPDATE SKIP LOCKED transitionCycle) + 7 engine test files green
- [x] 03-04-PLAN.md — Cycle #1 bootstrap (registerUser + createHousehold) + Server Actions (skipCurrentCycle, createAvailability, deleteAvailability) + queries (getCurrentCycle, getHouseholdAvailabilities) + 4 test files green
- [x] 03-05-PLAN.md — Cron orchestrator (advanceAllHouseholds) + POST /api/cron/advance-cycles route handler + paused-resume + cron-route tests green

### Phase 4: Invitation System
**Goal**: Owners can generate and revoke shareable join-link tokens; recipients can join via the link regardless of login state; member removal and ownership transfer work
**Depends on**: Phase 1
**Requirements**: INVT-01, INVT-02, INVT-03, INVT-04, INVT-05, INVT-06
**Success Criteria** (what must be TRUE):
  1. Owner can generate an invitation link — the link works for anyone who has it, has no expiry, and can be revoked (revocation immediately invalidates the link)
  2. A logged-out user who opens an invitation link is routed to login/signup; the token survives the authentication redirect and the join-confirm page appears after login
  3. A logged-in user who opens an invitation link sees a confirm screen showing household name, owner, and member count before they choose to accept
  4. User can leave any household; if they are the sole owner and last member the household and its plants are deleted after a destructive-action confirmation
  5. Owner can remove any non-owner member; owner can transfer ownership to another member
**Plans**: 6 plans
  - [x] 04-01-PLAN.md — Wave 0 scaffolding: crypto helper + Zod schemas + unstable_update export + 14 test stubs + phase-04 fixtures
  - [x] 04-02-PLAN.md — Read helpers (resolveInvitationByToken, getHouseholdInvitations, getHouseholdMembers) + mocked-Prisma unit tests
  - [x] 04-03-PLAN.md — Invitation write Server Actions (createInvitation, revokeInvitation, acceptInvitation with atomic updateMany + unstable_update) + unit tests
  - [x] 04-04-PLAN.md — Membership mutation actions (leaveHousehold, removeMember, promoteToOwner, demoteToMember) with last-OWNER guards + unit tests
  - [x] 04-05-PLAN.md — Auth carve-out (auth.config.ts + proxy.ts) + public /join/[token] page + AcceptForm + DestructiveLeaveDialog
  - [x] 04-06-PLAN.md — Real-DB integration tests (D-23 concurrency, D-14 cascade, D-27 assignee-transition, D-26 JWT refresh)
**Pitfall flags**:
  - Pitfall 10: Token generated with `crypto.randomBytes(32).toString('hex')` only; acceptance is atomic `UPDATE WHERE acceptedAt IS NULL` with row-count check; no expiry per user decision
  - Pitfall 9: `acceptInvitation` appends new member to end of rotation; does not reset current cycle pointer
  - Pitfall 16: Leave/remove-member action calls `unstable_update` to force JWT reissue on next request
  - `/join/[token]` must be in `publicPaths` (auth.config.ts) and excluded from proxy.ts matcher

### Phase 5: Household Notifications
**Goal**: Only the current cycle assignee sees daily reminder badges; cycle-start and reassignment banners are delivered to the right recipient; the existing notification bell works correctly on both mobile and desktop
**Depends on**: Phase 2, Phase 3
**Requirements**: HNTF-01, HNTF-02, HNTF-03, HNTF-04
**Success Criteria** (what must be TRUE):
  1. Non-assignee members see reminder badge count of 0 for household plant reminders; only the current assignee sees overdue/due counts
  2. When a new cycle starts, the new assignee receives a cycle-start banner notification on their dashboard showing due-plant count and cycle end date
  3. When responsibility changes mid-cycle (skip, auto-skip, membership change), the incoming assignee receives a reassignment notification; the previous assignee's banner clears on their next page load
  4. Non-assignees see a passive household status banner identifying the current responsible member and who is next
**Plans**: 5 plans
  - [x] 05-01-PLAN.md — Wave 0 scaffolding: Prisma migration (readAt + index) with [BLOCKING] push + CycleEventItem type + 9 phase-05 test scaffolds
  - [x] 05-02-PLAN.md — Server layer: assignee gate (D-07..D-10) + getUnreadCycleEventCount + getCycleNotificationsForViewer + markNotificationsRead Server Action (D-20, D-28, D-29)
  - [x] 05-03-PLAN.md — Four dashboard banner components (CycleStart, Reassignment, PassiveStatus, Fallback) per D-12 + component tests
  - [x] 05-04-PLAN.md — Unified NotificationBell with variant prop + useTransition mark-read + BottomTabBar inline-dropdown deletion (v1 tech-debt fix; D-17..D-22)
  - [ ] 05-05-PLAN.md — Layout + dashboard wiring (totalCount, banner region in D-13 order) + Chrome DevTools MCP human-verify checkpoint
**Pitfall flags**:
  - Pitfall 13: `getReminderCount` joins active Cycle and gates on `assignedUserId === session.user.id`; integration test verifies non-assignee gets count = 0
  - Pitfall 14: `HouseholdNotification` (cycle events) is a separate model from `Reminder` (daily per-plant preferences); they must not be merged
  - v1 tech debt: `NotificationBell` hidden on mobile and `BottomTabBar` Alerts linking to `/dashboard` must be fixed in this phase before new notification surfaces are added
  - Phase 3 carry-over (IN-01): `HouseholdNotification.@@unique([cycleId, recipientUserId, type])` relies on Postgres's default "NULLs are distinct in unique indexes" behavior. Phase 3 always writes non-null `cycleId`, but if Phase 5 introduces notification types with `cycleId: null`, switch the index to `NULLS NOT DISTINCT` (Postgres 15+) or add a partial `CREATE UNIQUE INDEX ... WHERE cycleId IS NULL` to prevent duplicate rows per (recipient, type).
**UI hint**: yes

### Phase 6: Settings UI + Switcher + Dashboard
**Goal**: Users can switch between households in the top nav; owners can manage household settings, member list, rotation order, and invite links from one page; the dashboard shows the cycle banner and assignee status
**Depends on**: Phase 2, Phase 3, Phase 4, Phase 5
**Requirements**: HSET-01, HSET-02, HSET-03, ROTA-01
**Success Criteria** (what must be TRUE):
  1. Authenticated routes are served under `/h/[householdSlug]/...`; the top-nav household switcher navigates between households while preserving the current route suffix
  2. User can mark any household as default — it becomes the post-login landing target
  3. Owner can edit household name, timezone, and cycle duration from the settings page; changes take effect at the next cycle boundary
  4. Owner can reorder the rotation member list using up/down controls; the new order is reflected in the rotation immediately
  5. Dashboard shows a cycle banner with current assignee identity, countdown to cycle end, and next-assignee preview
**Plans**: TBD
**Pitfall flags**:
  - Pitfall 17: URL routing is established in Phase 1; this phase implements the full client navigation — ensure all internal links use `/h/[slug]/` prefix, not absolute paths without slug
  - shadcn/ui components to verify before installing: `calendar`, `popover`, `command`, `sheet` — check `src/components/ui/` first
  - Availability form uses two Calendar + Popover pickers; do not use a third-party date-range picker
  - ROTA-01: HTML5 drag-and-drop or numbered arrows; no DnD library
**UI hint**: yes

### Phase 7: Demo Mode Compatibility
**Goal**: The demo user experience works correctly with household data; all household-mutating actions are blocked in demo mode using the existing read-only guard pattern
**Depends on**: Phase 6
**Requirements**: HDMO-01, HDMO-02
**Success Criteria** (what must be TRUE):
  1. Demo mode starts with a pre-seeded "Demo Household" containing sample members, an active cycle, and a sample availability period — all visible without authentication
  2. All household-mutating actions (invite, skip, reorder, settings changes, member removal) are silently blocked in demo mode; the existing read-only guard pattern is used without a new code path
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema Foundation + Data Migration | 4/4 | Complete | 2026-04-16 |
| 2. Query + Action Layer Update | 10/13 | In progress (08/09/10 gap-closure remaining) | - |
| 3. Rotation Engine + Availability | 4/5 | In progress (Waves 0-3 complete) | - |
| 4. Invitation System | 0/6 | Planned | - |
| 5. Household Notifications | 2/5 | In Progress|  |
| 6. Settings UI + Switcher + Dashboard | 0/TBD | Not started | - |
| 7. Demo Mode Compatibility | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-16 — milestone `household`*
