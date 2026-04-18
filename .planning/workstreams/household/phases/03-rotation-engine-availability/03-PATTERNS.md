# Phase 3: Rotation Engine + Availability — Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 22 (8 new code, 7 extended code, 1 new migration, 13 new test files, 3 config)
**Analogs found:** 20 / 22 (two files — `cycle.ts` transition function and Node-runtime Route Handler — have no in-repo analog; RESEARCH.md §Pattern 1 / §Pattern 3 supply templates)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/household/cycle.ts` | domain helper (transition engine) | write + row-level lock (transaction boundary) | `src/features/auth/actions.ts` `registerUser` `$transaction` (lines 45-89) | role-match (no in-repo `FOR UPDATE SKIP LOCKED` analog) |
| `src/features/household/availability.ts` | domain helper (pure predicates) | read-only (pure functions) | `src/features/household/guards.ts` (module shape) | role-match (no pure-predicate module yet) |
| `src/features/household/cron.ts` | orchestrator (loops transitions) | read + per-iteration transaction | `src/features/auth/actions.ts` `completeOnboarding` (module shape) | role-match |
| `src/app/api/cron/advance-cycles/route.ts` | Route Handler (Node runtime, bearer auth) | request-response | `src/app/api/auth/[...nextauth]/route.ts` (lines 1-3) | role-only (no bearer-auth handler exists) |
| `tests/phase-03/rotation-formula.test.ts` | unit test (pure function) | in-memory | `tests/household-create.test.ts` (lines 1-16 header + mock style) | good match |
| `tests/phase-03/cycle-boundaries.test.ts` | unit test (pure function) | in-memory | `tests/household-create.test.ts` | good match |
| `tests/phase-03/dst-boundary.test.ts` | unit test (real `@date-fns/tz` IANA) | in-memory (no DB, no mocks) | `tests/household-create.test.ts` (plain `describe/test`) | role-match |
| `tests/phase-03/availability-create.test.ts` | unit test (mocked Prisma) | mocked | `tests/household-create.test.ts` (lines 1-62) | exact |
| `tests/phase-03/availability-delete.test.ts` | unit test (mocked Prisma) | mocked | `tests/household-create.test.ts` | exact |
| `tests/phase-03/cron-endpoint.test.ts` | unit/integration test (Route Handler) | mocked `advanceAllHouseholds` | `tests/household-create.test.ts` (mock style) | role-match |
| `tests/phase-03/transition-concurrency.test.ts` | integration test (real Postgres) | real DB, `Promise.all` parallel | `tests/household-integration.test.ts` (entire file) | exact |
| `tests/phase-03/transition-auto-skip.test.ts` | integration test (real Postgres) | real DB | `tests/household-integration.test.ts` | exact |
| `tests/phase-03/transition-manual-skip.test.ts` | integration test (real Postgres) | real DB | `tests/household-integration.test.ts` | exact |
| `tests/phase-03/transition-fallback.test.ts` | integration test (real Postgres) | real DB | `tests/household-integration.test.ts` | exact |
| `tests/phase-03/transition-paused.test.ts` | integration test (real Postgres) | real DB | `tests/household-integration.test.ts` | exact |
| `tests/phase-03/transition-paused-resume.test.ts` | integration test (real Postgres) | real DB | `tests/household-integration.test.ts` | exact |
| `src/features/household/actions.ts` | Server Action (extended) | write (7-step template) | same file: `createHousehold` lines 20-81 | exact (self-pattern) |
| `src/features/household/queries.ts` | Server query (extended) | read | same file: `getUserHouseholds` lines 31-44 | exact (self-pattern) |
| `src/features/household/schema.ts` | Zod v4 schema (extended) | validation | same file: `createHouseholdSchema` lines 23-27 + `registerSchema` refine | exact |
| `src/features/auth/actions.ts` | Server Action (extended `$transaction`) | write (transaction) | same file lines 45-89 | exact (self-pattern, 1 added step) |
| `prisma/schema.prisma` | Prisma schema (extended) | DDL | same file: `Cycle` (171-189), `HouseholdMember` (57-70), `Invitation` (207-222) | exact |
| `proxy.ts` | NextAuth edge proxy (matcher edit) | request-response | same file (1-line matcher diff) | exact |
| `.env.example` | env template | config | same file | exact |
| `package.json` | deps manifest | config | same file `dependencies` block | exact |

---

## Pattern Assignments

### `src/features/household/cycle.ts` (NEW — engine internals)

**Role:** Domain helper module exporting `transitionCycle`, `findNextAssignee`, `computeAssigneeIndex`, `computeInitialCycleBoundaries`, `computeNextCycleBoundaries`, and the `TRANSITION_REASONS` / `NOTIFICATION_TYPES` constants.

**Primary analog for `$transaction` shape:** `src/features/auth/actions.ts` `registerUser` lines **45–89** (interactive `$transaction` with multiple `tx.*` writes that depend on earlier `tx.*` return values — exact shape `transitionCycle` must adopt, plus a `tx.$queryRaw` as the first statement).

**Imports pattern to copy** (from `src/features/auth/actions.ts:1-11` + `src/features/household/actions.ts:1-6`):
```typescript
import { db } from "@/lib/db";
// no "use server" directive — this is a plain domain module, not a Server Action file
```

**`$transaction` with multi-table write — analog** (`src/features/auth/actions.ts:45-89`):
```typescript
await db.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email, passwordHash } });
  // ... slug loop ...
  const household = await tx.household.create({ data: { ... } });
  await tx.householdMember.create({
    data: { userId: user.id, householdId: household.id, role: "OWNER", rotationOrder: 0, isDefault: true },
  });
});
```
**What to replicate:** the single-callback-multiple-writes idiom; each `tx.*` call uses the same transaction client; thrown errors roll back everything.
**What to change:** prepend `await tx.$queryRaw<...>'SELECT ... FOR UPDATE SKIP LOCKED'` as the very first statement (no in-repo analog; see RESEARCH §Pattern 1 lines 291-398 for the template); early-return `{ skipped: true }` if the lock select returns `[]`.

**Notification INSERT inside the same transaction — no in-repo analog.** Use RESEARCH §Pattern 1 lines 374-388 verbatim for the `try { tx.householdNotification.create(...) } catch P2002` block.

**`@date-fns/tz` TZDate usage — no in-repo analog.** Use RESEARCH §Pattern 2 lines 424-446 verbatim for `computeInitialCycleBoundaries` / `computeNextCycleBoundaries`. Import style:
```typescript
import { addDays, startOfDay } from "date-fns";
import { TZDate } from "@date-fns/tz";
```

**Error handling:** follow `src/features/auth/actions.ts:98-104` — let Prisma errors propagate; caller (cron or action) converts them.

---

### `src/features/household/availability.ts` (NEW — pure predicates)

**Role:** Exports `isMemberUnavailableOn(userId, date)`, `findOverlappingPeriod(userId, householdId, start, end)`. Pure functions / thin Prisma read wrappers; no `auth()`, no transactions.

**Analog module shape:** `src/features/household/guards.ts` (52 lines — single-responsibility domain module with JSDoc + one or two helpers + no `"use server"` directive).

**Imports pattern to copy** (`src/features/household/guards.ts:1-2`):
```typescript
import { db } from "@/lib/db";
// NO auth import — pure predicates
```

**`findOverlappingPeriod` body pattern** — `findFirst` with composite range-overlap `where` (no existing analog for range queries; closest is `guards.ts:37-40` findFirst on `@@unique` — copy the `findFirst` call style):
```typescript
const row = await db.availability.findFirst({
  where: {
    userId,
    householdId,
    startDate: { lte: endDate },
    endDate:   { gte: startDate },
  },
  select: { id: true, startDate: true, endDate: true },
});
```
(Operators come from CONTEXT.md D-06; Pitfall E in RESEARCH flags half-open vs closed — match D-06 literally: `lte`/`gte`.)

---

### `src/features/household/cron.ts` (NEW — orchestrator)

**Role:** Exports `advanceAllHouseholds()` — queries candidate households, loops sequentially, catches per-household errors, returns `{ ranAt, totalHouseholds, transitions, errors }`.

**Analog:** No existing batch orchestrator in repo. Closest structural analog is `src/features/auth/actions.ts:107-126` `updateTimezone` for "module-level async function that does its own `auth()`/safety checks and calls `db.*`" — but cron is NOT a Server Action (no `"use server"`). Use plain TS module shape, RESEARCH §"Cron Orchestrator — Sequential Per-Household Loop" lines 803-863 as the verbatim template.

**Imports pattern:**
```typescript
import { db } from "@/lib/db";
import { transitionCycle } from "./cycle";
// NO "use server" — this is called from the Route Handler, not form actions
```

**Core pattern:** use RESEARCH.md lines 807-862 (complete template) with no changes except resolving the `result.reason` field to the actual TransitionResult shape chosen in `cycle.ts`.

---

### `src/app/api/cron/advance-cycles/route.ts` (NEW — Node runtime Route Handler)

**Role:** POST handler, bearer auth, `runtime = 'nodejs'`, delegates to `advanceAllHouseholds()`.

**Analog:** `src/app/api/auth/[...nextauth]/route.ts` (2 lines — just re-exports handlers). The in-repo analog exists only as "Route Handler lives in `app/api/<name>/route.ts`" convention; it provides NO pattern for bearer auth or Node runtime declaration. **Use RESEARCH §Pattern 3 lines 489-517 verbatim** as the template:

```typescript
// src/app/api/cron/advance-cycles/route.ts
import { NextRequest } from "next/server";
import { advanceAllHouseholds } from "@/features/household/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
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

