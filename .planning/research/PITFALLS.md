# Pitfalls Research

**Domain:** Multi-tenancy retrofit + rotation engine on existing single-user Next.js/Prisma app
**Researched:** 2026-04-16
**Confidence:** HIGH — based on direct codebase audit of v1 queries/actions + documented multi-tenancy patterns

---

## Context: What v1 Looks Like

Every v1 query filters by `userId` directly on `Plant`, `Room`, and `Reminder`. There is no household concept. The JWT carries only `{ id, isDemo }`. Every Server Action does an ownership check via `findFirst({ where: { ..., userId: session.user.id } })`.

After the household milestone:
- `Plant.userId` → `Plant.householdId`
- `Room.userId` → `Room.householdId`
- `Reminder.userId` remains (per-user preferences), but plant eligibility must be filtered by active assignee
- A new `activeHouseholdId` must be added to the session JWT

This reparenting is the root cause of most pitfalls below.

---

## Critical Pitfalls

### Pitfall 1: Missed userId Filter — Data Leaks Across Households

**What goes wrong:**
After migration, `Plant` rows have a `householdId`. If a developer updates `getDashboardPlants` and `getPlants` but misses `getWateringHistory`, `loadMoreWateringHistory`, or `getPlantReminder`, those functions still filter by `plant.userId`. In the worst case they're updated to remove `userId` but don't add `householdId` — any authenticated user can fetch any plant's history by guessing an ID.

Looking at v1: `watering/queries.ts` filters history with `plant: { userId }`. After reparenting, this check must become `plant: { householdId }`. It is the only guard on that query. If it goes stale, a user in Household A can read Household B's watering timeline by hitting the Server Action with a plant ID they guessed.

**Why it happens:**
The refactor search-and-replace hits the obvious places (`getPlants`, dashboard) and misses the indirect ones. `WateringLog` has no `userId` itself — the ownership guard is a nested Prisma relation filter. Grep for `userId` won't find it because `plant: { userId }` is buried inside an `include`.

**How to avoid:**
1. Add a Prisma middleware (or a query helper wrapper) that asserts every `plant.findFirst/findMany/count` includes either `userId` (solo) or `householdId` (household) in the `where` clause. Raise an error in development if neither is present.
2. Create a migration checklist enumerating every query file that touches `Plant`, `WateringLog`, `Note`, `HealthLog`, `Room`, `Reminder` — sign off each one explicitly before shipping the data model phase.
3. Write an integration test: create User A in Household 1, User B in Household 2, assert that `getWateringHistory(householdBPlantId, userASession)` returns 404/empty.

**Warning signs:**
- Any query that joins through `plant` to enforce ownership but doesn't explicitly select `householdId` on that join.
- Server Actions that skip re-checking ownership after a `householdId` column addition (look for `findFirst({ where: { id: ... } })` with no tenant filter).
- Prisma queries on `WateringLog`, `Note`, `HealthLog`, `HealthLog` that only verify `plantId` without traversing to `householdId`.

**Phase to address:** Data model phase (add `householdId`) + query audit as a mandatory gate before any UI work ships.

---

### Pitfall 2: Cascade Misconfiguration — User Delete Wipes Household Plants

**What goes wrong:**
v1 schema has `Plant` with `onDelete: Cascade` on the `User` relation. After reparenting plants to `Household`, if the `Plant → User` relation is not removed (or changed to `SetNull`) and the old `userId` column is kept as an audit field, deleting a founding user cascades and deletes all household plants — even plants created by other members.

A variant: `Room` also has `onDelete: Cascade` on `User`. If rooms are reparented to `Household`, forgetting to update the `Room → User` cascade means a member departure kills all rooms.

**Why it happens:**
Prisma schema changes are mechanical and developers focus on adding new relations. The old relations are copied forward without auditing their `onDelete` behavior in the new context.

**How to avoid:**
Explicit migration design rule: when a row changes from "owned by User" to "owned by Household", the `User` foreign key either:
- Is dropped entirely (if the field is no longer needed), OR
- Becomes a nullable audit field (`createdByUserId String?`, `onDelete: SetNull`) with no cascade.

Never keep `onDelete: Cascade` on a `User` relation for a household-scoped entity.

**Warning signs:**
- Schema has both a `householdId` and a `userId` on `Plant` or `Room` with `onDelete: Cascade` on the user relation.
- No migration test that deletes a non-owning user and checks plant count.

**Phase to address:** Data model phase, schema review gate.

---

### Pitfall 3: Missing Indexes After Adding householdId

**What goes wrong:**
`Plant` currently has no explicit index on `userId` in the schema (Prisma adds a btree index on FK columns by default for PostgreSQL). After adding `householdId`, dashboard queries filter on `{ householdId, archivedAt: null }` and the `getPlants` query adds `roomId`. Without a composite index on `(householdId, archivedAt)` the dashboard query does a full table scan on households with 50+ plants. The `Cycle` table needs an index on `(householdId, status)` for the transition query.

**Why it happens:**
Developers add the column and the relation, run `prisma migrate dev`, and Prisma creates a single-column FK index. The composite index for the hot query path is never written because there's no test that catches slow queries.

