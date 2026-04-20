import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks: next/navigation, sonner, @/features/household/actions, dropdown-menu
//
// We mock DropdownMenu primitives to render children inline (no portal,
// no real Base UI keyboard/click flow). This matches the pattern used in
// tests/phase-05/notification-bell-variant.test.tsx and keeps the phase
// surface self-contained without needing @testing-library/user-event.
// ─────────────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/features/household/actions", () => ({
  setDefaultHousehold: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-root">{children}</div>
  ),
  DropdownMenuTrigger: ({
    render,
    children,
    "aria-label": ariaLabel,
  }: {
    render?: React.ReactElement;
    children?: React.ReactNode;
    "aria-label"?: string;
  }) => {
    // Mirror Base UI's render-prop pattern minimally: clone `render` with
    // aria-label + inner children so `getByRole("button", { name })` works.
    if (render) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (
        <button type="button" aria-label={ariaLabel} data-testid="dropdown-trigger">
          {children}
        </button>
      );
    }
    return (
      <button type="button" aria-label={ariaLabel} data-testid="dropdown-trigger">
        {children}
      </button>
    );
  },
  DropdownMenuContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dropdown-content" className={className}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    className,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <div
      role="menuitem"
      data-testid="dropdown-item"
      className={className}
      aria-disabled={disabled ? "true" : "false"}
      data-disabled={disabled ? "true" : undefined}
      onClick={(e) => {
        if (disabled) return;
        onClick?.();
        void e;
      }}
    >
      {children}
    </div>
  ),
  DropdownMenuLabel: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dropdown-label" className={className}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-sep" />,
}));

import {
  HouseholdSwitcher,
  buildSwitchPath,
} from "@/components/household/household-switcher";
import { setDefaultHousehold } from "@/features/household/actions";
import { usePathname } from "next/navigation";

