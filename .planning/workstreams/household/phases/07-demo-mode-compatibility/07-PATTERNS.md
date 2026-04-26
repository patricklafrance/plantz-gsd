# Phase 7: Demo Mode Compatibility - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 5 (3 modified, 2 new)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/seed.ts` | seed script | CRUD (batch write) | `prisma/seed.ts` (current) | self — extend in-place |
| `src/features/demo/seed-data.ts` | constants module | — (data declaration) | `src/features/demo/seed-data.ts` (current) | self — extend in-place |
| `src/features/demo/actions.ts` | server action | request-response | `src/features/demo/actions.ts` (current) | self — simplify in-place |
| `tests/phase-07/demo-guard-audit.test.ts` | static audit test | — (file I/O + regex) | `tests/phase-06/links-audit.test.ts` | exact role + data flow |
| `tests/phase-07/seed-structure.test.ts` (optional) | source-grep test | — (file I/O + regex) | `tests/phase-06/dashboard-redirect.test.ts` | exact role + data flow |

---

## Pattern Assignments

### `prisma/seed.ts` (seed script, batch CRUD — modify)

**Analog:** `prisma/seed.ts` current state + `tests/phase-03/fixtures.ts` (for inline `tx.cycle.create` shape)

**Current imports pattern** (`prisma/seed.ts` lines 1–8):
```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { catalogData } from "./data/catalog";
import bcryptjs from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS } from "../src/features/demo/seed-data";
import { generateHouseholdSlug } from "../src/lib/slug";
```

**New imports to add** (import `computeInitialCycleBoundaries` and `crypto`):
```typescript
import crypto from "node:crypto";
import { computeInitialCycleBoundaries } from "../src/features/household/cycle";
// DEMO_SAMPLE_MEMBERS will also be imported from seed-data once added
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS, DEMO_SAMPLE_MEMBERS } from "../src/features/demo/seed-data";
```
Note: `cycle.ts` has no `"use server"` directive — it is a plain module, safe to import from a Node.js seed script. (`src/features/household/cycle.ts` lines 1–17 confirm this.)

**Idempotency guard pattern** (`prisma/seed.ts` lines 45–46):
```typescript
const existingDemo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
if (!existingDemo) {
  // ... all demo seed work inside this block
}
```

**Transaction shape for user + household + member** (`prisma/seed.ts` lines 50–96):
```typescript
const { demoUser, household } = await db.$transaction(async (tx) => {
  const demoUser = await tx.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo User",
      onboardingCompleted: true,
      remindersEnabled: true,
    },
  });

  // Slug collision loop — bounded at 10 attempts
  let slug: string;
  let attempts = 0;
  do {
    slug = generateHouseholdSlug();
    const existing = await tx.household.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) break;
    if (attempts++ >= 9) throw new Error("Slug generation failed after 10 attempts");
  } while (true);

  const household = await tx.household.create({
    data: {
      name: "Demo Plants",
      slug: slug!,
      timezone: "UTC",
      cycleDuration: 7,
      rotationStrategy: "sequential",
    },
  });

  await tx.householdMember.create({
    data: {
      userId: demoUser.id,
      householdId: household.id,
      role: "OWNER",
      rotationOrder: 0,
      isDefault: true,
    },
  });

  return { demoUser, household };
});
```

