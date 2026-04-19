// tests/phase-04/remove-member.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("removeMember", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-06) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-06 / D-24] non-OWNER caller: ForbiddenError-shaped error");
  test.todo("[INVT-06] self-target: returns 'To leave a household, use Leave instead of Remove.'");
  test.todo("[INVT-06] target is last OWNER: blocked with owner-specific error");
  test.todo("[INVT-06] removes HouseholdMember row + cancels target's future availability");
});
