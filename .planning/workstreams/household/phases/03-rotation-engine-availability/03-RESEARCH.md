# Phase 3: Rotation Engine + Availability — Research

**Researched:** 2026-04-17
**Domain:** Timezone-aware cycle engine + Postgres row-level locking + Next.js 16 cron route handler + availability CRUD
**Confidence:** HIGH on stack choices (locked by CONTEXT.md); MEDIUM-HIGH on `@date-fns/tz` DST semantics; MEDIUM on test-infrastructure concurrency simulation (real Postgres required)

## Summary

Phase 3 builds a single-write-path rotation engine on top of a fully locked Phase 1/2 foundation. Every knob of this phase is already decided — tech stack, file layout, function boundary, notification model, cron cadence, auth style, fallback semantics. Research scope is not "what to build" but "which verified patterns let us build it correctly," because three of the mandated techniques (`@date-fns/tz` TZDate with date-fns v4 context-option, `FOR UPDATE SKIP LOCKED` driven from Prisma 7's `tx.$queryRaw`, and a bearer-auth Node-runtime route handler that must bypass the existing `proxy.ts` auth matcher) each have non-obvious correctness traps.

Three findings dominate:

1. **`@date-fns/tz` v1.4.1 is the correct library** (not `date-fns-tz` by marnusw — the STATE.md mandate is well-founded). With `date-fns@^4.1.0` (current in `package.json`) you use either `TZDate` instances OR the `in: tz("IANA/Name")` context option — both make date-fns arithmetic zone-aware. Adding 1 day via `addDays(tzDate, 1)` preserves **wall-clock time** across DST boundaries (23h or 25h of UTC elapsed), which is exactly the Pitfall 6 requirement.
2. **Prisma 7 supports `FOR UPDATE SKIP LOCKED` via `tx.$queryRaw`** inside an interactive transaction. The correct shape is a single SELECT-with-lock inside the transaction callback, handing the returned id to `tx.cycle.update`. The often-cited "multi-statement `BEGIN;...COMMIT;` inside `$queryRaw`" attempt fails with "cannot insert multiple commands into a prepared statement" — the transaction boundary is owned by `$transaction`, not by inline SQL.
3. **`proxy.ts` currently matches `/api/cron/*`** — `matcher: "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)"` excludes only `api/auth`. The cron route will hit the NextAuth-backed proxy before the bearer handler unless this matcher is extended. Phase 3 must add `api/cron` (or `api`) to the exclusion. This is a cross-cutting change that is NOT called out anywhere in CONTEXT.md.

**Primary recommendation:** Plan five task surfaces — (a) Prisma migration for `Cycle.transitionReason` + `HouseholdNotification` + back-relations, (b) `cycle.ts` engine with the one-function-one-lock pattern, (c) `availability.ts` + availability actions, (d) `cron.ts` orchestrator + `/api/cron/advance-cycles` route + `proxy.ts` matcher update, (e) `registerUser` / `createHousehold` transaction extensions. DST-boundary test and concurrent-transition test are both hard acceptance gates and each requires a real Postgres (neither is unit-mockable).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cycle lifecycle — bootstrap**
- **D-01:** Cycle #1 is created eagerly at household creation, inside the same `db.$transaction` as the Household + owner HouseholdMember rows. Two write sites extended:
  1. `src/features/auth/actions.ts` `registerUser` — append Cycle #1 write to existing `db.$transaction`
  2. `src/features/household/actions.ts` `createHousehold` — same extension
  Every household always has an active Cycle; no code path handles "household without a cycle."
- **D-02:** Cycle #1 `anchorDate` = start of the next local day in the household's timezone, converted to UTC via `@date-fns/tz` `TZDate`. `startDate === anchorDate`. `endDate = anchorDate + cycleDuration days` using TZDate addition (DST-safe). `cycleNumber = 1`, `status = 'active'`, `assignedUserId = ownerUserId`, `memberOrderSnapshot = [{ userId: ownerUserId, rotationOrder: 0 }]`.

**Cycle lifecycle — status transitions**
- **D-03:** Cycle `status` state machine = `active` | `completed` | `skipped` | `paused`. Transitions write the next Cycle row first inside the transaction, then mark the outgoing row closed with `status` + `transitionReason`. Single write path — cron, `skipCurrentCycle`, and Phase 4 `leaveHousehold` all go through one function.
- **D-04:** `Cycle.transitionReason` nullable String column added this phase. Domain: `cycle_end` | `manual_skip` | `auto_skip_unavailable` | `member_left` | `all_unavailable_fallback` | `paused_resumed`.
- **D-05:** Paused cycle resume is cron-only. Every hourly tick iterates paused cycles alongside active-ready-to-transition cycles. No action-side trigger on availability delete.

**Availability rules**
- **D-06:** Overlap handling = reject (Pitfall 11). Pre-insert query in `createAvailability` for `startDate: { lte: input.endDate }, endDate: { gte: input.startDate }`. Reject with user-facing message identifying the conflicting period. Past-start rejection (Pitfall 12, `startDate >= today`) is a separate Zod refinement applied before the overlap check.
- **D-07:** Availability is delete-only, never editable. Actions shipped: `createAvailability`, `deleteAvailability`. No `updateAvailability`.
- **D-08:** All household members can VIEW all members' availability. `getHouseholdAvailabilities(householdId)` returns every row for the household joined with `user.name`.
- **D-09:** Delete authority = owning member OR household owner. `deleteAvailability` fetches the row, runs `requireHouseholdAccess(row.householdId)`, then authorizes if `member.userId === row.userId || role === 'OWNER'`. Otherwise `ForbiddenError`.

**Cron endpoint**
- **D-10:** Cron cadence is hourly via cron-job.org. Vercel Cron NOT used.
- **D-11:** Endpoint iterates households sequentially. Each household gets its own `db.$transaction` wrapping a `SELECT ... FOR UPDATE SKIP LOCKED` on the outgoing cycle. Exceptions are caught per-household and recorded in the response `errors` array.
- **D-12:** Response shape (200 JSON): `{ ranAt, totalHouseholds, transitions: [{ householdId, fromCycleNumber, toCycleNumber, reason, assignedUserId }], errors: [{ householdId, message }] }`.
- **D-13:** Auth failure = 401 with `{ "error": "unauthorized" }`. Plain `===` compare on `Authorization: Bearer $CRON_SECRET`. Constant-time compare deferred.

**Manual skip**
- **D-14:** `skipCurrentCycle(householdId)` in `src/features/household/actions.ts`, follows Phase 2 D-12's 7-step template: auth → demo guard → Zod parse (just `householdId.cuid()`) → `requireHouseholdAccess` → assert `session.user.id === currentCycle.assignedUserId` → call shared `transitionCycle(..., reason: 'manual_skip')` → `revalidatePath('/h/[slug]/dashboard')`.

**Notification boundary**
- **D-15:** Phase 3 emits `HouseholdNotification` rows; Phase 5 renders. Every cycle transition writes one notification row for the incoming assignee inside the same `db.$transaction` as the Cycle writes.
- **D-16:** Recipient = new assignee only. One row per transition. Previous-assignee "banner clears" (HNTF-03) and passive banner for non-assignees (HNTF-04) are read-time derivations in Phase 5, not stored.
- **D-17:** `HouseholdNotification` Prisma model added this phase (bare-minimum) — see shape in CONTEXT.md lines 107–122. Phase 5 extends with `readAt`, `payload Json?`, dismissal columns.
- **D-18:** Notification `type` string values: `cycle_started`, `cycle_reassigned_manual_skip`, `cycle_reassigned_auto_skip`, `cycle_reassigned_member_left`, `cycle_fallback_owner`. `paused_resumed` maps to `cycle_started` (reuse, no separate type).
- **D-19:** Dedupe via DB-level `@@unique([cycleId, recipientUserId, type])`. Unique-violation from a retry is a no-op (catch + continue).

**Server file layout**
- **D-20:** All Phase 3 server code lives in `src/features/household/`. User-chosen: do NOT create `src/features/rotation/`. New files: `cycle.ts`, `availability.ts`, `cron.ts`. Extended: `actions.ts`, `queries.ts`, `schema.ts`. New route: `src/app/api/cron/advance-cycles/route.ts`.

### Claude's Discretion

- Exact internal API of `transitionCycle(tx, householdId, reason)` — return shape, whether it takes the outgoing cycle row vs. looking it up, where lock acquisition lives. Keep one function, one write path.
- Whether `cycle.ts` / `availability.ts` / `cron.ts` are split as D-20 suggests or consolidated into `actions.ts` / `queries.ts` — prefer split for testability.
- Whether `transitionReason` values live as string constants in `src/features/household/constants.ts` or Zod enum in `schema.ts`. Recommend single source reused by notification `type` mapping.
- `HouseholdNotification.type` as Prisma enum or string column. Recommend **string** — matches `Cycle.status` / `Cycle.transitionReason` convention.
- Reconciliation of `status = 'paused'` (Pitfall 8) vs AVLB-05 owner fallback: when `findNextAssignee` returns null AND owner is unavailable → `paused`, no assignee. When owner IS available → `active`, `assignedUserId = ownerId`, `transitionReason = 'all_unavailable_fallback'`.
- Deploy-time backfill script for pre-existing households lacking Cycle #1 — inventory at plan time; expected zero.
- Cron observability: `console.log` to Vercel logs sufficient for v1.
- `skippedByUserId` audit column on Cycle — nice-to-have; add if easy.
- Test file organization: one `tests/phase-03/rotation-engine.test.ts` vs per-function. DST-boundary test is a hard acceptance gate regardless.

### Deferred Ideas (OUT OF SCOPE)

- `HouseholdNotification.readAt` / dismissal / payload Json — Phase 5.
- Passive household status banner (HNTF-04) — Phase 5, derived at read time.
- All Phase 3 UI (cycle banner, availability form, rotation reorder, skip button, fallback banner) — Phase 6.
- Demo-household seed with availability + cycle — Phase 7.
- Structured logging / observability format for cron — `console.log` is v1 answer.
- Constant-time bearer-secret compare — deferred.
- Parallel household iteration in cron — deferred.
- `updateAvailability` action — explicitly rejected (D-07).
- Multi-timezone per household — out of scope.
- Observer role, load-balanced rotation, per-plant assignment — `ROTAX-*` / `MEMBX-*` deferred.
- Availability reason length cap — Zod default for now.
- Retention / archival of historical completed cycles — no pruning.
- Event-driven resume (action-side trigger on availability delete) — rejected; cron-only (D-05).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROTA-02 | Exactly one active assignee per household, computed via `floor(daysSinceAnchor / cycleDuration) % memberCount` | `memberOrderSnapshot` on Cycle + deterministic rotation formula; unit test verifies formula independently of DB |
| ROTA-03 | Cycle duration configurable (1/3/7/14), changes take effect at next boundary | `Household.cycleDuration` read at transition time (not mutated on existing cycles); Zod enum in `schema.ts` for settings form (Phase 6 consumes) |
| ROTA-04 | `/api/cron/advance-cycles` endpoint — bearer auth, idempotent, JSON summary | Next.js 16 Route Handler with `export const runtime = 'nodejs'`; `proxy.ts` matcher exclusion required (see Pitfalls §Cron-Proxy Collision) |
| ROTA-05 | Timezone-aware — boundaries respect household timezone; DST does not skew 7-day cycles | `@date-fns/tz` TZDate + `addDays` preserves wall-clock time; DST-boundary unit test is acceptance gate |
| ROTA-06 | Race-safe — concurrent invocations cannot double-advance | `tx.$queryRaw` with `FOR UPDATE SKIP LOCKED` inside `$transaction`; `@@unique([householdId, cycleNumber])` already on schema as backstop |
| ROTA-07 | Membership change mid-cycle does not retroactively change current assignee | `memberOrderSnapshot` JSON captured at cycle creation; current cycle reads from snapshot; next cycle reads live members — Phase 1 D-02 established |
| AVLB-01 | Member can declare unavailability (start, end, optional reason) | `createAvailability` action + Zod schema with `startDate >= today` refinement |
| AVLB-02 | Member can view and delete own periods; overlapping periods handled | D-06 overlap = reject; D-07 delete-only; `getHouseholdAvailabilities` returns all |
| AVLB-03 | Cron auto-skips unavailable members; skipped members stay in rotation | `findNextAssignee(memberOrderSnapshot, currentOrder, availabilityMap)` walks rotation skipping unavailable; rotation order not mutated |
| AVLB-04 | Active assignee can manually skip; cycle advances to next available member | `skipCurrentCycle` action calls shared `transitionCycle` with `reason: 'manual_skip'` |
| AVLB-05 | All-unavailable fallback to owner as assignee + fallback banner | `findNextAssignee` returns null → check owner availability; owner available → transition with `reason: 'all_unavailable_fallback'`, owner as assignee; owner unavailable → cycle `paused` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timezone-safe date arithmetic | API / Backend (Node) | — | `@date-fns/tz` runs server-side; needed during cycle creation and transition (both server-only paths). Browser `Intl.DateTimeFormat` never touches cycle math. |
| Cycle transition (lock + write) | API / Backend (Node, Prisma) | Database (row-level lock) | `FOR UPDATE SKIP LOCKED` is a Postgres feature; the lock is the database's job. The orchestration logic is Node/Prisma. |
| Cron trigger | External (cron-job.org) | API / Backend (Route Handler) | External service owns cadence; Node route handler owns response + orchestration. Vercel Cron explicitly rejected (STATE.md). |
| Bearer auth | API / Backend (Route Handler) | — | `Authorization` header parsed server-side; CRON_SECRET env var never reaches client. Does NOT use NextAuth session path. |
| Availability create/delete | API / Backend (Server Action) | Database (constraints, cascade) | Zod validation in action; FK cascades on User/Household delete handle cleanup. |
| Rotation formula evaluation | API / Backend (pure function) | — | Deterministic `floor(daysSinceAnchor / cycleDuration) % memberCount` — pure TS; no DB, no I/O. Unit-testable trivially. |
| Notification emission | API / Backend (same transaction as Cycle writes) | Database (`@@unique` dedupe) | Unique constraint is the dedupe authority; transition code wraps INSERT with try/catch for Prisma P2002. |
| Dashboard cycle banner | Frontend Server (Server Component) | API / Backend (query) | NOT this phase — Phase 6. Phase 3 ships `getCurrentCycle(householdId)` for Phase 6 to consume. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@date-fns/tz` | **1.4.1** (latest, published 2025-08-12) `[VERIFIED: npm view @date-fns/tz]` | Timezone-aware date math on top of date-fns v4 | STATE.md mandates it; `date-fns-tz` (marnusw) was archived and is incompatible with date-fns v4. `@date-fns/tz` is the official date-fns v4 companion (kossnocorp is date-fns core maintainer). |
| `date-fns` | **^4.1.0** (already in package.json) `[VERIFIED: package.json]` | Base date utilities (`addDays`, `startOfDay`, `differenceInDays`) | v4's `in` context option allows passing `tz("IANA/Name")` to make any arithmetic zone-aware without TZDate wrapping. |
| `@prisma/client` | **^7.7.0** (already in package.json) `[VERIFIED: package.json]` | ORM + raw query + transactions | Rust-free v7 closes cold-start gap; supports `tx.$queryRaw` for `FOR UPDATE SKIP LOCKED`. `@prisma/adapter-pg` already installed. |
| `zod` | **^4.3.6** (already in package.json, import as `zod/v4`) `[VERIFIED: package.json]` | Input validation for availability + skip schemas | 7-step action template mandates Zod parse at step 3. |
| Next.js Route Handler | **Next.js 16.2.4** `[VERIFIED: npm view next]` | `/api/cron/advance-cycles` endpoint | Node runtime (required for Prisma — edge incompatible). `export const runtime = 'nodejs'`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | **^4.1.4** `[VERIFIED: package.json]` | Unit + integration tests | DST-boundary test, rotation formula test, overlap tests, action tests. |
| `@playwright/test` | **^1.59.1** `[VERIFIED: package.json]` | E2E tests | Not needed this phase — no UI. Phase 6 consumer. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `@date-fns/tz` TZDate | `date-fns-tz` (marnusw) `fromZonedTime`/`toZonedTime` | Works with date-fns v3; familiar. Incompatible with date-fns v4. | **Rejected by STATE.md.** Pitfall 5 example in PITFALLS.md is written for `date-fns-tz` — ignore that example; use `@date-fns/tz` idioms. |
| `tx.$queryRaw` for SELECT FOR UPDATE | `prisma.$transaction` with Serializable isolation + conflict retry | Works without raw SQL; tolerates serialization failures. Slower under contention; requires retry loop. | **Rejected by CONTEXT.md D-11 / Pitfall 7 verbatim.** `FOR UPDATE SKIP LOCKED` is the specified lock mechanism. |
| Vercel Cron | cron-job.org external hit | Zero infrastructure; built-in observability. | **Rejected by STATE.md** — single external cron owner simplifies ops reasoning. |
| Prisma enum for `transitionReason` / notification `type` | String columns | Enum gives TS types for free; DB constraint on values. | **Recommend string** (matches Claude's Discretion recommendation + `Cycle.status` convention). Source of truth: Zod enum in `schema.ts` OR string constants in `constants.ts`. |
| Promise.all parallel household iteration in cron | Sequential `for` loop | 10x+ faster at scale. Harder to reason about lock contention + error isolation. | **Rejected by D-11.** Revisit only if cron runtime exceeds cron-job.org timeout. |

**Installation:**

```bash
npm install @date-fns/tz
```

No other new dependencies. `date-fns@^4.1.0`, `@prisma/client@^7.7.0`, `zod@^4.3.6` are already present.

**Version verification performed 2026-04-17:**
- `@date-fns/tz` → `1.4.1` (published 2025-08-12, via `npm view @date-fns/tz version`)
- `next` → `16.2.4` (latest)
- `vitest` → `4.1.4` (latest)
- `@playwright/test` → `1.59.1` (latest)

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────┐
                │ cron-job.org (external)     │
                │ hourly POST w/ Bearer header│
                └──────────────┬──────────────┘
                               │ HTTPS
                               ▼
         ┌────────────────────────────────────────┐
         │ proxy.ts (NextAuth session middleware) │
         │   matcher MUST exclude /api/cron/*     │◄── [CRITICAL PHASE 3 EDIT]
         └──────────────┬─────────────────────────┘
                        │  (bypassed for /api/cron/*)
                        ▼
         ┌────────────────────────────────────────┐
         │ /api/cron/advance-cycles/route.ts      │
         │   runtime = 'nodejs'                   │
         │   POST(request):                       │
         │     1. Read Authorization header       │
         │     2. Plain === compare with          │
         │        process.env.CRON_SECRET         │
         │     3. 401 if mismatch                 │
         │     4. Call advanceAllHouseholds()     │
         │     5. Return 200 JSON summary         │
         └──────────────┬─────────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────────┐
         │ src/features/household/cron.ts         │
         │   advanceAllHouseholds():              │
         │     - Query households with            │
         │       (active cycle endDate <= now)    │
         │       OR (status = 'paused')           │
         │     - for household of households:     │
         │         try: transitionCycle(...)      │
         │         catch: push into errors[]      │
         │     - Return { transitions, errors }   │
         └──────────────┬─────────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────────┐
         │ src/features/household/cycle.ts        │
         │   transitionCycle(householdId, reason):│
         │     await db.$transaction(async tx ⇒ { │
         │       1. tx.$queryRaw SELECT … FOR     │
         │          UPDATE SKIP LOCKED            │
         │          → if no row: return (skip)    │
         │       2. findNextAssignee(...)         │
         │       3. Compute next cycle boundaries │
         │          with @date-fns/tz             │
         │       4. tx.cycle.create({ next })     │
         │       5. tx.cycle.update({ outgoing,   │
         │          status, transitionReason })   │
         │       6. tx.householdNotification      │
         │          .create({ type, recipient })  │
         │          (catch P2002 → idempotent)    │
         │     })                                 │
         └────────────────────────────────────────┘
                        ▲           ▲
   Phase 4 leave ──────/             \───── manual skip action
   (reason = 'member_left')          (reason = 'manual_skip')
```

**Key flow invariants encoded in the diagram:**
- Single entry point (`transitionCycle`) for all three callers (cron, manual skip, Phase 4 leave)
- Lock acquisition is inside the transaction, NOT before it
- Notification INSERT is inside the same transaction as Cycle writes
- `proxy.ts` matcher change is a CROSS-CUTTING edit that gates the cron endpoint entirely

### Recommended Project Structure

Per D-20, all Phase 3 server code lives in `src/features/household/`:

```
src/
├── app/
│   └── api/
│       └── cron/
│           └── advance-cycles/
│               └── route.ts          # NEW — Node runtime; bearer auth
├── features/
│   └── household/
│       ├── actions.ts                # EXTENDED — skipCurrentCycle, createAvailability, deleteAvailability
│       ├── queries.ts                # EXTENDED — getCurrentCycle, getHouseholdAvailabilities, getMyAvailabilities
│       ├── schema.ts                 # EXTENDED — availabilitySchema, skipSchema, transitionReason enum, notificationType enum
│       ├── guards.ts                 # UNCHANGED — requireHouseholdAccess consumed by all 3 new actions
│       ├── paths.ts                  # UNCHANGED — revalidatePath targets
│       ├── cycle.ts                  # NEW — findNextAssignee, computeCycleBoundaries, transitionCycle
│       ├── availability.ts           # NEW — isMemberUnavailableOn, findOverlappingPeriod
│       ├── cron.ts                   # NEW — advanceAllHouseholds orchestrator
│       └── constants.ts              # NEW (optional) — TRANSITION_REASONS, NOTIFICATION_TYPES string unions
├── features/
│   └── auth/
│       └── actions.ts                # EXTENDED — registerUser transaction now writes Cycle #1
└── prisma/
    └── schema.prisma                 # EXTENDED — Cycle.transitionReason, HouseholdNotification model, back-relations
```

### Pattern 1: One-Function-One-Write-Path Cycle Transition (Pitfall 7 + D-03 + D-11 + D-14)

**What:** A single `transitionCycle(householdId, reason)` function is the *only* code path that closes a Cycle and opens a new one. Cron, `skipCurrentCycle`, and Phase 4 `leaveHousehold` all call it. Inside, a `tx.$queryRaw` with `FOR UPDATE SKIP LOCKED` acquires a row-level lock on the outgoing Cycle; concurrent invocations silently skip (not block, not fail).

**When to use:** Every cycle transition. No exceptions. If you see `tx.cycle.update({ status: ... })` anywhere outside `cycle.ts`, that's a bug.

**Example (template for planner):**

```typescript
// src/features/household/cycle.ts
import { db } from "@/lib/db";
import { addDays, startOfDay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";

export type TransitionReason =
  | "cycle_end"
  | "manual_skip"
  | "auto_skip_unavailable"
  | "member_left"
  | "all_unavailable_fallback"
  | "paused_resumed";

export type TransitionResult =
  | { skipped: true } // lock already held by another tx
  | { transitioned: true; fromCycleNumber: number; toCycleNumber: number; assignedUserId: string | null; status: "active" | "paused" };

export async function transitionCycle(
  householdId: string,
  reason: TransitionReason,
): Promise<TransitionResult> {
  return db.$transaction(async (tx) => {
    // STEP 1 — Acquire row-level lock on the outgoing cycle.
    // If another cron tick or skip action holds the lock, SKIP LOCKED makes this
    // transaction silently return an empty array; we exit without side effects.
    // Source: https://medium.com/@connect.hashblock/10-prisma-transaction-patterns-that-avoid-deadlocks-4f52a174760b (pattern 7)
    const lockedRows = await tx.$queryRaw<Array<{
      id: string;
      householdId: string;
      cycleNumber: number;
      anchorDate: Date;
      cycleDuration: number;
      startDate: Date;
      endDate: Date;
      status: string;
      assignedUserId: string | null;
      memberOrderSnapshot: unknown;
    }>>`
      SELECT id, "householdId", "cycleNumber", "anchorDate", "cycleDuration",
             "startDate", "endDate", status, "assignedUserId", "memberOrderSnapshot"
      FROM "Cycle"
      WHERE "householdId" = ${householdId}
        AND status IN ('active', 'paused')
      ORDER BY "cycleNumber" DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (lockedRows.length === 0) {
      return { skipped: true };
    }
    const outgoing = lockedRows[0];

    // STEP 2 — Load household (for timezone) + live member list (for rotation).
    const household = await tx.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { id: true, timezone: true, cycleDuration: true },
    });
    const members = await tx.householdMember.findMany({
      where: { householdId },
      orderBy: { rotationOrder: "asc" },
    });

    // STEP 3 — Find next assignee (null if all-unavailable without owner fallback).
    const nextAssignee = await findNextAssignee(tx, household.id, members, outgoing);

    // STEP 4 — Compute boundaries. endDate of outgoing IS startDate of next
    //           (start of next local day, DST-safe via TZDate).
    const { nextStart, nextEnd, nextStatus, nextAssignedUserId } =
      nextAssignee
        ? computeNextCycle(outgoing, household, nextAssignee.userId)
        : paused(outgoing);

    // STEP 5 — Write next cycle (inside the same transaction).
    const nextCycle = await tx.cycle.create({
      data: {
        householdId,
        cycleNumber: outgoing.cycleNumber + 1,
        anchorDate: nextStart,
        cycleDuration: household.cycleDuration,
        startDate: nextStart,
        endDate: nextEnd,
        status: nextStatus,
        assignedUserId: nextAssignedUserId,
        memberOrderSnapshot: members.map((m) => ({
          userId: m.userId,
          rotationOrder: m.rotationOrder,
        })),
      },
    });

    // STEP 6 — Close outgoing cycle.
    await tx.cycle.update({
      where: { id: outgoing.id },
      data: {
        status: reason === "manual_skip" ? "skipped"
              : reason === "auto_skip_unavailable" ? "skipped"
              : reason === "member_left" ? "skipped"
              : "completed",
        transitionReason: reason,
      },
    });

    // STEP 7 — Emit notification for incoming assignee (dedupe via DB unique).
    if (nextAssignedUserId) {
      try {
        await tx.householdNotification.create({
          data: {
            householdId,
            recipientUserId: nextAssignedUserId,
            type: mapReasonToNotificationType(reason),
            cycleId: nextCycle.id,
          },
        });
      } catch (err) {
        // Prisma P2002 unique violation → idempotent retry; swallow.
        if (!isUniqueViolation(err)) throw err;
      }
    }

    return {
      transitioned: true,
      fromCycleNumber: outgoing.cycleNumber,
      toCycleNumber: nextCycle.cycleNumber,
      assignedUserId: nextAssignedUserId,
      status: nextStatus,
    };
  });
}
```

### Pattern 2: DST-Safe Cycle Boundary Computation (Pitfall 5 + 6 + D-02)

**What:** Compute "start of next local day in household timezone, converted to UTC" and "N days later" using `@date-fns/tz`. Adding days via TZDate preserves wall-clock time across DST boundaries — 24h local, not 24h UTC.

**When to use:** Cycle #1 creation (eager at household creation) and every cycle-end computation (inside `transitionCycle`).

**Example:**

```typescript
// src/features/household/cycle.ts
import { addDays, startOfDay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";

/**
 * Compute cycle #1 boundaries for a new household.
 * anchorDate = startDate = start of next local day in household timezone (as UTC).
 * endDate = anchorDate + cycleDuration days (wall-clock preserved across DST).
 *
 * Source: @date-fns/tz v1.4.1 docs — TZDate preserves zone through date-fns operations
 *   https://github.com/date-fns/tz  (verified 2026-04-17)
 * DST semantics: addDays(tzDate, 1) yields "same wall-clock time one day later" —
 *   24h UTC in a normal day, 23h UTC on spring-forward, 25h UTC on fall-back.
 */
export function computeInitialCycleBoundaries(
  now: Date,
  timezone: string,
  cycleDuration: number,
): { anchorDate: Date; startDate: Date; endDate: Date } {
  // `now` is a UTC Date. Construct a TZDate rooted in the household zone.
  const nowInZone = new TZDate(now.getTime(), timezone);

  // "Start of next local day" = startOfDay(addDays(now, 1)) in-zone.
  const tomorrowStartLocal = startOfDay(addDays(nowInZone, 1));

  // End = start + cycleDuration days, still wall-clock-preserving.
  const endLocal = addDays(tomorrowStartLocal, cycleDuration);

  // A TZDate's internal millis-since-epoch IS the UTC timestamp; Prisma
  // Timestamptz(3) columns store this directly. `new Date(tzDate.getTime())`
  // materializes a plain Date for Prisma.
  return {
    anchorDate: new Date(tomorrowStartLocal.getTime()),
    startDate: new Date(tomorrowStartLocal.getTime()),
    endDate: new Date(endLocal.getTime()),
  };
}

/**
 * Compute the next cycle from an outgoing cycle's endDate.
 * Next startDate = outgoing endDate (contiguous; no gap).
 */
export function computeNextCycleBoundaries(
  outgoingEndDate: Date,
  timezone: string,
  cycleDuration: number,
): { startDate: Date; endDate: Date } {
  const startInZone = new TZDate(outgoingEndDate.getTime(), timezone);
  const endInZone = addDays(startInZone, cycleDuration);
  return {
    startDate: new Date(startInZone.getTime()),
    endDate: new Date(endInZone.getTime()),
  };
}
```

**Alternative (equivalent) idiom using `in: tz(...)` context:**

```typescript
// Same result without TZDate wrapping:
import { addDays, startOfDay } from "date-fns";
import { tz } from "@date-fns/tz";

const ctx = { in: tz(timezone) };
const tomorrowStart = startOfDay(addDays(now, 1, ctx), ctx);
const end = addDays(tomorrowStart, cycleDuration, ctx);
```

Either works; TZDate is the explicit option and easier to inspect in debugger output. **Recommend TZDate for this codebase** — it makes the zone visible in test assertions.

### Pattern 3: Bearer-Auth Cron Route Handler (ROTA-04 + D-13)

**What:** Next.js 16 Route Handler in `src/app/api/cron/advance-cycles/route.ts` with `runtime = 'nodejs'`. POST handler reads `Authorization: Bearer <secret>`, plain-equality compares to `process.env.CRON_SECRET`, 401s on mismatch, otherwise calls `advanceAllHouseholds()`.

**When to use:** The one file — `/api/cron/advance-cycles/route.ts`. Do not genericize.

**Example:**

```typescript
// src/app/api/cron/advance-cycles/route.ts
import { NextRequest } from "next/server";
import { advanceAllHouseholds } from "@/features/household/cron";

// Node runtime is MANDATORY — Prisma is incompatible with edge.
// Source: CLAUDE.md "Stack Patterns" + D-20 file layout.
export const runtime = "nodejs";

// Do NOT cache — every invocation must re-evaluate.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // D-13: plain === compare; constant-time deferred.
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    // Log at warn level for monitoring
    console.warn("[cron] unauthorized", {
      ip: request.headers.get("x-forwarded-for"),
      ua: request.headers.get("user-agent"),
    });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await advanceAllHouseholds();
  return Response.json(result, { status: 200 });
}
```

### Pattern 4: Availability CRUD (D-06, D-07, D-09, D-14 7-step template)

**What:** `createAvailability` and `deleteAvailability` follow Phase 2 D-12's 7-step template with domain-specific additions (overlap check, dual-auth on delete).

**Example:**

```typescript
// src/features/household/actions.ts
import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { requireHouseholdAccess, ForbiddenError } from "./guards";
import { createAvailabilitySchema, deleteAvailabilitySchema } from "./schema";

