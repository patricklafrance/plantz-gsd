import { describe, test, afterAll } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

/**
 * D-15 / D-17 / D-19 notification dedupe + type mapping. Wave 2 (03-03) fills.
 */
describe("HouseholdNotification dedupe + type mapping (D-15, D-17, D-19)", () => {
  test.todo("same transition retried: exactly one HouseholdNotification row exists (P2002 swallowed)");
  test.todo("manual_skip transition → notification.type === 'cycle_reassigned_manual_skip'");
  test.todo("member_left transition → notification.type === 'cycle_reassigned_member_left'");
  test.todo("direct duplicate INSERT via db.householdNotification.create throws P2002 → isUniqueViolation(err) returns true");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
afterAll(() => { void EMAIL_PREFIX; });
