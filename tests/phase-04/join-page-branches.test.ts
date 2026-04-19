// tests/phase-04/join-page-branches.test.ts
import { describe, test } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

// Silence unused import until Wave 2/3 wires real tests
void EMAIL_PREFIX;

describe("/join/[token] branch logic", () => {
  // Wave 2/3/4 executors grep-and-replace `test.todo` with `test(` when implementing.
  // Test titles MUST include the requirement ID (e.g., INVT-03) so failures trace
  // back to REQUIREMENTS.md.
  test.todo("[INVT-03] unknown token renders Branch 1 copy (icon=XCircle)");
  test.todo("[INVT-03] revokedAt set renders Branch 2 copy (icon=ShieldOff)");
  test.todo("[INVT-03] acceptedAt set renders Branch 3 copy (icon=CheckCircle2)");
  test.todo("[INVT-03] caller already member renders Branch 4 copy with dashboard link");
  test.todo("[INVT-03] valid + logged-out renders Branch 5a with Sign in + Create account buttons and correct callbackUrl");
  test.todo("[INVT-04] valid + logged-in renders Branch 5b with Accept form");
});
