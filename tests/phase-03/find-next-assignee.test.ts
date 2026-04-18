import { describe, test, afterAll } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

/**
 * AVLB-03 / AVLB-05 walker tests. Wave 2 fills with real assertions against
 * `findNextAssignee(tx, householdId, members, outgoing)` inside db.$transaction.
 */
describe("findNextAssignee (AVLB-03, AVLB-05)", () => {
  test.todo("all members available → returns rotationOrder+1 with fallback=false");
  test.todo("next scheduled member unavailable → walks past to next available member");
  test.todo("all non-owner members unavailable + owner available → returns owner with fallback=true");
  test.todo("all members including owner unavailable → returns null (paused signal)");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
afterAll(() => { /* cleanup scoped to EMAIL_PREFIX — Wave 2 wires the real deletion */ void EMAIL_PREFIX; });
