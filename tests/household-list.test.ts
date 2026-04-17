import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    householdMember: { findMany: vi.fn() },
  },
}));

beforeEach(() => { vi.clearAllMocks(); });

describe("getUserHouseholds (HSLD-03, D-08)", () => {
  test("returns array of { household, role, isDefault, joinedAt } sorted by joinedAt asc", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.householdMember.findMany).mockResolvedValueOnce([
      {
        id: "m1",
        userId: "user_1",
        householdId: "hh_a",
        role: "OWNER",
        isDefault: true,
        rotationOrder: 0,
        createdAt: new Date("2026-01-01"),
        household: { id: "hh_a", name: "Solo", slug: "AAAA1111" },
      },
      {
        id: "m2",
        userId: "user_1",
        householdId: "hh_b",
        role: "MEMBER",
        isDefault: false,
        rotationOrder: 1,
        createdAt: new Date("2026-02-01"),
        household: { id: "hh_b", name: "Roommate", slug: "BBBB2222" },
      },
    ] as never);

    const { getUserHouseholds } = await import("@/features/household/queries");
    const result = await getUserHouseholds("user_1");

    expect(db.householdMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        orderBy: { createdAt: "asc" },
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      household: expect.objectContaining({ id: "hh_a", slug: "AAAA1111" }),
      role: "OWNER",
      isDefault: true,
    });
    expect(result[1].role).toBe("MEMBER");
    expect(result[1].isDefault).toBe(false);
  });

  test("returns empty array when user has no memberships", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.householdMember.findMany).mockResolvedValueOnce([] as never);

    const { getUserHouseholds } = await import("@/features/household/queries");
    const result = await getUserHouseholds("user_orphan");

    expect(result).toEqual([]);
  });

  test("preserves role field across OWNER and MEMBER rows", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.householdMember.findMany).mockResolvedValueOnce([
      { role: "OWNER", isDefault: true, createdAt: new Date(), household: { id: "a", slug: "x", name: "y" } },
      { role: "MEMBER", isDefault: false, createdAt: new Date(), household: { id: "b", slug: "z", name: "w" } },
    ] as never);

    const { getUserHouseholds } = await import("@/features/household/queries");
    const result = await getUserHouseholds("u");

    expect(result.map((r: { role: string }) => r.role).sort()).toEqual(["MEMBER", "OWNER"]);
  });
});
