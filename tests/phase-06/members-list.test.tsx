import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, cleanup } from "@testing-library/react";

// Mock Server Actions so submit paths are deterministic and assertable.
vi.mock("@/features/household/actions", () => ({
  reorderRotation: vi.fn(),
  promoteToOwner: vi.fn(),
  demoteToMember: vi.fn(),
  removeMember: vi.fn(),
}));

// Mock sonner toast so surface calls are observable.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const { MembersList } = await import(
  "@/components/household/settings/members-list"
);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

// Re-used across tests.
const VIEWER_OWNER_ID = "clh00000000000000000000001";
const MEMBER_ID = "clh00000000000000000000002";
const OTHER_OWNER_ID = "clh00000000000000000000003";
const HOUSEHOLD_ID = "clh00000000000000000000099";
const SLUG = "home-sweet-home";
const HOUSEHOLD_NAME = "Home";

const COMPONENT_SOURCE = readFileSync(
  path.resolve("src/components/household/settings/members-list.tsx"),
  "utf8",
);

function makeRow(
  overrides: Partial<
    Parameters<typeof MembersList>[0]["members"][number]
  > = {},
): Parameters<typeof MembersList>[0]["members"][number] {
  return {
    userId: VIEWER_OWNER_ID,
    userName: "Alice",
    userEmail: "alice@example.com",
    role: "OWNER",
    rotationOrder: 1,
    ...overrides,
  };
}

describe("MembersList (HSET-03 / ROTA-01 / D-17 / D-18)", () => {
  it("HSET-03 renders rotation-order prefix [N] for each row", () => {
    render(
      <MembersList
        members={[
          makeRow({
            userId: VIEWER_OWNER_ID,
            userName: "Alice",
            role: "OWNER",
            rotationOrder: 1,
          }),
          makeRow({
            userId: MEMBER_ID,
            userName: "Bob",
            role: "MEMBER",
            rotationOrder: 2,
          }),
          makeRow({
            userId: OTHER_OWNER_ID,
            userName: "Carol",
            role: "MEMBER",
            rotationOrder: 3,
          }),
        ]}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    // Prefixes rendered in bracket form [N] alongside the rotation column.
    expect(screen.getByText("[1]")).not.toBeNull();
    expect(screen.getByText("[2]")).not.toBeNull();
    expect(screen.getByText("[3]")).not.toBeNull();
  });

  it("HSET-03 OWNER viewer sees up/down arrows on all rows", () => {
    render(
      <MembersList
        members={[
          makeRow({
            userId: VIEWER_OWNER_ID,
            userName: "Alice",
            role: "OWNER",
            rotationOrder: 1,
          }),
          makeRow({
            userId: MEMBER_ID,
            userName: "Bob",
            role: "MEMBER",
            rotationOrder: 2,
          }),
        ]}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    // Each row has a Move up + Move down button.
    expect(screen.getByLabelText("Move Alice up")).not.toBeNull();
    expect(screen.getByLabelText("Move Alice down")).not.toBeNull();
    expect(screen.getByLabelText("Move Bob up")).not.toBeNull();
    expect(screen.getByLabelText("Move Bob down")).not.toBeNull();
  });

  it("HSET-03 MEMBER viewer sees no up/down arrows", () => {
    render(
      <MembersList
        members={[
          makeRow({
            userId: VIEWER_OWNER_ID,
            userName: "Alice",
            role: "OWNER",
            rotationOrder: 1,
          }),
          makeRow({
            userId: MEMBER_ID,
            userName: "Bob",
            role: "MEMBER",
            rotationOrder: 2,
          }),
        ]}
        viewerUserId={MEMBER_ID}
        viewerRole="MEMBER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    expect(screen.queryByLabelText(/Move .* up/)).toBeNull();
    expect(screen.queryByLabelText(/Move .* down/)).toBeNull();
  });

  it('HSET-03 OWNER viewer: 3-dot menu on MEMBER row offers "Make owner" + "Remove from household"', () => {
    // Base UI DropdownMenu portals content only when the trigger opens,
    // which requires user-event + positioner mounting. Source-grep on the
    // component confirms the two menu items are wired behind the
    // `canShowMakeOwner` / `canShowRemoveFromHousehold` branches, which
    // fire for OWNER viewer on a non-self MEMBER row.
    expect(COMPONENT_SOURCE).toMatch(/canShowMakeOwner/);
    expect(COMPONENT_SOURCE).toMatch(/canShowRemoveFromHousehold/);
    expect(COMPONENT_SOURCE).toMatch(/Make owner/);
    expect(COMPONENT_SOURCE).toMatch(/Remove from household/);

    // Trigger is rendered for OWNER viewer on non-self row.
    render(
      <MembersList
        members={[
          makeRow({
            userId: VIEWER_OWNER_ID,
            userName: "Alice",
            role: "OWNER",
            rotationOrder: 1,
          }),
          makeRow({
            userId: MEMBER_ID,
            userName: "Bob",
            role: "MEMBER",
            rotationOrder: 2,
          }),
        ]}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );
    expect(screen.getByLabelText("Actions for Bob")).not.toBeNull();
  });

  it('HSET-03 OWNER viewer: 3-dot menu on co-OWNER row offers "Remove from owners" (disabled when ownerCount===1)', () => {
    // Two co-OWNER rows: viewer is one, the other is the target.
    render(
      <MembersList
        members={[
          makeRow({
            userId: VIEWER_OWNER_ID,
            userName: "Alice",
            role: "OWNER",
            rotationOrder: 1,
          }),
          makeRow({
            userId: OTHER_OWNER_ID,
            userName: "Carol",
            role: "OWNER",
            rotationOrder: 2,
          }),
        ]}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={2}
      />,
    );

    // Carol (co-OWNER, non-self) has a 3-dot trigger.
    expect(screen.getByLabelText("Actions for Carol")).not.toBeNull();

    // Source-grep proves the "Remove from owners" branch + the ownerCount
    // === 1 disabled-with-tooltip branch are both wired.
    expect(COMPONENT_SOURCE).toMatch(/Remove from owners/);
    expect(COMPONENT_SOURCE).toMatch(/ownerCount === 1/);
    expect(COMPONENT_SOURCE).toMatch(/Need at least one owner/);
    expect(COMPONENT_SOURCE).toMatch(/canShowRemoveFromOwners/);
  });

  it('HSET-03 OWNER role pill renders with "bg-muted text-foreground"', () => {
    render(
      <MembersList
        members={[
          makeRow({
            userId: VIEWER_OWNER_ID,
            userName: "Alice",
            role: "OWNER",
            rotationOrder: 1,
          }),
          makeRow({
            userId: MEMBER_ID,
            userName: "Bob",
            role: "MEMBER",
            rotationOrder: 2,
          }),
        ]}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    const ownerPill = screen.getByText("OWNER");
    expect(ownerPill.className).toContain("bg-muted");
    expect(ownerPill.className).toContain("text-foreground");

    const memberPill = screen.getByText("MEMBER");
    expect(memberPill.className).toContain("bg-muted");
    expect(memberPill.className).toContain("text-muted-foreground");
  });

  it("ROTA-01 self-row 3-dot menu does NOT contain 'leave household' text (warning #7 split lock)", () => {
    // This is the single-most-important regression test for the Plan 05/05b
    // split: if a future refactor accidentally surfaces a self-departure
    // action in members-list (instead of DangerZoneCard), this source-grep
    // flags it immediately. Case-insensitive to catch any variation.
    expect(COMPONENT_SOURCE.toLowerCase()).not.toContain("leave household");
  });
});