**How to avoid:**
Add `@@index([householdId, archivedAt])` on `Plant` and `@@index([householdId, status])` on `Cycle` explicitly in the schema. Add `@@index([householdId])` on `Room`. Verify with `EXPLAIN ANALYZE` in a development migration that the dashboard query uses the index.

**Warning signs:**
- Prisma schema has `householdId` column on `Plant` but no `@@index` directive covering it alongside `archivedAt`.
- No `EXPLAIN ANALYZE` in the migration notes.

**Phase to address:** Data model phase.

---

### Pitfall 4: Wrong Migration Order — NOT NULL Before Backfill

**What goes wrong:**
Developer adds `householdId String` on `Plant`, immediately sets it `NOT NULL`, and runs `prisma migrate dev`. The migration fails (existing rows have null `householdId`) or, in PostgreSQL, the column is added with a default that bypasses backfill. Every existing plant ends up in a fake "default" household that doesn't exist as a real row.

**Why it happens:**
The correct order is three migrations, but developers collapse them into one because they're eager to get the new schema in place.

**How to avoid:**
Enforce a three-step migration ritual:
1. **Add nullable**: `householdId String?` — migrate, deploy.
2. **Backfill**: For each existing User with plants, create a solo Household and a HouseholdMember, then `UPDATE Plant SET householdId = newHouseholdId WHERE userId = thatUserId`. Do this in a Prisma seed script or a raw migration SQL block, not application code.
3. **Add NOT NULL constraint**: Change to `householdId String`, regenerate, migrate.

Write a test that runs the backfill script against a seeded database and asserts that zero plants have a null `householdId` afterward.

**Warning signs:**
- Single migration file that both adds the column and marks it NOT NULL.
- No backfill script or migration SQL in the PR.
- `prisma migrate dev` output shows "0 rows affected" for a backfill step.

**Phase to address:** Data model phase — this is the very first migration in the milestone and must be correct before any feature work begins.

---

### Pitfall 5: Timezone Bug — Cycle Ends at Midnight Local, Server Runs UTC

**What goes wrong:**
The `Cycle` table stores `startDate` and `endDate` as `DateTime @db.Timestamptz`. The household has a `timezone` field. A developer writes the cycle end check as:

```typescript
const now = new Date(); // UTC
if (now >= cycle.endDate) { transitionCycle(); }
```

But `endDate` was set as "Sunday midnight" in the household's timezone. For a household in `America/New_York` (UTC-5), "Sunday midnight" is stored as `2026-04-20T05:00:00Z`. If the server checks at `2026-04-20T04:30:00Z`, it thinks the cycle hasn't ended — but it's already Monday morning for the users.

The inverse also happens: a household in `Asia/Tokyo` (UTC+9) has their cycle end stored as `2026-04-19T15:00:00Z` (Sunday midnight JST). If another timezone's check fires before then, nothing breaks — but if the check fires after and the DB stores wall-clock "Monday" as the start, Tokyo users see a cycle that started mid-cycle from their perspective.

**Why it happens:**
`new Date()` is always UTC. Storing dates as Timestamptz is correct, but the conversion to "end of day in household timezone" is missed when constructing `endDate` during cycle creation.

**How to avoid:**
Always derive `endDate` using the household's timezone:
```typescript
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
const endOfCycleLocal = endOfDay(addDays(parseISO(startDate), cycleDurationDays - 1));
const endDate = fromZonedTime(endOfCycleLocal, household.timezone);
```

Write a unit test for `createCycle` that asserts `endDate` for a `America/New_York` household lands at the correct UTC timestamp.

**Warning signs:**
- `endDate` is computed with `addDays(new Date(), duration)` without timezone conversion.
- No timezone in the test fixtures for cycle creation tests.
- `Household.timezone` column exists but is not read during cycle construction.

**Phase to address:** Rotation engine phase.

---

### Pitfall 6: DST Boundary — 23h or 25h Day Skews 7-Day Cycles

**What goes wrong:**
A 7-day cycle starting on the Sunday before a DST "spring forward" in `America/New_York` is 6 days and 23 hours of wall-clock time. If the transition trigger fires on a UTC schedule (e.g., a cron at 00:00 UTC), it fires "before midnight" local time on that Sunday — the cycle hasn't finished yet for the user. The next assignee gets notified while the current assignee's "Sunday" is still ongoing.

The reverse at "fall back": a 7-day cycle is 7 days and 1 hour. The trigger fires, correctly, but the next cycle's `startDate` is set one hour ahead of the previous one, causing drift over multiple cycles.

**Why it happens:**
`addDays(date, 7)` in date-fns adds exactly 7 * 86400 seconds. It does not account for DST. The cycle is created at midnight UTC and the 7-day arithmetic is correct in UTC — but it diverges from the user's local "7 days."

**How to avoid:**
Use `date-fns-tz`'s `addDays` in the context of the household timezone, not UTC arithmetic:
```typescript
import { addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

function nextCycleStart(currentEndDate: Date, tz: string): Date {
  // Get the end date as local time in the household timezone
  const local = toZonedTime(currentEndDate, tz);
  // Add 1 second to move to the start of the next local day
  const nextLocal = addMilliseconds(local, 1);
  // Convert back to UTC
  return fromZonedTime(startOfDay(nextLocal), tz);
}
```

Test with a cycle that spans the March DST transition and the November DST transition for `America/New_York`.

