import { describe, test, afterAll } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

/**
 * ROTA-02 end-to-end transition happy path. Wave 2 (03-03) fills with real-DB assertions.
 */
describe("transitionCycle — cycle_end happy path (ROTA-02, D-15, D-18)", () => {
  test.todo("returns { transitioned: true, fromCycleNumber: 1, toCycleNumber: 2, reason: 'cycle_end', ... }");
  test.todo("new Cycle row exists with status='active' and assignedUserId=ownerId");
  test.todo("outgoing Cycle #1 has status='completed' and transitionReason='cycle_end'");
  test.todo("HouseholdNotification row emitted with type='cycle_started' inside same transaction");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
afterAll(() => { void EMAIL_PREFIX; });
