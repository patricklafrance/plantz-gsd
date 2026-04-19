// tests/phase-04/get-household-invitations.test.ts
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findUnique: vi.fn(), findMany: vi.fn() },
    householdMember: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/crypto", () => ({
  hashInvitationToken: vi.fn(() => "hashed_token_abc123"),
}));

const { db } = await import("@/lib/db");
const { getHouseholdInvitations } = await import(
  "@/features/household/queries"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getHouseholdInvitations", () => {
  test("[INVT-02] filters to active-only (revokedAt: null AND acceptedAt: null)", async () => {
    vi.mocked(db.invitation.findMany).mockResolvedValueOnce([] as never);
    await getHouseholdInvitations("hh_cuid");
    const [call] = vi.mocked(db.invitation.findMany).mock.calls;
    expect(call?.[0]?.where).toEqual({
      householdId: "hh_cuid",
      revokedAt: null,
      acceptedAt: null,
    });
  });

  test("[INVT-02] orders by createdAt DESC", async () => {
    vi.mocked(db.invitation.findMany).mockResolvedValueOnce([] as never);
    await getHouseholdInvitations("hh_cuid");
    const [call] = vi.mocked(db.invitation.findMany).mock.calls;
    expect(call?.[0]?.orderBy).toEqual({ createdAt: "desc" });
  });

  test("[INVT-02] includes invitedBy name + email", async () => {
    vi.mocked(db.invitation.findMany).mockResolvedValueOnce([] as never);
    await getHouseholdInvitations("hh_cuid");
    const [call] = vi.mocked(db.invitation.findMany).mock.calls;
    expect(call?.[0]?.include).toEqual({
      invitedBy: { select: { name: true, email: true } },
    });
  });
});
