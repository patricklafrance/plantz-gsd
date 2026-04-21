# Phase 7: Demo Mode Compatibility - Research

**Researched:** 2026-04-20
**Domain:** Prisma seed expansion, cycle engine bootstrap, demo session simplification, static audit test design
**Confidence:** HIGH — all findings are codebase-verified; no web searches required for this phase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Demo household = 3 members: demo user + two new `User` rows with fake emails (`alice@demo.plantminder.app`, `bob@demo.plantminder.app`). Real `User` + `HouseholdMember` rows required for rotation math and notification queries.
- **D-02:** Sample members' credentials use an unusable sentinel `passwordHash` (bcrypt hash of a never-stored 64-byte CSPRNG value) so no one can accidentally log in as them.
- **D-03:** Sample members are never marked `isDemo`. The `isDemo` token flag is strictly `email === DEMO_EMAIL`. Keeping passwords unusable is load-bearing.
- **D-04:** Demo household starts mid-cycle: `Cycle.startDate = now - 3 days`, `endDate = now + 4 days` (7-day duration). Demo user is the active assignee.
- **D-05:** Rotation order: demo user at `rotationOrder: 0`, sample members at `rotationOrder: 1` and `rotationOrder: 2`.
- **D-06:** Sample availability: seeded on a sample member (not demo user), future window `startDate = now + 10 days`, `endDate = now + 17 days`.
- **D-07:** Demo household `Cycle` row MUST be created during seed. Either (a) route through `createHousehold` + walk cycle back, or (b) inline `tx.cycle.create` using `computeInitialCycleBoundaries` output shifted. Planner picks.
- **D-08:** Demo guard return shape: `{ error: "Demo mode — sign up to save your changes." }` on all 15 household mutating actions. Keep existing shape — zero guard changes required.
- **D-09:** Do NOT introduce `isDemo` into member/invitation/settings UI components. Server-side short-circuit is the single enforcement point.
- **D-10:** `prisma/seed.ts` is the single source of truth for the expanded demo seed.
- **D-11:** `startDemoSession` drops its lazy creation branch. Becomes: `findUnique(demo user)` → `signIn` → `redirect`. Error branch fires when demo user is missing, directing dev to run seed.
- **D-12:** No automated reset. Dev re-runs `prisma db seed` if state corrupts.
- **D-13:** Add `tests/phase-07/demo-guard-audit.test.ts` that (1) globs `src/features/**/actions.ts`, (2) parses each `export async function <name>(...)` block, (3) asserts function body contains `session.user.isDemo`. Failure lists offending (file, functionName).
- **D-14:** Scope = every exported function in any `features/**/actions.ts`. Read-only helpers mis-placed in actions.ts get the guard or move out.
- **D-15:** Known exception: `/api/cron/advance-cycles` is NOT in `features/**/actions.ts`, not in scope.

### Claude's Discretion
- Sample member names and email local-parts (keep obviously fake: `alice`, `bob`)
- Exact bcrypt unusable-password construction
- Whether to seed `HouseholdNotification` rows for demo assignee (bell dropdown)
- Exact date math for the mid-window cycle (use date-fns + household timezone "UTC")
- Whether `reorderRotation` / invitation seed needs sample invitation tokens
- Whether to seed an `Availability` row on the demo user for the "delete my availability" flow

### Deferred Ideas (OUT OF SCOPE)
- Per-visit demo reset
- Disabled-button UX in demo mode (server-side guard is sufficient for v1)
- Seeding cycle history (past cycles for AUDT-01/02)
- Signed-out pass-through view of demo data
- Observer role for sample members
- Sample invitation tokens seeded into the Demo Household
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HDMO-01 | Demo user is a member of a pre-seeded "Demo Household" with sample members, an active cycle, and a sample availability period | Seed expansion findings (§1), Cycle bootstrap recommendation (§2), Availability seeding (§3) |
| HDMO-02 | All household-mutating actions are blocked in demo mode using the existing read-only guard pattern | Guard audit baseline (§5), Static audit test design (§4) |
</phase_requirements>

---

## Summary

Phase 7 is almost entirely an additive seed expansion plus a structural simplification to `startDemoSession`. The codebase is in a clean state for this work: all 15 household actions already have the canonical `session.user.isDemo` guard at Step 2, all non-household actions.ts files are also fully guarded, and the `computeInitialCycleBoundaries` function from the cycle engine is already importable by `prisma/seed.ts`.

The most impactful implementation decision is the cycle bootstrap strategy: inlining `tx.cycle.create` with a manually shifted `startDate`/`endDate` is the recommended approach because it avoids walking `createHousehold` and then patching the Cycle row separately, which would create two writes instead of one. The demo household's timezone is "UTC" so all date arithmetic collapses to plain `new Date()` with `subDays`/`addDays` from date-fns.

