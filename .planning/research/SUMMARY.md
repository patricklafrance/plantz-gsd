# Project Research Summary

**Project:** Plant Minder — Household + Rotation Milestone
**Domain:** Multi-tenant collaborative plant care (household scoping, rotation engine, in-app notifications)
**Researched:** 2026-04-16
**Confidence:** HIGH

## Executive Summary

The household milestone is a focused multi-tenancy retrofit on a shipped v1.0 Next.js / Prisma codebase. The core challenge is not building new features in isolation — it is reparenting every existing data entity (Plant, Room, Reminder) from per-user ownership to per-household ownership without introducing data leaks, broken cascades, or stale session state. Research from direct codebase inspection, official documentation, and on-call scheduling tool patterns confirms that the milestone is well-scoped and all patterns are established; the risk is entirely in execution discipline, not in design uncertainty.

The recommended approach is a strict phase ordering anchored to schema-first delivery: nothing can be built until the additive Prisma migration creates the `Household`, `HouseholdMember`, `Cycle`, `Availability`, and `Invitation` tables and backfills every existing plant to its owner’s auto-created solo household. The rotation engine is a pure-function deterministic calculation (anchor-date math, request-time lazy evaluation) that needs no background scheduler for this milestone’s in-app-only scope. The invitation system uses a shareable CSPRNG token link — no email infrastructure. Active-household context travels in the JWT, but every Server Action must perform a live membership check because JWT tokens do not self-invalidate on membership changes.

The most dangerous pitfalls are all in the data model phase: wrong migration order (NOT NULL before backfill), missed `userId` filter in nested Prisma queries (cross-household data leak), and cascade misconfiguration (member removal deletes household plants). These must be treated as hard gates before any feature UI ships. The architectural question that requires a user decision before planning begins is the household routing model: session-scoped `activeHouseholdId` in JWT (simpler, breaks multi-tab and bookmarks) versus URL-scoped `/h/[slug]/` prefix (correct, but requires rewriting every route and link in the app).

## Key Findings

### Recommended Stack

The v1.0 stack is locked and sufficient. This milestone requires exactly two new npm packages and four shadcn/ui component installs. `@date-fns/tz@^1.3.0` is mandatory — it is the official date-fns team companion for DST-safe cycle boundary arithmetic; the third-party `date-fns-tz` (marnusw) does not support date-fns v4 and must not be used. `nanoid@^5.1.9` (or the built-in `crypto.randomUUID()`) handles invitation token generation with sufficient entropy and no predictability. No background job infrastructure (Inngest, BullMQ, Vercel Cron) is needed for this milestone because the rotation engine is deterministic and evaluates lazily at request time; email notifications that would require a scheduler are explicitly deferred.

**New packages:**
- `@date-fns/tz ^1.3.0`: DST-safe cycle date arithmetic — official date-fns v4 companion, mandatory for correct cycle boundaries
- `nanoid ^5.1.9`: Invitation token generation — or use `crypto.randomUUID()` (zero-dependency, equally correct)

**shadcn/ui components to verify/install:**
- `calendar` (`npx shadcn@latest add calendar`): availability date selection
- `sheet` (`npx shadcn@latest add sheet`): household settings panel
- `popover` (`npx shadcn@latest add popover`): calendar trigger
- `command` (`npx shadcn@latest add command`): combobox inner component

**What to explicitly avoid:**
- `date-fns-tz` (marnusw) — no date-fns v4 support
- `luxon` — 50 KB, redundant with existing date-fns ecosystem
- `react-beautiful-dnd` / `@dnd-kit/core` — HTML5 drag events sufficient for 2-8 member rotation reorder
- Inngest / BullMQ / Vercel Cron — not needed for in-app-only notification scope
- Prisma `$extends` auto-injection for tenant scoping — documented limitation with nested reads; manual `where: { householdId }` is safer

### Expected Features

All P1 features are table stakes with established industry precedents (Notion workspace switcher, PagerDuty/Opsgenie anchor-date rotation, WorkOS invite token flow). No feature requires research into unknown territory.