**Warning signs:**
- Cycle duration math uses `addDays(utcDate, n)` directly without zoning.
- No DST-boundary test case in the rotation engine tests.
- `date-fns-tz` is not in the dependency list.

**Phase to address:** Rotation engine phase.

---

### Pitfall 7: Race Condition — Double Cycle Transition

**What goes wrong:**
Member A and Member B both click "skip cycle" within milliseconds of each other. Both Server Actions read the active cycle, find it in `status: 'active'`, and both compute the next assignee. Both run `UPDATE Cycle SET status='skipped'` and `INSERT INTO Cycle`. Result: two Cycle rows with `status: 'active'` for the same household, two notifications sent to two different members.

The same race applies to the automatic time-based transition when two concurrent requests arrive at exactly the cycle boundary (e.g., two browser tabs refreshing at midnight).

**Why it happens:**
Server Actions in Next.js do not have built-in mutual exclusion. The check-then-act pattern (read active cycle, compute next, write) is not atomic.

**How to avoid:**
Wrap cycle transitions in a PostgreSQL advisory lock or a `SELECT ... FOR UPDATE` on the Cycle row:

```typescript
await db.$transaction(async (tx) => {
  // Lock the current cycle row for update — blocks concurrent transitions
  const cycle = await tx.$queryRaw`
    SELECT * FROM "Cycle"
    WHERE "householdId" = ${householdId} AND "status" = 'active'
    FOR UPDATE SKIP LOCKED
  `;
  if (!cycle[0]) return; // Another transaction already transitioned
  
  // Now safe to transition
  await tx.cycle.update({ where: { id: cycle[0].id }, data: { status: 'skipped' } });
  await tx.cycle.create({ data: { ...nextCycle } });
});
```

`FOR UPDATE SKIP LOCKED` means a concurrent transaction silently skips — it won't block, and the duplicate write is prevented.

**Warning signs:**
- Cycle transition logic is not inside a `db.$transaction`.
- No optimistic concurrency check (e.g., checking that `cycle.status === 'active'` after acquiring the transaction).
- Skip and auto-transition are separate code paths without shared locking.

**Phase to address:** Rotation engine phase — must be addressed before the skip feature is testable.

---

### Pitfall 8: Empty Rotation — All Members Unavailable or Single-Member Household

**What goes wrong:**
The cycle transition algorithm iterates through rotation members to find the next available one. If all members are marked unavailable (or one member has left and the household has one remaining), the loop either:
- Throws an uncaught error ("Cannot read property of undefined")
- Enters an infinite loop
- Creates a Cycle with `assignedUserId = null` which breaks notification routing and the dashboard assignee banner

**Why it happens:**
Fallback logic is added as an afterthought. The "next available member" helper is written assuming at least one eligible member exists.

**How to avoid:**
The `findNextAssignee` function must explicitly return a nullable result and callers must handle the null case:

```typescript
function findNextAssignee(members: Member[], currentOrder: number): Member | null {
  const eligible = members.filter(m => m.participationStatus === 'active' && !isUnavailable(m));
  if (eligible.length === 0) return null;
  // ... rotation logic
}
```

When `findNextAssignee` returns null, create a Cycle with `assignedUserId = null` and `status = 'paused'`. The dashboard shows "No one is assigned this cycle — all members unavailable." No notifications are sent. When a member becomes available again, the system auto-resumes.

For single-member households, the same member is always the assignee — no rotation. Create cycles with `assignedUserId = soleMemeber.userId` unconditionally.

**Warning signs:**
- `findNextAssignee` has no null return path.
- Dashboard assignee banner does not handle `null` assignee.
- No test for a household where `Availability` covers all members.

**Phase to address:** Rotation engine phase.

---

### Pitfall 9: Membership Change Mid-Cycle — New Member or Current Assignee Leaves

**What goes wrong:**
**Scenario A — Assignee leaves:** The active Cycle has `assignedUserId = "alice"`. Alice calls "leave household." Her membership is deleted. The cycle row still points to Alice. Notification queries join to `HouseholdMember` and return nothing. The dashboard shows a broken "Current Assignee" banner.

**Scenario B — New member added mid-cycle:** Bob joins. The rotation order is updated to include Bob. The active cycle still runs to completion with Alice as assignee, which is correct — but Bob's position in the rotation must be inserted in a way that doesn't cause Alice to get two consecutive cycles (once the current one ends, the counter must advance past Alice to Bob, not back to start).

**Why it happens:**
Scenario A: leave-household logic only removes the `HouseholdMember` row. It doesn't check if that user is the current cycle assignee.
Scenario B: rotation order insertion is a separate concern from cycle ordering and developers forget the "current position in rotation" must be preserved.

**How to avoid:**
Leave-household action must:
1. Check if the leaving user is the current cycle's assignee.
2. If yes: immediately run the cycle transition algorithm (same path as skip) with a `reason: 'member_left'` audit flag.
3. If the leaving user is the only member: mark the cycle `status: 'paused'`.

New member insertion must append to the end of the rotation, not reset the sequence counter.

**Warning signs:**
- Leave-household Server Action does not query the active Cycle before removing the member.
- Rotation order is stored as an integer `position` field — inserting Bob at position 2 renumbers existing members without recalculating where the "current pointer" is.

