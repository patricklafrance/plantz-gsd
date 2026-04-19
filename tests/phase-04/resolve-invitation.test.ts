// tests/phase-04/resolve-invitation.test.ts
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findUnique: vi.fn(), findMany: vi.fn() },
    householdMember: { findMany: vi.fn() },
  },
}));

// Mock crypto so hashInvitationToken returns a stable value
vi.mock("@/lib/crypto", () => ({
  hashInvitationToken: vi.fn(() => "hashed_token_abc123"),
}));

const { db } = await import("@/lib/db");
const { resolveInvitationByToken } = await import(
  "@/features/household/queries"
);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRow = {
  id: "inv_cuid",
  householdId: "hh_cuid",
  tokenHash: "hashed_token_abc123",
  invitedByUserId: "usr_owner",
  invitedEmail: null,
  revokedAt: null,
  acceptedAt: null,
  acceptedByUserId: null,
  createdAt: new Date("2026-04-18"),
  household: {
    id: "hh_cuid",
    name: "Alice's House",
    slug: "alices-house",
    _count: { members: 3 },
    members: [{ user: { name: "Alice", email: "alice@test.local" } }],
  },
};

describe("resolveInvitationByToken", () => {
  test("[INVT-04] unknown token: returns null", async () => {
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce(null as never);
    const result = await resolveInvitationByToken("unknown_raw_token");
    expect(result).toBeNull();
  });

  test("[INVT-04] valid token: returns { invitation, household, ownerName, memberCount }", async () => {
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce(baseRow as never);
    const result = await resolveInvitationByToken("valid_raw_token");
    expect(result).not.toBeNull();
    expect(result?.invitation.id).toBe("inv_cuid");
    expect(result?.household.name).toBe("Alice's House");
    expect(result?.household.slug).toBe("alices-house");
    expect(result?.ownerName).toBe("Alice");
    expect(result?.memberCount).toBe(3);
  });

  test("[INVT-04] owner display falls back to email when user.name is null", async () => {
    const rowWithNullName = {
      ...baseRow,
      household: {
        ...baseRow.household,
        members: [{ user: { name: null, email: "alice@test.local" } }],
      },
    };
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce(
      rowWithNullName as never,
    );
    const result = await resolveInvitationByToken("valid_raw_token");
    expect(result?.ownerName).toBe("alice@test.local");
  });

  test("[INVT-04] member count reflects live HouseholdMember row count", async () => {
    const rowWith5Members = {
      ...baseRow,
      household: {
        ...baseRow.household,
        _count: { members: 5 },
      },
    };
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce(
      rowWith5Members as never,
    );
    const result = await resolveInvitationByToken("valid_raw_token");
    expect(result?.memberCount).toBe(5);
  });
});