**Must have — launch blockers (P1):**
- Auto-create solo household on signup + migrate v1 plants to `householdId` — seamless v1 user upgrade path
- Shareable join-link with CSPRNG token, 7-day expiry, revocable — standard no-email invite pattern (Notion, Figma)
- Accept flow handles both logged-out and logged-in users, token threaded through auth redirect
- Sequential rotation with anchor-date deterministic math: `floor(daysSinceAnchor / duration) % memberCount`
- Exactly one active assignee at all times; dashboard banner scoped: "You are responsible" vs "Alice is responsible"
- Cycle countdown + next-assignee preview
- Manual skip (creates override Cycle record, notifies new assignee)
- Availability period (date range, single dialog, no recurring patterns in v1)
- Auto-skip when cycle hits unavailability block; all-unavailable fallback
- Assignee-scoped due/overdue notifications — non-assignees get zero reminder badge
- Cycle-start and reassignment banners to incoming assignee
- Audit trail: "Watered by Alice" in plant timeline

**Should have — differentiators (P2):**
- Reorder rotation members (drag/up-down)
- Next-cycle preview in dashboard
- Visual rotation order in settings (avatar chain A -> B -> C -> A)

**Defer to v1.x after validation:**
- QR code on invite page
- Rotation fairness counter (cycles per member)
- "Skip and back in 7 days" shortcut

**Defer to v2+:**
- Email notifications (Resend/SendGrid), per-user email preferences
- Observer role, per-room/per-plant assignment
- Recurring unavailability patterns, external calendar sync
- Push notifications, weighted rotation

### Architecture Approach

The milestone is built on a strict layered dependency graph. The data model phase is the foundation — every other phase depends on the new schema columns existing in the database. After schema, the query/action layer update (reparenting all v1 queries from `userId` to `householdId`) and the rotation engine (pure function in `src/features/cycles/engine.ts`) can proceed in parallel. Household notifications require both layers before they can know who the current assignee is. The invitation system requires only the schema. The settings UI requires all preceding phases. Demo mode compatibility is last because it seeds data and needs the final schema shape.

**Major components:**

1. **Schema migration + backfill** (`prisma/migrations/`) — additive three-step: nullable add -> data backfill (auto-create household per user, reparent plants) -> NOT NULL constraint. This is the riskiest single operation in the milestone.

2. **`getHouseholdContext()` helper** (`src/lib/`) — resolves `activeHouseholdId` from session; called at the top of every Server Action and query function. Every Prisma query includes explicit `where: { householdId }` — no auto-injection middleware.

3. **`requireHouseholdAccess()` guard** (`src/lib/`) — live DB membership check for every write operation. JWT is a hint for redirects; live check is the real security gate.

4. **Rotation engine** (`src/features/cycles/engine.ts`) — `maybeAdvanceCycle(householdId)` called at the start of every dashboard load. Pure function: `resolveAssignee(household, members, now)` uses `TZDate` from `@date-fns/tz`. All cycle transitions wrapped in `db.$transaction` with `SELECT FOR UPDATE SKIP LOCKED`. A Vercel Cron hourly safety-net catches households where no user loaded the app across a cycle boundary.

5. **Invitation state machine** (`src/features/household/actions.ts`) — `createInvitation` / `revokeInvitation` / `acceptInvitation`. Public route `/join/[token]` handles both logged-in confirm and logged-out redirect-through-auth flows. Token is `crypto.randomBytes(32).toString('hex')`. Acceptance is atomic: single `UPDATE WHERE acceptedAt IS NULL` with row-count check.

6. **`HouseholdNotification` model** (separate from `Reminder`) — stores cycle-start, reassignment, and skip-confirmed events per recipient user. The existing `Reminder` model remains for per-plant per-user preferences; cycle events must live in a separate table.

7. **Household switcher** (extends `src/components/auth/user-menu.tsx`) — top-nav dropdown that calls `update({ activeHouseholdId })` from the client and `router.refresh()`. No new page needed; `/settings/household` handles all household management.

### Critical Pitfalls

The following five pitfalls represent the highest execution risk. Full detail on all 17 pitfalls is in `.planning/research/PITFALLS.md`.

1. **Missed `userId` filter after reparenting** — After Plants move to `householdId`, `WateringLog`, `Note`, and `HealthLog` queries that enforce ownership through a nested `plant: { userId }` join will silently lose tenant scope. Any authenticated user could read another household’s plant history by guessing an ID. Prevention: enumerate every query file that touches Plant-related models before the data model phase ships, sign off each explicitly, and write an integration test asserting cross-household reads return empty/404.

