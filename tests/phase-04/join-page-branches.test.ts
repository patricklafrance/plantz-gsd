// tests/phase-04/join-page-branches.test.ts
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHouseholdMember = { findFirst: vi.fn() };
vi.mock("@/lib/db", () => ({
  db: { householdMember: mockHouseholdMember },
}));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
vi.mock("@/features/household/queries", () => ({
  resolveInvitationByToken: vi.fn(),
}));
// AcceptForm is a client component — stub it for the server-only render
vi.mock("@/app/join/[token]/accept-form", () => ({
  AcceptForm: ({ token }: { token: string }) =>
    ({ type: "accept-form-stub", props: { token } }) as unknown as React.ReactElement,
}));

const { auth } = await import("../../auth");
const { resolveInvitationByToken } = await import(
  "@/features/household/queries"
);
const JoinPageModule = await import("@/app/join/[token]/page");
const JoinPage = JoinPageModule.default;

beforeEach(() => {
  vi.clearAllMocks();
  mockHouseholdMember.findFirst.mockResolvedValue(null);
});

const TOKEN = "a".repeat(64);
const HOUSEHOLD = { id: "hh_1", name: "Alice's House", slug: "alices-house" };

// Helper: recursively walk React element tree looking for a prop value match
function findProp(el: unknown, propName: string, value: string): boolean {
  if (!el || typeof el !== "object") return false;
  const node = el as Record<string, unknown>;
  if (node.props && typeof node.props === "object") {
    const props = node.props as Record<string, unknown>;
    if (props[propName] === value) return true;
    const children = props.children;
    const list = Array.isArray(children)
      ? children
      : children !== undefined && children !== null
        ? [children]
        : [];
    if (list.some((c) => findProp(c, propName, value))) return true;
  }
  // Also check top-level type for stubs
  if ("type" in node && node.type === value) return true;
  return false;
}