**Phase to address:** Membership phase (leave/join) — can be addressed in the same phase as invitation acceptance.

---

### Pitfall 10: Invitation Token Predictability and Reuse

**What goes wrong:**
A developer generates the token as:

```typescript
const token = Buffer.from(`${householdId}:${Date.now()}`).toString('base64');
```

or uses `Math.random()`. Both are predictable. An attacker who receives one invitation link can enumerate other tokens for the same household by adjusting the timestamp by ±1 second.

Token reuse: Alice invites Bob. Bob accepts. The token in the DB has `acceptedAt` set. Alice forwards the same link to Carol. Carol clicks it — if acceptance only checks `acceptedAt IS NULL` and doesn't verify that `acceptedAt` was set in this session, Carol joins.

Wrong-user acceptance: Alice is already logged in. Bob receives an invitation link and clicks it while using the same browser as Alice (shared laptop). Alice's session is active. The acceptance flow uses `session.user.id` and Alice accidentally joins instead of Bob.

**Why it happens:**
Token generation and acceptance validation are written quickly in the invitation flow. Email-based invitation was deferred in the spec (the token is copy-paste shared), so the "who clicked the link" check is loose.

**How to avoid:**
1. **Token generation:** Use `crypto.randomBytes(32).toString('hex')` — 256 bits of entropy. Never encode predictable data.
2. **One-time use:** On acceptance, atomically check `acceptedAt IS NULL` AND set `acceptedAt = NOW()` in a single UPDATE with `WHERE acceptedAt IS NULL`. Check the returned row count — if 0, the token was already consumed.
3. **Wrong-user acceptance:** On the invitation acceptance page, show the invitation details (invited email if stored, household name) and require the user to confirm. If the logged-in user's email doesn't match the invited email (when stored), show a warning: "This invitation was for a different email address."
4. **Expiry:** Store `expiresAt` as a concrete UTC timestamp (not a duration). Check `expiresAt > NOW()` on every acceptance attempt, not just on display.

**Warning signs:**
- Token is base64-encoded data rather than random bytes.
- Acceptance action uses `findFirst({ where: { token } })` and then a separate `update` — not atomic.
- Acceptance page doesn't show household name or any confirmation context.

**Phase to address:** Membership / invitation phase.

---

### Pitfall 11: Availability Overlapping Periods

**What goes wrong:**
A user creates availability period "Away June 1–10" and then creates "Away June 7–15." The cycle transition algorithm queries `Availability` for a date and finds two overlapping rows. If it counts them independently, the member appears unavailable until June 15 correctly — but if the algorithm checks "is this member unavailable on date X" by finding any overlapping row, deleting one period may still leave the member marked unavailable. Worse: if periods are treated as discrete items and the system calculates "next available date" by advancing past `endDate` of the first row, it finds June 11 — but the second row makes June 11–15 also unavailable. The system assigns the member to a cycle that starts June 11, which is wrong.

**Why it happens:**
"Find next available date" is implemented as a single-row lookup (`findFirst`) rather than a range union.

**How to avoid:**
Enforce no-overlap at the database or validation level:
- On `Availability` creation, check if any existing row for the same `userId` overlaps the new `[startDate, endDate]` range. If yes, either reject (and ask the user to merge) or auto-merge into a single span.
- "Is member unavailable on date X" query: `WHERE userId = ? AND startDate <= X AND endDate >= X` — a single indexed range query.
- "Next available date" algorithm: retrieve all availability rows for the user sorted by `startDate`, then walk the merged intervals.

**Warning signs:**
- No uniqueness/overlap constraint on `Availability(userId, startDate, endDate)`.
- Availability check uses `findFirst` without verifying the date is within the range.

**Phase to address:** Availability / skip phase.

---

### Pitfall 12: Past-Dated Availability Creation

**What goes wrong:**
A user submits an availability period with `startDate` in the past (e.g., "I was away April 1–5" submitted on April 10). The system processes this as if it needs to retroactively reassign cycles that already ran during April 1–5. If the cycle transition logic is triggered by availability changes, it may attempt to reconstruct historical cycles — creating orphan Cycle rows, double-notifications to whoever was assigned then, or simply throwing an error.

**Why it happens:**
The availability form has no date validation preventing past start dates, and the "availability changed → maybe reassign" trigger doesn't distinguish between past and future ranges.

**How to avoid:**
Validate at the Server Action: if `startDate < today`, reject with an error message "Availability periods must start today or in the future." Historical unavailability has no operational effect and should not be stored. If a retroactive entry is a UX requirement (e.g., explanatory notes), store it but mark it `archived: true` and skip it in all cycle assignment logic.

**Warning signs:**
- Availability creation schema allows any date without a `min: today` constraint.
- Cycle assignment logic doesn't guard against `startDate < currentCycle.startDate`.

**Phase to address:** Availability / skip phase.

---

### Pitfall 13: Old User-Scoped Reminders Still Fire After Household Refactor

**What goes wrong:**
v1 `getReminderCount` and `getReminderItems` filter by `plant.userId` (matching the querying user). After reparenting, `Plant.userId` is gone. But the `Reminder` table still has `userId` — it's a per-user preference row. If the reminder query is updated to use `plant.householdId` but still filters notifications to show all plants in the household to every member, every member gets notified for every overdue plant, regardless of whether they are the current assignee.

