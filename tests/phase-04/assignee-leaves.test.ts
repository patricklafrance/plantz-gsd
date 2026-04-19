// tests/phase-04/assignee-leaves.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("assignee-leaves triggers transitionCycle (real DB, D-27)", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-05) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-05 / D-27] active assignee calls leaveHousehold: new active Cycle with different assignee exists AND outgoing cycle has transitionReason='member_left'");
});
