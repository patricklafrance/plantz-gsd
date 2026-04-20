import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { householdNotification: { findMany: vi.fn() } },
}));

const { db } = await import("@/lib/db");
const { getCycleNotificationsForViewer } = await import(
  "@/features/household/queries"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCycleNotificationsForViewer (D-29)", () => {
  it("HNTF-02 returns findMany result with where { householdId, recipientUserId, cycleId } + cycle/household/members include", async () => {
    const rows = [
      { id: "n1", type: "cycle_started", createdAt: new Date(), readAt: null },
    ];
    vi.mocked(db.householdNotification.findMany).mockResolvedValue(rows as never);

    const result = await getCycleNotificationsForViewer(
      "hh_1",
      "user_A",
      "cycle_1",
    );

    expect(db.householdNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          householdId: "hh_1",
          recipientUserId: "user_A",
          cycleId: "cycle_1",
        },
        include: {
          // WR-02: priorAssignee snapshot join — authoritative for
          // cycle_reassigned_* names regardless of rotation churn.
          priorAssignee: { select: { name: true, email: true } },
          cycle: {
            include: {
              household: {
                include: {
                  members: {
                    include: {
                      user: { select: { name: true, email: true } },
                    },
                    orderBy: { rotationOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      }),
    );
    expect(result).toBe(rows);
  });

  it("HNTF-03 orders by createdAt desc", async () => {
    vi.mocked(db.householdNotification.findMany).mockResolvedValue([] as never);

    await getCycleNotificationsForViewer("hh_1", "user_A", "cycle_1");

    expect(db.householdNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("HNTF-02 filters to only the given cycleId (previous-cycle rows excluded — D-06 derivational clearing)", async () => {
    vi.mocked(db.householdNotification.findMany).mockResolvedValue([] as never);

    await getCycleNotificationsForViewer("hh_1", "user_A", "cycle_2");

    const callArg = vi.mocked(db.householdNotification.findMany).mock.calls[0][0] as {
      where: { cycleId: string };
    };
    expect(callArg.where.cycleId).toBe("cycle_2");
  });
});
