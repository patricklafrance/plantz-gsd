// tests/phase-04/get-household-members.test.ts
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
const { getHouseholdMembers } = await import("@/features/household/queries");

beforeEach(() => {
  vi.clearAllMocks();
});

const mockMemberRow = {
  userId: "usr_1",
  user: { name: "Alice", email: "alice@test.local" },
  role: "OWNER",
  rotationOrder: 0,
  createdAt: new Date("2026-01-01"),
};

describe("getHouseholdMembers", () => {
  test("[INVT-06] orders by rotationOrder ASC", async () => {
    vi.mocked(db.householdMember.findMany).mockResolvedValueOnce(
      [mockMemberRow] as never,
    );
    await getHouseholdMembers("hh_cuid");
    const [call] = vi.mocked(db.householdMember.findMany).mock.calls;
    expect(call?.[0]?.orderBy).toEqual({ rotationOrder: "asc" });
  });

  test("[INVT-06] returns all members with { userId, userName, userEmail, role, rotationOrder, joinedAt }", async () => {
    vi.mocked(db.householdMember.findMany).mockResolvedValueOnce(
      [mockMemberRow] as never,
    );
    const result = await getHouseholdMembers("hh_cuid");
    expect(result).toHaveLength(1);
    expect(Object.keys(result[0]).sort()).toEqual(
      ["joinedAt", "role", "rotationOrder", "userEmail", "userId", "userName"].sort(),
    );
  });

  test("[INVT-06] joinedAt equals the mocked row's createdAt", async () => {
    vi.mocked(db.householdMember.findMany).mockResolvedValueOnce(
      [mockMemberRow] as never,
    );
    const result = await getHouseholdMembers("hh_cuid");
    expect(result[0].joinedAt).toEqual(new Date("2026-01-01"));
  });
});