// Helper: collect all text strings from the element tree (concatenated for sibling checks)
function collectText(el: unknown): string {
  if (typeof el === "string") return el;
  if (typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.map(collectText).join("");
  if (!el || typeof el !== "object") return "";
  const node = el as Record<string, unknown>;
  if (node.props && typeof node.props === "object") {
    const props = node.props as Record<string, unknown>;
    const children = props.children;
    return collectText(children);
  }
  return "";
}

// Helper: find any string content anywhere in the tree, including across siblings
function findText(el: unknown, text: string): boolean {
  if (typeof el === "string") return el.includes(text);
  if (typeof el === "number") return String(el).includes(text);
  if (Array.isArray(el)) {
    // Check if concatenated siblings contain the text (handles JSX interpolation)
    const joined = el.map(collectText).join("");
    if (joined.includes(text)) return true;
    return el.some((item) => findText(item, text));
  }
  if (!el || typeof el !== "object") return false;
  const node = el as Record<string, unknown>;
  if (node.props && typeof node.props === "object") {
    const props = node.props as Record<string, unknown>;
    // Check concatenated children first (catches "Join " + householdName patterns)
    const childrenText = collectText(props.children);
    if (childrenText.includes(text)) return true;
    // Then recurse into each prop value
    for (const val of Object.values(props)) {
      if (findText(val, text)) return true;
    }
  }
  return false;
}

describe("/join/[token] branch logic", () => {
  test("[INVT-03] unknown token renders Branch 1 copy (icon=XCircle)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(resolveInvitationByToken).mockResolvedValue(null);

    const element = await JoinPage({ params: Promise.resolve({ token: TOKEN }) });

    expect(
      findProp(element, "heading", "This invite link isn't valid"),
    ).toBe(true);
  });

  test("[INVT-03] revokedAt set renders Branch 2 copy (icon=ShieldOff)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(resolveInvitationByToken).mockResolvedValue({
      invitation: {
        id: "inv_1",
        householdId: HOUSEHOLD.id,
        tokenHash: "hash",
        invitedByUserId: "user_owner",
        invitedEmail: null,
        revokedAt: new Date("2026-01-01"),
        acceptedAt: null,
        acceptedByUserId: null,
        createdAt: new Date("2025-12-01"),
      },
      household: HOUSEHOLD,
      ownerName: "Alice",
      memberCount: 1,
    });

    const element = await JoinPage({ params: Promise.resolve({ token: TOKEN }) });

    expect(
      findProp(element, "heading", "This invite has been revoked"),
    ).toBe(true);
  });

  test("[INVT-03] acceptedAt set renders Branch 3 copy (icon=CheckCircle2)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(resolveInvitationByToken).mockResolvedValue({
      invitation: {
        id: "inv_1",
        householdId: HOUSEHOLD.id,
        tokenHash: "hash",
        invitedByUserId: "user_owner",
        invitedEmail: null,
        revokedAt: null,
        acceptedAt: new Date("2026-01-15"),
        acceptedByUserId: "user_other",
        createdAt: new Date("2025-12-01"),
      },
      household: HOUSEHOLD,
      ownerName: "Alice",
      memberCount: 2,
    });

    const element = await JoinPage({ params: Promise.resolve({ token: TOKEN }) });

    expect(
      findProp(element, "heading", "This invite has already been used"),
    ).toBe(true);
  });

  test("[INVT-03] caller already member renders Branch 4 copy with dashboard link", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user_member", email: "member@test.local" },
    } as never);
    vi.mocked(resolveInvitationByToken).mockResolvedValue({
      invitation: {
        id: "inv_1",
        householdId: HOUSEHOLD.id,
        tokenHash: "hash",
        invitedByUserId: "user_owner",
        invitedEmail: null,
        revokedAt: null,
        acceptedAt: null,
        acceptedByUserId: null,
        createdAt: new Date("2025-12-01"),
      },
      household: HOUSEHOLD,
      ownerName: "Alice",
      memberCount: 2,
    });
    mockHouseholdMember.findFirst.mockResolvedValue({
      createdAt: new Date("2026-01-10"),
    });

    const element = await JoinPage({ params: Promise.resolve({ token: TOKEN }) });

    expect(
      findProp(element, "heading", "You're already in Alice's House"),
    ).toBe(true);
    // Verify the dashboard link href is present somewhere in the tree
    expect(findText(element, `/h/${HOUSEHOLD.slug}/dashboard`)).toBe(true);
  });

  test("[INVT-03] valid + logged-out renders Branch 5a with Sign in + Create account buttons and correct callbackUrl", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(resolveInvitationByToken).mockResolvedValue({
      invitation: {
        id: "inv_1",
        householdId: HOUSEHOLD.id,
        tokenHash: "hash",
        invitedByUserId: "user_owner",
        invitedEmail: null,
        revokedAt: null,
        acceptedAt: null,
        acceptedByUserId: null,
        createdAt: new Date("2025-12-01"),
      },
      household: HOUSEHOLD,
      ownerName: "Alice",
      memberCount: 3,
    });

    const element = await JoinPage({ params: Promise.resolve({ token: TOKEN }) });

    // Branch 5a heading does NOT have trailing "?"
    expect(findText(element, "Join Alice's House")).toBe(true);
    // callbackUrl links present
    expect(findText(element, `/login?callbackUrl=/join/${TOKEN}`)).toBe(true);
    expect(findText(element, `/register?callbackUrl=/join/${TOKEN}`)).toBe(true);
  });

  test("[INVT-04] valid + logged-in renders Branch 5b with Accept form", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user_nonmember", email: "nonmember@test.local" },
    } as never);
    vi.mocked(resolveInvitationByToken).mockResolvedValue({
      invitation: {
        id: "inv_1",
        householdId: HOUSEHOLD.id,
        tokenHash: "hash",
        invitedByUserId: "user_owner",
        invitedEmail: null,
        revokedAt: null,
        acceptedAt: null,
        acceptedByUserId: null,
        createdAt: new Date("2025-12-01"),
      },
      household: HOUSEHOLD,
      ownerName: "Alice",
      memberCount: 1,
    });
    // Not a member
    mockHouseholdMember.findFirst.mockResolvedValue(null);

    const element = await JoinPage({ params: Promise.resolve({ token: TOKEN }) });

    // Branch 5b heading has trailing "?"
    expect(findText(element, "Join Alice's House?")).toBe(true);
    // AcceptForm stub should appear in tree
    expect(findProp(element, "token", TOKEN)).toBe(true);
  });
});
