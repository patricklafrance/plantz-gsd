import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockInvitation = {
  findUnique: vi.fn(),
  updateMany: vi.fn(),
};
const mockHouseholdMember = {
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
};
const mockCycle = {
  update: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    invitation: mockInvitation,
    householdMember: mockHouseholdMember,
    cycle: mockCycle,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        invitation: mockInvitation,
        householdMember: mockHouseholdMember,
        cycle: mockCycle,
      });
    }),
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { db } = await import("@/lib/db");
const { auth, unstable_update } = await import("../../auth");
const { acceptInvitation } = await import("@/features/household/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

const USER_ID = "usr_joiner_cuid12345678";
const HOUSEHOLD_ID = "clh1234567890abcdefghijkl";
const HOUSEHOLD_SLUG = "alices-house";
// RAW_TOKEN must be 64 hex chars to pass the acceptInvitationSchema (token: z.string().min(1))
// and hashInvitationToken will be called on it. We use a real 64-char hex string.
const RAW_TOKEN = "a".repeat(64);

function mockSession(isDemo = false) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: USER_ID, isDemo },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockValidInvitationRow(
  overrides: Partial<{ revokedAt: Date | null; acceptedAt: Date | null }> = {},
) {
  mockInvitation.findUnique.mockResolvedValueOnce({
    id: "clwinv1234567890abcdefgh",
    householdId: HOUSEHOLD_ID,
    tokenHash: "h",
    invitedByUserId: null,
    invitedEmail: null,
    revokedAt: null,
    acceptedAt: null,
    acceptedByUserId: null,
    createdAt: new Date(),
    household: { id: HOUSEHOLD_ID, slug: HOUSEHOLD_SLUG },
    ...overrides,
  } as never);
}

describe("acceptInvitation", () => {
  test("[INVT-04] valid token: inserts HouseholdMember with role='MEMBER', rotationOrder = max+1", async () => {
    mockSession();
    mockValidInvitationRow();
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);
    mockInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockHouseholdMember.aggregate.mockResolvedValueOnce({
      _max: { rotationOrder: 3 },
    });
    mockHouseholdMember.create.mockResolvedValueOnce({ id: "clwmbr1234567890abcde" });
    vi.mocked(unstable_update).mockResolvedValueOnce(undefined as never);

    const result = await acceptInvitation({ token: RAW_TOKEN });

    expect(result).toMatchObject({ success: true });
    expect((result as { redirectTo: string }).redirectTo).toBe(
      `/h/${HOUSEHOLD_SLUG}/dashboard`,
    );
    expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
      activeHouseholdId: HOUSEHOLD_ID,
    });
    const createCall = mockHouseholdMember.create.mock.calls[0][0] as {
      data: { rotationOrder: number; role: string };
    };
    expect(createCall.data.rotationOrder).toBe(4);
    expect(createCall.data.role).toBe("MEMBER");
  });

  test("[INVT-04] token unknown: returns 'This invite link isn't valid.'", async () => {
    mockSession();
    mockInvitation.findUnique.mockResolvedValueOnce(null);

    const result = await acceptInvitation({ token: RAW_TOKEN });

    expect(result).toEqual({ error: "This invite link isn't valid." });
  });

  test("[INVT-04] token revoked: returns 'This invite was revoked.'", async () => {
    mockSession();
    mockValidInvitationRow({ revokedAt: new Date("2026-04-10") });

    const result = await acceptInvitation({ token: RAW_TOKEN });

    expect(result).toEqual({ error: "This invite was revoked." });
  });

  test("[INVT-04] token already accepted (pre-read branch): returns 'This invite has already been used.'", async () => {
    mockSession();
    mockValidInvitationRow({ acceptedAt: new Date("2026-04-10") });

    const result = await acceptInvitation({ token: RAW_TOKEN });

    expect(result).toEqual({ error: "This invite has already been used." });
  });

  test("[INVT-04] caller already a member: returns 'You're already in this household.'", async () => {
    mockSession();
    mockValidInvitationRow();
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ id: "existing_member_id" });

    const result = await acceptInvitation({ token: RAW_TOKEN });

    expect(result).toEqual({ error: "You're already in this household." });
    expect(mockHouseholdMember.create).not.toHaveBeenCalled();
  });

  test("[INVT-04] race-loss: updateMany returns count=0, returns 'This invite has already been used.'", async () => {
    mockSession();
    mockValidInvitationRow();
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);
    mockInvitation.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await acceptInvitation({ token: RAW_TOKEN });

    expect(result).toEqual({ error: "This invite has already been used." });
    expect(mockHouseholdMember.create).not.toHaveBeenCalled();
  });

  test("[INVT-04] rotation append: rotationOrder = max+1; cycle pointer NOT touched", async () => {
    mockSession();
    mockValidInvitationRow();
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);
    mockInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    // aggregate returns max = 2, so nextOrder should be 3
    mockHouseholdMember.aggregate.mockResolvedValueOnce({
      _max: { rotationOrder: 2 },
    });
    mockHouseholdMember.create.mockResolvedValueOnce({ id: "clwmbr1234567890abcde" });
    vi.mocked(unstable_update).mockResolvedValueOnce(undefined as never);

    await acceptInvitation({ token: RAW_TOKEN });

    const createCall = mockHouseholdMember.create.mock.calls[0][0] as {
      data: { rotationOrder: number };
    };
    expect(createCall.data.rotationOrder).toBe(3);
    // cycle.update must NOT have been called (cycle pointer not touched)
    expect(mockCycle.update).not.toHaveBeenCalled();
  });

  test("[INVT-04] calls unstable_update({ activeHouseholdId }) AFTER $transaction commits", async () => {
    mockSession();
    mockValidInvitationRow();
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);
    mockInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    mockHouseholdMember.aggregate.mockResolvedValueOnce({
      _max: { rotationOrder: 0 },
    });
    mockHouseholdMember.create.mockResolvedValueOnce({ id: "clwmbr1234567890abcde" });
    vi.mocked(unstable_update).mockResolvedValueOnce(undefined as never);

    await acceptInvitation({ token: RAW_TOKEN });

    // $transaction and unstable_update both recorded call order
    const txOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0];
    const updateOrder = vi.mocked(unstable_update).mock.invocationCallOrder[0];
    expect(txOrder).toBeLessThan(updateOrder);
    expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
      activeHouseholdId: HOUSEHOLD_ID,
    });
  });
});
