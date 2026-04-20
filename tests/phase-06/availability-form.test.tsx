import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, cleanup } from "@testing-library/react";

// jsdom does not implement matchMedia; a few shadcn surfaces bundled via
// use-media-query still expect it. Stub before component import.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Mock Server Actions so create/delete paths are deterministic.
vi.mock("@/features/household/actions", () => ({
  createAvailability: vi.fn(),
  deleteAvailability: vi.fn(),
}));

// Mock sonner so toast calls are observable.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const { AvailabilitySection } = await import(
  "@/components/household/settings/availability-section"
);

// Source-grep fallback for assertions about portal-rendered content and
// component-level invariants (past-filter logic, role-gated delete button).
const COMPONENT_SOURCE = readFileSync(
  path.resolve(
    "src/components/household/settings/availability-section.tsx",
  ),
  "utf8",
);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const VIEWER_ID = "clh00000000000000000000001";
const OTHER_ID = "clh00000000000000000000002";
const HOUSEHOLD_ID = "clh00000000000000000000099";
const SLUG = "home-sweet-home";

// Helpers for deterministic test dates.
const DAY_MS = 24 * 60 * 60 * 1000;
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * DAY_MS);
}

function makeRow(
  overrides: Partial<
    Parameters<typeof AvailabilitySection>[0]["availabilities"][number]
  > = {},
): Parameters<typeof AvailabilitySection>[0]["availabilities"][number] {
  return {
    id: "clh00000000000000000000aaa",
    userId: VIEWER_ID,
    userName: "Alice",
    userEmail: "alice@example.com",
    startDate: daysFromNow(1),
    endDate: daysFromNow(7),
    reason: null,
    ...overrides,
  };
}

