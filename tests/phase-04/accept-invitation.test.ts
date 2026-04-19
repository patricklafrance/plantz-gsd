// tests/phase-04/accept-invitation.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("acceptInvitation", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-04) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-04] valid token: inserts HouseholdMember with role='MEMBER', rotationOrder = max+1");
  test.todo("[INVT-04] valid token: does NOT reset cycle pointer (cycleNumber, anchorDate unchanged)");
  test.todo("[INVT-04] token already accepted: returns 'This invite has already been used.'");
  test.todo("[INVT-04] token revoked: returns 'This invite was revoked.'");
  test.todo("[INVT-04] token unknown: returns 'This invite link isn't valid.'");
  test.todo("[INVT-04] caller already a member: returns 'You're already in this household.'");
  test.todo("[INVT-04] calls unstable_update({ activeHouseholdId }) after successful insert");
});