The static guard audit test (D-13) is straightforward to implement using the same `readFileSync` + regex pattern established by `tests/phase-06/links-audit.test.ts` and `tests/phase-06/dashboard-redirect.test.ts`. The audit must declare explicit allowed-exceptions for functions that are legitimately guard-free: `startDemoSession` (the demo entry point itself), `registerUser` (pre-auth), and three read-only/passthrough helpers (`loadMoreWateringHistory`, `loadMoreTimeline`, `updateTimezone`). The test will go green immediately because all mutating functions already carry the guard.

**Primary recommendation:** Use approach (b) for cycle seeding: inline `tx.cycle.create` with `computeInitialCycleBoundaries` output date-shifted by -3/-4 days. Simplify `startDemoSession` to `findUnique → signIn → redirect`. Implement the static audit as a `readFileSync` + regex approach in `tests/phase-07/demo-guard-audit.test.ts`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Demo household seed data | Database / Storage | — | `prisma/seed.ts` runs at deploy/dev time against Postgres; all writes are direct Prisma calls, no HTTP layer |
| Demo session entry point | API / Backend | — | `startDemoSession` is a Server Action; `GET /demo` route handler calls it |
| isDemo guard enforcement | API / Backend | — | Step 2 of the 7-step Server Action template; server-side only, no UI involvement |
| Static guard audit test | — (build/CI tool) | — | Pure Node.js file-reading test; no DB, no auth, no HTTP |
| Cycle mid-window state | Database / Storage | — | Cycle row with adjusted start/end dates; computed at seed time |
| Availability sample data | Database / Storage | — | Direct `tx.availability.create` inside the seed transaction |

---

## Standard Stack

No new libraries required. All tools are already installed.

### Core (already present)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `bcryptjs` | installed | Hash unusable sample member passwords | Already used in seed.ts and auth/actions.ts |
| `date-fns` | `^4.x` | `subDays`, `addDays` for mid-window cycle dates | Already imported in seed.ts |
| `@date-fns/tz` | `1.4.1` | `TZDate` for DST-safe date math (already a direct dep) | Required by `computeInitialCycleBoundaries` |
| `crypto` (Node built-in) | — | `randomBytes(64)` for unusable password source | No install needed |
| `vitest` | `4.1.4` | Static audit test runner | Already configured in vitest.config.mts |

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
npx prisma db seed
        |
        v
  [seed.ts: main()]
        |
        +-- careProfile upsert (catalog entries)
        |
        +-- db.user.findUnique(DEMO_EMAIL)
              |
              | (not exists path)
              v
        db.$transaction(tx)
              |
              +-- tx.user.create(demo user)
              +-- tx.household.create("Demo Household")
              +-- tx.householdMember.create(demo user, OWNER, rotationOrder:0)
              +-- tx.user.create(alice — unusable password)
              +-- tx.householdMember.create(alice, MEMBER, rotationOrder:1)
              +-- tx.user.create(bob — unusable password)
              +-- tx.householdMember.create(bob, MEMBER, rotationOrder:2)
              +-- computeInitialCycleBoundaries(now, "UTC", 7) → shift -3/-4 days
              +-- tx.cycle.create(cycleNumber:1, startDate:now-3d, endDate:now+4d, assignedUserId:demoUser.id)
              +-- tx.availability.create(on alice/bob, startDate:now+10d, endDate:now+17d)
        |
        +-- (outside tx) db.room.create x2
        +-- (outside tx) db.plant.create x8 + db.wateringLog.create x8


GET /demo → startDemoSession()
        |
        +-- db.user.findUnique(DEMO_EMAIL)
        |     |
        |     | (not found)
        |     v
        |   return { error: "Run npx prisma db seed first." }
        |
        +-- signIn("credentials", { email, password, redirectTo: /h/<demoSlug>/dashboard })
              → NEXT_REDIRECT (success path)
              → { error: ... } (catch path, re-throws NEXT_REDIRECT)


Vitest: tests/phase-07/demo-guard-audit.test.ts
        |
        +-- glob("src/features/**/actions.ts")
        +-- for each file: readFileSync + regex-extract exported function bodies
        +-- assert each body contains "session.user.isDemo"
        +-- SKIP_LIST: startDemoSession, registerUser, loadMoreWateringHistory,
                       loadMoreTimeline, updateTimezone
        +-- on failure: throw with list of (file:functionName) pairs
```

### Recommended Project Structure

No new directories. Changes land in existing locations:

```
prisma/
├── seed.ts              # expanded — seedDemoHousehold helper added (D-10)
src/
├── features/
│   └── demo/
│       ├── actions.ts   # startDemoSession simplified (D-11)
│       └── seed-data.ts # DEMO_SAMPLE_MEMBERS constant added
tests/
└── phase-07/
    └── demo-guard-audit.test.ts  # NEW (D-13)
```

### Pattern 1: Unusable Password Construction (D-02)

```typescript
// Source: Node.js crypto (built-in) + bcryptjs (already in project)
import crypto from "node:crypto";
import bcryptjs from "bcryptjs";

