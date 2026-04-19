// tests/phase-04/get-household-members.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("getHouseholdMembers", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-06) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-06] returns all members with { userId, userName, userEmail, role, rotationOrder, joinedAt }");
  test.todo("[INVT-06] ordered by rotationOrder ASC");
});
