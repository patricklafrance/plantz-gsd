// tests/phase-04/promote-demote.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("promoteToOwner / demoteToMember", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-06) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-06 / D-24] promote: non-OWNER caller blocked");
  test.todo("[INVT-06] promote: already OWNER is no-op (idempotent)");
  test.todo("[INVT-06] promote: MEMBER → OWNER updates role column");
  test.todo("[INVT-06] demote: would leave 0 OWNERs blocked");
  test.todo("[INVT-06] demote: self-demote with another OWNER present allowed");
  test.todo("[INVT-06] demote: non-OWNER caller blocked");
});