// Generate a bcrypt hash of a random 64-byte value never stored anywhere.
// bcryptjs accepts a 72-byte input limit; 64 bytes in hex = 128 chars, so
// use the raw buffer with .toString("base64") to stay under 72 bytes safely.
// Alternatively: hash a fixed-length random hex — bcryptjs truncates at 72 chars
// for the comparison, meaning ANY input >= 72 chars that nobody knows will fail.
const unusableHash = await bcryptjs.hash(
  crypto.randomBytes(32).toString("hex"), // 64 hex chars, well under 72-byte bcrypt limit
  12
);
```

**Verification:** `bcryptjs.compare(anyString, unusableHash)` returns `false` because
the source secret is never stored. The comparison value (64-hex-char random string) is
generated fresh each seed run and discarded immediately. [VERIFIED: codebase inspection of bcryptjs usage in seed.ts and auth.ts]

### Pattern 2: Mid-Window Cycle Seeding (D-04, D-07 — Option B Recommended)

Option B (inline `tx.cycle.create` with shifted dates) is recommended over Option A (route through `createHousehold` then patch). Rationale:

- `createHousehold` in `src/features/household/actions.ts` calls `computeInitialCycleBoundaries(new Date(), ...)` and inserts a Cycle with `startDate = tomorrow`. Getting a mid-window cycle via that path requires a subsequent `tx.cycle.update` to shift `startDate`/`endDate` backward — two writes instead of one.
- Option B calls `computeInitialCycleBoundaries` directly (it is already imported by `prisma/seed.ts` as an available export), produces the boundaries, then applies the day shift before the single `tx.cycle.create`. This keeps the "single write path" narrative intact.
- `computeInitialCycleBoundaries` produces `anchorDate = startOfDay(tomorrow)`, `startDate = anchorDate`, `endDate = anchorDate + 7 days`. For the seed, override: `startDate = now - 3 days`, `endDate = now + 4 days`. The `anchorDate` can remain as produced (tomorrow) — it is used only for the `computeAssigneeIndex` formula in `computeAssigneeIndex`, which is never called on the initial seed; what matters for the demo is the visible `startDate`/`endDate` window.

```typescript
// Source: prisma/seed.ts + src/features/household/cycle.ts (computeInitialCycleBoundaries)
import { computeInitialCycleBoundaries } from "../src/features/household/cycle";
import { subDays, addDays } from "date-fns";

const now = new Date();
const { anchorDate } = computeInitialCycleBoundaries(now, "UTC", 7);
// Override start/end to mid-window per D-04
const cycleStartDate = subDays(now, 3);
const cycleEndDate = addDays(now, 4);

await tx.cycle.create({
  data: {
    householdId: household.id,
    cycleNumber: 1,
    anchorDate,               // tomorrow in UTC (from computeInitialCycleBoundaries)
    cycleDuration: 7,
    startDate: cycleStartDate,  // now - 3 days
    endDate: cycleEndDate,      // now + 4 days
    status: "active",
    assignedUserId: demoUser.id,  // D-04: demo user is active assignee
    memberOrderSnapshot: [
      { userId: demoUser.id, rotationOrder: 0 },
      { userId: aliceUser.id, rotationOrder: 1 },
      { userId: bobUser.id, rotationOrder: 2 },
    ],
  },
});
```

**Why no TZDate needed for UTC:** The demo household timezone is "UTC" (confirmed in seed.ts line 79). When timezone is UTC, `new TZDate(now.getTime(), "UTC")` produces the same result as `new Date(now)`. `subDays` and `addDays` from date-fns operate on UTC when given plain Date objects and the timezone is UTC. No TZDate wrapping is needed here — the `computeInitialCycleBoundaries` call produces the anchor (for correctness), and the shifted dates use plain date-fns. [VERIFIED: seed.ts line 79, cycle.ts computeInitialCycleBoundaries implementation]

### Pattern 3: Availability Seeding (D-06)

The `Availability` model has these fields (verified from `prisma/schema.prisma`):

```
id          String   @id @default(cuid())
userId      String                         -- FK → User (required)
householdId String                         -- FK → Household (required)
startDate   DateTime @db.Timestamptz(3)    -- no midnight normalization in schema
endDate     DateTime @db.Timestamptz(3)    -- no midnight normalization in schema
reason      String?                        -- optional
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

The `createAvailability` Server Action (lines 197–207 of household/actions.ts) validates `startDate >= today` and `endDate > startDate` at the action level, but the schema has no DB-level constraint on this. For seed purposes, direct `tx.availability.create` bypasses those action-level validations safely. The seed just needs to produce a valid future range.