2. **Cascade misconfiguration on User delete** — v1 has `onDelete: Cascade` on `Plant -> User` and `Room -> User`. After reparenting to Household, the old user FK kept as `createdByUserId` must be changed to `onDelete: SetNull`. If it stays `Cascade`, deleting any member deletes all household plants. Prevention: schema review gate — no `onDelete: Cascade` on User relations for household-scoped entities.

3. **Wrong migration order (NOT NULL before backfill)** — Adding `householdId String NOT NULL` in a single migration step will fail on existing rows or assign them to a phantom household. Prevention: three-step migration: nullable add -> backfill SQL -> NOT NULL constraint. Test: assert zero plants have null `householdId` after the backfill script.

4. **Race condition on cycle transition** — Two concurrent skip actions both read an `ACTIVE` cycle and both write a new cycle row. Result: two active cycles, two notification sets. Prevention: all cycle transition code paths go through one function wrapped in `db.$transaction` with `SELECT ... FOR UPDATE SKIP LOCKED`. Hard requirement before the skip feature is testable.

5. **JWT `activeHouseholdId` staleness** — A user removed from a household retains their JWT with the old `activeHouseholdId` for up to 30 days. Every Server Action must perform a live `householdMember.findFirst` check. The leave/remove-member action must call `unstable_update` to force JWT reissue.

## Implications for Roadmap

The architecture research produces a concrete seven-phase build order with strict dependencies.

### Phase 1: Schema Foundation + Data Migration

**Rationale:** Nothing else can start. Every downstream query, action, and UI component depends on `householdId` existing in the database with valid data. This is where the most irreversible decisions live (cascade behavior, index design, migration order).

**Delivers:** New Prisma models (`Household`, `HouseholdMember`, `Cycle`, `Availability`, `Invitation`); three-step migration with backfill; `activeHouseholdId` in JWT + NextAuth callbacks; TypeScript module augmentation; `getHouseholdContext()` and `requireHouseholdAccess()` helpers. Also: DB-level `WateringLog` duplicate constraint; composite indexes `@@index([householdId, archivedAt])` on Plant and `@@index([householdId, status])` on Cycle.

**Addresses:** Auto-create solo household on signup; v1 plant reparenting.

**Avoids:** Pitfalls 1, 2, 3, 4 — highest-recovery-cost failures.

**Research flag:** Requires architectural decision on URL-scoped vs session-scoped routing before this phase starts.

### Phase 2: Query + Action Layer Update

**Rationale:** All v1 query files filter by `userId`. After Phase 1, the schema has `householdId` but all application code is still routing through `userId`. This phase aligns the code with the schema. Can run in parallel with Phase 3.

**Delivers:** Updated queries and Server Actions in `plants/`, `rooms/`, `watering/`, `notes/`, `reminders/` — all ownership checks migrated from `userId` to `householdId` membership check. Demo mode updated to create a demo household.

**Avoids:** Pitfall 1 (missed filter), Pitfall 13 (old user-scoped reminders fire to all members).

**Key constraint:** `getReminderCount` and `getReminderItems` need the rotation engine’s `currentAssigneeId`. Coordinate with Phase 3 on the cycle query interface.

### Phase 3: Rotation Engine

**Rationale:** Pure-function core that feeds the dashboard, notifications, and availability logic. No UI dependency — can be written and fully tested before any screen is built. Runs in parallel with Phase 2.

**Delivers:** `src/features/cycles/engine.ts` with `maybeAdvanceCycle`, `resolveAssignee` (availability-aware, explicit null for all-unavailable), `advanceCycle` (transactional `SELECT FOR UPDATE SKIP LOCKED`); cycle queries and skip action; Vercel Cron hourly safety-net endpoint.

**Addresses:** Sequential rotation, anchor-date deterministic math, manual skip, availability auto-skip, all-unavailable fallback.

**Avoids:** Pitfalls 5, 6 (timezone/DST — use `TZDate` from `@date-fns/tz`); Pitfall 7 (race condition); Pitfall 8 (null assignee with paused status).

**Research flag:** Standard patterns. No phase research needed.

### Phase 4: Invitation System