**Inline `tx.cycle.create` shape** (analog: `tests/phase-03/fixtures.ts` lines 124–141 + `src/features/household/actions.ts` lines 107–124):
```typescript
// From createHousehold (actions.ts lines 107–124) — same fields, different date values
const { anchorDate } = computeInitialCycleBoundaries(new Date(), "UTC", 7);
// Override start/end to mid-window per D-04
const cycleStartDate = subDays(new Date(), 3);
const cycleEndDate = addDays(new Date(), 4);

await tx.cycle.create({
  data: {
    householdId: household.id,
    cycleNumber: 1,
    anchorDate,                   // tomorrow UTC (from computeInitialCycleBoundaries)
    cycleDuration: 7,
    startDate: cycleStartDate,    // now - 3 days
    endDate: cycleEndDate,        // now + 4 days
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
`memberOrderSnapshot` is a JSON column — the array-of-objects shape is confirmed from `actions.ts` line 122: `memberOrderSnapshot: [{ userId, rotationOrder: 0 }]`.

**Unusable password pattern** (from RESEARCH.md §Pattern 1, consistent with bcryptjs usage at `prisma/seed.ts` line 47):
```typescript
const unusableHash = await bcryptjs.hash(
  crypto.randomBytes(32).toString("hex"), // 64 hex chars — source secret never stored
  12
);
// Usage per sample member:
const aliceUser = await tx.user.create({
  data: {
    email: "alice@demo.plantminder.app",
    passwordHash: unusableHash,
    name: "Alice",
    onboardingCompleted: true,
    remindersEnabled: true,
  },
});
```

**`tx.availability.create` shape** (fields from `prisma/schema.prisma` — verified by RESEARCH.md §Pattern 3):
```typescript
await tx.availability.create({
  data: {
    userId: aliceUser.id,
    householdId: household.id,
    startDate: addDays(now, 10),  // D-06: future window
    endDate: addDays(now, 17),
    reason: "Out of town",        // optional String?
  },
});
```

**Rooms + plants outside transaction** (`prisma/seed.ts` lines 99–156 — copy pattern verbatim, no changes needed):
```typescript
const livingRoom = await db.room.create({
  data: { name: "Living Room", householdId: household.id, createdByUserId: demoUser.id },
});
// ... bedroom, plants loop, wateringLog loop — unchanged
```

**`seedDemoHousehold` helper function signature** (from RESEARCH.md §Pattern 5):
```typescript
// tx type extracted from Prisma's $transaction callback parameter
async function seedDemoHousehold(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]
) {
  // returns { demoUser, household, aliceUser, bobUser }
}

// Called from main():
const { demoUser, household } = await db.$transaction(seedDemoHousehold);
// Outside tx: rooms + plants (existing pattern, lines 99–156)
```

---

### `src/features/demo/seed-data.ts` (constants module — modify)

**Analog:** `src/features/demo/seed-data.ts` current state

**Current shape** (`src/features/demo/seed-data.ts` lines 1–25):
```typescript
export const DEMO_EMAIL = "demo@plantminder.app";
export const DEMO_PASSWORD = "demo-password-not-secret";

export const DEMO_PLANTS = [
  { catalogName: "...", nickname: "...", daysAgoWatered: 8, intervalDays: 7 },
  // ...
] as const;

export const STARTER_PLANTS = [
  "Pothos",
  // ...
] as const;
```

**Pattern to add — `DEMO_SAMPLE_MEMBERS` constant** (mirrors `DEMO_PLANTS` structural style: typed tuple `as const`, each entry has all fields needed by the seed):
```typescript
export const DEMO_SAMPLE_MEMBERS = [
  {
    email: "alice@demo.plantminder.app",
    name: "Alice",
    rotationOrder: 1,
  },
  {
    email: "bob@demo.plantminder.app",
    name: "Bob",
    rotationOrder: 2,
  },
] as const;
```
Place after `DEMO_PASSWORD` and before `DEMO_PLANTS`. The constant is consumed only by `prisma/seed.ts` (seed time), not by any runtime action — importing it into `seed.ts` is already established by the `DEMO_EMAIL`/`DEMO_PASSWORD`/`DEMO_PLANTS` import on line 6.

---

### `src/features/demo/actions.ts` (server action — simplify)

**Analog:** `src/features/demo/actions.ts` current state (lines 16–142, the `startDemoSession` function)

**Current `startDemoSession` shape** (`src/features/demo/actions.ts` lines 16–142):
- Lines 17–127: lazy-creation branch (auto-creates user + household + rooms + plants when demo user doesn't exist)
- Lines 129–133: `signIn("credentials", { ... })` call
- Lines 134–141: catch block re-throwing NEXT_REDIRECT

**Target shape after D-11 simplification** (from RESEARCH.md §Pattern 4):
```typescript
export async function startDemoSession() {
  try {
    const demo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!demo) {
      return { error: "Demo data not found. Run `npx prisma db seed` to set up the demo." };
    }

    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    const { isRedirectError } = await import("next/dist/client/components/redirect-error");
    if (isRedirectError(error)) throw error;
    return { error: "Could not start demo session. Please try again." };
  }
}
```

Key changes:
- Remove lines 20–127 entirely (the `if (!existing) { ... }` lazy-creation block)
- Replace with `if (!demo) return { error: "..." }` (seed-missing error)
- Keep `signIn` call unchanged (lines 129–133 shape is identical)
- Keep catch block unchanged (lines 134–141 shape is identical)
- Remove dynamic imports of `bcryptjs` and `date-fns` (no longer needed after lazy-creation block is gone)
- Remove imports of `generateHouseholdSlug` and `requireHouseholdAccess` if they become unused after the removal

**Imports to keep** (`src/features/demo/actions.ts` lines 1–9):
```typescript
"use server";