```typescript
// Source: prisma/schema.prisma + src/features/household/actions.ts createAvailability
const sampleMember = aliceUser; // or bob — Claude's discretion (D-06 says "a sample member")

await tx.availability.create({
  data: {
    userId: sampleMember.id,
    householdId: household.id,
    startDate: addDays(now, 10),   // D-06: future window, now + 10 days
    endDate: addDays(now, 17),     // D-06: now + 17 days
    reason: "Out of town",         // optional; adds UI completeness
  },
});
```

No date normalization (midnight anchoring) is enforced at the schema or query level — the availability range check in `findNextAssignee` uses `startDate <= X AND endDate >= X` inclusive semantics. The seed values only need to be in the future and not overlap with now. [VERIFIED: schema.prisma lines 196–210, availability.ts findOverlappingPeriod, cycle.ts findNextAssignee]

### Pattern 4: startDemoSession Simplification (D-11)

Current `startDemoSession` (src/features/demo/actions.ts, lines 16–142): lazy-creates user + household + rooms + plants on first hit.

Simplified shape:

```typescript
// Source: src/features/demo/actions.ts (current pattern) + src/app/(auth)/demo/route.ts
export async function startDemoSession() {
  try {
    const demo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!demo) {
      return { error: "Demo data not found. Run `npx prisma db seed` to set up the demo." };
    }

    // signIn throws NEXT_REDIRECT on success — the catch block re-throws it
    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo: "/dashboard",  // Legacy redirect stub resolves to /h/<demoSlug>/dashboard
    });
  } catch (error) {
    const { isRedirectError } = await import("next/dist/client/components/redirect-error");
    if (isRedirectError(error)) throw error;
    return { error: "Could not start demo session. Please try again." };
  }
}
```

**Redirect destination:** The `redirectTo: "/dashboard"` target is correct. The legacy `/dashboard` page at `src/app/(main)/dashboard/page.tsx` resolves the user's default household and redirects to `/h/<slug>/dashboard`. This path already works for the existing demo flow and is listed in `ALLOWED_PREFIXES` in the links-audit test. The demo user's default household is `isDefault: true` (set in seed) so the landing always reaches the Demo Household. [VERIFIED: demo/actions.ts line 133, route.ts GET handler, links-audit.test.ts ALLOWED_PREFIXES]

**Error branch:** The route handler at `src/app/(auth)/demo/route.ts` checks `result?.error` and redirects to `/login?error=demo_failed`. This contract is unchanged — returning `{ error: "..." }` from the simplified `startDemoSession` flows correctly into the existing error branch. [VERIFIED: route.ts lines 24–30]

### Pattern 5: seedDemoHousehold Helper in seed.ts

The current `prisma/seed.ts` checks `if (!existingDemo)` at line 46 before creating the demo user. The expanded seed slots entirely within that block. A `seedDemoHousehold` helper function is cleaner than inlining ~70 lines directly in `main()`.

Recommended structure:

```typescript
// prisma/seed.ts
async function seedDemoHousehold(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  // 1. Create demo user
  // 2. Slug loop + household.create
  // 3. Create sample users (alice, bob) with unusable passwords
  // 4. Create HouseholdMember rows x3
  // 5. Cycle #1 (mid-window, D-04)
  // 6. Availability row (future, D-06)
  // Return { demoUser, household, aliceUser, bobUser }
}

async function main() {
  // ...catalog seed...
  const existingDemo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!existingDemo) {
    const { demoUser, household } = await db.$transaction(seedDemoHousehold);
    // Outside the tx: rooms + plants (existing pattern)
  }
}
```

**Idempotency:** The entire `seedDemoHousehold` block is inside `if (!existingDemo)`, so re-running `prisma db seed` when the demo user exists is a no-op. The sample member emails (`alice@demo.plantminder.app`, `bob@demo.plantminder.app`) would fail the `@@unique` constraint on `User.email` if a second run somehow passed the outer guard, which is safe. The `careProfile.upsert` loop at the top is already idempotent. [VERIFIED: seed.ts lines 45–46, schema.prisma User.email @unique]

### Anti-Patterns to Avoid

- **Routing through `createHousehold` action for the seed cycle:** `createHousehold` is a Server Action with `"use server"` and `auth()` calls. It cannot be called from `prisma/seed.ts` (no HTTP context, no session). Import `computeInitialCycleBoundaries` directly from `src/features/household/cycle.ts` instead.
- **Using `TZDate` for UTC arithmetic:** Unnecessary complexity. `subDays(now, 3)` and `addDays(now, 4)` produce correct UTC results when the household timezone is "UTC". TZDate is load-bearing for non-UTC households (DST safety), not for UTC.
- **Checking `session.user.isDemo` in the audit test at runtime:** The audit test must not import action modules. It reads source files as text and checks for the literal string. Importing modules would pull in `auth()`, Prisma, and Next.js internals.
- **Placing `startDemoSession` in the SKIP_LIST of the audit test:** `startDemoSession` does not need the guard because it is the demo entry point itself (it creates the demo session, not a mutating write). The audit test must explicitly exclude it so the test passes without adding a spurious guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unusable password sentinel | Custom "INVALID" or empty string in passwordHash | `bcryptjs.hash(crypto.randomBytes(32).toString("hex"), 12)` | bcryptjs will always return false on compare; custom sentinels may pass if `bcryptjs.compare` is ever called with an empty string depending on implementation |
| Mid-window date arithmetic | Custom millisecond math | `subDays(now, 3)` / `addDays(now, 4)` from date-fns | Already imported in seed.ts; DST-safe for UTC context |
| AST parsing for the audit test | `@babel/parser`, `ts-morph` | `readFileSync` + regex on function bodies | The test's invariant is a one-liner regex check; AST tools add install weight and complexity for zero benefit when the literal string `session.user.isDemo` is the exact contract |

