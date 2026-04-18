# Phase 3: Rotation Engine + Availability - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Workstream:** `household`

<domain>
## Phase Boundary

Deliver the deterministic, timezone-aware, race-safe cycle engine; the `/api/cron/advance-cycles` endpoint; availability period CRUD (actions + queries only, no UI); the `skipCurrentCycle` Server Action; and the all-members-unavailable owner-fallback path. Every cycle transition — natural boundary, manual skip, auto-skip of an unavailable assignee, member-leave, all-unavailable fallback, paused resume — runs through one transition function and writes a `HouseholdNotification` row for the incoming assignee in the same transaction. Ship the `HouseholdNotification` Prisma model bare-minimum this phase; Phase 5 extends it with read state + render.

**Explicitly not in this phase:** any UI surface (dashboard cycle banner, skip button, availability form, fallback banner, rotation reorder, settings page — all Phase 6). Notification rendering, `NotificationBell` update, passive household-status banner for non-assignees, `readAt` / payload detail on `HouseholdNotification` — all Phase 5. Invitation/member-join/leave flows — Phase 4, except that the cycle engine's transition function must be callable from Phase 4's `leaveHousehold` action (Pitfall 9). Demo-household seed — Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Cycle lifecycle — bootstrap

- **D-01:** Cycle #1 is created **eagerly at household creation**, inside the same `db.$transaction` as the `Household` row and the owner's `HouseholdMember` row. Two write sites require amendment this phase:
  1. `src/features/auth/actions.ts` `registerUser` — the signup transaction already creates Household + owner HouseholdMember (Phase 1 D-08); append Cycle #1 creation to that transaction.
  2. `src/features/household/actions.ts` `createHousehold` (Phase 2 D-06) — same amendment.

  Every household always has an active `Cycle`; no code path anywhere has to handle the "household without a cycle" state. No-plant households and single-member households are edge cases for the rendering layer, not the engine — cycles are orthogonal to plants; a single-member household's assignee is always that sole member via `floor(daysSinceAnchor / cycleDuration) % 1 === 0` (Pitfall 8 confirmed).
- **D-02:** Cycle #1 `anchorDate` = **start of the next local day in the household's timezone**, converted to UTC. Computed via `@date-fns/tz` `TZDate` — e.g., `fromZonedTime(startOfDay(addDays(now, 1)), household.timezone)`. `startDate === anchorDate`; `endDate = anchorDate + cycleDuration days` using TZDate addition (Pitfall 6 — DST-safe). `cycleNumber = 1`. `status = 'active'`. `assignedUserId = ownerUserId` (the only member at creation). `memberOrderSnapshot = [{ userId: ownerUserId, rotationOrder: 0 }]`.

### Cycle lifecycle — status transitions

