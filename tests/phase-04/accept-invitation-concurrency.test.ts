// tests/phase-04/accept-invitation-concurrency.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("acceptInvitation atomicity (real DB, D-23)", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-04) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-04 / D-23] two concurrent acceptInvitation calls with same token: exactly one succeeds, one returns 'already used'");
  test.todo("[INVT-04 / D-23] no duplicate HouseholdMember row is created");
});