**Key insight:** The guard audit is fundamentally a source-text grep, not semantic analysis. The convention that the literal token `session.user.isDemo` appears in every function body is the contract. A regex on the function-body text is sufficient and mirrors how `tests/phase-06/dashboard-redirect.test.ts` verifies sort order contracts.

---

## Guard Audit Baseline (HDMO-02 Verification)

**Complete inventory of exported functions across all `src/features/**/actions.ts` files, verified against source:**

### `src/features/household/actions.ts` — 15 mutating actions
All 15 confirmed to have `session.user.isDemo` guard at Step 2. [VERIFIED: grep count = 15]

| Function | Guard Present |
|----------|--------------|
| `createHousehold` (line 44) | YES — line 50-52 |
| `skipCurrentCycle` (line 138) | YES — line 144-146 |
| `createAvailability` (line 189) | YES — line 195-197 |
| `deleteAvailability` (line 258) | YES — line 264-266 |
| `createInvitation` (line 306) | YES — line 312-315 |
| `revokeInvitation` (line 362) | YES — line 368-371 |
| `acceptInvitation` (line 433) | YES — line 437-440 |
| `leaveHousehold` (line 533) | YES — line 538-541 |
| `removeMember` (line 645) | YES — line 649-652 |
| `promoteToOwner` (line 735) | YES — line 739-742 |
| `demoteToMember` (line 784) | YES — line 788-791 |
| `markNotificationsRead` (line 857) | YES — line 862-864 |
| `setDefaultHousehold` (line 908) | YES — line 913-916 |
| `updateHouseholdSettings` (line 975) | YES — line 980-983 |
| `reorderRotation` (line 1046) | YES — line 1051-1054 |

### Other `features/**/actions.ts` files

| File | Functions | Guard Count | Notes |
|------|-----------|-------------|-------|
| `features/plants/actions.ts` | 5 (createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant) | 5 | All guarded |
| `features/rooms/actions.ts` | 3 (createRoom, updateRoom, deleteRoom) | 3 | All guarded |
| `features/watering/actions.ts` | 4 (logWatering, editWateringLog, deleteWateringLog, loadMoreWateringHistory) | 3 | `loadMoreWateringHistory` is read-only — no guard needed |
| `features/notes/actions.ts` | 4 (createNote, updateNote, deleteNote, loadMoreTimeline) | 3 | `loadMoreTimeline` is read-only — no guard needed |
| `features/reminders/actions.ts` | 4 (snoozeReminder, snoozeCustomReminder, togglePlantReminder, toggleGlobalReminders) | 4 | All guarded |
| `features/auth/actions.ts` | 3 (registerUser, updateTimezone, completeOnboarding) | 2 | `registerUser` is pre-auth (no session); `updateTimezone` guard returns void, not error object |
| `features/demo/actions.ts` | 2 (startDemoSession, seedStarterPlants) | 1 | `startDemoSession` is the demo entry point (no guard appropriate); `seedStarterPlants` guarded |

**Pre-existing gap analysis for the audit test (D-13/D-14):**

The audit test as literally described by D-13/D-14 (every exported function must contain `session.user.isDemo`) would fail on 4 functions that are legitimately guard-free:

1. **`startDemoSession`** — the demo sign-in initiator; adding the guard would make demo mode inaccessible to itself
2. **`registerUser`** — pre-auth; no session exists yet
3. **`loadMoreWateringHistory`** — read-only paginator; writes nothing
4. **`loadMoreTimeline`** — read-only paginator; writes nothing
5. **`updateTimezone`** — writes User.timezone only; guard is present (`if (session.user.isDemo) return;`) but returns void, not error object

Items 3 and 4 have no `session.user.isDemo` check at all. Items 1, 2, and 5 need special handling.

**Recommendation:** The audit test should declare a `SKIP_FUNCTIONS` set (not a file-level exclusion) for these 5 function names. This is preferable to excluding entire files because excluding the whole `auth/actions.ts` or `demo/actions.ts` would let future mutating additions slip through undetected.