**Rationale:** Depends only on Phase 1. Must be complete before the household settings UI can generate invite links. Can overlap with Phases 2 and 3 if capacity allows.

**Delivers:** Public `/join/[token]` route (added to `publicPaths` and excluded from `proxy.ts` matcher); `createInvitation`, `revokeInvitation`, `acceptInvitation` Server Actions; token-through-auth redirect flow; acceptance state machine.

**Avoids:** Pitfall 10 (token predictability — `crypto.randomBytes(32)` only, atomic acceptance); Pitfall 9 (member addition mid-cycle).

**Research flag:** Standard patterns. No phase research needed.

### Phase 5: Household Notifications

**Rationale:** Requires both Phase 2 (`householdId` query layer) and Phase 3 (cycle engine) to know who the current assignee is.

**Delivers:** New `HouseholdNotification` model (second migration); cycle-start and reassignment notification creation; updated `layout.tsx` to query notification count and surface banner; `getReminderCount` / `getReminderItems` gated on `assignedUserId === session.user.id`.

**Addresses:** Assignee-scoped due/overdue badges; cycle-start banner; reassignment notification to incoming assignee.

**Avoids:** Pitfall 13 (reminders to non-assignees); Pitfall 14 (duplicate notifications during reassignment).

**Also addresses:** v1 tech debt — `NotificationBell` hidden on mobile and `BottomTabBar` Alerts linking to `/dashboard` should be fixed here before new notification types are added.

### Phase 6: Household Settings UI + Dashboard Updates

**Rationale:** Last assembly step. Requires Phases 2, 3, 4, and 5 complete so the settings page has real data and all actions are functional.

**Delivers:** `src/app/(main)/settings/household/page.tsx`; household switcher extending `UserMenu`; `member-list.tsx` with rotation order (drag/up-down); `availability-form.tsx` with two Calendar + Popover date pickers (no third-party range picker); `cycle-banner.tsx` on dashboard; `invite-link.tsx`; leave household + ownership transfer flow.

**Addresses:** All remaining P1 features; P2 features (visual rotation order).

**shadcn/ui installs to verify:** `calendar`, `popover`, `command`, `sheet` — check existing `components/` directory before installing.

### Phase 7: Demo Mode Compatibility

**Rationale:** Last because demo seeds data and needs the final schema shape.

**Delivers:** Updated `startDemoSession` to create a demo `Household` + `HouseholdMember` + `Cycle`; `seedStarterPlants` using `householdId` instead of `userId`; `/join` verified public for demo mode.

### Phase Ordering Rationale

- Phase 1 is a hard prerequisite — no parallel path around it.
- Phases 2 and 3 are independent and can proceed in parallel.
- Phase 4 only requires Phase 1 — can overlap with Phases 2 and 3.
- Phase 5 must follow both 2 and 3 because it joins query-layer scoping with cycle-engine state.
- Phase 6 assembles all previous phases into visible UI — building it earlier exercises broken wiring.
- Phase 7 targets the final schema shape and must be last.

### Research Flags

No phase requires `/gsd-research-phase` — all patterns are well-documented:
- Rotation math: PagerDuty/Opsgenie/OneUptime anchor-date formulas are published with code examples.
- Invitation flow: WorkOS, Logto, Auth0 document the token-through-auth redirect state machine.
- Multi-tenant Prisma: explicit `where: { householdId }` is the canonical safe pattern.
- DST-safe cycle arithmetic: `@date-fns/tz` TZDate API is documented with timezone examples.

Phases requiring extra review discipline (not research, but caution):
- **Phase 1:** Highest recovery cost. Schema review and migration test are release gates.
- **Phase 3:** DST-boundary unit tests are acceptance criteria, not optional.

## Open Questions Requiring User Decision

These must be resolved before the roadmapper generates the phase plan.

