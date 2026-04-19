// tests/phase-04/revoke-invitation.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("revokeInvitation", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-02) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-02] sets revokedAt on the matching Invitation row");
  test.todo("[INVT-02] idempotent on already-revoked (returns success, no-op write)");
  test.todo("[INVT-02] returns error 'Can't revoke an already-accepted invite.' when acceptedAt is set");
  test.todo("[INVT-02] non-OWNER caller: returns OWNER-gate error");
});