**`updateTimezone` edge case:** It has `if (session.user.isDemo) return;` which is a valid guard (just returns void instead of an error object). The audit test regex should match `session.user.isDemo` as a literal string — this form passes. No exception needed for `updateTimezone`.

**Revised SKIP_FUNCTIONS list:** `startDemoSession`, `registerUser`, `loadMoreWateringHistory`, `loadMoreTimeline`.

**Revised guard count:** 36 total exported functions across all 8 files. 32 have `session.user.isDemo`. 4 are in SKIP_FUNCTIONS (no guard, legitimately). The audit test passes on the current codebase with these 4 in the skip list.

---

## Common Pitfalls

### Pitfall 1: `computeInitialCycleBoundaries` Is a Pure Function — Import Directly
**What goes wrong:** Developer tries to route through `createHousehold` (a Server Action) from `prisma/seed.ts`, hits a missing `auth()` context or import error.
**Why it happens:** `createHousehold` lives in `src/features/household/actions.ts` which has `"use server"` and calls `auth()` internally.
**How to avoid:** Import `computeInitialCycleBoundaries` from `src/features/household/cycle.ts` directly. It is a pure function with no auth dependencies. `prisma/seed.ts` already imports from `src/features/demo/seed-data` and `src/lib/slug`, so the import pattern is established.
**Warning signs:** TypeScript errors about `auth()` being called outside a request context.

### Pitfall 2: Cycle `anchorDate` vs. `startDate` Semantics
**What goes wrong:** Setting `anchorDate = now - 3 days` breaks the `computeAssigneeIndex` formula for future cycle transitions.
**Why it happens:** `anchorDate` is the reference point for the formula `floor(daysSince / cycleDuration) % memberCount`. Setting it too far in the past shifts which rotation slot would be assigned in future cycles.
**How to avoid:** Keep `anchorDate` as produced by `computeInitialCycleBoundaries` (tomorrow). Only override `startDate` and `endDate` with the -3/+4 day shift. The demo cycle is a single static cycle — cron will eventually advance it naturally with a fresh anchor.
**Warning signs:** Cycle countdown shows wrong assignee after the demo cycle expires.

### Pitfall 3: Sample Member `isDemo` Contamination
**What goes wrong:** Sample members accidentally satisfy `email === DEMO_EMAIL` check if their email is set incorrectly, or if the JWT callback logic is modified.
**Why it happens:** The `isDemo` flag is derived dynamically in `auth.ts` line 21 on every sign-in.
**How to avoid:** Sample member emails must use a different domain suffix (e.g., `alice@demo.plantminder.app` != `demo@plantminder.app`). D-03 is a hard invariant.
**Warning signs:** Alice or Bob's login session has `isDemo: true` — cycle engine would see them as a demo user.

### Pitfall 4: Audit Test Imports Action Modules
**What goes wrong:** Importing `import * as actions from "@/features/household/actions"` in the test file causes `auth()`, Prisma, and Next.js server internals to load.
**Why it happens:** Server Actions have side effects at module load time (Prisma client init, NextAuth setup).
**How to avoid:** The audit test uses only Node.js file system APIs (`readFileSync`, `readdirSync`). It never imports from `src/`. Pattern matches `tests/phase-06/links-audit.test.ts` exactly.
**Warning signs:** Test file throws `DATABASE_URL is not set` or `Cannot find module 'next/headers'` at import time.

### Pitfall 5: Idempotency — Sample Member Email Collisions
**What goes wrong:** Re-running `prisma db seed` after partial failure creates a second demo household but fails on `alice@demo.plantminder.app` unique constraint.
**Why it happens:** The `if (!existingDemo)` guard checks for the demo user email only. If the demo user was created but the transaction rolled back before household creation, the seed would attempt to re-create alice and hit a unique constraint.
**How to avoid:** Wrap ALL demo-related creates (demo user + sample users + household + members + cycle + availability) in a single `$transaction`. The outer `if (!existingDemo)` check on demo user email is the idempotency gate. If the transaction rolls back, no User rows were created either (Prisma $transaction guarantee).
**Warning signs:** `Unique constraint failed on the fields: (email)` at seed time.

### Pitfall 6: `loadMoreWateringHistory` / `loadMoreTimeline` Exclusion Scope
**What goes wrong:** Audit test excludes these at the file level (skipping all of `watering/actions.ts`), allowing future mutating functions added to that file to slip past the audit.
**Why it happens:** Developer takes the path of least resistance to make the test pass.
**How to avoid:** Exclude by function name, not by file. The `SKIP_FUNCTIONS` constant in the test file should be a `Set<string>` checked against the parsed function name, not a file path exclusion.
**Warning signs:** A mutating `deleteWateringLogBulk` added in Phase 8 has no guard but the test passes because the whole file is excluded.

---

## Code Examples

### Verified Guard Pattern (canonical)

```typescript
// Source: src/features/household/actions.ts lines 44-52 (createHousehold)
export async function createHousehold(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (unchanged from v1 pattern)
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }
  // ...
}
```

