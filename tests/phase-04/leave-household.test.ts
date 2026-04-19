// tests/phase-04/leave-household.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("leaveHousehold", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-05) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-05 / D-25] last OWNER in multi-member household: blocked with 'You're the only owner.' error");
  test.todo("[INVT-05] two OWNERs, two members: allowed — HouseholdMember row deleted");
  test.todo("[INVT-05] one OWNER, two members: blocked");
  test.todo("[INVT-05] cancels future Availability rows (startDate >= today) for the leaving user");
  test.todo("[INVT-05] calls unstable_update to flip activeHouseholdId to another household or null");
});
