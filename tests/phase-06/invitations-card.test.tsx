import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";

// jsdom does not implement matchMedia; ResponsiveDialog reads it via
// useMediaQuery to pick Dialog (desktop) vs Drawer (mobile). Stub before
// component import so React's initial state resolves to the desktop branch.
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

// Mock the Server Actions so create/revoke paths are deterministic.
vi.mock("@/features/household/actions", () => ({
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));

// Mock sonner so toast calls are observable (clipboard success path asserts this).
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const actions = await import("@/features/household/actions");
const { InvitationsCard } = await import(
  "@/components/household/settings/invitations-card"
);

// Source-grep fallback for assertions that hit portal-rendered content
// (ResponsiveDialog/AlertDialog portal into document.body via Base UI).
const COMPONENT_SOURCE = readFileSync(
  path.resolve("src/components/household/settings/invitations-card.tsx"),
  "utf8",
);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const HOUSEHOLD_ID = "clh00000000000000000000099";
const HOUSEHOLD_SLUG = "home-sweet-home";
const HOUSEHOLD_NAME = "Home";

describe("InvitationsCard (HSET-03 / D-20 / D-21)", () => {
  it("HSET-03 Phase A: Invite people button opens dialog with Create invite link", () => {
    render(
      <InvitationsCard
        invitations={[]}
        householdId={HOUSEHOLD_ID}
        householdSlug={HOUSEHOLD_SLUG}
        householdName={HOUSEHOLD_NAME}
      />,
    );

    // The trigger button is visible in the rendered tree (not portaled —
    // only the dialog surface is portaled).
    const trigger = screen.getByRole("button", { name: /invite people/i });
    expect(trigger).not.toBeNull();

    fireEvent.click(trigger);

    // After opening, Phase A renders the create-link button in the portaled
    // dialog. Base UI's Dialog portals into document.body — query through
    // the full document rather than the container.
    const createButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /create invite link/i.test(el.textContent ?? ""));
    expect(createButton).not.toBeUndefined();

    // Phase A description copy is in the dialog.
    expect(COMPONENT_SOURCE).toMatch(
      /Anyone with the link can join this household/,
    );
  });

  it("HSET-03 Phase B: success returns token then dialog shows Input readOnly + Copy link", async () => {
    vi.mocked(actions.createInvitation).mockResolvedValueOnce({
      success: true as const,
      token: "abc123token",
      invitationId: "clh00000000000000000000aaa",
    });

    render(
      <InvitationsCard
        invitations={[]}
        householdId={HOUSEHOLD_ID}
        householdSlug={HOUSEHOLD_SLUG}
        householdName={HOUSEHOLD_NAME}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /invite people/i }));

    const createButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /create invite link/i.test(el.textContent ?? ""));
    expect(createButton).not.toBeUndefined();
    fireEvent.click(createButton as HTMLButtonElement);

    // useTransition + async Server Action — flush microtasks.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(actions.createInvitation)).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    // Phase B: readOnly Input surfacing the raw token + Copy link button.
    const readOnlyInput = document.querySelector(
      'input[readonly]',
    ) as HTMLInputElement | null;
    expect(readOnlyInput).not.toBeNull();
    expect(readOnlyInput?.value ?? "").toMatch(/abc123token/);

    const copyButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /^copy link$/i.test((el.textContent ?? "").trim()));
    expect(copyButton).not.toBeUndefined();
  });

  it("HSET-03 Phase C: error returns then inline Couldnt create + Retry button", async () => {
    vi.mocked(actions.createInvitation).mockResolvedValueOnce({
      error: "Only household owners can generate invite links.",
    });

    render(
      <InvitationsCard
        invitations={[]}
        householdId={HOUSEHOLD_ID}
        householdSlug={HOUSEHOLD_SLUG}
        householdName={HOUSEHOLD_NAME}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /invite people/i }));

    const createButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /create invite link/i.test(el.textContent ?? ""));
    fireEvent.click(createButton as HTMLButtonElement);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Phase C inline alert copy.
    const alert = Array.from(
      document.querySelectorAll("[role='alert']"),
    ).find((el) =>
      /couldn.t create an invite link/i.test(el.textContent ?? ""),
    );
    expect(alert).not.toBeUndefined();

    // Retry button is present in Phase C.
    const retryButton = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /^retry/i.test((el.textContent ?? "").trim()));
    expect(retryButton).not.toBeUndefined();
  });

  it("HSET-03 Existing invitation row: Revoke button opens AlertDialog confirm", () => {
    const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    render(
      <InvitationsCard
        invitations={[
          {
            id: "clh00000000000000000000bbb",
            createdAt,
            creatorName: "Alice",
          },
        ]}
        householdId={HOUSEHOLD_ID}
        householdSlug={HOUSEHOLD_SLUG}
        householdName={HOUSEHOLD_NAME}
      />,
    );

    // Creator + relative date rendered on the row (visible, not portaled).
    expect(screen.getByText(/Alice/)).not.toBeNull();

    // The Revoke button is the AlertDialogTrigger — click it to open the
    // portaled confirm.
    const revokeTrigger = Array.from(
      document.querySelectorAll("button"),
    ).find((el) => /^revoke$/i.test((el.textContent ?? "").trim()));
    expect(revokeTrigger).not.toBeUndefined();
    fireEvent.click(revokeTrigger as HTMLButtonElement);

    // AlertDialog title (portal-rendered) should now be in the document.
    const title = Array.from(document.querySelectorAll("*")).find((el) =>
      /^revoke this invite link\?$/i.test((el.textContent ?? "").trim()),
    );
    expect(title).not.toBeUndefined();
  });

  it("HSET-03 Existing invitation row: NO Copy link button (tokenHash-only per Phase 4 D-01)", () => {
    // The raw invitation token is never recoverable for existing rows — the
    // component must not render a "Copy link" affordance on the invitation
    // list row. This is a source-level invariant (Phase B is the only place
    // "Copy link" appears, inside the create dialog's success branch).
    // Count: "Copy link" string occurs exactly once (Phase B), never in the
    // ExistingInvitationRow sub-component.
    const copyLinkOccurrences = (
      COMPONENT_SOURCE.match(/Copy link/g) ?? []
    ).length;
    expect(copyLinkOccurrences).toBe(1);

    // Structural assertion: ExistingInvitationRow contains "Revoke" but
    // NOT "Copy link".
    const rowStart = COMPONENT_SOURCE.indexOf(
      "function ExistingInvitationRow(",
    );
    expect(rowStart).toBeGreaterThan(-1);
    const rowBody = COMPONENT_SOURCE.slice(rowStart);
    expect(rowBody).toContain("Revoke");
    expect(rowBody).not.toContain("Copy link");
  });

  it("HSET-03 Empty state: No active invitations yet.", () => {
    render(
      <InvitationsCard
        invitations={[]}
        householdId={HOUSEHOLD_ID}
        householdSlug={HOUSEHOLD_SLUG}
        householdName={HOUSEHOLD_NAME}
      />,
    );

    expect(screen.getByText(/No active invitations yet/)).not.toBeNull();
  });
});

// `within` is referenced in an assertion path even if unused — keep the
// import consistent with the test-suite's shared RTL surface.
void within;
