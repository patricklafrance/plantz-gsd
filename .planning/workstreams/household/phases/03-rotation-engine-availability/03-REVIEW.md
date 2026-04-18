---
phase: 03-rotation-engine-availability
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .env.example
  - package.json
  - prisma/schema.prisma
  - proxy.ts
  - src/app/api/cron/advance-cycles/route.ts
  - src/features/auth/actions.ts
  - src/features/household/actions.ts
  - src/features/household/availability.ts
  - src/features/household/constants.ts
  - src/features/household/cron.ts
  - src/features/household/cycle.ts
  - src/features/household/paths.ts
  - src/features/household/queries.ts
  - src/features/household/schema.ts
  - tests/household-create.test.ts
  - tests/phase-03/all-unavailable-fallback.test.ts
  - tests/phase-03/auto-skip-unavailable.test.ts
  - tests/phase-03/availability-overlap.test.ts
  - tests/phase-03/availability-past-date.test.ts
  - tests/phase-03/cron-route.test.ts
  - tests/phase-03/cycle-boundaries.test.ts
  - tests/phase-03/dst-boundary.test.ts
  - tests/phase-03/find-next-assignee.test.ts
  - tests/phase-03/fixtures.ts
  - tests/phase-03/household-notification.test.ts
  - tests/phase-03/paused-resume.test.ts
  - tests/phase-03/rotation-formula.test.ts
  - tests/phase-03/skip-current-cycle.test.ts
  - tests/phase-03/transition-concurrency.test.ts
  - tests/phase-03/transition-cycle.test.ts
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 3 delivers the rotation engine (`transitionCycle`), availability predicates, cron
orchestrator, cron bearer-auth route, Cycle #1 eager-write in signup/create, and the skip /
create-availability / delete-availability Server Actions. The architecture is solid — the
`FOR UPDATE SKIP LOCKED` pattern is correctly placed as the first statement inside
`$transaction`, all side-effect writes live inside the same tx, notification dedupe relies
on a composite `@@unique`, and the `TZDate`-based boundary math preserves wall-clock time
across DST. The D-09 dual-auth on `deleteAvailability` and the assignee-only check in
`skipCurrentCycle` are correctly enforced. Tests cover the happy paths, auto-skip,
all-unavailable fallback, manual-skip, paused-resume, concurrency, past-date rejection,
overlap rejection, and the cron bearer handler.

The one critical issue is a CRON auth bypass when `CRON_SECRET` is unset or empty at
runtime: the literal string `"Bearer undefined"` (or `"Bearer "`) becomes a valid token.
Everything else is warning- or info-tier: a hard-coded `cycleDuration: 7` duplicated
between action and boundary-compute, the binding DST acceptance gate is still `test.todo`,
a stale line-number comment, and minor schema/test-scope observations.

## Critical Issues

### CR-01: Cron auth bypass when `CRON_SECRET` is unset or empty

