---
phase: 07-demo-mode-compatibility
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/features/demo/seed-data.ts
  - prisma/seed.ts
  - src/features/demo/actions.ts
  - tests/phase-07/seed-structure.test.ts
  - tests/phase-07/demo-guard-audit.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 07 introduces three cross-cutting changes: (1) expanding the demo seed to include a household, two sample member users with unusable passwords, an active Cycle, and an Availability row; (2) simplifying `startDemoSession` to a pure look-up-and-sign-in shape; and (3) adding a static guard-audit test that enforces `session.user.isDemo` on every exported Server Action.

The code is structurally sound and the security invariants for the unusable-hash pattern are correctly implemented. No critical issues were found. Three warnings flag a variable shadowing hazard, an unguarded `seedStarterPlants` write loop (multiple `db.plant.create` calls are not wrapped in a transaction, leaving partial-write state possible), and a latent authorization gap in the `seedStarterPlants` flow. Three info items cover code quality.

---

## Warnings

### WR-01: Variable shadowing — `now` declared twice in `prisma/seed.ts`

**File:** `prisma/seed.ts:158` and `prisma/seed.ts:213`

**Issue:** `const now = new Date()` is declared inside the `$transaction` callback at line 158 (used for cycle/availability date math), and again in the outer scope at line 213 (used for the plant loop). The outer declaration shadows the inner one once the transaction returns. Although the two declarations are in separate lexical scopes and the outer one is used correctly, the duplication is a maintenance trap: a future refactor that merges the plant loop into the transaction will silently reuse the inner `now`, potentially introducing a subtle clock skew between transaction-time and plant-loop-time.

**Fix:** Hoist a single `now` declaration to immediately before `db.$transaction(...)` and remove the second declaration:

```ts
// Before $transaction
const now = new Date();

const { demoUser, household, aliceUser, bobUser } = await db.$transaction(
  async (tx) => {
    // use the already-declared `now` here — remove the `const now = new Date();` on line 158
    const { anchorDate } = computeInitialCycleBoundaries(now, "UTC", 7);
    ...
  }
);

// Plant loop below — still uses the same `now`
for (let i = 0; i < DEMO_PLANTS.length; i++) {
  ...
}
```

---

### WR-02: `seedStarterPlants` plant-creation loop is not atomic — partial writes possible

**File:** `src/features/demo/actions.ts:111-132`

**Issue:** The `for (const profile of allProfiles)` loop calls `db.plant.create` individually for each profile (lines 112-130). If any iteration throws (e.g., a unique-constraint violation on `nickname`, a transient DB error, or a network blip), the function returns an unhandled exception with some plants already created and others not. The caller sees a 500-level error but the database is in an inconsistent partial state. For an onboarding action this is particularly user-visible: the user's collection will contain a random subset of starter plants with no way to know which ones were saved.

**Fix:** Wrap the creation loop in a `$transaction` call (or use `db.$transaction` with a mapped array of creates):

```ts
const createdPlants = await db.$transaction(
  allProfiles.map((profile) =>
    db.plant.create({
      data: {
        nickname: profile.name,
        species: profile.species,
        wateringInterval: profile.wateringInterval,
        careProfileId: profile.id,
        householdId: targetHouseholdId,
        createdByUserId: session.user.id,
        lastWateredAt: now,
        nextWateringAt: addDays(now, profile.wateringInterval),
        reminders: {
          create: { userId: session.user.id, enabled: true },
        },
      },
    }),
  ),
);

return { success: true, count: createdPlants.length };
```

---

### WR-03: `requireHouseholdAccess` is called after multiple DB reads in `seedStarterPlants` — TOCTOU ordering

**File:** `src/features/demo/actions.ts:77-110`