| Question | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Household routing model | Session-scoped `activeHouseholdId` in JWT — simpler, all current routes unchanged | URL-scoped `/h/[slug]/` prefix — industry standard, correct for multi-household, requires rewriting all routes and links | **URL-scoped.** PROJECT.md specifies 1..N households. Session-scoped breaks multi-tab and bookmarks (Pitfall 17). |
| Cron vs pure-lazy cycle evaluation | Hybrid: Vercel Cron hourly safety-net + lazy primary (ARCHITECTURE.md) | Pure lazy, no cron (STACK.md) | **Hybrid.** Users may not open the app for 2+ days. Hourly Cron prevents stale assignee state for inactive households. |
| Invitation token expiry | 72 hours (ARCHITECTURE.md) | 7 days (FEATURES.md, industry standard) | **7 days.** Matches Notion, Figma, WorkOS. 72 hours is unnecessarily short for home use. |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack additions | HIGH | `@date-fns/tz` and `nanoid` verified against official npm registry and date-fns blog. All avoid conclusions have official source citations. |
| Features | HIGH | Rotation patterns verified against PagerDuty, Opsgenie, OneUptime. Invitation flow verified against WorkOS and Logto official docs. |
| Architecture | HIGH | Based on direct codebase inspection of v1.0. Build order is deterministic from dependency graph, not inferred. |
| Pitfalls | HIGH | All 17 pitfalls derived from direct codebase audit and documented PostgreSQL/NextAuth/Prisma limitations with official source citations. |

**Overall confidence: HIGH**

### Gaps to Address

- **URL vs session routing decision:** The only true open question. Must be decided before Phase 1 planning begins. All other gaps are implementation details that follow from established patterns.

- **`unstable_update` API stability:** NextAuth v5 session update API is explicitly named unstable. Monitor for API changes. Fallback (re-query membership on each request) is documented and safe.

- **v1 tech debt interaction:** `NotificationBell` hidden on mobile and `BottomTabBar` Alerts linking to `/dashboard` are known v1 bugs. Resolve in Phase 5 before adding new notification types on a broken notification surface.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — library versions, compatibility matrix, installation commands
- `.planning/research/FEATURES.md` — feature table stakes, state machines, domain precedents
- `.planning/research/ARCHITECTURE.md` — codebase-based build order, schema models, file change list
- `.planning/research/PITFALLS.md` — codebase audit and PostgreSQL/NextAuth/Prisma documented limitations
- `.planning/PROJECT.md` — authoritative scope, constraints, current milestone definition
- [PagerDuty Schedule Basics](https://support.pagerduty.com/main/docs/schedule-basics) — anchor-date rotation math
- [Opsgenie On-Call Rotations](https://support.atlassian.com/opsgenie/docs/manage-on-call-schedules-and-rotations/) — anchor-based formula
- [Auth.js Extending the Session](https://authjs.dev/guides/extending-the-session) — JWT callback and module augmentation
- [date-fns v4 timezone support](https://blog.date-fns.org/v40-with-time-zone-support/) — `@date-fns/tz` is official companion
- [@date-fns/tz npm](https://www.npmjs.com/package/@date-fns/tz) — v1.3.0, 2.3M weekly downloads
- [nanoid GitHub](https://github.com/ai/nanoid) — v5.1.9, ESM-only, crypto.randomBytes
- [WorkOS Invitation Docs](https://workos.com/docs/authkit/invitations) — token invite state machine
- [Logto Invite Organization Members](https://docs.logto.io/end-user-flows/organization-experience/invite-organization-members) — pending/accepted/expired/revoked states
- [Prisma Client Extensions query component](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — nested read limitation
- [Notion Help: Members and Guests](https://www.notion.com/help/add-members-admins-guests-and-groups) — reusable invite link UX
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) — path-based routing recommendation
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — UTC-only, plan-tier minimums

### Secondary (MEDIUM confidence)
- [NextAuth v5 unstable_update discussion](https://github.com/nextauthjs/next-auth/discussions/10366) — server-side session mutation pattern
- [OneUptime On-Call Rotation Guide](https://oneuptime.com/blog/post/2026-02-02-on-call-rotations/view) — anchor-date formula with working code
- [Achromatic Dev: Multi-Tenant Next.js](https://www.achromatic.dev/blog/multi-tenant-architecture-nextjs) — org switcher pattern

### Tertiary (LOW confidence)
- [Cloudron Forum: Invite token 7-day expiry](https://forum.cloudron.io/topic/4760/user-invite-token-please-note-that-the-invite-link-will-expire-in-7-days) — community confirmation of 7-day industry standard

---
*Research completed: 2026-04-16*
*Ready for roadmap: yes — pending user decision on URL-scoped vs session-scoped household routing*