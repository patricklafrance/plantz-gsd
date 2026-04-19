// tests/phase-04/leave-household-sole.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("leaveHousehold sole-member terminal case (real DB, D-14)", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-05) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-05 / D-14] sole-member last-OWNER: Household.delete succeeds and cascade wipes plants, rooms, cycles, availabilities, invitations");
});