**Critical:** this file will be intercepted by `proxy.ts` unless the matcher is updated (see `proxy.ts` section below — Pitfall A, RESEARCH.md line 15).

---

### `src/features/household/actions.ts` (EXTENDED — adds 3 new actions)

**Role:** Server Actions file (`"use server"` directive).

**Analog for the 7-step template:** same file, `createHousehold` lines **20–81**. Every new action must mirror this scaffolding.

**Imports pattern to copy** (lines 1-6):
```typescript
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { /* new schemas */ } from "./schema";
// NEW imports for Phase 3:
import { revalidatePath } from "next/cache";
import { HOUSEHOLD_PATHS } from "./paths";
import { requireHouseholdAccess, ForbiddenError } from "./guards";
import { transitionCycle } from "./cycle";
import { findOverlappingPeriod } from "./availability";
```

**7-step Server Action template — analog** (`src/features/household/actions.ts:20-81` — this IS the template per Phase 2 D-12):
```typescript
export async function createHousehold(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = createHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const userId = session.user.id;

  // Step 4: requireHouseholdAccess (SKIPPED for create-new-household; REQUIRED for all Phase 3 actions)

  // Step 5 + 6: $transaction / DB writes

  // Step 7: revalidatePath (if UI consumer exists) — omitted in createHousehold per Phase 2 D-07
  return { success: true, household };
}
```

