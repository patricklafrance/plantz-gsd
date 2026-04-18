import { describe, test, afterAll } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

/**
 * ROTA-06 race-safe transition (BINDING). Wave 2 fills with real Promise.all concurrency test.
 * pg-mem does NOT support FOR UPDATE SKIP LOCKED — this test REQUIRES real Postgres.
 */
describe("transitionCycle concurrency — FOR UPDATE SKIP LOCKED (ROTA-06)", () => {
  test.todo("two parallel transitionCycle calls on same household: exactly 1 returns { transitioned: true }, 1 returns { skipped: true }");
  test.todo("exactly one Cycle row exists with cycleNumber=2 after the race");
  test.todo("exactly one HouseholdNotification emitted for the new cycle");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
afterAll(() => { void EMAIL_PREFIX; });
