import { describe, it } from "vitest";

describe("ReassignmentBanner (HNTF-03 / D-25)", () => {
  it.todo(
    "HNTF-03 manual_skip → '{Alice} skipped — you're covering this cycle.' subject",
  );
  it.todo(
    "HNTF-03 auto_skip → '{Alice} is unavailable — you're covering this cycle.' subject",
  );
  it.todo(
    "HNTF-03 member_left → '{Alice} left the household — you're covering this cycle.' subject",
  );
  it.todo("HNTF-03 priorAssigneeName rendered as font-semibold");
  it.todo("HNTF-03 meta shows '{N} plants due · Cycle ends {Tue Apr 23}'");
  it.todo(
    "HNTF-03 zero-due variant hides plant count from meta (still shows cycle end date)",
  );
  it.todo("HNTF-03 UserCheck icon has aria-hidden='true'");
  it.todo("HNTF-03 outer div has role='status'");
  // D-06: previous-assignee banner clear is a DASHBOARD-level filter (cycleId === currentCycle.id).
  // This test file does not assert the filter — that is the dashboard page's responsibility (Plan 05).
  // Documented here so auditors see the coverage is intentional not missing:
  it.todo(
    "HNTF-03 DOC-ONLY: banner receives only current-cycle notifications via getCycleNotificationsForViewer filter (D-06 derivational clear — asserted in Plan 05)",
  );
});