**What to change per Phase 3 action:**

- **`skipCurrentCycle(data)`** — add Step 4 (`requireHouseholdAccess(parsed.data.householdId)` inside a try/catch for `ForbiddenError` → `{ error: err.message }`, from `guards.ts:31-51`); add the current-assignee assertion (D-14 Step 5: load cycle, compare `session.user.id === currentCycle.assignedUserId`); Step 6 calls `transitionCycle(householdId, 'manual_skip')`; Step 7 `revalidatePath("/h/[householdSlug]/dashboard", "page")` — use `HOUSEHOLD_PATHS.dashboard` from `paths.ts:16`.

- **`createAvailability(data)`** — Step 4 `requireHouseholdAccess` + Step 5 overlap-check via `findOverlappingPeriod` (return the conflict message from D-06 verbatim); Step 6 `db.availability.create`; Step 7 `revalidatePath` — note `paths.ts` does NOT yet include a `settings` entry, so **either (a) add `settings: "/h/[householdSlug]/settings"` to `HOUSEHOLD_PATHS` or (b) inline the path string with a TODO for Phase 6**. RESEARCH §Pattern 4 lines 534-584 has the full template; read and copy directly.

- **`deleteAvailability(data)`** — Step 4 fetches row first (`db.availability.findUnique`), then `requireHouseholdAccess(row.householdId)` for the dual-auth check (D-09: `row.userId === session.user.id || role === 'OWNER'`, else throw `ForbiddenError`). RESEARCH §Pattern 4 lines 586-615 is the template.