### Verified Regex for Audit Test (extracting function bodies)

The `links-audit.test.ts` and `dashboard-redirect.test.ts` patterns use `readFileSync` + string regex. For the guard audit, the strategy is:

1. `readFileSync(file, "utf8")` to get the full source text
2. Match all `export async function <name>(` occurrences via regex
3. For each match, extract the function body by tracking brace depth from the opening `{`
4. Assert the body contains `session.user.isDemo`

```typescript
// Source: tests/phase-07/demo-guard-audit.test.ts (new file)
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_FUNCTIONS = new Set([
  "startDemoSession",   // demo entry point — no guard appropriate
  "registerUser",       // pre-auth — no session exists
  "loadMoreWateringHistory",  // read-only paginator
  "loadMoreTimeline",         // read-only paginator
]);

function walk(dir: string): string[] { /* ...same as links-audit.test.ts... */ }

function extractFunctionBodies(src: string): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  const funcRegex = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = funcRegex.exec(src)) !== null) {
    const name = m[1];
    // Find the opening brace of this function
    const openBrace = src.indexOf("{", m.index + m[0].length - 1);
    if (openBrace === -1) continue;
    // Walk to the matching close brace
    let depth = 0, i = openBrace;
    while (i < src.length) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) break; }
      i++;
    }
    results.push({ name, body: src.slice(openBrace, i + 1) });
  }
  return results;
}
```

This approach is sufficient because:
- D-14 says "direct body" — we do not need transitive analysis
- The literal string `session.user.isDemo` is the exact contract; no AST parsing needed
- Function body brace-tracking via string scan is ~15 lines and has no install dependencies

[VERIFIED: tests/phase-06/links-audit.test.ts, tests/phase-06/dashboard-redirect.test.ts for the established readFileSync pattern]

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `startDemoSession` lazy-bootstraps all demo data on first `/demo` hit | Simplified: `findUnique → signIn → redirect` | D-11 eliminates the lazy path |
| Demo household has 1 member | Demo household has 3 members + Cycle + Availability | This phase adds the household data |
| No guard regression test | Static `demo-guard-audit.test.ts` audit | D-13 locks in guard coverage |

**Deprecated/outdated after this phase:**
- The lazy creation block in `startDemoSession` (lines 20–127 of demo/actions.ts): entirely removed by D-11.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `anchorDate` produced by `computeInitialCycleBoundaries` (tomorrow) can remain as-is while `startDate`/`endDate` are overridden to -3/+4 days | Pattern 2 (Cycle Seeding) | If the cron or `transitionCycle` derives `endDate` from `anchorDate` rather than from the stored `endDate`, the demo cycle duration would be wrong. Risk: LOW — `transitionCycle` reads `outgoing.endDate` directly from the row, not from `anchorDate`. [VERIFIED: cycle.ts STEP 4 uses `outgoing.endDate`] |

If this table is effectively empty of risks: A1 is LOW confidence only because it depends on implementation internals of `transitionCycle` which were verified but worth confirming during implementation.

---

## Open Questions

1. **Whether to seed a `HouseholdNotification` row for the demo cycle**
   - What we know: The cycle engine emits a `cycle_started` notification inside `transitionCycle` for every new cycle. The demo cycle is seeded directly (bypassing `transitionCycle`), so no notification row is emitted automatically.
   - What's unclear: Whether the bell dropdown showing empty is confusing vs. acceptable for the demo experience (Claude's discretion per CONTEXT.md).
   - Recommendation: Default to not seeding notification rows. The `CycleCountdownBanner` renders from Cycle data and is visible immediately. The bell being empty on first demo visit is acceptable — the user can see the banner explains the cycle state.

