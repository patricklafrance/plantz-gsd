// tests/phase-04/jwt-refresh.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("JWT unstable_update on membership change (D-26)", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-05) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-05 / D-26] acceptInvitation: unstable_update receives activeHouseholdId of newly joined household");
  test.todo("[INVT-05 / D-26] leaveHousehold: unstable_update receives next activeHouseholdId (another membership or null)");
});
