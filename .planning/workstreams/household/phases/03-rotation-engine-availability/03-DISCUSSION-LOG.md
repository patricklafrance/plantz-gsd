# Phase 3: Rotation Engine + Availability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 03-rotation-engine-availability
**Workstream:** household
**Mode:** discuss (interactive)
**Areas discussed:** Cycle lifecycle, Availability rules, Cron cadence + shape, Notification boundary

---

## Cycle lifecycle

### Bootstrap — when is Cycle #1 created?

| Option | Description | Selected |
|--------|-------------|----------|
| Eager at household creation (Recommended) | createHousehold/registerUser transaction creates Cycle #1 atomically. Dashboard always has an active cycle. Single-member + zero-plant edge cases handled in the engine. | ✓ |
| Lazy on first dashboard load | Household creation stops at Household + HouseholdMember. First dashboard visit creates the cycle. | |
| Cron endpoint bootstraps missing | Cron iterates households, creates Cycle #1 for any with none. Dashboard shows 'pending' until next tick. | |
| Explicit 'Start rotation' action | Owner opts in from Phase 6 settings. | |

**User first response:** Asked "If I was to choose 1, what happens when there's no configured plants? What happens for households with a single member?"
**Claude clarification:** Cycles are orthogonal to plants — an empty cycle just means the assignee has nothing to water this week. Single-member: `floor(daysSinceAnchor / cycleDuration) % 1 === 0` → sole member always assigned, no real rotation (matches Pitfall 8). Both edge cases handled cleanly by the engine with no special-casing.
**User's final choice:** Eager at household creation.

### Initial anchorDate for Cycle #1

| Option | Description | Selected |
|--------|-------------|----------|
| Next local midnight (Recommended) | anchorDate = start of tomorrow in household timezone, converted to UTC. Clean boundary. | ✓ |
| Now (creation timestamp) | anchorDate = createdAt. Cycle starts immediately; cycle boundaries fall at odd local times forever. | |
| Start of today (local) | anchorDate = start of today local. Retroactive partial first day. | |

**User's choice:** Next local midnight.

### Paused cycle resume trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Cron re-evaluates every tick (Recommended) | Hourly cron checks paused cycles, transitions if any member is now available. No explicit user action. | ✓ |
| Transition on availability change | Deleting an availability (or its endDate passing) triggers a cycle-transition check in the action path. | |
| Stay paused, cycle forward normally with owner assignee | Owner fallback = active cycle with owner assigned; next boundary runs normal findNextAssignee. | |

**User's choice:** Cron re-evaluates every tick.

### Skip reason audit location

| Option | Description | Selected |
|--------|-------------|----------|
| transitionReason column on Cycle (Recommended) | Nullable string on the CLOSED cycle; set when status flips. Cheap, queryable. | ✓ |
| JSON audit blob on Cycle | transitionMeta Json? column holding { reason, actorUserId, timestamp }. More extensible, less queryable. | |
| Separate CycleTransition log table | Full audit table decoupled from Cycle. Overkill for v1. | |

**User's choice:** transitionReason column on Cycle.

---

## Availability rules

### Overlap handling (Pitfall 11)

| Option | Description | Selected |
|--------|-------------|----------|
| Reject with error (Recommended) | Server Action returns actionable message identifying the conflict. No silent merge. | ✓ |
| Auto-merge into union | Silently replace overlapping rows with one spanning the union. | |
| Allow both as separate rows | No overlap validation; query OR across rows. Pitfall 11 warns against this. | |

**User's choice:** Reject.

### Edit path

| Option | Description | Selected |
|--------|-------------|----------|
| Delete + recreate only (Recommended) | Matches AVLB-02 literally. Actions: createAvailability, deleteAvailability. | ✓ |
| Add updateAvailability action | Owner of the period can edit dates/reason. More DB churn, smoother UX. | |

**User's choice:** Delete + recreate only.

### Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| All household members (Recommended) | Transparency — every member sees every member's availability. Only owning member can delete. | ✓ |
| Only the member themselves | Self-managed and private. | |
| Member + owner | Owner can view for oversight; members see only their own. | |

**User's choice:** All household members.

### Delete authority

| Option | Description | Selected |
|--------|-------------|----------|
| Only the owning member (Recommended) | Matches AVLB-02 literally. | |
| Owning member + household owner | Household owner gets override authority for stale entries. | ✓ |

**User's choice:** Owning member + household owner.

---

## Cron cadence + shape

### Polling cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Hourly (Recommended) | 24 invocations/day. Worst-case transition lag ≈ 1 hour past local midnight. Idempotent. | ✓ |
| Every 15 minutes | 96 invocations/day. Tighter boundary precision. Noisier logs. | |
| Daily (00:00 UTC) | 1 invocation/day. Wrong for non-UTC households. | |

**User's choice:** Hourly.

### Iteration strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential with per-household tx (Recommended) | for-loop, per-household db.$transaction with FOR UPDATE SKIP LOCKED. Errors isolated. | ✓ |
| Parallel Promise.all | Concurrent processing. Prisma pool contention, harder to reason about. | |
| Sequential, abort on first error | Safest no-partial-progress but one bad household blocks everyone. | |

**User's choice:** Sequential with per-household tx.