2. **Which sample member gets the availability row**
   - What we know: D-06 says "on a sample member (not the demo user)". Both alice and bob qualify.
   - What's unclear: Whether placing it on alice (rotationOrder: 1, the "next" member) vs. bob (rotationOrder: 2) affects any UI rendering.
   - Recommendation: Place on alice (rotationOrder: 1). The availability section on the settings page shows all members' availability periods. Alice being "next in rotation" makes the availability period more meaningful to a demo visitor reading the settings page.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no changes requiring external tools beyond the project's existing Node.js + PostgreSQL setup. The seed runs against the same DB that is already live for development.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` (project root) |
| Quick run command | `npx vitest run tests/phase-07/` |
| Full suite command | `npx vitest run` |

The config file includes `tests/**/*.{test,spec}.{ts,tsx}` — a new `tests/phase-07/` directory is auto-discovered.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HDMO-01 | Demo user can sign in and reaches Demo Household with active cycle and availability visible | Integration (manual smoke) | Chrome DevTools MCP UAT | No — manual-only; requires running DB + seeded demo |
| HDMO-01 | Seeded demo household has exactly 3 HouseholdMember rows with correct rotationOrders | Unit (static) | `npx vitest run tests/phase-07/seed-structure.test.ts` | No — Wave 0 gap |
| HDMO-02 | Every exported function in `features/**/actions.ts` (except SKIP_FUNCTIONS) contains `session.user.isDemo` | Static audit | `npx vitest run tests/phase-07/demo-guard-audit.test.ts` | No — Wave 0 gap |

**Manual-only justification for HDMO-01 integration:** The full happy path (seed → `GET /demo` → dashboard renders with cycle banner + availability) requires a live PostgreSQL DB, a running Next.js dev server, and browser navigation. This cannot be automated in Vitest without a full Playwright E2E setup. The Chrome DevTools MCP checkpoint is the appropriate gate for this requirement.

**Static audit test IS the HDMO-02 validation.** The test reads source files and requires no runtime DB. It goes green immediately on the current codebase (all 15 household actions + all other actions files are already guarded) and acts as the regression gate for future phases.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/phase-07/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + Chrome DevTools MCP UAT confirming demo household renders before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/phase-07/demo-guard-audit.test.ts` — covers HDMO-02 (the static guard audit)
- [ ] `tests/phase-07/seed-structure.test.ts` — optional structural assertions on the seed output (readFileSync source-grep of seed.ts to confirm expected create calls are present)

No framework install needed — Vitest 4.1.4 is already configured and the `tests/phase-07/` directory is automatically in scope.

*(Alternatively, `seed-structure.test.ts` can be omitted in favor of the Chrome DevTools MCP UAT checkpoint, which is richer.)*

---

## Security Domain

`security_enforcement` is not explicitly set to `false` in config.json — this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | Unusable bcrypt hash ensures sample members cannot authenticate (D-02/D-03) |
| V3 Session Management | No | No session logic changes; `isDemo` derivation in `auth.ts` unchanged |
| V4 Access Control | Yes | Demo guard at Step 2 of all mutating Server Actions — verified present on all 36 applicable functions |
| V5 Input Validation | No | Seed uses direct Prisma writes; no user input in this phase |
| V6 Cryptography | Partial | Unusable password uses `crypto.randomBytes(32)` (CSPRNG) + bcryptjs (12 rounds) — standard |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sample member login (D-02/D-03) | Spoofing | `bcryptjs.hash(randomBytes)` — source secret is never stored; compare always returns false |
| Demo user accessing household data of real users | Information Disclosure | `requireHouseholdAccess` guard (Step 4) enforces membership; demo user can only access their own household |
| Future phase bypassing isDemo guard | Tampering | `demo-guard-audit.test.ts` (D-13) — regression gate on every CI run |
| Seed running against production DB | Tampering | `if (!existingDemo)` idempotency guard prevents clobbering existing data; seed should only run in dev/staging |

---

## Sources

### Primary (HIGH confidence — codebase verified)
- `prisma/seed.ts` — current seed structure, idempotency guard, existing transaction shape
- `src/features/demo/actions.ts` — `startDemoSession` lazy creation block (to be removed), `seedStarterPlants` guard pattern
- `src/features/household/cycle.ts` — `computeInitialCycleBoundaries` signature and implementation, `transitionCycle` STEP 4 outgoing.endDate usage
- `src/features/household/actions.ts` — all 15 actions with guard locations (line numbers verified)
- `prisma/schema.prisma` — `Availability` model fields, `Cycle` model fields, `HouseholdMember` composite key
- `auth.ts` — JWT callback `isDemo` derivation (line 21), `activeHouseholdId` sign-in resolution
- `src/app/(auth)/demo/route.ts` — error branch shape (`result?.error` → redirect `/login?error=demo_failed`)
- `src/features/demo/seed-data.ts` — `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_PLANTS` for reference
- `tests/phase-06/links-audit.test.ts` — `readFileSync` + regex pattern for the audit test
- `tests/phase-06/dashboard-redirect.test.ts` — source-grep behavioral surrogate pattern
- `vitest.config.mts` — test include glob (`tests/**/*.{test,spec}.{ts,tsx}`), confirming `tests/phase-07/` is auto-discovered
- `.planning/config.json` — `workflow.nyquist_validation: true`

### Secondary (MEDIUM confidence)
- None required — all claims are directly verified from codebase source files.

---

## Metadata

**Confidence breakdown:**
- Seed expansion: HIGH — implementation is additive, all primitives verified in codebase
- Cycle bootstrap (Option B): HIGH — `computeInitialCycleBoundaries` is importable, STEP 4 usage of `outgoing.endDate` is verified
- `startDemoSession` simplification: HIGH — route handler contract verified, redirect destination confirmed
- Guard audit baseline: HIGH — function-by-function grep verified against all 8 action files
- Static audit test design: HIGH — pattern mirrors two existing test files in the codebase

**Research date:** 2026-04-20
**Valid until:** 2026-06-01 (stable domain — only invalidated by Phase 8 adding new mutating actions)
