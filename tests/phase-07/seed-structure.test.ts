/**
 * HDMO-01 — Seed structure source-grep assertions.
 *
 * Behavioral surrogate for the Plan 01 seed expansion. Verifies that
 * `prisma/seed.ts` contains the expected create calls, sample emails, and
 * unusable-password construction without running the seed against a real DB.
 * Also verifies that `src/features/demo/actions.ts` has been stripped of its
 * lazy bootstrap (Plan 02 Task 1) and that `DEMO_SAMPLE_MEMBERS` is exported.
 *
 * Mirrors the source-grep surrogate idiom from
 * tests/phase-06/dashboard-redirect.test.ts.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..", "..");

function readSource(relative: string) {
  return readFileSync(resolve(projectRoot, relative), "utf8");
}

describe("HDMO-01 — seed expansion source structure", () => {
  test("prisma/seed.ts creates the expanded Demo Household (3 members + Cycle + Availability)", () => {
    const src = readSource("prisma/seed.ts");

    // Sample members (T-07-02 — emails distinct from DEMO_EMAIL)
    expect(src).toContain("DEMO_SAMPLE_MEMBERS");

    // Cycle #1 mid-window (D-04)
    expect(src).toContain("tx.cycle.create");
    expect(src).toContain("computeInitialCycleBoundaries");
    expect(src).toContain("subDays(now, 3)");
    expect(src).toContain("addDays(now, 4)");
    expect(src).toContain('status: "active"');
    expect(src).toContain("memberOrderSnapshot");

    // Availability future window (D-06)
    expect(src).toContain("tx.availability.create");
    expect(src).toContain("addDays(now, 10)");
    expect(src).toContain("addDays(now, 17)");

    // Unusable password (T-07-01)
    expect(src).toContain('crypto.randomBytes(32).toString("hex")');

    // Cycle is created once, never patched (Option B, not Option A)
    expect(src).not.toContain("tx.cycle.update");
  });

  test("src/features/demo/actions.ts has the simplified startDemoSession (no lazy bootstrap)", () => {
    const src = readSource("src/features/demo/actions.ts");

    // Lazy bootstrap artifacts must be gone (D-11)
    expect(src).not.toContain("tx.household.create");
    expect(src).not.toContain("tx.householdMember.create");
    expect(src).not.toContain('await import("bcryptjs")');
    expect(src).not.toContain("generateHouseholdSlug");
    expect(src).not.toContain("DEMO_PLANTS");

    // Simplified shape: findUnique → signIn → redirect
    expect(src).toContain(
      "db.user.findUnique({ where: { email: DEMO_EMAIL } })",
    );
    expect(src).toContain('signIn("credentials"');
    expect(src).toContain("Demo data not found. Run `npx prisma db seed`");

    // seedStarterPlants guard stays
    expect(src).toContain("session.user.isDemo");
  });

  test("src/features/demo/seed-data.ts exports DEMO_SAMPLE_MEMBERS with fake emails", () => {
    const src = readSource("src/features/demo/seed-data.ts");

    expect(src).toContain("export const DEMO_SAMPLE_MEMBERS");
    expect(src).toContain("alice@demo.plantminder.app");
    expect(src).toContain("bob@demo.plantminder.app");

    // T-07-02: sample emails must NOT equal DEMO_EMAIL
    expect(src).toContain('DEMO_EMAIL = "demo@plantminder.app"');
  });
});