export async function createAvailability(data: unknown) {
  // STEP 1 — session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // STEP 2 — demo guard
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  // STEP 3 — Zod parse (schema includes startDate >= today refinement per Pitfall 12)
  const parsed = createAvailabilitySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // STEP 4 — live household access check
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // STEP 5 — overlap check (Pitfall 11 + D-06)
  const overlap = await db.availability.findFirst({
    where: {
      userId: session.user.id,
      householdId: parsed.data.householdId,
      startDate: { lte: parsed.data.endDate },
      endDate: { gte: parsed.data.startDate },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlap) {
    return {
      error: `You already have an availability period covering those dates (${fmt(overlap.startDate)} → ${fmt(overlap.endDate)}). Delete it first, or pick non-overlapping dates.`,
    };
  }

  // STEP 6 — write
  await db.availability.create({
    data: {
      userId: session.user.id,
      householdId: parsed.data.householdId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason ?? null,
    },
  });

  // STEP 7 — revalidate (Phase 6 settings page will consume)
  revalidatePath(`/h/${parsed.data.householdSlug}/settings`);
  return { success: true };
}

export async function deleteAvailability(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = deleteAvailabilitySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Fetch first so we can authorize
  const row = await db.availability.findUnique({
    where: { id: parsed.data.availabilityId },
    select: { id: true, userId: true, householdId: true },
  });
  if (!row) return { error: "Not found." };

  try {
    const { role } = await requireHouseholdAccess(row.householdId);
    // D-09: owning member OR household owner
    if (row.userId !== session.user.id && role !== "OWNER") {
      throw new ForbiddenError("You can only delete your own availability.");
    }
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  await db.availability.delete({ where: { id: row.id } });
  revalidatePath(`/h/${parsed.data.householdSlug}/settings`);
  return { success: true };
}
```

### Anti-Patterns to Avoid

- **Splitting `transitionCycle` into separate `skipCycle` / `autoAdvanceCycle` / `leaveCycle` functions.** Pitfall 7 violation. Different callers pass different `reason` values to the *same* function.
- **Acquiring the lock before `db.$transaction`** (`await db.$queryRaw FOR UPDATE SKIP LOCKED` outside transaction). The lock is released the moment that raw query returns; subsequent `db.cycle.update` runs unlocked. MUST be `tx.$queryRaw` inside the `$transaction` callback.
- **Computing `endDate` as `addDays(startDate, cycleDuration)` on a raw UTC Date.** That adds 24h UTC, not 24h local — Pitfall 6. Must go through TZDate or `in: tz(...)` context.
- **Emitting the notification after `$transaction` returns.** Breaks the D-15 single-source-of-truth contract: if the outer call crashes between transaction commit and notification INSERT, the Cycle exists without its notification. Notification INSERT MUST be inside the same transaction.
- **`middleware.ts` instead of `proxy.ts` for anything.** Next.js 16 deprecated `middleware.ts`. Codebase already uses `proxy.ts`.
- **Reading `session.user.activeHouseholdId` for authorization.** Pitfall 16. Must call `requireHouseholdAccess` on the action's incoming `householdId` argument.
- **Using `date-fns-tz` (marnusw).** STATE.md explicit ban. Incompatible with date-fns v4.
- **Forgetting to update `proxy.ts` matcher.** Current matcher includes `/api/cron/*`; the route will be wrapped by NextAuth's `auth` middleware and the bearer check never runs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone-aware day arithmetic | Custom UTC-offset math, `date.setHours(0,0,0,0)` in-zone | `@date-fns/tz` `TZDate` + `date-fns` `addDays`/`startOfDay` | DST transitions (23h / 25h days), historical offset changes, timezone name aliasing — all handled by IANA tz database that `@date-fns/tz` reads. |
| Mutual exclusion on cycle row | JS-level mutex, Redis lock, application-level "active" flag with retry loop | Postgres `SELECT ... FOR UPDATE SKIP LOCKED` in `tx.$queryRaw` | The database is already a global lock authority. Skip-locked gives non-blocking semantics for free. Application-level locks don't survive process restarts. |
| Cron cadence | Next.js background job, `setInterval` in a long-lived process | cron-job.org → POST endpoint | Vercel serverless has no persistent processes; setInterval is discarded after each request. External cron is the only viable trigger. |
| Notification dedupe | Application-side "already sent?" lookup before INSERT | DB unique constraint + catch P2002 | Read-then-write has the same race problem as cycle transitions. Unique constraint is atomic. |
| Rotation formula | "Find next member by index + skip unavailable" with mutable state | Pure function `floor(daysSinceAnchor / cycleDuration) % memberCount` + pure `findNextAssignee(snapshot, availability) -> Member \| null` | Stateless, deterministic, trivially unit-testable. No database reads during computation. |
| Bearer token constant-time compare | `crypto.timingSafeEqual` (D-13 deferred) | Plain `===` per D-13 | Cron traffic is 24 req/day from a known origin; timing-attack surface is non-existent at this scale. If/when scale changes, swap in `timingSafeEqual`. |
| DST test scaffolding | Mocked `Date.now()` + synthetic zones | Real `@date-fns/tz` call against `America/New_York` across March + November 2026 transitions | TZDate reads the real IANA database; mocking it defeats the purpose of the test. |

**Key insight:** The rotation engine reads like a lot of logic but is almost entirely assembled from stock library primitives. The *glue* is the locked transaction and the TZDate math; everything else — notification dedupe, idempotency, cron cadence — is the database or an external service.

## Runtime State Inventory

Not applicable — Phase 3 is greenfield schema additions (one new column, one new model) and new code files. No renames, no migrations of existing data, no external services reconfigured. The one pre-existing consideration:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `Cycle.transitionReason` is a new nullable column; no backfill needed. `HouseholdNotification` is a new model. | None for Phase 3. Existing Cycle rows (if any from Phase 1/2 test runs) simply have `transitionReason = NULL`. |
| Live service config | `cron-job.org` job must be configured to hit `/api/cron/advance-cycles` hourly with `Authorization: Bearer $CRON_SECRET`. Not in git. | Phase 3 operational step: document in `.env.example` that CRON_SECRET must be set in Vercel env; provide cron-job.org configuration instructions as a separate runbook task. |
| OS-registered state | None. | None. |
| Secrets / env vars | `CRON_SECRET` is NEW — must be added to `.env.example` and Vercel env. | Planner: add env-var provisioning task. Verify `.env.example` and document in README. |
| Build artifacts | Prisma generated client regenerates from schema; no orphan artifacts. | None. |
| Pre-existing household rows lacking Cycle #1 | Expected count: **zero** (Phase 1 DB flush decision; Phase 2 UAT may have created test data without cycles — inventory at plan time). | Planner: task to query `SELECT COUNT(*) FROM "Household" h LEFT JOIN "Cycle" c ON c."householdId" = h.id WHERE c.id IS NULL;` as part of migration dry-run. If non-zero, ship a backfill SQL block with the migration. |

## Common Pitfalls

### Pitfall A: Cron-Proxy Collision (NOT in PITFALLS.md — discovered during research)

**What goes wrong:** `proxy.ts` currently uses `matcher: "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)"`. This regex excludes `/api/auth/*` but not `/api/cron/*`. Because `proxy.ts` re-exports NextAuth's `auth` middleware, requests to `/api/cron/advance-cycles` will be intercepted by the session middleware before the route handler runs. A cron-job.org POST with no session cookie gets redirected or 401-ed by NextAuth before our bearer-auth check executes.

**Why it happens:** The matcher was written for Phase 1/2 when no `/api/*` route existed outside `/api/auth/*`. It's a default "protect everything" posture that didn't anticipate service-to-service endpoints.

**How to avoid:** Phase 3 MUST update the `proxy.ts` matcher to also exclude `api/cron`:

```typescript
// proxy.ts
export { auth as proxy } from "./auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo).*)",
  ],
};
```

**Verify with:** Integration test that POSTs to `/api/cron/advance-cycles` without session cookie and with a valid bearer header — must return 200, not 401 from NextAuth. The task plan for the cron route handler MUST include "update proxy.ts matcher" as a line item; otherwise the feature ships broken.

**Warning signs:** Cron endpoint returns 302 redirect to `/login`, or returns 401 with NextAuth's error shape (not our `{ error: "unauthorized" }` shape).

### Pitfall B: Lock Acquired Outside Transaction (Pitfall 7 misreading)

**What goes wrong:** Developer reads Pitfall 7 and the Medium article, writes:

```typescript
const [locked] = await db.$queryRaw`SELECT ... FOR UPDATE SKIP LOCKED`;
await db.$transaction(async (tx) => {
  await tx.cycle.update({ where: { id: locked.id }, data: { ... } });
});
```

This is broken. The `FOR UPDATE SKIP LOCKED` lock is released when the `$queryRaw` call's implicit transaction commits (a single statement is auto-committed). The subsequent `$transaction` runs without any lock held. A concurrent request can still acquire the same row and produce a duplicate cycle.

**Why it happens:** `$queryRaw` outside a `$transaction` callback uses Prisma's connection pool — each call is its own connection/transaction. `FOR UPDATE` only persists for the duration of the transaction, which here is one statement.

**How to avoid:** The `$queryRaw` MUST be inside the `$transaction` callback and MUST use the `tx` parameter:

```typescript
await db.$transaction(async (tx) => {
  const [locked] = await tx.$queryRaw`SELECT ... FOR UPDATE SKIP LOCKED`;
  if (!locked) return; // another tx holds it
  await tx.cycle.update({ where: { id: locked.id }, data: { ... } });
  await tx.cycle.create({ data: { ... } });
});
```

**Verify with:** Concurrent-transition test (see Validation Architecture). Two parallel calls to `transitionCycle` against the same household MUST produce exactly one new active cycle, not two.

### Pitfall C: `addDays` on a Plain UTC Date Instead of TZDate (Pitfall 6)

**What goes wrong:** `addDays(new Date(), 7)` adds `7 * 86400 * 1000` milliseconds — exactly 7 × 24 hours of UTC time. For a household in `America/New_York` with a cycle crossing the March 2026 DST transition (March 8, 2026 at 02:00 local), that's 6 days 23 hours of local wall-clock — the cycle ends an hour early for the users. Over 52 weeks, a once-a-year DST skew accumulates into noticeable drift.

**Why it happens:** `date-fns` `addDays` operates on milliseconds since epoch. It's zone-unaware unless you pass the `in: tz(...)` context or operate on a `TZDate`.

**How to avoid:** Always wrap UTC dates in `TZDate` before arithmetic, or pass `{ in: tz(timezone) }` to every date-fns call:

```typescript
// WRONG
const end = addDays(startUtc, 7);

// RIGHT (TZDate form)
const endInZone = addDays(new TZDate(startUtc.getTime(), timezone), 7);
const end = new Date(endInZone.getTime());

// RIGHT (context form)
const end = addDays(startUtc, 7, { in: tz(timezone) });
```

**Verify with:** DST-boundary unit test (see Validation Architecture). Acceptance gate per PITFALLS.md §Pitfall 6.

### Pitfall D: `@@unique` Partial Match on Nullable cycleId (D-17 subtlety)

**What goes wrong:** `HouseholdNotification.cycleId` is nullable (per D-17 — `cycleId String?` because Phase 5 may eventually emit cycle-independent notifications). `@@unique([cycleId, recipientUserId, type])` in Postgres treats `NULL` as distinct from other NULLs — so two rows with `cycleId = NULL, recipientUserId = X, type = Y` are both inserted without violation. For Phase 3, every notification HAS a `cycleId` so this is not a runtime issue; but if Phase 5 or later starts writing `cycleId = null` notifications, the dedupe contract silently fails.

**Why it happens:** Postgres's `UNIQUE` constraint uses SQL-standard NULL semantics (`NULL ≠ NULL`) by default. Prisma's `@@unique` maps directly to Postgres's `UNIQUE INDEX`.

**How to avoid:** Phase 3 doesn't need to fix this (all Phase 3 notifications have a non-null `cycleId`). But document the contract: *"every Phase 3 notification row has a non-null cycleId; if Phase 5+ adds cycleId-less types, add a partial unique index or switch to `NULLS NOT DISTINCT` (Postgres 15+)."* Leave a comment in the Prisma schema + a note in STATE.md.

**Warning signs:** Phase 5+ introduces a notification type with `cycleId: null`; run a duplicate-insert test to detect.

### Pitfall E: Overlap Check Has Off-by-One on Same-Day Boundaries (D-06)

**What goes wrong:** User has availability "April 10 – April 15." They submit "April 15 – April 20." Depending on whether `startDate` / `endDate` are stored as zoned dates or UTC timestamps, the condition `startDate <= input.endDate AND endDate >= input.startDate` may consider April 15 both a start and an end of overlapping periods — either accepting contiguous-non-overlapping input or rejecting truly-overlapping input. The effect is either double-coverage (two rows both covering April 15) or unnecessary rejection (two rows that don't overlap flagged as overlap).

**Why it happens:** Availability dates are conceptually days (user intent: "April 10 through April 15"), but stored as Timestamptz — so midnight-on-April-16 may or may not count depending on how the UI sends the value.

**How to avoid:** Normalize all availability date inputs to `startOfDay(date, { in: tz(householdTimezone) })` before write. Store half-open intervals `[startDate, endDate)` — `endDate` is the exclusive "day after last unavailable day." Then the overlap check becomes unambiguous:

```typescript
// Two half-open intervals [a, b) and [c, d) overlap iff a < d AND c < b.
const overlap = await db.availability.findFirst({
  where: {
    userId,
    householdId,
    startDate: { lt: input.endDate },   // NOT lte
    endDate:   { gt: input.startDate }, // NOT gte
  },
});
```

**Decision required at plan time:** Clarify with user whether `endDate` is inclusive-last-day or exclusive-day-after. The D-06 language says `startDate: { lte: endDate }, endDate: { gte: startDate }` — that's closed-interval semantics. Recommend planner flag this for Phase 6 UI alignment (Phase 6 date-picker likely returns inclusive dates). For Phase 3, match D-06 literally (closed intervals) since it's the locked decision.

**Warning signs:** Two adjacent availability entries (one ends April 15, next starts April 16) reject as overlap; or one ending April 15 + one starting April 15 both accept (double-covering April 15).

## Code Examples

### Registering a User — Extended Transaction (D-01 extension of Phase 1 D-08)

```typescript
// src/features/auth/actions.ts (extended)
// Original lines 44–86 get one additional step inside the transaction.
await db.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email, passwordHash } });

  // ... existing slug loop, household create, member create (lines 56–88) ...

  // NEW (D-01): Cycle #1 eager creation.
  const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
    new Date(),
    detectedTimezone,
    7, // default cycleDuration
  );

  await tx.cycle.create({
    data: {
      householdId: household.id,
      cycleNumber: 1,
      anchorDate,
      cycleDuration: 7,
      startDate,
      endDate,
      status: "active",
      assignedUserId: user.id,
      memberOrderSnapshot: [{ userId: user.id, rotationOrder: 0 }],
    },
  });
});
```

### Cron Orchestrator — Sequential Per-Household Loop (D-11)

```typescript
// src/features/household/cron.ts
import { db } from "@/lib/db";
import { transitionCycle } from "./cycle";

export async function advanceAllHouseholds() {
  const now = new Date();
  const transitions: Array<{
    householdId: string;
    fromCycleNumber: number;
    toCycleNumber: number;
    reason: string;
    assignedUserId: string | null;
  }> = [];
  const errors: Array<{ householdId: string; message: string }> = [];

  // D-11: iterate households with active cycles past endDate OR paused cycles.
  const households = await db.household.findMany({
    where: {
      cycles: {
        some: {
          OR: [
            { status: "active", endDate: { lte: now } },
            { status: "paused" },
          ],
        },
      },
    },
    select: { id: true },
  });

  for (const h of households) {
    try {
      // transitionCycle decides reason internally: cycle_end vs paused_resumed vs
      // auto_skip_unavailable vs all_unavailable_fallback. Cron passes a hint
      // reason of "cycle_end" and the function may downgrade/upgrade as needed.
      const result = await transitionCycle(h.id, "cycle_end");
      if ("transitioned" in result) {
        transitions.push({
          householdId: h.id,
          fromCycleNumber: result.fromCycleNumber,
          toCycleNumber: result.toCycleNumber,
          reason: result.reason, // populated by transitionCycle
          assignedUserId: result.assignedUserId,
        });
      }
    } catch (err) {
      errors.push({
        householdId: h.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ranAt: now.toISOString(),
    totalHouseholds: households.length,
    transitions,
    errors,
  };
}
```

### Rotation Formula (ROTA-02 deterministic)

```typescript
// src/features/household/cycle.ts
export function computeAssigneeIndex(
  anchorDate: Date,
  now: Date,
  cycleDuration: number,
  memberCount: number,
): number {
  const daysSince = Math.floor(
    (now.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  // Pitfall 8 note: single-member household works naturally — floor(x) % 1 === 0.
  return Math.floor(daysSince / cycleDuration) % memberCount;
}
```

### `findNextAssignee` with Null-Return and Owner Fallback (Pitfall 8 + AVLB-05)

```typescript
// src/features/household/cycle.ts
type MemberWithAvailability = {
  userId: string;
  rotationOrder: number;
  role: string; // 'OWNER' | 'MEMBER'
};

export async function findNextAssignee(
  tx: PrismaTxClient,
  householdId: string,
  members: MemberWithAvailability[],
  outgoing: { memberOrderSnapshot: unknown; assignedUserId: string | null; endDate: Date },
): Promise<{ userId: string; fallback: boolean } | null> {
  // Step 1: find members unavailable on the next cycle's startDate
  const unavailableUserIds = await tx.availability.findMany({
    where: {
      householdId,
      startDate: { lte: outgoing.endDate },
      endDate:   { gte: outgoing.endDate },
    },
    select: { userId: true },
  }).then((rows) => new Set(rows.map((r) => r.userId)));

  // Step 2: walk rotation order from (current+1), skipping unavailable
  const sorted = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
  const currentIdx = sorted.findIndex((m) => m.userId === outgoing.assignedUserId);
  const startIdx = (currentIdx + 1) % sorted.length;

  for (let i = 0; i < sorted.length; i++) {
    const idx = (startIdx + i) % sorted.length;
    const candidate = sorted[idx];
    if (!unavailableUserIds.has(candidate.userId)) {
      return { userId: candidate.userId, fallback: false };
    }
  }

  // Step 3: all unavailable. AVLB-05 owner fallback.
  const owner = sorted.find((m) => m.role === "OWNER");
  if (owner && !unavailableUserIds.has(owner.userId)) {
    return { userId: owner.userId, fallback: true };
  }

  // Owner also unavailable → paused (caller creates paused cycle with null assignee).
  return null;
}
```

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Next.js 16 + TypeScript + Prisma 7 + PostgreSQL 17 — no negotiation.
- **Auth:** NextAuth v5 beta (`next-auth@beta`) — v4 is incompatible with App Router.
- **Zod v4 import path:** `import { z } from "zod/v4"`.
- **Tailwind v4 CSS-first config** — irrelevant to Phase 3 (no UI), but relevant if any test fixtures render.
- **`proxy.ts`, not `middleware.ts`** — Next.js 16 renamed; `middleware.ts` is deprecated.
- **`@@index` and `@@unique` explicit in schema** — no implicit FK-only indexes.
- **Cuid primary keys** (`@id @default(cuid())`) — pattern for `HouseholdNotification.id`.
- **`@db.Timestamptz(3)` on all DateTime columns** — apply to `HouseholdNotification.createdAt`.
- **Server Components read Prisma directly; Server Actions use Zod + Prisma writes** — applied throughout.
- **GSD workflow:** file edits gated through `/gsd-execute-phase` — research step does not edit code.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `date-fns-tz` (marnusw) `fromZonedTime`/`toZonedTime` | `@date-fns/tz` (kossnocorp) `TZDate` + `{ in: tz(...) }` context | date-fns v4 released Sep 2024 | PITFALLS.md §Pitfall 5 code example uses `date-fns-tz` — **ignore that snippet**; use `@date-fns/tz` API shown above. |
| `middleware.ts` | `proxy.ts` | Next.js 16 release (Oct 2025) | Already adopted in this codebase; Phase 3 does not reintroduce `middleware.ts`. |
| Prisma 5/6 Rust binary client | Prisma 7 Rust-free TypeScript client | Prisma 7 stable Nov 2025 | Faster cold starts; `tx.$queryRaw` API identical to v5/v6 — existing `FOR UPDATE SKIP LOCKED` patterns port unchanged. |
| Vercel Cron as default cron solution | External cron (cron-job.org) for this project | STATE.md decision 2026-04-16 | Single external cron owner simplifies ops reasoning; no Vercel-specific lock-in. |
| Application-level cycle lock (Redis, in-memory mutex) | Postgres `FOR UPDATE SKIP LOCKED` | v1 design | Database is already present and authoritative; no extra infra. |
| Notification de-dupe via app-level "already sent" lookup | DB `@@unique` + catch P2002 | This phase (D-19) | Atomic; survives race conditions. |

**Deprecated / outdated (do not use):**
- `date-fns-tz` (marnusw, archived) — superseded by `@date-fns/tz`.
- `middleware.ts` in Next.js 16 — renamed to `proxy.ts`.
- Prisma v4 fluent-client `SELECT FOR UPDATE` workarounds — `tx.$queryRaw` is the sanctioned path.
- Zod v3 `import { z } from "zod"` — use `zod/v4` in this project.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Data layer (`FOR UPDATE SKIP LOCKED` depends on it) | Expected ✓ (Phase 1 requirement) | 17.x | None — MySQL's SKIP LOCKED works too but project is committed to Postgres |
| Node.js | Route handler runtime | ✓ | >= 20 (Next.js 16 minimum) | None |
| `@date-fns/tz` | Cycle date math | Install required | 1.4.1 | None — STATE.md mandated |
| `cron-job.org` account | External cron trigger | External, not verifiable here | — | Manual POST via curl as emergency fallback |
| `CRON_SECRET` env var | Route handler bearer auth | Must be added | — | None — feature is non-functional without it |

**Missing dependencies that must be addressed in Phase 3 plans:**
- `npm install @date-fns/tz` — plan task
- `CRON_SECRET` in `.env.example` and Vercel env — plan task
- cron-job.org job configuration — runbook task (operational, not code)

**No blocking dependencies with no fallback.**

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 `[VERIFIED: package.json]` |
| Config file | `vitest.config.mts` (exists, uses jsdom + tsconfigPaths + react plugin) |
| Quick run command | `npm test -- tests/phase-03/` |
| Full suite command | `npm test` |
| Integration test pattern | `npm test tests/household-integration.test.ts` — already established; mocks only `auth()`, uses real Prisma. Phase 3 adds similar real-DB tests for `transitionCycle`. |

### Invariant Taxonomy

| Invariant | Layer | Enforcement | Verified By |
|-----------|-------|-------------|-------------|
| Exactly one active Cycle per household at any moment | Type + DB + Runtime | `@@unique([householdId, cycleNumber])` (exists) + `FOR UPDATE SKIP LOCKED` in transition | Concurrent-transition test (Postgres required) |
| `transitionReason` is set iff `status != 'active'` | Runtime | Application logic in `transitionCycle` | Unit test on outgoing-cycle write |
| Cycle boundaries are DST-safe (wall-clock-preserving) | Library (@date-fns/tz) | `TZDate` + `addDays` | **DST-boundary unit test (binding acceptance gate — Pitfall 6)** |
| `findNextAssignee` returns null when no eligible member + no owner-fallback | Type | TS return type `{ userId: string; fallback: boolean } \| null` | Unit test: all-unavailable household |
| Availability `startDate >= today` | Zod refinement | `src/features/household/schema.ts` `.refine(...)` | Unit test: past-date rejection |
| Availability periods do not overlap per-user-per-household | App-level (Pitfall 11) | Pre-insert `findFirst` in `createAvailability` | Unit test: overlap rejection (multiple scenarios) |
| One notification per (cycleId, recipientUserId, type) | DB constraint | `@@unique([cycleId, recipientUserId, type])` | Integration test: retry emits no duplicate |
| Cron endpoint rejects unauthenticated requests | Runtime | Plain `===` bearer compare | Unit test: missing header, wrong secret, right secret |
| Cron endpoint not intercepted by proxy.ts | Runtime | `proxy.ts` matcher update | Integration test: POST with bearer header + no session cookie → 200, not 401 redirect |
| Notification INSERT is in same transaction as Cycle writes | Runtime | Single `$transaction` callback | Integration test: force Cycle write failure, assert notification also absent |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROTA-02 | Rotation formula deterministic | unit | `npm test tests/phase-03/rotation-formula.test.ts` | Wave 0 |
| ROTA-03 | cycleDuration change applies at next boundary (not mid-cycle) | unit | `npm test tests/phase-03/rotation-formula.test.ts` | Wave 0 |
| ROTA-04 | `/api/cron/advance-cycles` bearer auth + JSON summary | integration | `npm test tests/phase-03/cron-endpoint.test.ts` | Wave 0 |
| ROTA-05 | Timezone-aware cycle end | unit | `npm test tests/phase-03/cycle-boundaries.test.ts` | Wave 0 |
| ROTA-06 | Race-safe transition | integration (real PG) | `npm test tests/phase-03/transition-concurrency.test.ts` | Wave 0 |
| ROTA-06 | DST-safe 7-day cycle (March + November NY) | unit | `npm test tests/phase-03/dst-boundary.test.ts` | Wave 0 **BINDING GATE** |
| ROTA-07 | Mid-cycle membership change doesn't retro-change assignee | integration | `npm test tests/phase-03/rotation-formula.test.ts` | Wave 0 |
| AVLB-01 | Create availability (success + past-date rejection) | unit | `npm test tests/phase-03/availability-create.test.ts` | Wave 0 |
| AVLB-02 | Delete availability + dual-auth | unit | `npm test tests/phase-03/availability-delete.test.ts` | Wave 0 |
| AVLB-02 | Overlap rejection with specific conflict message | unit | `npm test tests/phase-03/availability-create.test.ts` | Wave 0 |
| AVLB-03 | Auto-skip unavailable member | integration (real PG) | `npm test tests/phase-03/transition-auto-skip.test.ts` | Wave 0 |
| AVLB-04 | Manual skip | integration (real PG) | `npm test tests/phase-03/transition-manual-skip.test.ts` | Wave 0 |
| AVLB-05 | All-unavailable fallback to owner | integration (real PG) | `npm test tests/phase-03/transition-fallback.test.ts` | Wave 0 |
| AVLB-05 | All-unavailable including owner → paused | integration (real PG) | `npm test tests/phase-03/transition-paused.test.ts` | Wave 0 |
| D-05 | Cron resumes paused cycle | integration (real PG) | `npm test tests/phase-03/transition-paused-resume.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test tests/phase-03/` (targeted)
- **Per wave merge:** `npm test` (full suite — catches regressions in Phases 1–2 query/action tests)
- **Phase gate:** Full suite green + DST-boundary test passing + concurrent-transition test passing before `/gsd-verify-work`

### Wave 0 Gaps

All test files are new. Phase 3 plan must include a Wave 0 task creating:

- [ ] `tests/phase-03/` directory with shared `fixtures.ts`
- [ ] `tests/phase-03/rotation-formula.test.ts` — pure-function rotation math
- [ ] `tests/phase-03/cycle-boundaries.test.ts` — timezone-aware boundaries (NY, Tokyo, UTC)
- [ ] `tests/phase-03/dst-boundary.test.ts` — **binding acceptance gate** — March 2026 + November 2026 NY transitions
- [ ] `tests/phase-03/cron-endpoint.test.ts` — route handler auth + response shape
- [ ] `tests/phase-03/transition-concurrency.test.ts` — real PG, two parallel `transitionCycle` calls
- [ ] `tests/phase-03/transition-auto-skip.test.ts` — real PG
- [ ] `tests/phase-03/transition-manual-skip.test.ts` — real PG
- [ ] `tests/phase-03/transition-fallback.test.ts` — real PG
- [ ] `tests/phase-03/transition-paused.test.ts` — real PG
- [ ] `tests/phase-03/transition-paused-resume.test.ts` — real PG
- [ ] `tests/phase-03/availability-create.test.ts` — mocked Prisma
- [ ] `tests/phase-03/availability-delete.test.ts` — mocked Prisma

**Concurrency-test implementation note:** Simulating two concurrent `transitionCycle` calls requires real Postgres — `pg-mem` does not support `FOR UPDATE SKIP LOCKED`. Use the same pattern as `tests/household-integration.test.ts` (real DB, namespaced emails, `afterAll` cleanup). Trigger concurrency with `Promise.all([transitionCycle(id, 'manual_skip'), transitionCycle(id, 'manual_skip')])` — exactly one should return `{ transitioned: true }`, the other `{ skipped: true }`.

**DST-test implementation note:** Use `new TZDate(new Date('2026-03-08T06:00:00Z').getTime(), 'America/New_York')` as the anchor, add 7 days, assert resulting UTC Date is exactly 23 hours short of 7 × 24h = 168h — i.e., 145h × 3600 × 1000 + 6h offset from next day's midnight. The test must not mock `@date-fns/tz` — it must exercise the real IANA database.

## Cross-Phase Integration Surface

**These symbols must be exported by Phase 3 and remain stable across Phase 4/5/6:**

| Export | Signature | Consumer | Why Locked Now |
|--------|-----------|----------|----------------|
| `transitionCycle(householdId: string, reason: TransitionReason): Promise<TransitionResult>` | `src/features/household/cycle.ts` | Phase 4 `leaveHousehold` (Pitfall 9) | One function, one write path — adding a new caller must not break the signature |
| `getCurrentCycle(householdId: string): Promise<Cycle \| null>` | `src/features/household/queries.ts` | Phase 6 dashboard cycle banner | Dashboard Server Component signature |
| `getHouseholdAvailabilities(householdId: string): Promise<Array<Availability & { user: { name: string } }>>` | `src/features/household/queries.ts` | Phase 6 settings availability list | D-08 shape |
| `createAvailability(data: unknown): Promise<ActionResult>` | `src/features/household/actions.ts` | Phase 6 settings form | Hidden-field `householdId` pattern (Phase 2 D-04) |
| `deleteAvailability(data: unknown): Promise<ActionResult>` | `src/features/household/actions.ts` | Phase 6 settings delete button | D-09 dual-auth |
| `skipCurrentCycle(data: unknown): Promise<ActionResult>` | `src/features/household/actions.ts` | Phase 6 dashboard skip button | D-14 7-step |
| `HouseholdNotification` model | `prisma/schema.prisma` | Phase 5 notification bell query | Rows written by Phase 3; Phase 5 only reads + renders |
| `TRANSITION_REASONS` constant / Zod enum | `src/features/household/constants.ts` or `schema.ts` | Phase 4 (calls `transitionCycle`) | Reason domain must be the same string set across callers |
| `NOTIFICATION_TYPES` constant / Zod enum | `src/features/household/constants.ts` or `schema.ts` | Phase 5 styling by type | D-18 domain |

**Non-exports (Phase 3 internal):** `findNextAssignee`, `computeAssigneeIndex`, `computeInitialCycleBoundaries`, `computeNextCycleBoundaries`, `advanceAllHouseholds`, `isMemberUnavailableOn`, `mapReasonToNotificationType`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@date-fns/tz` `TZDate` + `addDays` preserves wall-clock time across DST (24h local, not 24h UTC) | Pattern 2; Pitfall C | Cycle endpoints drift by ±1 hour across DST; DST-boundary test will catch. Low risk because this is the documented behavior of TZDate in the v4.0 release blog, but official docs are not fully explicit about `addDays` specifically — DST-boundary test will surface empirically. `[VERIFIED via WebSearch cross-reference; DeepWiki date-fns confirms "Addition functions preserve wall-clock time across DST transitions"]` |
| A2 | cron-job.org POSTs with empty body (no JSON payload) | Pattern 3 | If cron-job.org sends a body, `request.json()` will fail silently — our handler doesn't call `request.json()`, so no risk. cron-job.org does allow configuring a body, but the plan should default to none. `[ASSUMED]` |
| A3 | Prisma 7's `tx.$queryRaw` inside `$transaction` holds the `FOR UPDATE SKIP LOCKED` lock for the transaction's duration | Pattern 1 | If the raw query runs on a different connection than the transaction, the lock is useless. Prisma's `tx.*` methods are documented to share the transaction's connection, and this is verifiable via EXPLAIN/lock-inspection in the concurrency test. `[CITED: Prisma docs — $transaction interactive mode uses a single connection for all tx.* calls]` |
| A4 | Postgres default `READ COMMITTED` isolation is sufficient for `FOR UPDATE SKIP LOCKED` pattern | Pattern 1; Pitfall B | `FOR UPDATE SKIP LOCKED` does not require Serializable; Read Committed is fine because the lock blocks other writers. Verified in the Prisma docs transaction page. `[CITED: prisma.io docs/orm/prisma-client/queries/transactions — PostgreSQL default is ReadCommitted]` |
| A5 | `proxy.ts` currently intercepts `/api/cron/*` | Pitfall A | If this is wrong (matcher was updated elsewhere and I missed it), the "update proxy.ts matcher" task is unnecessary but harmless. `[VERIFIED: read proxy.ts contents — matcher excludes api/auth only, not api/cron]` |
| A6 | Nullable `cycleId` + `@@unique` has NULL-distinct semantics | Pitfall D | Not Phase 3-breaking (all Phase 3 writes have non-null cycleId); flagged for Phase 5+. `[CITED: Postgres SQL standard — NULL ≠ NULL in UNIQUE constraints; use NULLS NOT DISTINCT in PG 15+ to change]` |
| A7 | Phase 2 test tooling (real-DB integration pattern in `tests/household-integration.test.ts`) is suitable for Phase 3 concurrency tests | Validation Architecture | If the test DB is shared with dev data, race-condition tests may be flaky; recommend a dedicated test DB URL or aggressive cleanup. `[VERIFIED: existing test uses real Prisma with afterAll cleanup]` |
| A8 | There are zero pre-existing households lacking Cycle #1 at Phase 3 deploy time | Runtime State Inventory | If non-zero, migration needs a backfill SQL block. Plan-time inventory task addresses this. `[ASSUMED — based on Phase 1 DB flush decision + Phase 2 UAT test-data uncertainty]` |

**User confirmations recommended before execution:**
- A1 (DST wall-clock preservation) — the DST-boundary test will verify empirically during implementation; no user input needed pre-planning.
- A2 (cron-job.org empty body) — confirm cron-job.org job will be configured without a body.
- A8 (zero pre-existing Cycle-less households) — run the inventory query during Wave 1 of plan execution.

## Open Questions (RESOLVED)

1. **How is `Cycle.transitionReason` populated on the initial Cycle #1 write?**
   - What we know: Cycle #1 is created "fresh" (no prior cycle to transition from). `transitionReason` is set on the *outgoing* cycle at the moment its status flips.
   - What's unclear: Does Cycle #1 have `transitionReason = null` forever (since it never has an outgoing-cycle predecessor)? Presumed yes.
   - RESOLVED: Leave `transitionReason` as nullable; Cycle #1 and any cycle that is still `active` have `transitionReason = NULL`. Planner should document this invariant in `cycle.ts` JSDoc.

2. **Exact half-open vs closed-interval semantics for Availability dates (Pitfall E).**
   - What we know: D-06 wording implies closed intervals (`startDate: { lte: endDate }, endDate: { gte: startDate }`).
   - What's unclear: Phase 6 UI date-picker returns typically-inclusive dates, but timestamps stored as Timestamptz lose the "day" abstraction.
   - RESOLVED: Plan a small decision task at phase-kickoff to confirm closed-interval semantics, then normalize all incoming dates to `startOfDay(..., { in: tz(timezone) })` on write. This preserves the D-06 operators unchanged.

3. **cron-job.org configuration — which environment gets the cron?**
   - What we know: Phase 3 ships `CRON_SECRET` env var. Vercel preview deployments typically don't run cron against test data.
   - What's unclear: Is there a production-only / staging-only gate on which deployments the cron hits?
   - RESOLVED: Planner task — document that `cron-job.org` is pointed at prod URL only; preview/dev envs have the endpoint but no scheduled invocation.

4. **When should the migration for `Cycle.transitionReason` ship?**
   - What we know: The column is needed to write new cycles; the `HouseholdNotification` model is needed to emit notifications.
   - What's unclear: Phase 1 DB flush decision means zero existing Cycle rows — migration is a simple `ADD COLUMN NULL`. But `HouseholdNotification` back-relations on User/Household/Cycle are breaking changes to three models.
   - RESOLVED: Single migration bundling both. Plan Wave 1. Test with `prisma migrate reset` on dev DB before committing.

5. **Audit column `skippedByUserId` on Cycle — include or defer?**
   - What we know: Claude's Discretion says "nice-to-have; add if easy."
   - What's unclear: Adding it now vs later has the same migration cost; the question is whether any Phase 3 test relies on it.
   - RESOLVED: **Include now.** Write it on the outgoing cycle during `manual_skip` and `member_left` transitions. Zero incremental cost, clean audit trail for Phase 5 notification rendering ("Alice skipped — you're up" needs to know `skippedByUserId`).

6. **Rotation order of `OWNER` in `memberOrderSnapshot`.**
   - What we know: D-02 sets owner at `rotationOrder: 0`. Phase 6 will add reorder UI.
   - What's unclear: If owner is not at rotationOrder 0 at transition time (Phase 6 reorder moved them), does fallback path still recognize them?
   - RESOLVED: `findNextAssignee` detects owner by `role === 'OWNER'`, not by rotationOrder. Pattern above already shows this.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Route handler: bearer token in env var; Server Actions: NextAuth session via `auth()` |
| V3 Session Management | yes | Phase 2 D-04 `requireHouseholdAccess` live check on every action; stale JWT handled by Phase 2 |
| V4 Access Control | yes | `requireHouseholdAccess` in 3 actions; `deleteAvailability` dual-auth (owning member OR OWNER role); cron bypasses session — bearer only |
| V5 Input Validation | yes | Zod v4 `createAvailabilitySchema`, `deleteAvailabilitySchema`, `skipCurrentCycleSchema`; `startDate >= today` refinement |
| V6 Cryptography | yes (minor) | `CRON_SECRET` must be >= 32 bytes random (use `crypto.randomBytes(32).toString('hex')` to generate); stored as env var, never logged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Timing attack on bearer compare | Information Disclosure | **Deferred by D-13** — traffic volume doesn't justify. Revisit if cron frequency exceeds 10 req/min. |
| Cross-household cycle mutation | Elevation of Privilege | `requireHouseholdAccess` on every action (Phase 2 pattern); `transitionCycle` is internal, called only from authenticated paths |
| Notification row stuffing (create arbitrary `HouseholdNotification` for another user) | Information Disclosure | `HouseholdNotification` is never directly mutable from user input; only written inside `transitionCycle`. No public action creates rows. |
| Past-dated availability → retroactive cycle rewrite | Tampering | Pitfall 12 Zod refinement (`startDate >= today`) blocks at Server Action boundary |
| Cron endpoint DDoS | Availability | Vercel serverless rate limits; bearer auth rejects unauthorized calls with 401 before any DB work |
| Race-to-create-two-active-cycles | Tampering / Integrity | `FOR UPDATE SKIP LOCKED` + `@@unique([householdId, cycleNumber])` as backstop |
| Skip-cycle-as-non-assignee | Elevation of Privilege | D-14 step 5: assert `session.user.id === currentCycle.assignedUserId` before transition |
| Availability-delete-as-other-user | Elevation of Privilege | D-09 dual-auth: `member.userId === row.userId \|\| role === 'OWNER'` |
| Demo-user skip / create-availability | Tampering | D-14 / createAvailability step 2 demo guard (already established pattern) |

### Env Var Handling

- `CRON_SECRET` added to `.env.example` (documented) but value is `changeme-prod-only` placeholder; real value set in Vercel dashboard only.
- Never logged in `console.log` or error responses.
- Route handler returns generic `{ error: "unauthorized" }` — no hint about expected format (D-13).

## Sources

### Primary (HIGH confidence)

- Next.js 16 Route Handlers official docs — `runtime = 'nodejs'`, POST signature, header reading, Response.json. [nextjs.org/docs/app/api-reference/file-conventions/route](https://nextjs.org/docs/app/api-reference/file-conventions/route) (fetched 2026-04-17, version 16.2.4)
- Prisma Transactions docs — interactive-mode `$transaction`, `tx.*` methods, isolation levels. [prisma.io/docs/orm/prisma-client/queries/transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) (fetched 2026-04-17)
- `@date-fns/tz` GitHub README — TZDate constructor, `tz()` context, date-fns v4 integration. [github.com/date-fns/tz](https://github.com/date-fns/tz) (fetched 2026-04-17, confirmed v1.4.1 from npm)
- `package.json` (this repo) — pinned versions of `date-fns@^4.1.0`, `@prisma/client@^7.7.0`, `zod@^4.3.6`, `next@^16.2.2`, `vitest@^4.1.4`, `@playwright/test@^1.59.1`
- `proxy.ts` (this repo) — current matcher is `/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)` — verified by reading the file
- `prisma/schema.prisma` (this repo) — `Cycle`, `Availability`, `Household`, `HouseholdMember`, `User` models with existing indexes and relations
- `src/features/household/guards.ts` + `actions.ts` + `queries.ts` + `schema.ts` (this repo) — Phase 2 patterns that Phase 3 extends
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` — 20 locked decisions
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` — D-12 7-step template

### Secondary (MEDIUM confidence)

- "10 Prisma Transaction Patterns That Avoid Deadlocks" (Hash Block, Medium) — `FOR UPDATE SKIP LOCKED` pattern with Prisma; verified against Prisma's own `$queryRaw` docs. [medium.com/@connect.hashblock/10-prisma-transaction-patterns-that-avoid-deadlocks-4f52a174760b](https://medium.com/@connect.hashblock/10-prisma-transaction-patterns-that-avoid-deadlocks-4f52a174760b)
- date-fns v4.0 release blog — TZDate + `tz()` context option introduction. [blog.date-fns.org/v40-with-time-zone-support/](https://blog.date-fns.org/v40-with-time-zone-support/)
- DeepWiki date-fns time-zone support page — reinforces wall-clock preservation claim for TZDate + date-fns arithmetic. [deepwiki.com/date-fns/date-fns/3-time-zone-support](https://deepwiki.com/date-fns/date-fns/3-time-zone-support)
- Prisma GitHub issue #17136 (row-locking support in find-*) and #5983 (FOR UPDATE SKIP LOCKED) — open feature requests; confirm `$queryRaw` is the sanctioned workaround

### Tertiary (LOW confidence — flagged)

- Prisma discussion #21335 — "multi-statement $queryRaw fails" warning; used for pitfall B documentation. Confirmed mechanism; no full corrective code shown.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — all versions verified against npm registry 2026-04-17; `@date-fns/tz` is the documented date-fns v4 companion.
- Architecture patterns: **HIGH** — patterns 1–4 are combinations of verified primitives; the transitional edge cases (owner fallback, paused resume) are already specified in CONTEXT.md decisions.
- DST semantics: **MEDIUM-HIGH** — the claim that TZDate + addDays preserves wall-clock time is well-supported across three sources (TZDate README, DeepWiki, date-fns blog); the canonical corner case (March / November NY) is not explicitly worked in the docs but is straightforward to verify in test (binding acceptance gate).
- Prisma 7 `tx.$queryRaw` with FOR UPDATE SKIP LOCKED: **HIGH** — `$queryRaw` inside `$transaction` is standard Prisma; the lock pattern is Postgres-native. The only caveat (Pitfall B) is a misreading risk, not a library limitation.
- proxy.ts cron-collision finding: **HIGH** — verified by reading the file.
- Concurrency test viability: **MEDIUM** — requires real Postgres and careful test isolation; `pg-mem` won't work. Pattern from Phase 2's `tests/household-integration.test.ts` carries over.
- Validation architecture (Nyquist): **HIGH** — every acceptance invariant has an identified enforcement layer and test path.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stack is stable; key libraries have release cadence of months, not weeks)
