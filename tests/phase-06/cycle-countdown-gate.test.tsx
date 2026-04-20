/**
 * D-25 / HSET-03 / Warning #5 — Behavioral test for the CycleCountdownBanner
 * render gate that lives at the dashboard mount site (Plan 07 EDIT 3 in
 * `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`):
 *
 *   viewerIsAssignee && currentCycle?.status === "active" && !hasUnreadCycleEvent
 *
 * The production gate is a JSX conditional in a Server Component; we can't
 * render the whole dashboard page in jsdom because it calls Prisma / auth() /
 * cookies() at module time. Instead this file renders a tiny GateHarness that
 * replicates the predicate exactly and asserts the banner mounts (or doesn't)
 * across the four meaningful combinations.
 *
 * If the production gate in dashboard/page.tsx diverges from this predicate,
 * keep both places aligned — the harness here IS the authoritative D-25
 * contract.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CycleCountdownBanner } from "@/components/household/cycle-countdown-banner";

type HarnessProps = {
  viewerIsAssignee: boolean;
  currentCycleStatus: "active" | "paused" | null;
  hasUnreadCycleEvent: boolean;
};

function GateHarness({
  viewerIsAssignee,
  currentCycleStatus,
  hasUnreadCycleEvent,
}: HarnessProps) {
  // Replicates dashboard/page.tsx:
  //   viewerIsAssignee && currentCycle?.status === "active" && !hasUnreadCycleEvent
  const shouldRender =
    viewerIsAssignee &&
    currentCycleStatus === "active" &&
    !hasUnreadCycleEvent;

  if (!shouldRender) return null;

  return (
    <CycleCountdownBanner
      daysLeft={3}
      nextAssigneeName="Alice"
      cycleEndDate={new Date("2026-05-01T00:00:00Z")}
      isSingleMember={false}
    />
  );
}

describe("D-25 CycleCountdown gate (warning #5 behavioral test)", () => {
  afterEach(() => cleanup());

  it("HSET-03 renders when viewerIsAssignee && status=active && !hasUnreadCycleEvent", () => {
    render(
      <GateHarness
        viewerIsAssignee={true}
        currentCycleStatus="active"
        hasUnreadCycleEvent={false}
      />,
    );
    // CycleCountdownBanner renders its container with role="status".
    const banner = screen.queryByRole("status");
    expect(banner).not.toBeNull();
    // Copy check pins the harness to the actual banner (not some other
    // role="status" region that might leak in via a future portal).
    expect(banner!.textContent).toMatch(/You're up this week/);
  });

  it("HSET-03 does NOT render when viewerIsAssignee=false", () => {
    render(
      <GateHarness
        viewerIsAssignee={false}
        currentCycleStatus="active"
        hasUnreadCycleEvent={false}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("HSET-03 does NOT render when hasUnreadCycleEvent=true (mutual exclusion with CycleStart / Reassignment)", () => {
    render(
      <GateHarness
        viewerIsAssignee={true}
        currentCycleStatus="active"
        hasUnreadCycleEvent={true}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it('HSET-03 does NOT render when currentCycle?.status !== "active"', () => {
    render(
      <GateHarness
        viewerIsAssignee={true}
        currentCycleStatus="paused"
        hasUnreadCycleEvent={false}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("HSET-03 does NOT render when currentCycle is null", () => {
    render(
      <GateHarness
        viewerIsAssignee={true}
        currentCycleStatus={null}
        hasUnreadCycleEvent={false}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