Result: Bob gets a notification that "Monstera is overdue" even though Alice is the assigned caretaker this cycle.

**Why it happens:**
The reminder query is updated for the household filter but the "only show to current assignee" scoping is not layered in. The v1 logic was "show reminders to the plant's owner" — which was trivially the `userId`. The new logic is "show reminders to the current cycle assignee."

**How to avoid:**
`getReminderItems` and `getReminderCount` must join to the active Cycle and check `cycle.assignedUserId = session.user.id` before surfacing any reminder. Non-assignee members should receive zero reminder badge counts for daily due/overdue plants. They may still see cycle-change banners (those are a separate notification type).

Implementation: add a `currentAssigneeId` derived value to the household context and pass it to all reminder queries. The check `session.user.id === household.currentAssigneeId` determines whether reminder queries run at all.

**Warning signs:**
- `getReminderCount` is updated to use `householdId` but does not check `cycle.assignedUserId`.
- Reminder badge shows the same count to all household members simultaneously.
- No test verifying that non-assignee members get reminder count = 0.

**Phase to address:** Notification phase (must follow rotation engine phase so `currentAssigneeId` exists).

---

### Pitfall 14: Duplicate Notifications During Reassignment

**What goes wrong:**
It is 8:00 AM. The nightly reminder generation (or per-request reminder query) runs for Alice (current assignee). At 8:01 AM Alice skips her cycle. At 8:02 AM Bob's session loads the dashboard and the same reminder query runs for Bob (now the assignee). Both Alice and Bob have a notification in their bell for "Monstera is overdue."

Separately: the cycle transition creates a "New assignment" notification for Bob. Bob now has two notifications: the "you're responsible" banner AND the "Monstera is overdue" reminder — both generated moments apart.

**Why it happens:**
Reminders are computed on read (not pre-generated), so timing of requests determines who sees what. There's no "I already notified Bob about this overdue plant this cycle" deduplication state.

**How to avoid:**
Reminders are on-read queries in v1 — this is the right approach for in-app notifications (no background job). The deduplication strategy is: **only the current assignee's session triggers reminder computation**. Since `getReminderCount` already checks `session.user.id`, the fix is ensuring the check `session.user.id === currentAssigneeId` happens before any reminder query runs. When reassignment happens, the old assignee's session next load will find they are no longer the assignee and will see 0.

For the "two notifications" problem (banner + overdue): the "New assignment" banner is a separate notification type stored in a `Notification` table (not derived from reminder queries). The overdue reminders are derived from plant state. These are different surfaces — they don't need deduplication because they say different things.

**Warning signs:**
- Reminder queries run regardless of whether the user is the current assignee.
- "New assignment" notification is stored in the same table as daily reminder items.

**Phase to address:** Notification phase.

---

### Pitfall 15: Concurrent Watering Log by Multiple Members

**What goes wrong:**
Alice and Bob both look at the dashboard at 9:00 AM. Both see "Fern is overdue." Both tap "Mark as watered" within 2 seconds of each other. The v1 duplicate check uses a UTC-day window (`dayStart`/`dayEnd`). Both requests arrive within the same day window. The first succeeds. The second also passes the `existingLog` check because the first log was committed milliseconds before the second reads — depending on PostgreSQL transaction isolation level, the second read may not see the first write.

Result: two `WateringLog` rows for the same plant on the same day. The plant's `lastWateredAt` is updated twice, and the second update wins — the `nextWateringAt` is correct (both compute the same value), but the audit trail has a duplicate.

**Why it happens:**
The duplicate check is a two-phase "read then write." Under PostgreSQL's default `READ COMMITTED` isolation, the second transaction's SELECT runs before the first transaction's INSERT is visible.