### Response shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per-household summary array (Recommended) | 200 JSON with ranAt, totalHouseholds, transitions[], errors[]. Observable. | ✓ |
| Aggregate counts only | { ranAt, transitioned, skipped, errors }. Simpler, less investigable. | |
| 204 No Content | Log-only. cron-job.org dashboard shows green ticks. | |

**User's choice:** Per-household summary array.

### Auth failure response

| Option | Description | Selected |
|--------|-------------|----------|
| 401 + generic message (Recommended) | `{error:"unauthorized"}`. Log attempt at warn level. | ✓ |
| 404 Not Found (hide endpoint) | Security-through-obscurity; breaks cron-job.org retry heuristics. | |
| 401 + constant-time compare | crypto.timingSafeEqual on the secret. Overkill for this volume. | |

**User's choice:** 401 + generic message.

---

## Notification boundary

### Emission responsibility

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 emits, Phase 5 renders (Recommended) | Cycle transition writes HouseholdNotification rows in the same tx. Single source of truth. | ✓ |
| Phase 3 stops at Cycle; Phase 5 does both | Phase 5 derives notifications at query time from recent Cycle rows. | |
| Phase 3 emits minimally (cycle-start only) | Compromise — Phase 3 emits cycle_started only; Phase 5 handles the rest. | |

**User's choice:** Phase 3 emits, Phase 5 renders.

### Recipient scope

| Option | Description | Selected |
|--------|-------------|----------|
| New assignee only (Recommended) | One row per transition. Phase 5 derives 'previous clears' at read time. Passive banner (HNTF-04) also read-time-derived. | ✓ |
| New assignee + previous assignee | Explicit 'you are no longer responsible' row; more writes. | |
| Every household member | Fully denormalized; simplest read, heaviest writes. | |

**User's choice:** New assignee only.

### Schema scope for HouseholdNotification

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 ships the model (full) | Add the table shape-complete this phase including readAt, payload, etc. | |
| Phase 3 ships bare-minimum, Phase 5 extends | Only columns needed for emissions; Phase 5 adds readAt/payload/indexes. | ✓ |
| Defer entirely to Phase 5 | Phase 3 emits nothing (contradicts emission decision). | |

**User's choice:** Phase 3 ships bare-minimum, Phase 5 extends.

### Notification type enum

| Option | Description | Selected |
|--------|-------------|----------|
| Granular per trigger (Recommended) | cycle_started, cycle_reassigned_manual_skip, cycle_reassigned_auto_skip, cycle_reassigned_member_left, cycle_fallback_owner. | ✓ |
| Two types (start vs reassigned) | Detail lives on Cycle.transitionReason; Phase 5 joins at render time. | |
| One type: cycle_assignment | Minimal enum; Phase 5 derives everything. | |

**User's choice:** Granular per trigger.

### Dedupe mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Unique (cycleId, recipientUserId, type) index (Recommended) | DB-level constraint. Duplicate INSERT fails silently inside tx. | ✓ |
| Wrap emission in same tx as Cycle create | FOR UPDATE SKIP LOCKED prevents double-transition; no unique index. | |
| Both: tx + unique index | Belt-and-suspenders. | |

**User's choice:** Unique (cycleId, recipientUserId, type) index.

### Manual skip action location

| Option | Description | Selected |
|--------|-------------|----------|
| Ship skipCurrentCycle in Phase 3 (Recommended) | Action in household/actions.ts; Phase 6 just wires a button. | ✓ |
| Defer skip action to Phase 6 | Splits rotation logic across two phases. | |

**User's choice:** Ship in Phase 3.

### Feature folder

| Option | Description | Selected |
|--------|-------------|----------|
| New src/features/rotation/ (Recommended) | Separate feature folder for rotation+availability. | |
| Split: cycle/ + availability/ | Two folders; cross-coupling. | |
| Extend src/features/household/ | All household-scoped; household folder grows. | ✓ |

**User's choice:** Extend src/features/household/ (deviation from Claude's recommendation — honored in CONTEXT.md D-20).

---

## Claude's Discretion

- Internal API shape of `transitionCycle(tx, householdId, reason)`
- File split inside `src/features/household/` (cycle.ts / availability.ts / cron.ts vs consolidation)
- Location of `transitionReason` constants (constants.ts vs schema.ts enum)
- `HouseholdNotification.type` as Prisma enum vs string — recommend string
- Reconciliation of `paused` status vs AVLB-05 owner fallback
- Need for a deploy-time Cycle #1 backfill script
- Cron observability format (console.log vs structured)
- `skippedByUserId` audit column — add if easy
- Test file organization (DST-boundary test is a hard acceptance gate regardless)

## Deferred Ideas

- HouseholdNotification readAt / payload — Phase 5
- Passive status banner (HNTF-04) — Phase 5
- All UI surfaces — Phase 6
- Demo-household seed — Phase 7
- Structured cron logging — v1 defers
- Constant-time secret compare — deferred
- Parallel household iteration — deferred
- updateAvailability action — rejected in D-07
- Event-driven paused resume — rejected; cron-only (D-05)
- Availability reason length cap — Phase 6 UI concern
- Completed-cycle retention policy — deferred
- skippedByUserId audit column — Claude's Discretion
