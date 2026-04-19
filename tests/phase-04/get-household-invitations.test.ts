// tests/phase-04/get-household-invitations.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("getHouseholdInvitations", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-02) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-02] returns active-only rows (revokedAt: null AND acceptedAt: null)");
  test.todo("[INVT-02] ordered by createdAt DESC");
  test.todo("[INVT-02] includes invitedBy relation with name + email");
});