**How to avoid:**
Add a unique constraint to prevent the data integrity issue at the DB level:
```sql
CREATE UNIQUE INDEX ON "WateringLog" ("plantId", date_trunc('day', "wateredAt" AT TIME ZONE 'UTC'));
```
Or in Prisma schema using a functional index (requires raw migration SQL — Prisma doesn't support functional indexes natively):
```prisma
@@index([plantId, wateredAt]) -- partial guard
```

Better: use `INSERT ... ON CONFLICT DO NOTHING` for the watering log creation, or wrap the duplicate check and insert in a transaction with `SERIALIZABLE` isolation. At minimum, handle the unique constraint violation in the Server Action and return `{ error: "DUPLICATE" }` gracefully.

In the UI, optimistic updates should disable the "water" button immediately on tap — this is already partially handled in v1 but needs to be preserved during the household refactor.

**Warning signs:**
- No database-level uniqueness constraint on `(plantId, day)` for `WateringLog`.
- The duplicate check and insert are separate non-transactional operations.
- The "water" button doesn't disable after first tap in optimistic UI.

**Phase to address:** Data model phase (add the constraint) — and verify during watering/UI phase that the optimistic disable is preserved.

---

### Pitfall 16: activeHouseholdId in JWT Becomes Stale

**What goes wrong:**
After the household milestone, the JWT includes `activeHouseholdId`. User joins a household, gets a new JWT. Later: the household owner removes the user, or the user leaves. Their JWT still carries the old `activeHouseholdId`. Every Server Action that reads `session.user.activeHouseholdId` will use a household they no longer belong to. They can still query household plants until the JWT expires (default NextAuth session: 30 days).

**Why it happens:**
JWT sessions in NextAuth v5 are not invalidated on data changes — the token lives in the client cookie and is only refreshed on login or explicit session update. There is no mechanism that pushes "your household membership changed" to an active JWT.

**How to avoid:**
Every Server Action that uses `activeHouseholdId` must perform a live membership check:
```typescript
const membership = await db.householdMember.findFirst({
  where: { householdId: session.user.activeHouseholdId, userId: session.user.id }
});
if (!membership) return { error: "No longer a member of this household." };
```
This is one extra DB query per mutation. It is worth it. Cache it in the Server Component for read operations (it changes rarely).

Additionally: when a member is removed, call `unstable_update` (NextAuth v5's session update API) to force their next request to revalidate the JWT. This clears the stale `activeHouseholdId` on their next page load.

**Warning signs:**
- Server Actions read `session.user.activeHouseholdId` without a live membership check.
- No test that validates behavior after membership is revoked mid-session.
- Leave / remove-member action does not call `unstable_update`.

**Phase to address:** Membership phase, reinforced in every subsequent phase's Server Action pattern.

---

### Pitfall 17: URL-Scoped vs Session-Scoped Household Mismatch

**What goes wrong:**
The app uses a session-stored `activeHouseholdId`. User A has two households (or in a future milestone, multiple). They open `/dashboard` in two tabs — Tab 1 shows Household A, Tab 2 they switch to Household B via a settings action that updates the session. Tab 1 now silently shows Household B data on next navigation because the session cookie changed. The URL hasn't changed, but the data is different.

A more acute variant: a shared URL like `/plants/cm_abc123` — someone bookmarks or shares a link to a plant in Household A. If the user's `activeHouseholdId` is Household B when they open the link, the ownership check fails and they see a 404 for a plant they own.

**Why it happens:**
Session-scoped active household is convenient but breaks URL shareability and multi-tab usage. It's the same design mistake as storing "current org" in a cookie for multi-tenant SaaS apps.

**How to avoid:**
Scope the household to the URL, not the session. Use a path prefix or query param:
- `/h/[householdSlug]/dashboard`
- `/h/[householdSlug]/plants`

Server Components read `params.householdSlug`, resolve it to a `householdId`, and verify membership. The JWT still carries the user's default household for the home redirect, but page-level data is always URL-scoped.

This is a routing architecture decision that must be made in Phase 1 (data model) and propagated through all UI phases. Changing it mid-milestone is expensive.

**Warning signs:**
- Session is the only place `activeHouseholdId` is stored.
- Plant detail pages resolve `plantId` → `householdId` and then check against `session.activeHouseholdId` rather than verifying the plant belongs to a household the user is a member of.
- No multi-tab test in E2E coverage.

**Phase to address:** Architecture decision in data model phase — before any URL structure is established.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `userId` on Plant as a non-null column during transition | Avoids breaking v1 queries immediately | Dual-ownership confusion, queries silently use wrong column | Never — remove or rename to `createdByUserId` (nullable) |
| Session-scoped `activeHouseholdId` instead of URL-scoped | Simple to implement | Breaks multi-tab, breaks bookmarks, stale JWT hazard | Never for URL-addressable resources |
| Skip the 3-step migration, use nullable + default | Faster to ship | Plants assigned to ghost household, data integrity broken | Never |
| Cycle transition without `SELECT FOR UPDATE` | Simpler code | Race condition on skip, double notification, double cycle rows | Never |
| One global `Reminder` table for both individual and assignee-scoped notifications | Avoids new table | Impossible to distinguish "this is a daily reminder" from "this is a cycle event" | Never — add separate notification event store |
| No `@@index([householdId, archivedAt])` on Plant | Saves migration time | Dashboard query full-scans at 50+ plants | Acceptable during early dev, must add before first household user |
| Check membership in JWT only | Saves one DB query per action | Stale JWT allows access to deleted membership | Never for write operations |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NextAuth v5 JWT + householdId | Adding `activeHouseholdId` to JWT and treating it as ground truth | JWT is a hint for the redirect; live membership check required in every Server Action |
| NextAuth v5 `unstable_update` | Not calling it after membership changes | Call after leave/remove-member to force JWT reissue on next request |
| Prisma $transaction + FOR UPDATE | Using `db.$transaction` with the fluent client (which uses `READ COMMITTED`) instead of raw SQL for locking | Use `tx.$queryRaw` with `SELECT ... FOR UPDATE SKIP LOCKED` for cycle transitions |
| date-fns + timezones | Using `date-fns` for timezone math (it has no timezone support) | Use `date-fns-tz` for all `fromZonedTime` / `toZonedTime` operations; `date-fns` is only for UTC arithmetic |
| v1 Reminder query + household | Updating `getReminderCount` to use `householdId` without adding assignee check | Assignee check is a separate join to `Cycle`; must be added at the same time as the `householdId` filter change |
| Prisma cascade on User delete | Existing `onDelete: Cascade` on Plant→User copied forward | Change to `onDelete: SetNull` (or remove the relation) when Plant migrates to Household ownership |
| `WateringLog` duplicate guard | Relying solely on application-level day-window check | Add functional unique index `(plantId, date_trunc('day', wateredAt))` at the DB level |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No composite index on `(householdId, archivedAt)` on Plant | Dashboard query slow for households with 20+ plants | Add `@@index([householdId, archivedAt])` in schema | ~20 plants per household |
| No index on `(householdId, status)` on Cycle | Cycle transition query full-scans Cycle table | Add `@@index([householdId, status])` | ~50+ cycles per household (years of data) |
| Live membership check on every reminder count read | Nav badge causes extra query per page load | Cache membership in Server Component, pass down; or add `householdId` + `userId` compound index on `HouseholdMember` | Every page load; noticeable at moderate traffic |
| Availability overlap scan without index | `findNextAssignee` queries all Availability rows per member | Add `@@index([userId, startDate, endDate])` on Availability | 10+ availability periods per user |
| `getReminderItems` doing 2 queries + cycle join on every notification bell open | Notification panel opens slowly | The Cycle join adds cost; ensure `(householdId, status)` index is used | Noticeable immediately if cycle index is missing |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Invitation token using `Math.random()` or timestamp encoding | Token enumeration attack — attacker generates their own tokens for known householdIds | Use `crypto.randomBytes(32).toString('hex')` only |
| Non-atomic invitation acceptance | Token reuse — second person accepts the same token | `UPDATE ... WHERE acceptedAt IS NULL` + check row count, not a read-then-write |
| No email match check on invitation acceptance | Wrong logged-in user joins the household | Show invitation details, warn if logged-in email differs from invited email |
| JWT `activeHouseholdId` trusted without DB check | User retains access to household after removal | Live membership check in every Server Action that touches household data |
| Missing `householdId` filter on any Plant/Room/WateringLog query | Cross-household data leak | Prisma middleware assertion that rejects queries without tenant scope |
| Invitation token never expires | Indefinitely valid link forwarded years later | Hard `expiresAt` check on every token use, not just display |
| `WateringLog` attributed only to `plantId`, not `userId` | Audit trail doesn't show which member performed the action | Add `loggedByUserId` (nullable for backward compat) to `WateringLog` during household migration |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Assignee banner visible to all members showing "You are responsible" | Non-assignees confused — they see "you" when they aren't | Show "Alice is responsible this cycle" for non-assignees, "You are responsible" only for the assignee |
| Skip cycle has no confirmation and no "undo" | Members accidentally skip | Require confirmation dialog; allow "undo skip" within 30 seconds (soft delete cycle state) |
| Availability period form allows past start dates | User submits historical data that silently fails or triggers retroactive logic | Validate `startDate >= today` in schema and show error |
| Rotation reorder saves silently | Members don't know the order changed | Show "Rotation order updated — next cycle: Bob" after save |
| Notification bell shows 0 for non-assignee with no explanation | Member wonders if notifications are broken | Show subtle "Alice is responsible for care this week" in the notification panel when badge is 0 for non-assignee |
| Invitation expiry shown as "expires in 7 days" but no timezone context | User confused about cutoff | Show exact date "Expires April 23, 2026" not a relative duration |

---

## "Looks Done But Isn't" Checklist

- [ ] **Plant reparenting:** All queries in `plants/queries.ts`, `watering/queries.ts`, `notes/queries.ts`, `rooms/queries.ts`, and `reminders/queries.ts` updated to use `householdId` — verify no `userId` filter remains on Plant-scoped queries.
- [ ] **Cascade audit:** Every Prisma relation that was `onDelete: Cascade` on a User→Plant or User→Room relation is either removed or changed to `SetNull` after reparenting.
- [ ] **Reminder assignee gate:** `getReminderCount` and `getReminderItems` join to active Cycle and check `assignedUserId === session.user.id` — not just `householdId`.
- [ ] **Cycle transition is transactional:** Every code path that transitions a cycle (auto, skip, member-leave) goes through the same locked transaction function.
- [ ] **DST test:** Cycle creation has a test for a cycle spanning the March DST boundary in `America/New_York`.
- [ ] **Empty rotation:** `findNextAssignee` has an explicit null return and every caller handles null.
- [ ] **Invitation token:** Token generated with `crypto.randomBytes(32)`, not `Math.random()` or timestamp.
- [ ] **Invitation acceptance:** Atomic `WHERE acceptedAt IS NULL` update, row count checked.
- [ ] **JWT staleness:** Leave/remove-member action calls `unstable_update` to force JWT reissue.
- [ ] **Duplicate watering DB constraint:** `WateringLog` has a database-level uniqueness constraint on `(plantId, day)`, not just an application-level check.
- [ ] **URL-scoped household:** Household is in the URL path, not only in the session, for all plant/room/dashboard routes.
- [ ] **Backfill verified:** Migration test asserts zero plants with null `householdId` after running the backfill script.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missed userId filter causing data leak | HIGH | Immediate: add the missing filter and deploy. Audit: query logs to determine if cross-household reads occurred. GDPR: notify affected users if household data was exposed. |
| Cascade deleted household plants | HIGH | Restore from pre-migration backup. Add missing `SetNull` cascade. Re-run migration with correct cascade behavior. |
| Double cycle transition (two active cycles) | MEDIUM | Write a one-off script to identify households with >1 active cycle, manually resolve to the correct state (keep the later one, mark the earlier `skipped`). Add the `FOR UPDATE` lock going forward. |
| JWT stale after membership revoke | MEDIUM | Force logout all sessions for affected user (delete session from DB if using database sessions; for JWT there's no easy revoke without a blocklist). Add the live membership check immediately. |
| Invitation token reuse | MEDIUM | Revoke all outstanding tokens, regenerate using `crypto.randomBytes`. Notify affected households. |
| Wrong migration order (NOT NULL before backfill) | HIGH | Roll back migration. Re-run with the three-step order. All plants affected by the broken migration will need manual backfill from `userId` mapping. |
| Overlapping availability causing wrong assignment | LOW | Query all Availability rows with overlaps for each user, merge them, update the `endDate` to the latest. No user action required. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Missed userId filter (data leak) | Data model phase | Integration test: cross-household read attempt returns empty/404 |
| Cascade misconfiguration | Data model phase | Schema review: no `onDelete: Cascade` on User relations for household-scoped entities |
| Missing indexes | Data model phase | `EXPLAIN ANALYZE` on dashboard query shows index scan |
| Wrong migration order | Data model phase | Migration test: backfill script → zero null `householdId` rows |
| Timezone bug (cycle end UTC vs local) | Rotation engine phase | Unit test: cycle `endDate` for NY household lands at correct UTC timestamp |
| DST boundary skew | Rotation engine phase | Unit test: 7-day cycle spanning March DST transition |
| Race condition (double transition) | Rotation engine phase | Concurrent test: two simultaneous skip calls → exactly one new active cycle |
| Empty rotation | Rotation engine phase | Unit test: all-unavailable household returns `null` assignee, `status: paused` |
| Membership change mid-cycle | Membership phase | Integration test: leave-household when assignee → cycle transitions immediately |
| Invitation token predictability | Membership phase | Code review: token source is `crypto.randomBytes` |
| Invitation token reuse | Membership phase | Integration test: accept same token twice → second attempt fails |
| Wrong-user invitation acceptance | Membership phase | E2E test: click invite link while logged in as different user → warning shown |
| Overlapping availability | Availability phase | Unit test: overlapping periods submitted → rejected or merged |
| Past-dated availability | Availability phase | Unit test: `startDate < today` → validation error |
| Old user-scoped reminders still fire | Notification phase | Integration test: non-assignee member gets reminder count = 0 |
| Duplicate notifications during reassignment | Notification phase | Manual test: skip cycle, verify new assignee sees correct notification state |
| Concurrent watering log | Data model phase (constraint) + Watering UI phase (optimistic) | DB constraint test: two concurrent inserts → second fails gracefully |
| Stale `activeHouseholdId` in JWT | Membership phase | Integration test: remove member, immediate Server Action returns unauthorized |
| URL vs session household mismatch | Architecture decision in data model phase | URL routing test: plant detail URL works regardless of `activeHouseholdId` |

---

## Phase-Specific Warnings for Code Review

**Data Model Phase (first phase — highest risk):**
- Verify every `Plant.userId` reference in the codebase is updated or explicitly tracked as "to update in next phase."
- Confirm migration file has three steps: nullable add → backfill SQL → NOT NULL.
- Confirm `Room.userId` cascade is changed before the migration runs.
- Confirm `WateringLog` DB-level duplicate constraint is added.
- Confirm `@@index([householdId, archivedAt])` and `@@index([householdId, status])` are present.

**Rotation Engine Phase:**
- Every cycle transition code path must go through one function. If you see two different paths calling `cycle.update({ status: 'active' })`, that's a bug.
- Timezone handling must import from `date-fns-tz`, not `date-fns`. If you see `addDays(utcDate, n)` in a function that has `household.timezone` in scope, that's a bug.
- `findNextAssignee` must have a null return. If it throws on an empty array, that's a bug.

**Membership / Invitation Phase:**
- Token generation must use `crypto.randomBytes`. Any other source is a bug.
- Leave-household must query the active cycle. If it doesn't, that's a bug.
- Server Actions that use `activeHouseholdId` must include a live membership check. If `householdMember.findFirst` is absent from the action, that's a bug.

**Notification Phase:**
- `getReminderCount` must join to Cycle. If it doesn't, every member gets the reminder badge, which is wrong.
- If the "notification type" field on a stored Notification distinguishes `daily_reminder` from `cycle_event`, the deduplication surface is correct. If they're in the same bucket, that's a smell.

---

## Sources

- Direct codebase audit: `src/features/plants/queries.ts`, `src/features/watering/queries.ts`, `src/features/reminders/queries.ts`, `src/features/reminders/actions.ts`, `src/features/rooms/actions.ts`, `prisma/schema.prisma`, `auth.ts`
- NextAuth.js v5 session management: JWT invalidation limitations documented in Auth.js v5 migration guide
- PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` pattern: standard advisory lock pattern for queue/transition systems
- `date-fns-tz` required for timezone-aware cycle arithmetic: `date-fns` has no timezone support
- Three-step nullable→backfill→NOT NULL migration pattern: standard PostgreSQL zero-downtime migration practice
- `crypto.randomBytes` for token generation: OWASP Cryptographic Failures guidance

---
*Pitfalls research for: Multi-tenancy retrofit + rotation engine (Plant Minder household milestone)*
*Researched: 2026-04-16*