function mkRow(
  slug: string,
  name: string,
  role: "OWNER" | "MEMBER",
  isDefault: boolean,
) {
  return {
    household: { id: `id-${slug}`, slug, name },
    role,
    isDefault,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("HouseholdSwitcher (HSET-01 / D-03, D-05, D-09, D-34)", () => {
  it("HSET-01 renders all households from props with role pill + default star", () => {
    vi.mocked(usePathname).mockReturnValue("/h/alpha/dashboard");
    render(
      <HouseholdSwitcher
        variant="desktop"
        currentSlug="alpha"
        currentHouseholdName="Alpha"
        households={[
          mkRow("alpha", "Alpha", "OWNER", true),
          mkRow("beta", "Beta", "MEMBER", false),
        ]}
      />,
    );

    // Trigger is visible with aria-label "Switch household"
    expect(
      screen.getByRole("button", { name: /switch household/i }),
    ).not.toBeNull();

    // Both household names rendered (Alpha appears in both trigger + row,
    // Beta only in the row; use getAllByText for Alpha to avoid the
    // "multiple elements found" failure on the trigger duplicate).
    expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Beta")).not.toBeNull();

    // Role pills: OWNER for alpha, MEMBER for beta
    expect(screen.getByText("OWNER")).not.toBeNull();
    expect(screen.getByText("MEMBER")).not.toBeNull();

    // Default star rendered for isDefault row (alpha): look up the menuitem
    // containing "Alpha" text and confirm a child with fill-accent exists.
    const alphaRow = screen
      .getAllByRole("menuitem")
      .find((r) => r.textContent?.includes("Alpha"));
    expect(alphaRow).not.toBeUndefined();
    expect(alphaRow?.querySelector(".fill-accent")).not.toBeNull();

    // Beta row should NOT have a filled-star; it's a non-default row.
    const betaRow = screen
      .getAllByRole("menuitem")
      .find((r) => r.textContent?.includes("Beta"));
    expect(betaRow?.querySelector(".fill-accent")).toBeNull();
  });

  it("HSET-01 active household row is disabled (non-navigable)", () => {
    vi.mocked(usePathname).mockReturnValue("/h/alpha/dashboard");
    render(
      <HouseholdSwitcher
        variant="desktop"
        currentSlug="alpha"
        currentHouseholdName="Alpha"
        households={[
          mkRow("alpha", "Alpha", "OWNER", true),
          mkRow("beta", "Beta", "MEMBER", false),
        ]}
      />,
    );

    const alphaRow = screen
      .getAllByRole("menuitem")
      .find((r) => r.textContent?.includes("Alpha"));
    expect(alphaRow).not.toBeUndefined();
    // Mock sets aria-disabled="true" or data-disabled on disabled items.
    expect(
      alphaRow?.getAttribute("aria-disabled") === "true" ||
        alphaRow?.hasAttribute("data-disabled"),
    ).toBe(true);

    // Clicking the disabled active row must NOT push.
    alphaRow && fireEvent.click(alphaRow);
    expect(pushMock).not.toHaveBeenCalled();

    // Non-active beta row is navigable → click fires router.push with the
    // rewritten path (/h/beta/dashboard).
    const betaRow = screen
      .getAllByRole("menuitem")
      .find((r) => r.textContent?.includes("Beta"));
    betaRow && fireEvent.click(betaRow);
    expect(pushMock).toHaveBeenCalledWith("/h/beta/dashboard");
  });

  it("HSET-01 list-route preservation: /h/old/plants -> /h/new/plants", () => {
    expect(buildSwitchPath("/h/old/plants", "new")).toBe("/h/new/plants");
    expect(buildSwitchPath("/h/old/rooms", "new")).toBe("/h/new/rooms");
  });

  it("HSET-01 detail-route fallback: /h/old/plants/abc-cuid -> /h/new/plants", () => {
    // CUID: Prisma cuid() generates 25 lowercase-alpha-numeric; permissive
    // regex accepts 20+ chars in household-switcher's buildSwitchPath.
    expect(
      buildSwitchPath("/h/old/plants/clabcdef0123456789012", "new"),
    ).toBe("/h/new/plants");
    expect(
      buildSwitchPath("/h/old/rooms/clroomabcdef0123456789", "new"),
    ).toBe("/h/new/rooms");
  });

  it("HSET-01 buildSwitchPath handles /h/slug/settings verbatim", () => {
    expect(buildSwitchPath("/h/old/settings", "new")).toBe("/h/new/settings");
    // Nested settings tab: /h/old/settings/availability preserved
    expect(buildSwitchPath("/h/old/settings/availability", "new")).toBe(
      "/h/new/settings/availability",
    );
  });

  it("HSET-01 buildSwitchPath handles /h/slug/dashboard verbatim", () => {
    expect(buildSwitchPath("/h/old/dashboard", "new")).toBe("/h/new/dashboard");
  });

  it("HSET-02 'Set as default' click invokes setDefaultHousehold action with target householdId", async () => {
    vi.mocked(usePathname).mockReturnValue("/h/alpha/dashboard");
    vi.mocked(setDefaultHousehold).mockResolvedValue({ success: true });

    render(
      <HouseholdSwitcher
        variant="desktop"
        currentSlug="alpha"
        currentHouseholdName="Alpha"
        households={[
          mkRow("alpha", "Alpha", "OWNER", true),
          mkRow("beta", "Beta", "MEMBER", false),
        ]}
      />,
    );

    // Only the non-active, non-default row renders the "Set as default" button.
    const setDefaultBtn = screen.getByRole("button", {
      name: /set as default/i,
    });
    fireEvent.click(setDefaultBtn);

    // Drain microtasks so startTransition's async callback has flushed enough
    // for the first `await setDefaultHousehold(...)` call to register.
    await Promise.resolve();

    expect(setDefaultHousehold).toHaveBeenCalledTimes(1);
    expect(setDefaultHousehold).toHaveBeenCalledWith({
      householdId: "id-beta",
    });

    // The click must NOT have triggered a navigation — e.stopPropagation()
    // must prevent the outer DropdownMenuItem's onClick from firing.
    expect(pushMock).not.toHaveBeenCalled();
  });
});