- **D-03:** Cycle `status` state machine (the `status` column already exists per Phase 1 schema):
  - `active` — current cycle; exactly one per household at any moment (enforced by `@@unique([householdId, cycleNumber])` + the transition function's `FOR UPDATE SKIP LOCKED` lock on the outgoing row).
  - `completed` — natural boundary reached; transition wrote the next cycle.
  - `skipped` — manual skip or auto-skip via unavailability; transition wrote the next cycle.
  - `paused` — `findNextAssignee` returned `null` AND the owner-fallback path did not apply (see D-20 reconciliation); no successor cycle exists yet. Cron re-evaluates every tick (D-05).

  Transitions are **write the next Cycle row first inside the transaction**, then mark the outgoing row closed with `status` and `transitionReason`. Single write path; all callers (cron, `skipCurrentCycle`, `leaveHousehold` from Phase 4) go through it.

- **D-04:** **`transitionReason` column added to `Cycle` this phase** (migration ships with Phase 3). Nullable string column (not a Prisma enum — matches the existing `status` string convention in `Cycle`). Set on the outgoing cycle at the moment its `status` flips. Value domain:
  - `cycle_end` — natural boundary, next assignee found normally
  - `manual_skip` — active assignee invoked `skipCurrentCycle`
  - `auto_skip_unavailable` — cron saw the scheduled next assignee was inside an availability period and stepped past them
  - `member_left` — active assignee left the household (called from Phase 4)
  - `all_unavailable_fallback` — every rotation-order member is unavailable; outgoing cycle closes, new cycle opens with the owner as assignee (AVLB-05)
  - `paused_resumed` — a previously `paused` cycle leaves the paused state because someone became available

- **D-05:** **Paused cycle resumes via cron re-evaluation.** Every hourly cron tick iterates paused cycles alongside active-ready-to-transition cycles. For a paused cycle: call `findNextAssignee` against the current availability state; if any member is eligible, run the standard transition (write a new `active` cycle, mark the paused cycle closed with `transitionReason = 'paused_resumed'`). No user-facing "resume rotation" action; no action-side trigger on availability delete. Cron is the single source of forward motion for paused households.

### Availability rules

- **D-06:** **Overlap handling = reject** (Pitfall 11). `createAvailability` Server Action performs a pre-insert query: `db.availability.findFirst({ where: { userId, householdId, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } } })`. If a row is returned, reject with a user-facing message identifying the conflicting period: `"You already have an availability period covering those dates (<existingStart> → <existingEnd>). Delete it first, or pick non-overlapping dates."`. No silent merge. `startDate >= today` rejection (Pitfall 12) is a separate Zod refinement applied before the overlap check.

- **D-07:** **Availability is delete-only, never editable.** Actions shipped: `createAvailability`, `deleteAvailability`. No `updateAvailability`. Matches AVLB-02 literally and keeps the action surface minimal. Phase 6's settings UI will render existing periods as rows with a delete button and a separate "Add period" form.

- **D-08:** **All household members can VIEW all members' availability.** `getHouseholdAvailabilities(householdId)` returns every availability row for the household, joined with `user.name` (or display name — Phase 2's established user-name shape). Reasoning for rotation skips has to be legible to roommates — opacity breeds friction. Consumer: Phase 6 settings page.

- **D-09:** **Delete authority = owning member OR household owner.** `deleteAvailability(availabilityId)` fetches the row, runs `requireHouseholdAccess(row.householdId)` to get `{ member, role }`, then authorizes if `member.userId === row.userId || role === 'OWNER'`. Otherwise throws `ForbiddenError`. Owner override is narrow but valuable for stale entries after a member leaves or forgets.

### Cron endpoint — `/api/cron/advance-cycles`

- **D-10:** **Cron cadence is hourly.** `cron-job.org` is configured to hit the endpoint at the top of every hour (24 invocations/day). Bounded worst-case transition lag ≈ 1 hour past a household's local midnight. Idempotency makes no-op ticks safe. Vercel Cron is explicitly NOT used (STATE.md decision — single external cron owner).

- **D-11:** **Endpoint iterates households sequentially.** A `for` loop over households that either have `status = 'active'` cycles with `endDate <= now` OR have `status = 'paused'` cycles. Each household gets its own `db.$transaction` wrapping a `SELECT ... FOR UPDATE SKIP LOCKED` on the outgoing cycle (Pitfall 7 verbatim). A thrown exception inside one household's transaction is caught, recorded in the response `errors` array, and the loop continues — one bad household never blocks others. No `Promise.all` parallelization; premature optimization at v1 scale.

- **D-12:** **Response shape (200 JSON):**
  ```json
  {
    "ranAt": "2026-04-17T14:00:00.123Z",
    "totalHouseholds": 12,
    "transitions": [
      {
        "householdId": "clx…",
        "fromCycleNumber": 3,
        "toCycleNumber": 4,
        "reason": "cycle_end",
        "assignedUserId": "clu…"
      }
    ],
    "errors": [
      { "householdId": "clx…", "message": "..." }
    ]
  }
  ```
  Observable for regression detection. Size stays trivial at expected scale.

