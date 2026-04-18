import { describe, test, afterAll } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

/**
 * AVLB-03 auto-skip path (integration). Wave 3 (03-04) fills with real-DB assertions.
 */
describe("transitionCycle auto_skip_unavailable path (AVLB-03, D-04)", () => {
  test.todo("next scheduled member has Availability covering cycle end → transition skips past them");
  test.todo("outgoing cycle transitionReason === 'auto_skip_unavailable'");
  test.todo("HouseholdNotification type === 'cycle_reassigned_auto_skip'");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
afterAll(() => { void EMAIL_PREFIX; });
