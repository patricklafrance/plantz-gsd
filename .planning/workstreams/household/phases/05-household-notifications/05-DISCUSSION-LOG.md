# Phase 5: Household Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 05-household-notifications
**Workstream:** household
**Areas discussed:** Schema extensions, Assignee reminder gate, Banner architecture, Mobile surface rework

---

## Schema extensions

### Q1 — readAt column vs derive from current Cycle

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from current Cycle only | No readAt. Filter notifications by `cycleId === currentCycle.id`. Prior-assignee's banner clears naturally when cycle transitions. | ✓ (initially) |
| Add readAt + derive | Dashboard visit writes readAt = NOW(); render filters on readAt IS NULL. | |
| Add readAt, user-dismissed only | readAt set only by explicit dismiss click. | |

**User's initial choice:** Derive from current Cycle only.
**Notes:** Later reversed in Area 4 discussion — adding readAt became necessary when the merged-feed bell model required inbox semantics. See Area 4 challenge and resolution.

### Q2 — payload Json column vs read-time derivation

| Option | Description | Selected |
|--------|-------------|----------|
| Read-time derivation | No payload column. Join Cycle + members + reminders at render. | ✓ |
| Snapshot payload Json at write | Freeze due-plant count + cycle end + names at emit time. | |
| Hybrid — payload for stable fields only | prior-assignee name snapshotted; counts dynamic. | |

**User's choice (after clarification on Cycle table schema):** "runtime derivation seems acceptable for now."
**Notes:** User asked where cycle info lives; I explained Cycle table has startDate/endDate/assignedUserId/status; due-plant count is dynamic via getReminderCount. User then accepted read-time derivation.

### Q3 — Dismissable banners

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-clear only | No X button; banner stays until cycle transition or responsibility change. | ✓ |
| Add dismiss action + dismissedAt column | X button sets dismissedAt via Server Action. | |
| Dismiss for cycle_started only | Hybrid per type. | |

**User's choice:** Auto-clear only.

### Q4 — New notification types in Phase 5

| Option | Description | Selected |
|--------|-------------|----------|
| Render-only, no new types | Style the 5 types Phase 3 emits; IN-01 is a no-op. | ✓ |
| Add new types with non-null cycleId | E.g., cycle_ending_soon reminder. | |
| Add types with cycleId: null | E.g., household announcements; triggers IN-01 migration. | |

**User's choice:** Render-only, no new types.

---

## Assignee reminder gate

### Q1 — How userId flows into getReminderCount/getReminderItems

| Option | Description | Selected |
|--------|-------------|----------|
| Add userId as explicit parameter | (householdId, userId, todayStart, todayEnd); 2 call sites in layout updated. | ✓ |
| Read auth() inside the query | Keep signature; query reads session internally. | (discarded by user) |
| Return the gate as a separate helper | isCurrentAssignee(householdId, userId) + short-circuit in caller. | |

**User requested plain-text explanation of options 1 and 3; explicitly discarded option 2.**
**After explanation, user chose Option 1** (explicit userId param). Rationale: two call sites only, same file, composes with banner which needs cycle anyway — avoids duplicate cycle lookups.

### Q2 — Paused-cycle badge/list behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Zero for everyone when paused | No active assignee → no one sees count. | |
| Owner sees count when paused | Owner covers invisibly. | |
| All members see count when paused | Pre-Phase-5 household-wide fallback. | ✓ |

**User's choice:** All members see count when paused.
**Notes:** Deliberate deviation from Pitfall 13's strict wording. Justification: paused = no one responsible = plants shouldn't go silent = someone needs to step up. Active-cycle non-assignee still sees 0.

### Q3 — Query shape (how the gate enters the plant query)

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-check assignee, early return | Fetch cycle; early-return 0 for non-assignee before plant.count runs. | ✓ |
| Join Cycle into plant where-clause | Relation filter nested EXISTS. | |
| Split — count early-return, items relation filter | Hybrid. | |

**User requested tradeoff explanation; after explanation chose Option 1.** Rationale: keeps existing reminder filter readable, grep-able branches, composes with banner's cycle lookup, paused-cycle branch is a clean condition.

### Q4 — Test pattern consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Real-DB integration test, 3 cases | Spawn test DB; assignee / non-assignee / paused. | |
| Mocked Prisma unit tests only | Shape + branch assertions. | ✓ |
| Both — mocked unit + real integration | Most rigorous. | |

**User asked for existing pattern; I audited prior phases and reported:** Phase 2 D-16/D-17 used mocked Prisma for shape/branch tests; Phase 2 D-18 / Phase 4 D-23/D-27 used real-DB only when testing SQL semantics (atomicity, concurrency, cascade). Phase 5's gate is TypeScript branch logic — mocked Prisma is consistent.
**User confirmed:** "yes" → Mocked Prisma unit tests, 4 branches (added paused-cycle case from Q2).

---

## Banner architecture

### Q1 — Render location

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard page only | Banners in dashboard/page.tsx only. | ✓ |
| Household layout-wide (every page) | Banners in layout.tsx, visible on all routes. | |
| Hybrid — reassignment layout-wide, status dashboard-only | Mixed. | |

**User's choice:** Dashboard page only.

### Q2 — Component granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One CycleBanner, type-branched inside | Single component, internal switch. | |
| Four separate banner components | CycleStart / Reassignment / PassiveStatus / Fallback. | ✓ |
| Two components — AssigneeBanner + StatusBanner | Split by viewer role. | |

**User's choice:** Four separate banner components.

### Q3 — Next-assignee preview source

