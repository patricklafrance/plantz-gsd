/**
 * Phase 7: Seed structure assertions.
 *
 * Source-grep behavioral surrogates — same pattern as tests/phase-06/dashboard-redirect.test.ts.
 * No runtime DB required; reads source files as text.
 *
 * Covers:
 *   - HDMO-01 — Plan 07-01 seed expansion (DEMO_SAMPLE_MEMBERS, Cycle, Availability).
 *   - HDMO-02 — Plan 07-02 startDemoSession simplification (lazy bootstrap removed).
 *
 * startDemoSession is on the demo-guard-audit SKIP_FUNCTIONS allowlist, so this
 * file is the regression gate that locks its simplified shape.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..", "..");

function readSource(relative: string) {
  return readFileSync(resolve(projectRoot, relative), "utf8");
}

describe("Phase 7 seed-data.ts assertions (HDMO-01)", () => {
  test("seed-data.ts exports DEMO_SAMPLE_MEMBERS constant", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain("export const DEMO_SAMPLE_MEMBERS");
  });

  test("seed-data.ts includes alice@demo.plantminder.app", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain("alice@demo.plantminder.app");
  });

  test("seed-data.ts includes bob@demo.plantminder.app", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain("bob@demo.plantminder.app");
  });

  test("seed-data.ts DEMO_SAMPLE_MEMBERS ends with ] as const;", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain("] as const;");
  });

  test("seed-data.ts has rotationOrder: 1 for alice", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain("rotationOrder: 1");
  });

  test("seed-data.ts has rotationOrder: 2 for bob", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain("rotationOrder: 2");
  });

  test("seed-data.ts keeps DEMO_EMAIL as the canonical demo user email (T-07-02: sample emails must NOT equal DEMO_EMAIL)", () => {
    const src = readSource("src/features/demo/seed-data.ts");
    expect(src).toContain('DEMO_EMAIL = "demo@plantminder.app"');
  });
});

describe("Phase 7 seed.ts assertions (HDMO-01)", () => {
  test("seed.ts imports crypto from node:crypto", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain('import crypto from "node:crypto"');
  });

  test("seed.ts imports computeInitialCycleBoundaries", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain(
      'import { computeInitialCycleBoundaries } from "../src/features/household/cycle"',
    );
  });

  test("seed.ts imports DEMO_SAMPLE_MEMBERS", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("DEMO_SAMPLE_MEMBERS");
  });

  test("seed.ts uses CSPRNG unusable password pattern", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain('crypto.randomBytes(32).toString("hex")');
  });

  test("seed.ts calls tx.cycle.create (exactly once)", () => {
    const src = readSource("prisma/seed.ts");
    const matches = src.match(/tx\.cycle\.create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  test("seed.ts calls tx.availability.create (exactly once)", () => {
    const src = readSource("prisma/seed.ts");
    const matches = src.match(/tx\.availability\.create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  test("seed.ts sets assignedUserId to demoUser.id", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("assignedUserId: demoUser.id");
  });

  test("seed.ts includes memberOrderSnapshot", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("memberOrderSnapshot:");
  });

  test("seed.ts cycle status is active", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain('status: "active"');
  });

  test("seed.ts uses subDays(now, 3) for cycle startDate", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("subDays(now, 3)");
  });

  test("seed.ts uses addDays(now, 4) for cycle endDate", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("addDays(now, 4)");
  });

  test("seed.ts uses addDays(now, 10) for availability startDate", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("addDays(now, 10)");
  });

  test("seed.ts uses addDays(now, 17) for availability endDate", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).toContain("addDays(now, 17)");
  });

  test("seed.ts calls tx.householdMember.create exactly 3 times", () => {
    const src = readSource("prisma/seed.ts");
    const matches = src.match(/tx\.householdMember\.create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  test("seed.ts calls tx.user.create exactly 3 times (demo + alice + bob)", () => {
    const src = readSource("prisma/seed.ts");
    const matches = src.match(/tx\.user\.create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  test("seed.ts does NOT use tx.cycle.update (Option B, not A)", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).not.toContain("tx.cycle.update");
  });

  test("seed.ts anchorDate comes from computeInitialCycleBoundaries (not subDays)", () => {
    const src = readSource("prisma/seed.ts");
    expect(src).not.toContain("anchorDate: subDays");
    expect(src).not.toContain("anchorDate: cycleStartDate");
  });

  test("seed.ts preserves idempotency guard if (!existingDemo)", () => {
    const src = readSource("prisma/seed.ts");
    const matches = src.match(/if \(!existingDemo\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  test("seed.ts still has db.room.create for rooms (unchanged)", () => {
    const src = readSource("prisma/seed.ts");
    const matches = src.match(/db\.room\.create/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });
});

describe("Phase 7 startDemoSession simplification (HDMO-02 — D-11 lazy bootstrap removed)", () => {
  test("actions.ts no longer contains lazy-creation inline bcryptjs import", () => {
    const src = readSource("src/features/demo/actions.ts");
    expect(src).not.toContain('await import("bcryptjs")');
  });

  test("actions.ts no longer creates households in the demo entry point", () => {
    const src = readSource("src/features/demo/actions.ts");
    expect(src).not.toContain("tx.household.create");
    expect(src).not.toContain("tx.householdMember.create");
  });

  test("actions.ts no longer imports generateHouseholdSlug or DEMO_PLANTS (lazy bootstrap artefacts)", () => {
    const src = readSource("src/features/demo/actions.ts");
    expect(src).not.toContain("generateHouseholdSlug");
    expect(src).not.toContain("DEMO_PLANTS");
  });

  test("startDemoSession has the simplified shape: findUnique → signIn → redirect", () => {
    const src = readSource("src/features/demo/actions.ts");
    expect(src).toContain(
      "db.user.findUnique({ where: { email: DEMO_EMAIL } })",
    );
    expect(src).toContain('signIn("credentials"');
  });

  test("startDemoSession surfaces a seed-missing error pointing to `npx prisma db seed`", () => {
    const src = readSource("src/features/demo/actions.ts");
    expect(src).toContain("Demo data not found. Run `npx prisma db seed`");
  });

  test("seedStarterPlants retains its session.user.isDemo guard (the one legitimate isDemo check in this module)", () => {
    const src = readSource("src/features/demo/actions.ts");
    expect(src).toContain("session.user.isDemo");
  });
});