**Demo-mode error string:** MUST be exactly `"Demo mode — sign up to save your changes."` (from `actions.ts:27` — verbatim match for test assertions).

**`ForbiddenError` handling pattern to copy** (not yet in this file — copy from RESEARCH §Pattern 4 lines 547-552):
```typescript
try {
  await requireHouseholdAccess(parsed.data.householdId);
} catch (err) {
  if (err instanceof ForbiddenError) return { error: err.message };
  throw err;
}
```

---

### `src/features/household/queries.ts` (EXTENDED — adds `getCurrentCycle`, `getHouseholdAvailabilities`)

**Analog:** same file, `getUserHouseholds` lines **31–44**.

**Imports pattern** (`queries.ts:1`):
```typescript
import { db } from "@/lib/db";
// NO "use server" — Server Components read these directly
```

**Query style to copy** — simple `findMany` / `findUnique` with `include` or `select`, no `auth()` (the caller has already authorized via `requireHouseholdAccess`; note the security comment at `queries.ts:27-30`):
```typescript
export async function getUserHouseholds(userId: string) {
  const memberships = await db.householdMember.findMany({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ ... }));
}
```

**What to change:**
- **`getCurrentCycle(householdId)`** — `db.cycle.findFirst({ where: { householdId, status: { in: ['active', 'paused'] } }, orderBy: { cycleNumber: 'desc' } })`. Return shape locked by RESEARCH Cross-Phase Integration Surface as `Cycle | null`.
- **`getHouseholdAvailabilities(householdId)`** — `findMany` joined with `user: { select: { name: true, email: true } }` per D-08. Mirror the `.map((m) => ({ ... }))` shape transform at the end (lines 38-43).

**JSDoc convention:** mirror `queries.ts:3-12` — reference the D-number(s), explain which consumer uses it, note security preconditions.

---

### `src/features/household/schema.ts` (EXTENDED — Zod v4 for availability + skip)

**Analog:** same file (27 lines — full module to model after).

**Imports pattern** (line 1):
```typescript
import { z } from "zod/v4";
```

**Schema style to copy** (`schema.ts:23-27`):
```typescript
export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required.").max(80),
  timezone: z.string().optional(),
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
```

**`.refine` analog** — for `startDate >= today` (Pitfall 12). **No existing refine in `household/schema.ts`** — use the pattern from `src/features/auth/schemas.ts:15-18`:
```typescript
export const registerSchema = z
  .object({ /* ... */ })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
```

**Enum style to copy** (`schema.ts:8, 15`):
```typescript
export const householdRoleSchema = z.enum(["OWNER", "MEMBER"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
```
Use this for `transitionReasonSchema` and `notificationTypeSchema` (D-04 / D-18 string domains) — string enums, not Prisma enums.

**New schemas to add:**
- `createAvailabilitySchema` — `householdId: z.string().cuid()`, `startDate: z.date()` (or coerced), `endDate: z.date()`, `reason: z.string().max(200).optional()`, plus `.refine(d => d.endDate > d.startDate, ...)` and `.refine(d => d.startDate >= startOfToday(), ...)` (Pitfall 12).
- `deleteAvailabilitySchema` — `availabilityId: z.string().cuid()`, `householdSlug: z.string()` (hidden-field pattern per Phase 2 D-04).
- `skipCurrentCycleSchema` — `householdId: z.string().cuid()`.

---

### `src/features/auth/actions.ts` (EXTENDED — Cycle #1 write appended to `registerUser` `$transaction`)

**Analog:** same file, `registerUser` lines **13–105**. Specifically the `$transaction` callback at lines **45–89** gets ONE new statement appended as step 4 of the transaction.