import { signIn, auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { DEMO_EMAIL, DEMO_PASSWORD, STARTER_PLANTS } from "./seed-data";
// generateHouseholdSlug and requireHouseholdAccess can be removed if only used in startDemoSession
import { requireHouseholdAccess } from "@/features/household/guards";
import { HOUSEHOLD_PATHS } from "@/features/household/paths";
```
Note: `requireHouseholdAccess` is still needed by `seedStarterPlants` (line 204). `DEMO_PLANTS` is no longer needed in actions.ts after lazy-creation removal; `DEMO_PASSWORD` still needed for `signIn`.

**`seedStarterPlants` — no changes** (`src/features/demo/actions.ts` lines 150–232):
- Guard at line 153: `if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };`
- This is preserved unchanged. It is the canonical guard pattern for this file.

---

### `tests/phase-07/demo-guard-audit.test.ts` (static audit test — new)

**Analog:** `tests/phase-06/links-audit.test.ts` (exact role + data flow match)

**Scaffold imports pattern** (`tests/phase-06/links-audit.test.ts` lines 16–18):
```typescript
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
```

**`walk()` helper** (`tests/phase-06/links-audit.test.ts` lines 20–37):
```typescript
function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}
```
Adapt for this test: filter to files named `actions.ts` only (not all `.ts`/`.tsx`), OR use `walk` as-is and filter by filename after.

**SKIP_FUNCTIONS constant and `extractFunctionBodies` helper** (from RESEARCH.md §Code Examples):
```typescript
const SKIP_FUNCTIONS = new Set([
  "startDemoSession",          // demo entry point — no guard appropriate
  "registerUser",              // pre-auth — no session exists
  "loadMoreWateringHistory",   // read-only paginator
  "loadMoreTimeline",          // read-only paginator
]);

function extractFunctionBodies(src: string): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  const funcRegex = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = funcRegex.exec(src)) !== null) {
    const name = m[1];
    const openBrace = src.indexOf("{", m.index + m[0].length - 1);
    if (openBrace === -1) continue;
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

**Test + offender reporting pattern** (`tests/phase-06/links-audit.test.ts` lines 60–106):
```typescript
describe("HDMO-02 — demo guard audit", () => {
  test("Every exported function in features/**/actions.ts contains session.user.isDemo", () => {
    const offenders: Array<{ file: string; functionName: string }> = [];
    // ... glob + extract + assert loop
    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file} :: ${o.functionName}`)
        .join("\n");
      throw new Error(`Missing isDemo guard:\n${report}`);
    }
    expect(offenders.length).toBe(0);
  });
});
```

**Glob pattern for `features/**/actions.ts`** — use `walk("src/features")` then filter entries where `path.endsWith("/actions.ts")` (mirrors how links-audit.test.ts uses `walk` on `scanRoots`).

**File-to-glob mapping** (verified from RESEARCH.md §Guard Audit Baseline):
The 8 files that will be scanned:
1. `src/features/household/actions.ts` — 15 functions, all guarded
2. `src/features/plants/actions.ts` — 5 functions, all guarded
3. `src/features/rooms/actions.ts` — 3 functions, all guarded
4. `src/features/watering/actions.ts` — 4 functions, 3 guarded + `loadMoreWateringHistory` (SKIP)
5. `src/features/notes/actions.ts` — 4 functions, 3 guarded + `loadMoreTimeline` (SKIP)
6. `src/features/reminders/actions.ts` — 4 functions, all guarded
7. `src/features/auth/actions.ts` — 3 functions, `registerUser` (SKIP), `updateTimezone` (guarded, returns void), `completeOnboarding` (guarded)
8. `src/features/demo/actions.ts` — 2 functions, `startDemoSession` (SKIP), `seedStarterPlants` (guarded)

Expected result: 36 total functions, 4 in SKIP_FUNCTIONS, 32 confirmed with guard → test passes green immediately on current codebase.

---

### `tests/phase-07/seed-structure.test.ts` (optional source-grep test — new)

**Analog:** `tests/phase-06/dashboard-redirect.test.ts` (exact role match: source-grep behavioral surrogate)

**Full pattern** (`tests/phase-06/dashboard-redirect.test.ts` lines 1–60):
```typescript
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..", "..");  // adjust depth for tests/phase-07/

function readSource(relative: string) {
  return readFileSync(resolve(projectRoot, relative), "utf8");
}

