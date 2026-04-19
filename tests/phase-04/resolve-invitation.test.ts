// tests/phase-04/resolve-invitation.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("resolveInvitationByToken", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-04) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-04] unknown token: returns null");
  test.todo("[INVT-04] valid token: returns { invitation, household, ownerName, memberCount }");
  test.todo("[INVT-04] owner display falls back to email when user.name is null");
  test.todo("[INVT-04] member count reflects live HouseholdMember row count");
});