**File:** `src/app/api/cron/advance-cycles/route.ts:26-28`
**Issue:** When `process.env.CRON_SECRET` is `undefined` (env var not set) or empty, the
computed expected value becomes `` `Bearer undefined` `` or `` `Bearer ` ``. An attacker
sending exactly `Authorization: Bearer undefined` (or the empty-suffix variant) would
pass the `authHeader !== expected` check and reach `advanceAllHouseholds()`, driving
cycle mutations across every household. This inverts the intended "closed by default"
behavior of a missing-config deploy. The plain `===` comparison is documented as an
acceptable timing-safety tradeoff for 24 req/day; that rationale does not cover a
construction that turns a missing env var into a valid secret.
**Fix:**
```typescript
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed — refuse to serve if the secret is not configured.
    console.error("[cron] CRON_SECRET is not configured");
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader !== expected) {
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

Also consider adding a test that clears `process.env.CRON_SECRET` before POST and asserts
the response is 401 — `tests/phase-03/cron-route.test.ts` currently only exercises the
configured-secret path.

## Warnings

### WR-01: `cycleDuration: 7` hard-coded in two places per action (drift risk)

**File:** `src/features/auth/actions.ts:95-102`, `src/features/household/actions.ts:91-102`
**Issue:** `computeInitialCycleBoundaries(..., 7)` is called with the literal `7` on the
same line as `tx.cycle.create({ cycleDuration: 7, ... })`. The inline comment admits the
risk: "must match household.cycleDuration above." If Phase 6 or later introduces
configurable cycle duration on `createHousehold`, any edit that updates one literal but
not the other silently breaks Cycle #1's boundaries. Passing `7` twice is also inconsistent
with the rest of `transitionCycle`, which reads `household.cycleDuration` from the DB.
**Fix:** Extract to a single local and pass it everywhere. Example for
`src/features/household/actions.ts`:
```typescript
const cycleDuration = 7;
const resolvedTimezone = parsed.data.timezone ?? "UTC";
const created = await tx.household.create({
  data: {
    name: parsed.data.name,
    slug,
    timezone: resolvedTimezone,
    cycleDuration,
    rotationStrategy: "sequential",
  },
});
// ...
const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
  new Date(),
  resolvedTimezone,
  cycleDuration,
);
await tx.cycle.create({
  data: {
    householdId: created.id,
    cycleNumber: 1,
    anchorDate,
    cycleDuration,
    startDate,
    endDate,
    status: "active",
    assignedUserId: userId,
    memberOrderSnapshot: [{ userId, rotationOrder: 0 }],
  },
});
```
Same pattern applies to `registerUser`. Bonus: also pin `"sequential"` via the existing
`rotationStrategySchema` enum to keep the string-union single-sourced.

### WR-02: Binding DST acceptance gate is `test.todo`, not implemented

**File:** `tests/phase-03/dst-boundary.test.ts:10-12`
**Issue:** The file header marks these tests as "BINDING acceptance gate per RESEARCH.md
§Validation Architecture line 1016," but all three cases are `test.todo`. That means
`vitest run` reports them as passing, and the DST wall-clock invariant — the primary
non-obvious property of `computeInitialCycleBoundaries` / `computeNextCycleBoundaries` —
is not actually verified. `cycle-boundaries.test.ts` tests non-DST zones only (it
explicitly notes "no DST cross here"). A regression that breaks the `TZDate` addition
(e.g., somebody refactoring `addDays(startInZone, cycleDuration)` into
`new Date(startInZone.getTime() + N * 86400 * 1000)`) would sail through CI.
**Fix:** Replace each `test.todo` with a real assertion using the concrete 2026 DST
dates listed in the titles, e.g.:
```typescript
test("spring-forward: anchor 2026-03-08T06:00:00Z + 7 days preserves wall-clock local time", () => {
  // 2026-03-08 00:00 EST = 2026-03-08 05:00Z; DST begins that day, spring-forward at 02:00 local
  const outgoingEnd = new Date("2026-03-08T05:00:00Z"); // 00:00 EST
  const { endDate } = computeNextCycleBoundaries(outgoingEnd, "America/New_York", 7);
  // +7 wall-clock days in NY lands on 2026-03-15 00:00 EDT = 2026-03-15 04:00Z (23h short of 168h)
  expect(endDate.toISOString()).toBe("2026-03-15T04:00:00.000Z");
  expect(endDate.getTime() - outgoingEnd.getTime()).toBe(7 * 86_400_000 - 3_600_000);
});
```

### WR-03: `createAvailability` returns raw Zod message as user-facing error

**File:** `src/features/household/actions.ts:181-184`
**Issue:** When Zod fails, the action returns `parsed.error.issues[0]?.message ?? "Invalid input."`.
This surfaces whatever text the schema refinement used (e.g. "End date must be after start date.")
directly in the UI, which is desirable *for the dated refinements*, but it also exposes
internal messages for cases like `z.string().cuid()` on `householdId` (Zod v4 produces
`"Invalid cuid"`), or a `householdSlug` that fails `min(1)` (Zod: `"Too small: expected string to have >=1 characters"`).
The pattern is inconsistent with every other action in this file (`createHousehold`,
`skipCurrentCycle`, `deleteAvailability`) which return `"Invalid input."` generically.
**Fix:** Either (a) whitelist the two intentional refinements with explicit short-circuits,
or (b) keep the default user-facing message for base parse errors and only surface
refinement messages:
```typescript
if (!parsed.success) {
  const firstIssue = parsed.error.issues[0];
  // Only surface messages we authored via `.refine()` on dates; hide Zod defaults
  const isDateRefinement =
    firstIssue?.path[0] === "startDate" || firstIssue?.path[0] === "endDate";
  return {
    error: isDateRefinement ? firstIssue.message : "Invalid input.",
  };
}
```

### WR-04: `computeAssigneeIndex` appears to be unused by the transition path

**File:** `src/features/household/cycle.ts:39-48`
**Issue:** `transitionCycle` uses `findNextAssignee` (findIndex + walker), not
`computeAssigneeIndex`. The only caller in the entire reviewed tree is the pure-math test
file `tests/phase-03/rotation-formula.test.ts`. If this is intentional (public API for a
future dashboard indicator or the Phase 6 rotation preview), add an export comment
explaining where it's consumed. Otherwise it is dead code that drifts from the real
rotation logic — a silent invariant-break waiting to happen if `findNextAssignee` evolves
without anyone noticing `computeAssigneeIndex` still reflects the old semantics.
**Fix:** Either (a) document the consumer in a comment above the function, e.g.
`/** Consumed by: tests/rotation-formula.test.ts, Phase 6 dashboard preview (planned) */`,
or (b) delete it and delete the corresponding test file until a real consumer exists.

### WR-05: Stale line-number reference in `actions.ts` JSDoc

**File:** `src/features/household/actions.ts:30` (and `tests/household-create.test.ts` comments)
**Issue:** The JSDoc says `"Slug generation mirrors src/features/auth/actions.ts:54-66"`
but the current implementation spans `auth/actions.ts:56-69`. Similar off-by-one drift
appears in the test file comment about "previously ran 11 iterations" vs. the "WR-02" tag.
These are harmless today but are the canonical way future refactors go silently wrong —
a reader trusts the cross-reference, doesn't re-verify, and edits only one copy.
**Fix:** Replace line-number references with stable anchors — either function names
("the slug-collision loop in `registerUser`") or inline the shared logic into a helper
(`generateUniqueSlug(tx: Prisma.TransactionClient): Promise<string>`). The helper option
also removes the current duplication between `registerUser` and `createHousehold`.

## Info

### IN-01: `HouseholdNotification` unique constraint and NULL cycleId

**File:** `prisma/schema.prisma:234-247`
**Issue:** `@@unique([cycleId, recipientUserId, type])` with `cycleId` nullable relies on
Postgres's default "NULLs are distinct in unique indexes" behavior. The comment on lines
230-233 correctly flags this and notes Phase 3 always writes non-null `cycleId`. No action
needed for Phase 3, but the risk is real if a future phase introduces `cycleId: null`
rows — multiple would be allowed for the same (recipient, type). Surface this in Phase 5's
planning doc, and prefer `NULLS NOT DISTINCT` (Postgres 15+) or a partial unique index at
that point.
**Fix:** No code change now. Add a TODO at the top of the Phase 5 notification-schema
extension plan: `"When introducing nullable cycleId notification types, switch to NULLS NOT DISTINCT or add CREATE UNIQUE INDEX ... WHERE cycleId IS NULL."`

### IN-02: `z.string().cuid()` is deprecated in Zod v4

**File:** `src/features/household/schema.ts:50, 71, 80`
**Issue:** Zod v4 prefers `z.cuid()` (top-level, not a string refinement) for performance
and ergonomics. The current `z.string().cuid()` form still works but is flagged as
deprecated in v4 release notes. Not a bug, but will become a lint warning once Zod's
ESLint rules ship.
**Fix:** `householdId: z.cuid()` and `availabilityId: z.cuid()`. Behavior is identical.

### IN-03: `updateTimezone` has no IANA-format validation

**File:** `src/features/auth/actions.ts:128-147`
**Issue:** The comment notes this is "only used for display comparison" so a bogus
timezone string won't break anything user-visible. But the value also flows into
`createHousehold` via the onboarding form and eventually into `computeInitialCycleBoundaries`
where `new TZDate(now.getTime(), timezone)` would silently fall back to UTC on unknown
strings. Today the field is set from `Intl.DateTimeFormat().resolvedOptions().timeZone`
so this is theoretical, but hardening helps.
**Fix:** Add a light check via `Intl.supportedValuesOf('timeZone')` (Node 18+) or a
try/catch around `new Intl.DateTimeFormat("en", { timeZone: timezone })`. Low priority.

### IN-04: Duplicate `parsed.data.timezone ?? "UTC"` in `createHousehold`

**File:** `src/features/household/actions.ts:70, 87`
**Issue:** Same nullish-coalesce used on `household.create` and
`computeInitialCycleBoundaries`. Harmless duplication — but the WR-01 refactor eliminates
it naturally.
**Fix:** Folded into WR-01.

### IN-05: `advanceAllHouseholds` sequential loop is out-of-scope-noted but worth a comment

**File:** `src/features/household/cron.ts:44-90`
**Issue:** JSDoc correctly explains the tradeoff ("sequential, NOT Promise.all"). As the
number of households grows past a few hundred, the hourly cron could exceed the Next.js
route handler timeout on Vercel (default 10s, 60s max on Pro). This is called out as
"performance out of scope for v1" by the review scope, so it's info only. A sentence
estimating the crossover point (e.g., "budget ~50ms per household → ~200 households in
10s") would help the Phase 6+ operator plan.
**Fix:** Add a note to the JSDoc block about the scaling ceiling for future ops planning.
No code change.

### IN-06: `startOfDay(new Date())` in `createAvailabilitySchema` uses server-local "today"

**File:** `src/features/household/schema.ts:60`
**Issue:** The past-date refinement compares against the server's local "today," which on
Vercel/serverless hosts is typically UTC. A user in a far-east timezone creating an
availability for *their* "today" could have their startDate accidentally flagged as past,
or (less visibly) accept dates that are already past in their local timezone. For v1 this
is a known acceptable deviation, especially since availability is usually booked days ahead.
Worth documenting.
**Fix:** Add a comment explaining the server-timezone semantics:
```typescript
// Note: compares against server-local "today" (typically UTC on serverless).
// Users within ±12h are effectively unaffected; far-east users may see a
// one-day-off edge at wall-clock midnight. Phase 6 may thread household
// timezone through to make this timezone-aware.
.refine((d) => d.startDate >= startOfDay(new Date()), ...)
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
