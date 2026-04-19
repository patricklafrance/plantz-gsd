import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PassiveStatusBanner } from "@/components/household/passive-status-banner";

describe("PassiveStatusBanner (HNTF-04 / D-25)", () => {
  afterEach(() => {
    cleanup();
  });

  // Use local Date to avoid UTC drift shifting day-of-week locally.
  const cycleEnd = new Date(2026, 3, 23); // Thu Apr 23, 2026 (local)

  it("HNTF-04 renders '{Alice} is watering this cycle.' subject", () => {
    render(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(screen.getByText(/is watering this cycle/)).not.toBeNull();
    expect(screen.getByText("Alice")).not.toBeNull();
  });

  it("HNTF-04 renders '{Bob} is next up.' tail when nextAssigneeName provided", () => {
    const { container } = render(
      <PassiveStatusBanner
        assigneeName="Alice"
        nextAssigneeName="Bob"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(container.textContent).toMatch(/is next up\./);
    expect(container.textContent).toMatch(/Bob/);
  });

  it("HNTF-04 renders '{Owner} covers if no one's available next.' when nextAssigneeName is fallback owner variant", () => {
    const { container } = render(
      <PassiveStatusBanner
        assigneeName="Alice"
        nextAssigneeName="Carol"
        nextIsFallbackOwner={true}
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(container.textContent).toMatch(/Carol covers if no one's available next\./);
    expect(container.textContent).not.toMatch(/is next up/);
  });

  it("HNTF-04 hides 'is next up' tail when memberCount === 1 OR nextAssigneeName is undefined", () => {
    const { container, rerender } = render(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={1}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(container.textContent).not.toMatch(/is next up/);
    expect(container.textContent).not.toMatch(/covers if no one/);

    rerender(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(container.textContent).not.toMatch(/is next up/);
  });

  it("HNTF-04 meta shows 'Cycle ends {Thu Apr 23}'", () => {
    render(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    expect(screen.getByText(/Cycle ends Thu Apr 23/)).not.toBeNull();
  });

  it("HNTF-04 uses bg-muted/50 and border-border tokens", () => {
    const { container } = render(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    const outer = container.querySelector("[role='status']");
    expect(outer?.className).toMatch(/bg-muted\/50/);
    expect(outer?.className).toMatch(/border-border/);
  });

  it("HNTF-04 Users icon has aria-hidden='true'", () => {
    const { container } = render(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("HNTF-04 assignee name rendered as font-semibold", () => {
    const { container } = render(
      <PassiveStatusBanner
        assigneeName="Alice"
        memberCount={3}
        cycleEndDate={cycleEnd}
      />,
    );
    const nameSpan = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "Alice",
    );
    expect(nameSpan).toBeDefined();
    expect(nameSpan?.className).toMatch(/font-semibold/);
  });
});