| Option | Description | Selected |
|--------|-------------|----------|
| Derive via findNextAssignee walker | Phase 3 export; availability-aware. | ✓ |
| Show rotationOrder + 1 raw | Simple but may lie if next member is unavailable. | |
| Omit "next up" from the passive banner | Drops ROADMAP success criterion 4 wording. | |

**User's choice:** Derive via findNextAssignee walker.

### Q4 — Fallback banner placement

| Option | Description | Selected |
|--------|-------------|----------|
| Same CycleBanner, fallback variant | Color/copy branch only. | |
| Separate FallbackBanner + distinct placement | Dedicated sticky/prominent placement. | |
| Toast + CycleBanner | First-time toast + subsequent banner. | |

**User asked why I recommended distinct placement for option 2; requested challenge.**
**I clarified:** dedicated component earns its keep only with distinct placement; otherwise it's a split without benefit. Given Q1 scoped to dashboard-only and Q2 chose 4 separate components anyway, the real remaining question is within-dashboard ordering/styling.
**I offered refined choice:** (a) first-in-order warning-color inline, (b) sticky top of dashboard viewport, (c) same weight as passive status. Recommended (a).
**User replied:** "1" → first-in-order, warning color, inline.

---

## Mobile surface rework

### Q1 — Bell scope / end-state

| Option | Description | Selected |
|--------|-------------|----------|
| Keep two dropdowns, both visible | NotificationBell sm:visible + BottomTabBar Alerts stays. | |
| Remove bell from top-nav on mobile; BottomTabBar Alerts sole entry | Desktop-only top bell. | |
| Unify: one NotificationDropdown shared | Shared content, two triggers. | (partial — evolved) |

**User asked for challenge on blind spots, proposed their own model:** "there shouldn't be alert and notifications bells... only notification bells... that would include the alerts... desktop top-right next to user menu, mobile bottom-right."

### Q2 — Cycle events in the bell feed

| Option | Description | Selected |
|--------|-------------|----------|
| No — cycle events banners only; bell reminder-only | Clean boundary. | |
| Yes — merge into one feed | Mixed list with readAt semantics. | ✓ |
| Bell shows summary pill, details on dashboard | Compromise. | |

**User's choice:** Yes — merge into one feed.

### Q3 — Badge semantics

| Option | Description | Selected |
|--------|-------------|----------|
| No change — badge = reminderCount | Unchanged. | |
| Add cycle-event indicator (dot without number) | Separate dot. | (initially chosen, later reversed) |
| (later added) Unified count = reminderCount + unreadCycleEventCount | Single honest number via readAt. | ✓ (final) |

**User's initial choice:** "Add cycle-event indicator (dot without number)".
**During the blind-spot discussion I flagged:** a dot without readAt semantics is always-on for the assignee and always-off for non-assignees — redundant with "am I the assignee?" which the badge count already conveys indirectly. Under readAt (Path 2), a unified count is more honest.
**User asked sharp question:** "Is the issue the number on the red dot or the content of the notification or alert?"
**I clarified:** dropdown content is pull-only (no queue semantic, no readAt needed); badge is push (needs readAt to be honest). Recommended unified count once readAt was in play.
**User challenged my "big deal" framing on readAt.**
**I revised:** ~100 lines of code, one migration, one Server Action. Phase 3 D-17 explicitly scheduled readAt for Phase 5. Not a reopening — scheduled execution.
**User confirmed:** Path 2 (readAt + merged feed) → unified count badge.

### Q4 — Scope of tech-debt fix

| Option | Description | Selected |
|--------|-------------|----------|
| Scope-limited: flip bell visibility only | Minimal. | |
| Full dedup — extract shared dropdown, refactor both sites | Unify. | ✓ (via Path 2) |
| Remove BottomTabBar Alerts entirely | Delete. | (incorporated) |

**User deferred to the Q1 outcome.** Final outcome = full dedup (Path 2): unified NotificationBell with variant prop, BottomTabBar Alerts slot becomes the bell, inline duplicate dropdown deleted.

---

## Claude's Discretion

Captured in CONTEXT.md §Claude's Discretion. Notable:
- Tailwind color tokens for banner variants
- Whether unread-count and feed-rows are one query or two (recommended two)
- Copy strings for the 5 reassignment type variants
- Exact `useTransition` wiring on bell-open
- Whether `markNotificationsRead` takes `notificationIds[]` or `{ cycleId }`
- Single-member passive banner suppression heuristic
- BottomTabBar mobile in-flow vs FAB placement
- Whether to opportunistically fix adjacent v1 tech debt (PROJECT.md known list)

## Deferred Ideas

Captured in CONTEXT.md §Deferred Ideas. Notable cross-session items:
- `payload Json?` (audit-trail reconstruction) — rejected
- `dismissedAt` — rejected
- New notification types with `cycleId: null` — out of scope (would trigger roadmap IN-01)
- Layout-wide banners — rejected
- Notification history view — out of phase scope but enabled by readAt
- Email delivery / per-user preferences — deferred milestone

---

## Process Notes

- Discussion paced 4 Q per area, 4 areas total.
- User pushed back substantively in Areas 2 and 4, reshaping the design:
  - Area 2 Q1/Q3/Q4: user requested tradeoff exposition before committing; final answers matched recommendations after exposition.
  - Area 2 Q2: user deliberately deviated from Pitfall 13 for paused-cycle fallback.
  - Area 4 end-to-end: user rejected my initial "two-section dropdown without readAt" path and insisted the inbox-style merged feed was right; successfully challenged my over-dramatized cost framing; final model (one position-responsive bell + merged feed + readAt + unified count) supersedes Area 1 Q1's initial "no readAt" answer.
- Area 1 Q1 was reversed during Area 4 discussion. CONTEXT.md reflects the final state (readAt present). DISCUSSION-LOG preserves both the initial choice and the reversal for audit traceability.