**Issue:** `requireHouseholdAccess(targetHouseholdId)` is invoked at line 110, but `db.careProfile.findMany` queries run at lines 77 and 87-91 using `targetHouseholdId` as a context value before membership is verified. The queries themselves are read-only on a non-sensitive table, so there is no direct data leak. However, the authorization check is semantically out of order: the function performs work (two DB queries) before confirming the caller is authorized to operate on that household. If `requireHouseholdAccess` is ever strengthened to also verify the household is in an allowed state (e.g., not archived), any work performed before that check could be wasted or incorrect. Additionally, `targetHouseholdId` is resolved from `session.user.activeHouseholdId` at line 70 when `householdId` is not provided — a JWT-cached value — before the live membership check occurs.

**Fix:** Move `await requireHouseholdAccess(targetHouseholdId)` to immediately after the `targetHouseholdId` null-guard (line 71), before any DB reads:

```ts
const targetHouseholdId = householdId ?? session.user.activeHouseholdId;
if (!targetHouseholdId) return { error: "No household found." };

// Authorize first, before any other DB work
await requireHouseholdAccess(targetHouseholdId);

const { addDays } = await import("date-fns");
const now = new Date();
// ... rest of the function
```

---

## Info

### IN-01: `DEMO_PASSWORD` exported from `seed-data.ts` is available to any importer

**File:** `src/features/demo/seed-data.ts:2`

**Issue:** `DEMO_PASSWORD = "demo-password-not-secret"` is an exported constant in a source file that is also imported by `actions.ts`. While this password is intentionally public (demo account), exporting it from an application-layer source file (rather than a seed-only file) means it will be included in the production bundle. Any bundle analysis tool or accidental client import would expose it. The value appears in the comment "not-secret" indicating this is known, but the export surface is wider than necessary.

**Fix:** Consider moving `DEMO_PASSWORD` to `prisma/seed.ts` (seed-only scope) and importing it there directly. `actions.ts` does not need `DEMO_PASSWORD` — it passes the credential at sign-in time. Alternatively, read it from `process.env.DEMO_PASSWORD` in `actions.ts` so it is not compiled into the bundle. If keeping the export, add a `// @ts-ignore no-bundle` or ESLint disable comment to document the intentional public exposure.

---

### IN-02: `extractFunctionBodies` in the guard audit test does not handle string literals containing braces

**File:** `tests/phase-07/demo-guard-audit.test.ts:66-116`

**Issue:** The brace-depth tracker at lines 103-110 counts every `{` and `}` character, including those inside string literals (e.g., `return { error: "Use { braces }" }`). If any Server Action body contains a template literal or string with unbalanced braces, the extractor will miscount depth and may either prematurely end the extracted body or run past the actual closing brace, causing false passes or false failures in the guard audit. In practice, existing action bodies appear safe, but this is a fragile parser.

**Fix:** This is a test-quality concern rather than a production bug. The simplest hardening is to strip single- and double-quoted strings before counting braces:

```ts
const stripped = src.replace(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`/gs, '""');
// then apply depth counting on `stripped`
```

Alternatively, document the known limitation with a comment so future maintainers are aware.

---

### IN-03: `walk` in the guard audit test uses a hardcoded relative path `src/features`

**File:** `tests/phase-07/demo-guard-audit.test.ts:121`

**Issue:** The call `walk("src/features")` uses a relative path with no `resolve(__dirname, ...)` or `process.cwd()` anchor. In `seed-structure.test.ts`, the sibling test uses `resolve(__dirname, "..", "..")` to build absolute paths (line 18). The `walk` call in the guard audit relies on Vitest running with cwd equal to the project root, which is true for the current Vitest config (no explicit `root` override), but is not guaranteed if the config changes or the test is run from a subdirectory.

**Fix:** Make the path absolute to match the pattern used in `seed-structure.test.ts`:

```ts
const featuresRoot = resolve(__dirname, "..", "..", "src", "features");
```

Add `import { resolve } from "node:path";` at the top of the file (currently only `join` is imported from `node:path` at line 17).

---

_Reviewed: 2026-04-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