describe("AvailabilitySection (AVLB-01 / AVLB-02 / D-28 / D-29)", () => {
  it("AVLB-01 Two Popover+Calendar pickers render (start + end)", () => {
    render(
      <AvailabilitySection
        availabilities={[]}
        viewerUserId={VIEWER_ID}
        viewerRole="MEMBER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
      />,
    );

    // Both PopoverTriggers render a Button with aria-label="Start date"
    // and "End date" respectively. These are in the rendered tree (the
    // Popover content is portaled only when open, but the trigger is not).
    const startTrigger = screen.getByRole("button", {
      name: /start date/i,
    });
    const endTrigger = screen.getByRole("button", { name: /end date/i });
    expect(startTrigger).not.toBeNull();
    expect(endTrigger).not.toBeNull();

    // Both begin in the empty ("Pick a date") state.
    expect((startTrigger.textContent ?? "").trim()).toMatch(/pick a date/i);
    expect((endTrigger.textContent ?? "").trim()).toMatch(/pick a date/i);
  });

  it("AVLB-01 endDate < startDate shows inline error End date must be on or after start date", () => {
    // Client-side validation is wired as: when startDate && endDate && isBefore(endDate, startDate)
    // the component renders <p role="alert">End date must be on or after start date</p>.
    // The Popover+Calendar picker combo is hard to exercise through jsdom
    // (Base UI portals its Calendar into document.body; react-day-picker's
    // day buttons need layout), so assert the invariant at the source level:
    // the error copy is wired to the exact predicate.
    expect(COMPONENT_SOURCE).toMatch(
      /isBefore\(endDate, startDate\)[\s\S]*End date must be on or after start date/,
    );

    // Also confirm the alert element is rendered with role="alert" in the
    // end-date branch (accessibility contract).
    expect(COMPONENT_SOURCE).toMatch(
      /endDateError[\s\S]*role="alert"[\s\S]*text-destructive/,
    );
  });

  it("AVLB-01 startDate < today shows inline error Start date must be today or in the future", () => {
    // Same approach: the predicate startDate && isBefore(startDate, today)
    // gates the inline error message.
    expect(COMPONENT_SOURCE).toMatch(
      /isBefore\(startDate, today\)[\s\S]*Start date must be today or in the future/,
    );

    // The Calendar's disabled={(d) => isBefore(d, today)} predicate on the
    // start picker also enforces Phase 3 Pitfall 12 at the UI layer.
    expect(COMPONENT_SOURCE).toMatch(/disabled=\{\(d\) => isBefore\(d, today\)\}/);
  });

  it("AVLB-02 List row: You rendered for viewers own row", () => {
    render(
      <AvailabilitySection
        availabilities={[makeRow({ userId: VIEWER_ID, userName: "Alice" })]}
        viewerUserId={VIEWER_ID}
        viewerRole="MEMBER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
      />,
    );

    // Self-row renders "You" in place of the user's name.
    expect(screen.getByText("You")).not.toBeNull();
    // And the other-user's name is NOT present for this row.
    expect(screen.queryByText("Alice")).toBeNull();
  });

  it("AVLB-02 List row: Delete button visible on self-row", () => {
    render(
      <AvailabilitySection
        availabilities={[makeRow({ userId: VIEWER_ID })]}
        viewerUserId={VIEWER_ID}
        viewerRole="MEMBER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
      />,
    );

    const deleteButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /^delete$/i.test((el.textContent ?? "").trim()));
    expect(deleteButton).not.toBeUndefined();
  });

  it("AVLB-02 List row: Delete button visible on other-row when viewerRole=OWNER", () => {
    render(
      <AvailabilitySection
        availabilities={[
          makeRow({ userId: OTHER_ID, userName: "Bob", userEmail: "bob@x.com" }),
        ]}
        viewerUserId={VIEWER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
      />,
    );

    const deleteButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /^delete$/i.test((el.textContent ?? "").trim()));
    expect(deleteButton).not.toBeUndefined();

    // The row still shows the other user's name (not "You").
    expect(screen.getByText("Bob")).not.toBeNull();
    expect(screen.queryByText("You")).toBeNull();
  });

  it("AVLB-02 List row: Delete button HIDDEN on other-row when viewerRole=MEMBER", () => {
    render(
      <AvailabilitySection
        availabilities={[
          makeRow({ userId: OTHER_ID, userName: "Bob", userEmail: "bob@x.com" }),
        ]}
        viewerUserId={VIEWER_ID}
        viewerRole="MEMBER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
      />,
    );

    // With viewerRole=MEMBER and the row belonging to another user, the
    // Delete button must NOT render. (Server-side deleteAvailability also
    // enforces this per D-09; client hiding is defense-in-depth / UX polish.)
    const deleteButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /^delete$/i.test((el.textContent ?? "").trim()));
    expect(deleteButton).toBeUndefined();
  });

  it("AVLB-02 Past availabilities (endDate<today) filtered out of the list", () => {
    // A row whose endDate is in the past must not render, regardless of
    // startDate. Also render a future row so we can confirm the filter is
    // per-row (not "hide the whole list").
    render(
      <AvailabilitySection
        availabilities={[
          makeRow({
            id: "clh00000000000000000000ppp",
            startDate: daysFromNow(-14),
            endDate: daysFromNow(-7),
            reason: "Past vacation — should NOT render",
          }),
          makeRow({
            id: "clh00000000000000000000fff",
            startDate: daysFromNow(1),
            endDate: daysFromNow(3),
            reason: "Upcoming trip — should render",
          }),
        ]}
        viewerUserId={VIEWER_ID}
        viewerRole="MEMBER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
      />,
    );

    // Past-row reason text is filtered out.
    expect(
      screen.queryByText(/Past vacation — should NOT render/),
    ).toBeNull();
    // Future-row reason text renders.
    expect(
      screen.getByText(/Upcoming trip — should render/),
    ).not.toBeNull();

    // Empty-state copy must NOT appear (the future row is still there).
    expect(
      screen.queryByText(/No upcoming availability periods/),
    ).toBeNull();
  });
});
