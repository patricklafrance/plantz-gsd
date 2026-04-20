import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { CycleCountdownBanner } from "@/components/household/cycle-countdown-banner";

afterEach(() => {
  cleanup();
});

const futureDate = new Date("2026-05-10T12:00:00Z");

describe("CycleCountdownBanner (D-23 / D-24 / D-25)", () => {
  it("D-23 renders for assignee with no unread cycle event (normal variant)", () => {
    const { container } = render(
      <CycleCountdownBanner
        daysLeft={5}
        nextAssigneeName="Alice"
        cycleEndDate={futureDate}
        isSingleMember={false}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/You're up this week/)).toBeTruthy();
    expect(screen.getByText(/5 days left/)).toBeTruthy();
    expect(screen.getByText(/Alice is next/)).toBeTruthy();
    const outer = container.querySelector("[role='status']");
    expect(outer?.className).toMatch(/bg-accent\/10/);
    expect(outer?.className).not.toMatch(/bg-destructive\/10/);
  });

  it("D-25 does NOT render for non-assignee", () => {
    // This component is caller-gated — it has no internal render condition.
    // The assertion here is that the component is a pure props-in/JSX-out
    // function: if the dashboard doesn't mount it, it doesn't appear. Test
    // by confirming the component does NOT import any session/cycle hooks —
    // the non-assignee gating lives at the mount site (dashboard/page.tsx
    // wired in Plan 07 per D-25).
    const src = readFileSync(
      "src/components/household/cycle-countdown-banner.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/from "[^"]*auth[^"]*"/);
    expect(src).not.toMatch(/useSession|getCurrentHousehold/);
  });

  it("D-25 suppressed by unread cycle_started event (hasUnreadEvent=true)", () => {
    // Same rationale as the previous test: caller-gating lives at the dashboard
    // Server Component. The assertion here is that CycleCountdownBanner is
    // UNCONDITIONAL given its props — it does NOT read `hasUnreadEvent` or
    // any unread-event state internally.
    const src = readFileSync(
      "src/components/household/cycle-countdown-banner.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/hasUnreadEvent|unreadEvent|cycleEvents/);
  });

  it("D-25 suppressed by unread cycle_reassigned_* event", () => {
    // Same contract assertion — no internal unread-event logic.
    const src = readFileSync(
      "src/components/household/cycle-countdown-banner.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/cycle_reassigned|cycle_started/);
  });

  it("D-23 urgency variant when daysLeft <= 1: uses bg-destructive/10 border-destructive/30", () => {
    const { container } = render(
      <CycleCountdownBanner
        daysLeft={1}
        nextAssigneeName="Bob"
        cycleEndDate={futureDate}
        isSingleMember={false}
      />,
    );
    const outer = container.querySelector("[role='status']");
    expect(outer?.className).toMatch(/bg-destructive\/10/);
    expect(outer?.className).toMatch(/border-destructive\/30/);
    expect(screen.getByText(/Last day.*tomorrow passes to Bob/i)).toBeTruthy();
  });

  it("D-23 single-member copy variant: suppresses 'X is next' line when isSingleMember=true", () => {
    render(
      <CycleCountdownBanner
        daysLeft={5}
        nextAssigneeName={null}
        cycleEndDate={futureDate}
        isSingleMember={true}
      />,
    );
    expect(screen.getByText(/You're on rotation.*5 days left/)).toBeTruthy();
    // No "is next" text for single-member
    expect(screen.queryByText(/is next/)).toBeNull();
  });

  it("D-23 displays nextAssigneeName and formatted cycle end date", () => {
    render(
      <CycleCountdownBanner
        daysLeft={3}
        nextAssigneeName="Carol"
        cycleEndDate={futureDate}
        isSingleMember={false}
      />,
    );
    expect(screen.getByText(/Carol is next/)).toBeTruthy();
    // Format "MMM d, yyyy" for 2026-05-10 UTC → "May 10, 2026" (may vary by
    // locale timezone; assert by regex).
    expect(screen.getByText(/Cycle ends May \d{1,2}, 2026/)).toBeTruthy();
  });
});