describe("Phase 7 seed structure assertions", () => {
  test("seed.ts creates alice@demo.plantminder.app user", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("alice@demo.plantminder.app");
  });

  test("seed.ts calls tx.cycle.create", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("tx.cycle.create");
  });

  test("seed.ts calls tx.availability.create", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("tx.availability.create");
  });

  test("startDemoSession no longer contains lazy-creation block", () => {
    const src = readSource("src/features/demo/actions.ts");
    // The lazy branch was identified by the inline bcryptjs import
    expect(src).not.toContain('await import("bcryptjs")');
  });
});
```
`resolve(__dirname, "..", "..")` navigates from `tests/phase-07/` to the project root — same depth as `dashboard-redirect.test.ts` which navigates from `tests/phase-06/` (`resolve(__dirname, "..", "..")`  at line 13).

---

## Shared Patterns

### isDemo Guard (Step 2 of 7-step Server Action template)
**Source:** `src/features/household/actions.ts` lines 49–52 (`createHousehold`)
**Apply to:** All exported functions in `src/features/**/actions.ts` that perform writes
```typescript
// Step 2: demo-mode guard (unchanged from v1 pattern)
if (session.user.isDemo) {
  return { error: "Demo mode — sign up to save your changes." };
}
```
Placed immediately after Step 1 (session check), before Step 3 (Zod parse).

### `$transaction` shape for atomic multi-entity creation
**Source:** `prisma/seed.ts` lines 50–96 (current demo seed transaction)
**Apply to:** `prisma/seed.ts` `seedDemoHousehold` helper — expand the existing transaction body to include sample member creates, cycle create, and availability create before the `return` statement.
```typescript
await db.$transaction(async (tx) => {
  // tx.user.create x3 (demo + alice + bob)
  // slug loop + tx.household.create
  // tx.householdMember.create x3
  // tx.cycle.create (mid-window)
  // tx.availability.create (future window on alice)
  return { demoUser, household, aliceUser, bobUser };
});
```

### `readFileSync` + `describe/test/expect` scaffold for static tests
**Source:** `tests/phase-06/links-audit.test.ts` lines 16–37 (imports + walk helper)
**Apply to:** Both new test files in `tests/phase-07/`
```typescript
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
```
No `vi.mock` needed — neither test imports from `src/`.

### `computeInitialCycleBoundaries` call site shape
**Source:** `src/features/household/actions.ts` lines 107–111
**Apply to:** `prisma/seed.ts` `seedDemoHousehold` helper
```typescript
const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
  new Date(),
  cycleTimezone,   // "UTC" for demo household
  cycleDuration,   // 7
);
// For seed: discard startDate/endDate, only use anchorDate; override start/end with -3/+4 shift
```

---

## No Analog Found

All files in scope have close analogs in the codebase. No entries in this section.

---

## Key Implementation Notes for Planner

1. **`prisma/seed.ts` must import `computeInitialCycleBoundaries` from `"../src/features/household/cycle"`** — the `cycle.ts` module has no `"use server"` directive (confirmed: `src/features/household/cycle.ts` lines 1–17). This import pattern already exists for `seed-data.ts` (line 6) and `slug.ts` (line 7).

2. **All demo seed writes go inside a single `$transaction`** — idempotency is gated by `if (!existingDemo)` at line 46. If the transaction rolls back, no User rows are created (Prisma `$transaction` guarantee), so re-running the seed is safe.

3. **`anchorDate` must come from `computeInitialCycleBoundaries`, not be set to `now - 3 days`** — `anchorDate` drives the `computeAssigneeIndex` formula for future cycle transitions. Keep it as "tomorrow UTC" (produced by `computeInitialCycleBoundaries`); only override `startDate`/`endDate` to achieve the mid-window state.

4. **Audit test must NOT import from `src/`** — confirmed by `tests/phase-06/links-audit.test.ts` pattern (pure `node:fs` + `node:path`). Importing action modules pulls in `auth()`, Prisma, and Next.js server internals.

5. **SKIP_FUNCTIONS is a `Set<string>` keyed on function name, not file path** — prevents future mutating additions to partially-excluded files from slipping past the audit (Pitfall 6 from RESEARCH.md).

6. **`tests/phase-07/` is auto-discovered** by `vitest.config.mts` — the existing include glob `tests/**/*.{test,spec}.{ts,tsx}` covers it. No config changes needed.

---

## Metadata

**Analog search scope:** `prisma/`, `src/features/demo/`, `src/features/household/`, `tests/phase-03/`, `tests/phase-05/`, `tests/phase-06/`
**Files scanned:** 11 source files read in full
**Pattern extraction date:** 2026-04-20
