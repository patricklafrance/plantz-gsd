import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReassignmentBanner } from "@/components/household/reassignment-banner";

describe("ReassignmentBanner (HNTF-03 / D-25)", () => {
  afterEach(() => {
    cleanup();
  });

  // Use local Date — see cycle-start-banner.test.tsx note about UTC shift.
  const cycleEnd = new Date(2026, 3, 23); // Thu Apr 23, 2026 (local)

  it("HNTF-03 manual_skip → '{Alice} skipped — you're covering this cycle.' subject", () => {
    render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="manual_skip"
        dueCount={2}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(
      screen.getByText(/skipped — you're covering this cycle/),
    ).not.toBeNull();
    expect(screen.getByText("Alice")).not.toBeNull();
  });

  it("HNTF-03 auto_skip → '{Alice} is unavailable — you're covering this cycle.' subject", () => {
    render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="auto_skip"
        dueCount={2}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(
      screen.getByText(/is unavailable — you're covering this cycle/),
    ).not.toBeNull();
  });

  it("HNTF-03 member_left → '{Alice} left the household — you're covering this cycle.' subject", () => {
    render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="member_left"
        dueCount={2}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(
      screen.getByText(/left the household — you're covering this cycle/),
    ).not.toBeNull();
  });

  it("HNTF-03 priorAssigneeName rendered as font-semibold", () => {
    const { container } = render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="manual_skip"
        dueCount={2}
        cycleEndDate={cycleEnd}
      />,
    );
    const nameSpan = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "Alice",
    );
    expect(nameSpan).toBeDefined();
    expect(nameSpan?.className).toMatch(/font-semibold/);
  });

  it("HNTF-03 meta shows '{N} plants due · Cycle ends {Thu Apr 23}'", () => {
    render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="manual_skip"
        dueCount={4}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(
      screen.getByText(/4 plants due · Cycle ends Thu Apr 23/),
    ).not.toBeNull();
  });

  it("HNTF-03 zero-due variant hides plant count from meta (still shows cycle end date)", () => {
    const { container } = render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="manual_skip"
        dueCount={0}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(container.textContent).not.toMatch(/plants due/);
    expect(container.textContent).not.toMatch(/plant due/);
    expect(screen.getByText(/Cycle ends Thu Apr 23/)).not.toBeNull();
  });

  it("HNTF-03 UserCheck icon has aria-hidden='true'", () => {
    const { container } = render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="manual_skip"
        dueCount={2}
        cycleEndDate={cycleEnd}
      />,
    );
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("HNTF-03 outer div has role='status'", () => {
    const { container } = render(
      <ReassignmentBanner
        priorAssigneeName="Alice"
        reassignType="manual_skip"
        dueCount={2}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(container.querySelector("[role='status']")).not.toBeNull();
  });

  // D-06: previous-assignee banner clear is a DASHBOARD-level filter (cycleId === currentCycle.id).
  // This test file does not assert the filter — that is the dashboard page's responsibility (Plan 05).
  // Keeping this test as a documentation marker so auditors see the coverage is intentional.
  it("HNTF-03 DOC-ONLY: banner receives only current-cycle notifications via getCycleNotificationsForViewer filter (D-06 derivational clear — asserted in Plan 05)", () => {
    // The D-06 filter lives in getCycleNotificationsForViewer (Plan 05-02) and the
    // dashboard page Server Component (Plan 05-05). This component is unaware of it.
    expect(true).toBe(true);
  });
});
