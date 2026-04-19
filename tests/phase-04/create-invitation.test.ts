// tests/phase-04/create-invitation.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("createInvitation", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-01) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-01] OWNER caller: returns { success: true, token, invitationId } with a 64-char hex token");
  test.todo("[INVT-01] non-OWNER caller: returns ForbiddenError-shaped { error } with OWNER-gate copy");
  test.todo("[INVT-01] demo-mode session: returns disabled-action error");
  test.todo("[INVT-01] persists only tokenHash, not the raw token");
});
