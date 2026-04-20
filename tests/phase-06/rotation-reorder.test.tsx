import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Mock Server Actions so reorderRotation is a spy we can inspect.
vi.mock("@/features/household/actions", () => ({
  reorderRotation: vi.fn(),
  promoteToOwner: vi.fn(),
  demoteToMember: vi.fn(),
  removeMember: vi.fn(),
}));

// Mock sonner toast so we can observe revert → toast.error path.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const actions = await import("@/features/household/actions");
const sonnerModule = await import("sonner");
const { MembersList } = await import(
  "@/components/household/settings/members-list"
);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const VIEWER_OWNER_ID = "clh00000000000000000000001";
const MEMBER_ID_B = "clh00000000000000000000002";
const MEMBER_ID_C = "clh00000000000000000000003";
const HOUSEHOLD_ID = "clh00000000000000000000099";
const SLUG = "home-sweet-home";
const HOUSEHOLD_NAME = "Home";

const COMPONENT_SOURCE = readFileSync(
  path.resolve("src/components/household/settings/members-list.tsx"),
  "utf8",
);

function baseMembers() {
  return [
    {
      userId: VIEWER_OWNER_ID,
      userName: "Alice",
      userEmail: "alice@example.com",
      role: "OWNER" as const,
      rotationOrder: 1,
    },
    {
      userId: MEMBER_ID_B,
      userName: "Bob",
      userEmail: "bob@example.com",
      role: "MEMBER" as const,
      rotationOrder: 2,
    },
    {
      userId: MEMBER_ID_C,
      userName: "Carol",
      userEmail: "carol@example.com",
      role: "MEMBER" as const,
      rotationOrder: 3,
    },
  ];
}

describe("Rotation reorder optimistic UI (ROTA-01 / D-10 / D-12)", () => {
  it("ROTA-01 moveUp invokes reorderRotation with new order", async () => {
    vi.mocked(actions.reorderRotation).mockResolvedValueOnce({
      success: true as const,
    });

    render(
      <MembersList
        members={baseMembers()}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    // Click Bob's up arrow — he should swap with Alice.
    const bobUp = screen.getByLabelText("Move Bob up");
    fireEvent.click(bobUp);

    // startTransition dispatches microtasks; flush two ticks.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(actions.reorderRotation)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(actions.reorderRotation).mock
      .calls[0][0] as Record<string, unknown>;
    expect(call.householdId).toBe(HOUSEHOLD_ID);
    expect(call.householdSlug).toBe(SLUG);
    expect(call.orderedMemberUserIds).toEqual([
      MEMBER_ID_B, // Bob is now first
      VIEWER_OWNER_ID, // Alice is now second
      MEMBER_ID_C, // Carol stays third
    ]);
  });

  it("ROTA-01 top-row up-arrow is disabled", () => {
    render(
      <MembersList
        members={baseMembers()}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    const aliceUp = screen.getByLabelText("Move Alice up") as HTMLButtonElement;
    expect(aliceUp.disabled).toBe(true);
  });

  it("ROTA-01 bottom-row down-arrow is disabled", () => {
    render(
      <MembersList
        members={baseMembers()}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    const carolDown = screen.getByLabelText(
      "Move Carol down",
    ) as HTMLButtonElement;
    expect(carolDown.disabled).toBe(true);
  });

  it("ROTA-01 optimistic: local order updates immediately on click", async () => {
    // Pending promise — resolves only when we call the deferred resolver.
    // This keeps startTransition's callback in-flight so we can observe
    // the optimistic DOM update before the server action settles.
    let resolveAction: (value: { success: true }) => void = () => {};
    vi.mocked(actions.reorderRotation).mockImplementationOnce(
      () =>
        new Promise<{ success: true }>((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <MembersList
        members={baseMembers()}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    // Initially, the first row is Alice — read the first member-row-* testid.
    const rowsBefore = document.querySelectorAll(
      '[data-testid^="member-row-"]',
    );
    expect(
      (rowsBefore[0] as HTMLElement).getAttribute("data-testid"),
    ).toBe(`member-row-${VIEWER_OWNER_ID}`);

    // Click Bob's up arrow; local state should swap immediately.
    fireEvent.click(screen.getByLabelText("Move Bob up"));

    // Flush React state batching.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rowsAfter = document.querySelectorAll(
      '[data-testid^="member-row-"]',
    );
    expect(
      (rowsAfter[0] as HTMLElement).getAttribute("data-testid"),
    ).toBe(`member-row-${MEMBER_ID_B}`);
    expect(
      (rowsAfter[1] as HTMLElement).getAttribute("data-testid"),
    ).toBe(`member-row-${VIEWER_OWNER_ID}`);

    // Cleanup the in-flight promise so no unhandled rejection leaks.
    resolveAction({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("ROTA-01 on error: reverts local state AND shows toast.error", async () => {
    vi.mocked(actions.reorderRotation).mockResolvedValueOnce({
      error: "Member list changed — reload and try again.",
    });

    render(
      <MembersList
        members={baseMembers()}
        viewerUserId={VIEWER_OWNER_ID}
        viewerRole="OWNER"
        householdId={HOUSEHOLD_ID}
        householdSlug={SLUG}
        householdName={HOUSEHOLD_NAME}
        ownerCount={1}
      />,
    );

    fireEvent.click(screen.getByLabelText("Move Bob up"));

    // Flush transition + promise resolution.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // toast.error called with the action's error message.
    expect(vi.mocked(sonnerModule.toast.error)).toHaveBeenCalledWith(
      "Member list changed — reload and try again.",
    );

    // Local state reverted: Alice is first again.
    const rowsAfter = document.querySelectorAll(
      '[data-testid^="member-row-"]',
    );
    expect(
      (rowsAfter[0] as HTMLElement).getAttribute("data-testid"),
    ).toBe(`member-row-${VIEWER_OWNER_ID}`);
  });

  it("ROTA-01 all arrows disabled while isPending", () => {
    // Asserting the transient isPending DOM attribute is flaky in jsdom
    // (useTransition's pending flag is React-internal and only held across
    // the microtask gap when the action is truly suspending). The
    // plan-prescribed fallback (PATTERNS.md line 762) is source-grep: prove
    // the component propagates `isPending` to both ArrowUp and ArrowDown
    // buttons via the disabled prop.
    expect(COMPONENT_SOURCE).toMatch(/disabled=\{index === 0 \|\| isPending\}/);
    expect(COMPONENT_SOURCE).toMatch(
      /disabled=\{index === total - 1 \|\| isPending\}/,
    );
    expect(COMPONENT_SOURCE).toMatch(/const \[isPending, startTransition\] = useTransition/);
  });
});