**Imports pattern to add** (matching `actions.ts:1-11`):
```typescript
import { computeInitialCycleBoundaries } from "@/features/household/cycle";
```

**Existing transaction body** (`auth/actions.ts:45-89`) — DO NOT modify the user/slug/household/member writes; only APPEND:
```typescript
await db.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email, passwordHash } });

  // ... slug loop + household.create + householdMember.create ...

  // NEW (D-01): Cycle #1 eager creation — APPEND inside same transaction.
  const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
    new Date(),
    detectedTimezone,
    7, // must match household.cycleDuration above
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

**Identical extension required in `src/features/household/actions.ts` `createHousehold`** (lines 38-76): append the same Cycle #1 create block inside the existing `db.$transaction` callback after the `HouseholdMember` create (line 73). Use `parsed.data.timezone ?? "UTC"` (already computed at line 59).

---

### `prisma/schema.prisma` (EXTENDED — `Cycle.transitionReason`, `HouseholdNotification` model, back-relations)

**Analog for column addition:** `prisma/schema.prisma` `Cycle` model (lines **171–189**) — add one line before `@@unique`:
```prisma
  transitionReason    String?   // see src/features/household/schema.ts TRANSITION_REASONS
```
(String-nullable matches the `status String @default("active")` convention at line 180 — confirms D-04 choice.)

**Analog for new model with composite unique index:** `prisma/schema.prisma` `Cycle` model (lines 171-189) has `@@unique([householdId, cycleNumber])` + `@@index([householdId, status])`. Also `Availability` model (lines 191-205) has `@@index([userId, startDate, endDate])` — same composite style.

**`HouseholdNotification` model — direct lift from CONTEXT D-17 (lines 107-122 of CONTEXT.md), insert after `Availability` (line 205) or after `Invitation` (line 222):**
```prisma
model HouseholdNotification {
  id              String    @id @default(cuid())
  householdId     String
  household       Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  recipientUserId String
  recipient       User      @relation("HouseholdNotificationRecipient", fields: [recipientUserId], references: [id], onDelete: Cascade)
  type            String    // see TRANSITION_REASONS mapping
  cycleId         String?
  cycle           Cycle?    @relation(fields: [cycleId], references: [id], onDelete: SetNull)
  createdAt       DateTime  @default(now()) @db.Timestamptz(3)

  @@unique([cycleId, recipientUserId, type])
  @@index([recipientUserId, createdAt])
}
```
(Note: `recipient` uses a named relation `"HouseholdNotificationRecipient"` because `User` already has multiple relations to other models — follow the `User` model's `@relation("PlantCreatedBy", ...)` convention at lines 27-29 and `Cycle` `@relation("CycleAssignee", ...)` at line 182.)

**Back-relation additions required:**

1. **`User` model (line 10-37)** — add after line 36 (`acceptedInvitations`):
   ```prisma
   householdNotifications HouseholdNotification[] @relation("HouseholdNotificationRecipient")
   ```
   Mirror the `assignedCycles Cycle[] @relation("CycleAssignee")` style at line 33.

2. **`Household` model (line 39-55)** — add after line 54 (`invitations`):
   ```prisma
   notifications   HouseholdNotification[]
   ```
   Mirror `cycles Cycle[]` at line 52.

3. **`Cycle` model (line 171-189)** — add before `@@unique` (line 187):
   ```prisma
   notifications       HouseholdNotification[]
   ```

**Timestamptz convention to copy** (`schema.prisma:15, 46, 66, 184`): every `DateTime` column uses `@db.Timestamptz(3)`. Apply to `HouseholdNotification.createdAt`. DO NOT use `@updatedAt` on `HouseholdNotification` (Phase 3 ships bare-minimum; Phase 5 adds `readAt`).

**Cuid convention to copy** (every `id` field): `String @id @default(cuid())`.

---

### `proxy.ts` (EXTENDED — matcher excludes `/api/cron/*`)

**Analog:** same file, 8 lines total (Read the whole file — this is the smallest in-repo analog).

**Current state** (lines 5-7):
```typescript
matcher: [
  "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)",
],
```

**Required change (RESEARCH Pitfall A, lines 658-679):**
```typescript
matcher: [
  "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo).*)",
],
```

---

### `.env.example` (EXTENDED — add `CRON_SECRET`)

**Analog:** same file (3 lines — whole file is the template).

**Add:**
```
CRON_SECRET="changeme-prod-only-generate-with-openssl-rand-hex-32"
```
Place after `NEXTAUTH_URL=`. Match the `"quoted-placeholder"` style used for the other three vars.

---

### `package.json` (EXTENDED — add `@date-fns/tz`)

**Analog:** same file `dependencies` block (lines 17-39). Current `date-fns` pin is at line 24: `"date-fns": "^4.1.0"`.

**Add inside `"dependencies"`** (alphabetical insertion — before `bcryptjs`):
```json
"@date-fns/tz": "^1.4.1",
```
(`^1.4.1` matches the latest verified 2025-08-12 per RESEARCH.md line 123.)

**No `package-lock.json` entry** — run `npm install` after the edit; committing the lockfile is a planner step, not a pattern concern.

---

### `tests/phase-03/*.test.ts` — unit tests with mocked Prisma

**Files:** `rotation-formula.test.ts`, `cycle-boundaries.test.ts`, `dst-boundary.test.ts`, `availability-create.test.ts`, `availability-delete.test.ts`, `cron-endpoint.test.ts`.

**Analog:** `tests/household-create.test.ts` lines **1-62** (header + mock block + first test).

**Imports + mock hoisting pattern to copy verbatim** (`tests/household-create.test.ts:1-15`):
```typescript
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    household: { findUnique: vi.fn(), create: vi.fn() },
    householdMember: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });
```

**What to change per test file:**
- Add the models used in the tested action to the `@/lib/db` mock (e.g., `availability: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() }`).
- For `dst-boundary.test.ts` and `rotation-formula.test.ts`: **no mocks** — these exercise pure functions (including `TZDate` real IANA lookups per RESEARCH line 639).
- For `cron-endpoint.test.ts`: mock `@/features/household/cron` to stub `advanceAllHouseholds`.

**`$transaction` callback mock pattern** (`tests/household-create.test.ts:40-42` — reuse for any test that calls through `transitionCycle` without a real DB):
```typescript
vi.mocked(db.$transaction).mockImplementation(
  async (cb: (tx: typeof txMock) => unknown) => cb(txMock) as never
);
```

---

### `tests/phase-03/transition-*.test.ts` — integration tests with real Postgres

**Files:** `transition-concurrency.test.ts`, `transition-auto-skip.test.ts`, `transition-manual-skip.test.ts`, `transition-fallback.test.ts`, `transition-paused.test.ts`, `transition-paused-resume.test.ts`.

**Analog:** `tests/household-integration.test.ts` — **lift the entire file structure.**

**Header JSDoc to copy** (`tests/household-integration.test.ts:1-27`) — explain real-DB rationale, session mock, namespaced email isolation.

**Imports + mock + namespace pattern** (`tests/household-integration.test.ts:29-44`):
```typescript
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("../../auth", () => ({ auth: vi.fn() }));  // NOTE: phase-03 subdirectory → ../../auth (one more level than Phase 2 tests)

const { db } = await import("@/lib/db");
const { transitionCycle } = await import("@/features/household/cycle");
// ... etc ...

const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const EMAIL_PREFIX = `phase03-test-${RUN_ID}`;
const emailFor = (userTag: string) => `${EMAIL_PREFIX}-${userTag}@test.local`;
```

**Cleanup pattern to copy** (`tests/household-integration.test.ts:50-82`):
```typescript
afterAll(async () => {
  try {
    const users = await db.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u: { id: string }) => u.id);
    if (userIds.length > 0) {
      const memberships = await db.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true },
      });
      const householdIds = [...new Set(memberships.map((m: { householdId: string }) => m.householdId))];
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      if (householdIds.length > 0) {
        await db.household.deleteMany({ where: { id: { in: householdIds } } });
      }
    }
  } finally {
    await db.$disconnect();
  }
});
```
**What to change:** add explicit cleanup of `HouseholdNotification` rows BEFORE `user.deleteMany` — Prisma cascades handle `HouseholdMember` and `Cycle` (via `Household` cascade → `Cycle.onDelete: Cascade` is implicit through `Household @relation(..., onDelete: Cascade)`), but confirm `HouseholdNotification`'s `household.onDelete: Cascade` + `recipient.onDelete: Cascade` both fire before user deletes. Safe to leave as-is; defensive cleanup of notifications optional.

**Helper `createBareUser` to copy** (`tests/household-integration.test.ts:88-96`).

**Concurrency-specific pattern** (`transition-concurrency.test.ts` only) — RESEARCH.md line 1051:
```typescript
const [r1, r2] = await Promise.all([
  transitionCycle(householdId, "manual_skip"),
  transitionCycle(householdId, "manual_skip"),
]);
// Exactly one returns { transitioned: true }, the other { skipped: true }
const transitioned = [r1, r2].filter((r) => "transitioned" in r);
const skipped = [r1, r2].filter((r) => "skipped" in r);
expect(transitioned).toHaveLength(1);
expect(skipped).toHaveLength(1);
```

---

## Shared Patterns

### Authentication

**Source:** `src/features/household/guards.ts:31-51` (`requireHouseholdAccess`) + `ForbiddenError` class (lines 10-18).

**Apply to:** `skipCurrentCycle`, `createAvailability`, `deleteAvailability` (every Phase 3 action EXCEPT the cron route handler).

**Canonical invocation:**
```typescript
try {
  const { household, member, role } = await requireHouseholdAccess(householdId);
  // proceed
} catch (err) {
  if (err instanceof ForbiddenError) return { error: err.message };
  throw err;
}
```

**Cron route handler does NOT use this** — it uses `request.headers.get("authorization")` + `=== Bearer ${process.env.CRON_SECRET}` per RESEARCH §Pattern 3. Do not import `auth` or `requireHouseholdAccess` into `route.ts`.

---

### Demo-Mode Guard

**Source:** `src/features/household/actions.ts:25-28`.

**Apply to:** every new Server Action (`skipCurrentCycle`, `createAvailability`, `deleteAvailability`) — Step 2 of the 7-step template.

```typescript
if (session.user.isDemo) {
  return { error: "Demo mode — sign up to save your changes." };
}
```

**String is exact match** — tests (`tests/household-create.test.ts` line style; `tests/household-integration.test.ts:193`) assert on this literal.

---

### `$transaction` (Interactive Mode)

**Source:** `src/features/auth/actions.ts:45-89` (multi-table write with dependent IDs).

**Apply to:**
- `registerUser` extension (append `tx.cycle.create`)
- `createHousehold` extension (append `tx.cycle.create`)
- `transitionCycle` (lock select + cycle create + cycle update + notification create)

**Canonical shape:**
```typescript
await db.$transaction(async (tx) => {
  const a = await tx.tableA.create({ ... });
  const b = await tx.tableB.create({ data: { aId: a.id, ... } });
  // Every tx.* call shares the same connection and commits atomically.
});
```

**CRITICAL — RESEARCH Pitfall B (lines 681-707):** for `transitionCycle`, `tx.$queryRaw\`...FOR UPDATE SKIP LOCKED\`` MUST be inside the callback, using `tx`, NOT `db.$queryRaw` before/outside. The lock survives only for the transaction's lifetime.

---

### `revalidatePath` + `HOUSEHOLD_PATHS`

**Source:** `src/features/household/paths.ts` + `src/features/auth/actions.ts:156` usage.

**Apply to:** Step 7 of every Server Action that mutates data consumed by a household-scoped page.

```typescript
import { HOUSEHOLD_PATHS } from "./paths";
import { revalidatePath } from "next/cache";

revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
```

**Gap for Phase 3:** `paths.ts` currently has no `settings` entry. `createAvailability` / `deleteAvailability` revalidate a Phase 6 settings page. **Planner decision:** add `settings: "/h/[householdSlug]/settings"` to `HOUSEHOLD_PATHS` in the same commit as the new actions, OR inline the literal and flag with a TODO.

---

### Error Handling in Transactions (Prisma P2002 catch)

**Source:** No direct in-repo analog — use RESEARCH §Pattern 1 lines 383-388 template.

**Apply to:** Notification INSERT inside `transitionCycle` (idempotency — a cron retry must not fail on duplicate notification).

```typescript
try {
  await tx.householdNotification.create({ data: { ... } });
} catch (err) {
  if (!isUniqueViolation(err)) throw err;  // swallow P2002 only
}
```

**`isUniqueViolation` helper — does NOT yet exist in repo.** Planner must add a small utility (e.g., in `cycle.ts` itself) checking `err.code === 'P2002'` on a `Prisma.PrismaClientKnownRequestError`. Follow Prisma docs; no existing codebase pattern to match.

---

### Zod Refinement Style

**Source:** `src/features/auth/schemas.ts:15-18` (cross-field refinement with `path`).

**Apply to:** `createAvailabilitySchema` — for both `endDate > startDate` and `startDate >= startOfToday()` (Pitfall 12).

```typescript
.refine((data) => data.endDate > data.startDate, {
  message: "End date must be after start date.",
  path: ["endDate"],
})
.refine((data) => data.startDate >= startOfToday(), {
  message: "Availability cannot start in the past.",
  path: ["startDate"],
});
```

---

### Server-File Imports Discipline

**Source:** `src/features/household/actions.ts:1-6`, `src/features/auth/actions.ts:1-11`.

- `"use server";` ONLY on files exporting Server Actions (`actions.ts`). Do NOT add to `cycle.ts`, `availability.ts`, `cron.ts`, `queries.ts`, `schema.ts`, `guards.ts`.
- `auth` imports use the relative path `"../../../auth"` from `src/features/*/actions.ts` (3 levels up). From a test in `tests/phase-03/`, it's `"../../auth"` (2 levels).
- `db` imports use the alias `"@/lib/db"` (never relative).
- Zod imports: `import { z } from "zod/v4";` — v3 path forbidden per CLAUDE.md.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/features/household/cycle.ts` `transitionCycle` | domain helper — `FOR UPDATE SKIP LOCKED` inside `$transaction` | write + row-lock | No existing `$queryRaw` + row-lock pattern in the codebase. Planner must implement from RESEARCH §Pattern 1 (lines 269-398). |
| `src/app/api/cron/advance-cycles/route.ts` | Route Handler with bearer auth + Node runtime | request-response | Existing `api/auth/[...nextauth]/route.ts` only re-exports NextAuth handlers; provides no pattern for custom POST handlers, bearer auth, or runtime declaration. Planner must implement from RESEARCH §Pattern 3 (lines 486-517). |

Both gaps are documented in RESEARCH with verbatim templates; planner can lift those code blocks directly into the respective task `<read_first>` / action blocks without inventing new patterns.

---

## Metadata

**Analog search scope:**
- `src/features/household/` (actions.ts, queries.ts, schema.ts, guards.ts, paths.ts, context.ts)
- `src/features/auth/` (actions.ts, schemas.ts)
- `src/app/api/` (auth route only)
- `prisma/schema.prisma` (full)
- `proxy.ts`, `.env.example`, `package.json`
- `tests/` (household-integration.test.ts, household-create.test.ts — full; others noted for potential additional test-pattern extraction)

**Files scanned:** 15 source files + 2 test files read in full.

**Pattern extraction date:** 2026-04-17

**Confidence:** HIGH on self-pattern matches (actions.ts / queries.ts / schema.ts / schema.prisma extensions all follow existing in-file style exactly). HIGH on integration-test pattern match (`household-integration.test.ts` is a near-perfect template). MEDIUM on the two no-analog files (`cycle.ts` transition function and cron Route Handler) — RESEARCH.md provides complete templates, but the planner must execute them without in-repo reference.