- **D-13:** **Auth failure = 401 with generic body.** Missing or mismatched `Authorization: Bearer $CRON_SECRET` header → respond `401` with `{ "error": "unauthorized" }`. No hint about expected format. Log attempt at warn level with IP + user-agent. Plain `===` compare on the secret; constant-time compare deferred (traffic volume doesn't justify).

### Manual skip

- **D-14:** **`skipCurrentCycle(householdId)` ships in Phase 3.** Lives in `src/features/household/actions.ts` (D-19 folder decision). Action steps follow Phase 2 D-12's 7-step template:
  1. `auth()` — reject if no session
  2. Demo-mode guard — `if (session.user.isDemo) return { error }`
  3. Zod parse — schema just validates `householdId` cuid
  4. `await requireHouseholdAccess(householdId)` — throws `ForbiddenError` on non-member
  5. Load current cycle; assert `session.user.id === currentCycle.assignedUserId` — throw `ForbiddenError` if not the active assignee
  6. Call the shared transition function with `reason: 'manual_skip'` (same function cron uses)
  7. `revalidatePath(\`/h/\${slug}/dashboard\`)`

  Phase 6 adds the dashboard button; action already exists.

### Notification boundary

- **D-15:** **Phase 3 emits `HouseholdNotification` rows; Phase 5 renders.** Every cycle transition writes one notification row for the incoming assignee **inside the same `db.$transaction`** as the `Cycle` writes. Single source of truth — notifications always match audited transitions; no read-time derivation, no drift.

- **D-16:** **Recipient = new assignee only.** One row per transition. The previous assignee's "banner clears" behavior (HNTF-03) is derived at read time in Phase 5 by querying the current active cycle's `assignedUserId` — no explicit "you are no longer responsible" row is written. The non-assignee passive status banner (HNTF-04) is also a read-time derivation over the current `Cycle` row, not stored.

- **D-17:** **`HouseholdNotification` Prisma model added this phase (bare-minimum).** Was NOT in Phase 1's five new models. Shape:
  ```prisma
  model HouseholdNotification {
    id              String    @id @default(cuid())
    householdId     String
    household       Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
    recipientUserId String
    recipient       User      @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)
    type            String    // see D-18
    cycleId         String?
    cycle           Cycle?    @relation(fields: [cycleId], references: [id], onDelete: SetNull)
    createdAt       DateTime  @default(now()) @db.Timestamptz(3)

    @@unique([cycleId, recipientUserId, type])
    @@index([recipientUserId, createdAt])
  }
  ```
  Phase 5 extends with `readAt`, `payload Json?`, dismissal columns, and any render-side indexes. Also requires `Household notifications` / `User notifications` back-relations on those models.

- **D-18:** **Notification `type` enum (granular per trigger)** — string values, Zod-validated at write sites:
  - `cycle_started` — normal `cycle_end` transition wrote a new active cycle (used for both natural boundary AND `paused_resumed` — reuse, no separate "resumed" render)
  - `cycle_reassigned_manual_skip` — prior assignee used the skip action
  - `cycle_reassigned_auto_skip` — cron stepped past an unavailable member
  - `cycle_reassigned_member_left` — prior assignee left the household (emitted from Phase 4's leave path, which calls our transition function)
  - `cycle_fallback_owner` — all-unavailable fallback landed the owner as assignee
  Phase 5 styles each type differently (e.g., "Alice skipped — you're up" vs "Alice is away — you're up").

- **D-19:** **Dedupe via DB-level unique constraint.** `@@unique([cycleId, recipientUserId, type])` on `HouseholdNotification` (see D-17). A cycle transition can only produce one notification of each type per recipient. A duplicate INSERT from a retry or race raises a Prisma unique violation; transition code treats it as a no-op (catch + continue) so an idempotent cron re-run never produces duplicate notifications.

### Server file layout

- **D-20:** **All Phase 3 server code lives in `src/features/household/`** (user choice — keep household+rotation+availability under one feature folder; do NOT create `src/features/rotation/`). Files this phase adds or extends:
  - `actions.ts` — extended with `skipCurrentCycle`, `createAvailability`, `deleteAvailability`
  - `queries.ts` — extended with `getCurrentCycle(householdId)`, `getHouseholdAvailabilities(householdId)`, `getMyAvailabilities(userId)` (if needed)
  - `schema.ts` — Zod schemas for availability create + skip
  - `cycle.ts` (new) — engine internals: `findNextAssignee`, `computeCycleBoundaries`, shared `transitionCycle` function (called by cron, skip, and Phase 4 leave)
  - `availability.ts` (new) — helper utilities: overlap detection, `isMemberUnavailableOn(userId, date)` predicate
  - `cron.ts` (new) — `advanceAllHouseholds()` orchestrator consumed by the route handler
  - New route handler: `src/app/api/cron/advance-cycles/route.ts` — Node runtime (Prisma incompatible with edge), bearer auth, calls `advanceAllHouseholds()`

### Claude's Discretion

- Exact internal API of `transitionCycle(tx, householdId, reason)` — what it returns, whether it takes the outgoing cycle row vs looking it up, where the lock acquisition lives. Keep it one function, one write path.
- Whether `cycle.ts` / `availability.ts` / `cron.ts` are split as above or consolidated into `actions.ts` / `queries.ts` — prefer split for testability but planner decides.
- Whether `transitionReason` values live as string constants in a dedicated `src/features/household/constants.ts` or Zod enum in `schema.ts`. Recommend a single source (either) reused by the notification `type` mapping.
- Whether `HouseholdNotification.type` is a Prisma enum or a string column. Recommend **string** — matches `Cycle.status` / `Cycle.transitionReason` convention established in Phase 1.
- Reconciliation of `status = 'paused'` (Pitfall 8 guidance when `findNextAssignee` returns null) vs AVLB-05 "owner fallback" (active cycle, owner assignee, fallback banner). Proposed reconciliation: when `findNextAssignee` returns null AND the owner themselves is unavailable → `status = 'paused'`, no new cycle assignee. When the owner IS available → `status = 'active'`, `assignedUserId = ownerId`, `transitionReason = 'all_unavailable_fallback'`. Planner to verify this matches the user's AVLB-05 intent.
- Whether a Phase 3 deploy-time backfill script is needed to create cycle #1 for any pre-existing households. Expected: zero such households (Phase 1 DB flush + Phase 2 both already create owner membership but not cycle; if Phase 2 shipped test data without cycles, backfill during migration). Planner to inventory at plan time.
- Cron route handler observability: structured log vs `console.log`. `console.log` to Vercel logs is sufficient for v1.
- Whether to add `AUDT-01`-style `skippedByUserId` to the outgoing cycle for `transitionReason = 'manual_skip'` or `'member_left'`. Nice-to-have; add if easy.
- Test file organization: one `tests/phase-03/rotation-engine.test.ts` vs per-function test files. DST-boundary unit test (Pitfall 6 mandate) is a hard acceptance gate regardless.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/workstreams/household/ROADMAP.md` §Phase 3 — Goal, success criteria, pitfall flags (5, 6, 7, 8, 9, 11, 12) and external-cron constraint
- `.planning/workstreams/household/REQUIREMENTS.md` §Rotation engine & cron transitions — ROTA-02..07; §Availability & skip — AVLB-01..05
- `.planning/workstreams/household/STATE.md` §Accumulated Context §Decisions — cron-job.org decision, `@date-fns/tz` mandate, `HouseholdNotification` separate from `Reminder`

### Pitfalls (binding)
- `.planning/research/PITFALLS.md` §Pitfall 5 — Timezone-aware cycle end; drives D-02
- `.planning/research/PITFALLS.md` §Pitfall 6 — DST-safe `addDays` via TZDate; acceptance gate on rotation-engine tests
- `.planning/research/PITFALLS.md` §Pitfall 7 — `FOR UPDATE SKIP LOCKED` in `db.$transaction`; drives D-03, D-11, D-14
- `.planning/research/PITFALLS.md` §Pitfall 8 — `findNextAssignee` returns `Member | null`; drives D-03, D-05, and the Claude's Discretion reconciliation
- `.planning/research/PITFALLS.md` §Pitfall 9 — Member-leave triggers transition with `reason: 'member_left'`; Phase 4 consumer of our transition function
- `.planning/research/PITFALLS.md` §Pitfall 11 — Availability overlap rejection; drives D-06
- `.planning/research/PITFALLS.md` §Pitfall 12 — Past-dated availability rejection at Server Action; Zod refinement in `schema.ts`

### Phase 1 binding decisions (the foundation this phase builds on)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-02 — `Cycle` schema fields; Phase 3 adds only `transitionReason`
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-08 — `registerUser` transactional hook; Phase 3 extends with Cycle #1 write (D-01)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-16..D-20 — `requireHouseholdAccess` guard contract, `ForbiddenError`, rich return `{ household, member, role }`; consumed by every action this phase

### Phase 2 binding decisions
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-03 — layout chokepoint at `src/app/(main)/h/[householdSlug]/layout.tsx` + `getCurrentHousehold()` cached helper; dashboard Server Components reading cycle state consume this
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-04 — hidden-field `householdId` Server Action pattern; `skipCurrentCycle` follows it
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-06 — `createHousehold` transaction; Phase 3 extends with Cycle #1 write (D-01)
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-12 — 7-step action template; `skipCurrentCycle` / `createAvailability` / `deleteAvailability` follow it
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-14 — `getReminderCount` / `getReminderItems` interface; Phase 5 will add `cycle.assignedUserId` gate on top of Phase 2's `plant.householdId` filter — not this phase

### Project & tech stack
- `.planning/PROJECT.md` §Current Milestone — Household and Rotation goals
- `CLAUDE.md` §Technology Stack — Prisma 7, PostgreSQL 17, Next.js 16 App Router (Node runtime for cron route), Zod v4 (`zod/v4`), date-fns v4
- `CLAUDE.md` §Stack Patterns — Server Actions + Zod + Prisma writes; proxy.ts edge session check (does not cover `/api/cron/*`)

### Existing codebase anchor points
- `prisma/schema.prisma` §`model Cycle` (lines 171–189) — Phase 3 adds `transitionReason String?` column; `@@unique([householdId, cycleNumber])` is already in place
- `prisma/schema.prisma` §`model Availability` (lines 191–205) — Phase 3 reads/writes; no schema change needed
- `prisma/schema.prisma` §`model Household` / `model User` — Phase 3 adds `HouseholdNotification[]` back-relations
- `src/features/household/actions.ts` — extended with `skipCurrentCycle`, `createAvailability`, `deleteAvailability`
- `src/features/household/queries.ts` — extended with `getCurrentCycle`, `getHouseholdAvailabilities`
- `src/features/household/guards.ts` — `requireHouseholdAccess` + `ForbiddenError` consumed
- `src/features/household/schema.ts` — extended with availability + skip Zod schemas
- `src/features/auth/actions.ts` `registerUser` (~lines 44–86) — transaction extended with Cycle #1 write
- `src/app/api/cron/advance-cycles/route.ts` — new Route Handler (Node runtime)
- `package.json` — `@date-fns/tz` needs install (currently only `date-fns@^4.1.0` present)
- `.env` / Vercel env — `CRON_SECRET` added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 1 guard (`src/features/household/guards.ts`)** — `requireHouseholdAccess(householdId)` returns `{ household, member, role }`; consumed by all three new Server Actions and by the `/api/cron/advance-cycles` handler's bypass (cron does not use the guard — it uses bearer auth).
- **Phase 2 layout chokepoint (`src/app/(main)/h/[householdSlug]/layout.tsx`)** — Phase 6's dashboard cycle-banner consumer reads cycle state via `getCurrentCycle(household.id)` inside this already-authorized layout.
- **`db.$transaction` pattern** — used in `registerUser` (`src/features/auth/actions.ts:44–86`) and `createHousehold` — Phase 3's cycle transition function and the registerUser/createHousehold extensions follow the same shape.
- **`@db.Timestamptz(3)` convention** — all new datetime columns (`HouseholdNotification.createdAt`, `Cycle.transitionReason` — wait, string) use it.
- **Cuid primary keys (`@id @default(cuid())`)** — `HouseholdNotification.id`.
- **`revalidatePath` pattern** — `skipCurrentCycle` revalidates `/h/[slug]/dashboard` so the new assignee banner lands immediately for the clicking user (other members see it on next nav).
- **Demo-mode guard (`if (session.user.isDemo) return { error }`)** — carried into all three new actions verbatim (Phase 7 will refactor).

### Established Patterns
- **Feature-folder pattern** — `src/features/household/` absorbs this phase per D-20; no new feature folder.
- **Server Actions: 7-step template** — Phase 2 D-12. Every new action in this phase conforms.
- **Hidden-field `householdId` Server Action pattern** — Phase 2 D-04. `skipCurrentCycle` and `deleteAvailability` forms (Phase 6 consumer) follow it.
- **`@@unique` + `@@index` composite keys** — Phase 1 established; `HouseholdNotification.@@unique([cycleId, recipientUserId, type])` extends the style.
- **String status columns (not Prisma enums)** — `Cycle.status`, `HouseholdMember.role`. `transitionReason` and `HouseholdNotification.type` follow suit.

### Integration Points
- **`registerUser` + `createHousehold`** — both wrapped with Cycle #1 creation in the same transaction (D-01). Planner must inventory both callers and confirm no other path creates a `Household` row.
- **`/api/cron/advance-cycles` route handler** — new file; `export async function POST` (cron-job.org can POST with bearer header); Node runtime (`export const runtime = 'nodejs'`) — edge runtime is incompatible with Prisma.
- **Phase 4 consumer interface:** Phase 4's `leaveHousehold` action must call Phase 3's shared `transitionCycle(…, reason: 'member_left')` when the leaver is the current assignee. Phase 3 exports that function.
- **Phase 5 consumer interface:** `HouseholdNotification` rows produced here are consumed by Phase 5's notification-bell query and cycle-banner render. Phase 5 adds `readAt` / payload columns via a subsequent migration; Phase 3 does NOT ship those.
- **Phase 6 consumer interface:** `getCurrentCycle`, `getHouseholdAvailabilities`, `createAvailability`, `deleteAvailability`, `skipCurrentCycle` — all consumed by Phase 6's dashboard banner + settings availability surface. Signatures are locked this phase; Phase 6 only adds UI.
- **`@date-fns/tz` install** — add to `package.json` as a dependency. `date-fns-tz` (marnusw) is incompatible with date-fns v4; STATE.md explicitly mandates `@date-fns/tz` TZDate instead.
- **`CRON_SECRET` env var** — documented in `.env.example`, set in Vercel env.
- **Prisma migration** — one migration this phase: add `Cycle.transitionReason String?` + add `HouseholdNotification` model + back-relations on Household/User/Cycle.

</code_context>

<specifics>
## Specific Ideas

- The clarifying exchange on "no plants + single-member" (Area: Cycle lifecycle) drove confidence in D-01's eager creation. Cycles are orthogonal to plant count; single-member is handled by the formula with no engine-side special case. Downstream planner should NOT add a "has-plants" precondition to cycle creation.
- User chose `src/features/household/` over a new `src/features/rotation/` folder for Phase 3 server code. Downstream planner must honor this: do NOT create `src/features/rotation/`. New files (`cycle.ts`, `availability.ts`, `cron.ts`) land inside `src/features/household/`.
- The "Phase 3 emits, Phase 5 renders" split (D-15) is the contract: Phase 5 can assume `HouseholdNotification` rows exist for every transition Phase 3 writes. No read-time reconstruction. The unique index (D-19) is the hard guarantee backing this contract.
- `transitionCycle` is **one function, one write path, one lock**. Cron, `skipCurrentCycle`, and Phase 4's `leaveHousehold` all call it. Planner must resist splitting into separate "skip" / "auto-advance" / "leave" transition routines — that path leads to Pitfall 7.

</specifics>

<deferred>
## Deferred Ideas

- **`HouseholdNotification.readAt` / dismissal state / payload Json** — Phase 5. Phase 3 ships bare-minimum schema (D-17).
- **Passive household status banner (HNTF-04)** — Phase 5 derives at read time from current `Cycle` row; not stored.
- **Cycle banner UI, availability form UI, rotation reorder UI, skip button UI, fallback banner UI** — Phase 6.
- **Demo-household seed with availability + cycle** — Phase 7.
- **Structured logging / observability format for the cron endpoint** — `console.log` → Vercel logs is the v1 answer.
- **Constant-time bearer-secret compare** — deferred; traffic volume doesn't justify the hardening.
- **Parallel household iteration in cron** — deferred; sequential is fine at expected scale. Revisit only if runtime exceeds cron-job.org's timeout budget.
- **`updateAvailability` action** — explicitly rejected in D-07 (delete + recreate only).
- **Multi-timezone per household** — out of scope per REQUIREMENTS §Out of Scope.
- **Observer role, load-balanced rotation, per-plant assignment** — `ROTAX-*` / `MEMBX-*` deferred per REQUIREMENTS.
- **Availability reason field length cap** — leave to Zod default `z.string().optional()` for now; Phase 6 form sets display length.
- **Retention / archival of historical completed cycles** — no pruning policy this phase; cycles accumulate indefinitely. Revisit if analytics surfaces need it.
- **Deploy-time backfill for any pre-existing households lacking Cycle #1** — planner inventories at plan time; expected zero households.
- **`skippedByUserId` audit column on `Cycle` for manual-skip / member-left** — left to Claude's Discretion; add if easy.
- **Event-driven resume (action-side trigger on availability delete)** — considered, rejected in favor of cron-only resume (D-05).

</deferred>

---

*Phase: 03-rotation-engine-availability*
*Workstream: household*
*Context gathered: 2026-04-17*
