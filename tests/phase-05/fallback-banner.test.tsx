import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FallbackBanner } from "@/components/household/fallback-banner";

describe("FallbackBanner (D-12.4 / D-25)", () => {
  afterEach(() => {
    cleanup();
  });

  it("viewerIsOwner && isPaused=false → 'Nobody's available — you're covering this cycle.' subject", () => {
    render(<FallbackBanner viewerIsOwner={true} ownerName="Alice" isPaused={false} />);
    expect(
      screen.getByText(/Nobody's available — you're covering this cycle/),
    ).not.toBeNull();
  });

  it("!viewerIsOwner && isPaused=false → 'Nobody's available — {Owner} is covering this cycle.' subject", () => {
    const { container } = render(
      <FallbackBanner viewerIsOwner={false} ownerName="Alice" isPaused={false} />,
    );
    expect(container.textContent).toMatch(/Nobody's available/);
    expect(container.textContent).toMatch(/is covering this cycle/);
    expect(container.textContent).toMatch(/Alice/);
  });

  it("isPaused=true → 'This week's rotation is paused.' subject", () => {
    render(<FallbackBanner viewerIsOwner={false} ownerName="Alice" isPaused={true} />);
    expect(screen.getByText(/This week's rotation is paused/)).not.toBeNull();
  });

  it("outer div has role='alert' (not 'status')", () => {
    const { container } = render(
      <FallbackBanner viewerIsOwner={true} ownerName="Alice" isPaused={false} />,
    );
    expect(container.querySelector("[role='alert']")).not.toBeNull();
    expect(container.querySelector("[role='status']")).toBeNull();
  });

  it("uses bg-destructive/10 and border-destructive/30 tokens", () => {
    const { container } = render(
      <FallbackBanner viewerIsOwner={true} ownerName="Alice" isPaused={false} />,
    );
    const outer = container.querySelector("[role='alert']");
    expect(outer?.className).toMatch(/bg-destructive\/10/);
    expect(outer?.className).toMatch(/border-destructive\/30/);
  });

  it("AlertTriangle icon has aria-hidden='true'", () => {
    const { container } = render(
      <FallbackBanner viewerIsOwner={true} ownerName="Alice" isPaused={false} />,
    );
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("viewerIsOwner meta: 'Check back when members update their availability.'", () => {
    render(<FallbackBanner viewerIsOwner={true} ownerName="Alice" isPaused={false} />);
    expect(
      screen.getByText(/Check back when members update their availability/),
    ).not.toBeNull();
  });

  it("!viewerIsOwner meta: 'You can update your availability in settings.'", () => {
    render(<FallbackBanner viewerIsOwner={false} ownerName="Alice" isPaused={false} />);
    expect(
      screen.getByText(/You can update your availability in settings/),
    ).not.toBeNull();
  });
});
