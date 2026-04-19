import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CycleStartBanner } from "@/components/household/cycle-start-banner";

describe("CycleStartBanner (HNTF-02 / D-25)", () => {
  afterEach(() => {
    cleanup();
  });

  // Use local Date constructor — `new Date("2026-04-23T00:00:00Z")` shifts to
  // the previous day in test runners west of UTC (e.g., date-fns format
  // returns "Wed Apr 22" locally). `new Date(2026, 3, 23)` is timezone-stable.
  const cycleEnd = new Date(2026, 3, 23); // Thu Apr 23, 2026 (local)

  it("HNTF-02 renders 'You're up this cycle.' subject", () => {
    render(<CycleStartBanner dueCount={3} cycleEndDate={cycleEnd} />);
    // JSX &apos; renders as a literal apostrophe '\u0027'.
    expect(screen.getByText(/You're up this cycle/i)).not.toBeNull();
  });

  it("HNTF-02 renders '{N} plants due · Cycle ends {Thu Apr 23}' meta when dueCount > 0", () => {
    render(<CycleStartBanner dueCount={3} cycleEndDate={cycleEnd} />);
    expect(
      screen.getByText(/3 plants due · Cycle ends Thu Apr 23/),
    ).not.toBeNull();
  });

  it("HNTF-02 renders 'No plants due right now · Cycle ends {Thu Apr 23}' meta when dueCount === 0", () => {
    render(<CycleStartBanner dueCount={0} cycleEndDate={cycleEnd} />);
    expect(
      screen.getByText(/No plants due right now · Cycle ends Thu Apr 23/),
    ).not.toBeNull();
  });

  it("HNTF-02 formats cycleEndDate with date-fns format(date, 'EEE MMM d')", () => {
    // Tue Apr 21, 2026 (local)
    render(<CycleStartBanner dueCount={1} cycleEndDate={new Date(2026, 3, 21)} />);
    expect(screen.getByText(/Tue Apr 21/)).not.toBeNull();
  });

  it("HNTF-02 outer div has role='status' (not 'alert')", () => {
    const { container } = render(
      <CycleStartBanner dueCount={1} cycleEndDate={cycleEnd} />,
    );
    expect(container.querySelector("[role='status']")).not.toBeNull();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("HNTF-02 uses bg-accent/10 and border-accent/30 tokens", () => {
    const { container } = render(
      <CycleStartBanner dueCount={1} cycleEndDate={cycleEnd} />,
    );
    const outer = container.querySelector("[role='status']");
    expect(outer?.className).toMatch(/bg-accent\/10/);
    expect(outer?.className).toMatch(/border-accent\/30/);
  });

  it("HNTF-02 Sparkles icon has aria-hidden='true'", () => {
    const { container } = render(
      <CycleStartBanner dueCount={1} cycleEndDate={cycleEnd} />,
    );
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
