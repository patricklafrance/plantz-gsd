import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ForbiddenError needs to match instanceof checks in actions.ts
vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});

const { db } = await import("@/lib/db");
const { auth } = await import("../../auth");
const { requireHouseholdAccess } = await import("@/features/household/guards");
const { revokeInvitation } = await import("@/features/household/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

const OWNER_ID = "usr_owner_cuid";
const HOUSEHOLD_ID = "clh1234567890abcdefghijkl";
const HOUSEHOLD_SLUG = "alices-house";
const INVITATION_ID = "clw1234567890abcdefghijkl";

function mockOwnerSession() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: OWNER_ID, isDemo: false },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockRoleAccess(role: "OWNER" | "MEMBER") {
  vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
    household: { id: HOUSEHOLD_ID } as never,
    member: {} as never,
    role,
  });
}

describe("revokeInvitation", () => {
  test("[INVT-02] happy path: sets revokedAt on matching row", async () => {
    mockOwnerSession();
    mockRoleAccess("OWNER");
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce({
      id: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      revokedAt: null,
      acceptedAt: null,
    } as never);
    vi.mocked(db.invitation.update).mockResolvedValueOnce({} as never);

    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ success: true });
    expect(vi.mocked(db.invitation.update)).toHaveBeenCalledTimes(1);
    const updateCall = vi.mocked(db.invitation.update).mock.calls[0][0] as {
      where: { id: string };
      data: { revokedAt: unknown };
    };
    expect(updateCall.where).toEqual({ id: INVITATION_ID });
    expect(updateCall.data.revokedAt).toBeInstanceOf(Date);
  });

  test("[INVT-02] idempotent on already-revoked: returns success, update NOT called", async () => {
    mockOwnerSession();
    mockRoleAccess("OWNER");
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce({
      id: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      revokedAt: new Date("2026-04-01"),
      acceptedAt: null,
    } as never);

    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ success: true });
    expect(vi.mocked(db.invitation.update)).not.toHaveBeenCalled();
  });

  test("[INVT-02] already accepted: returns 'Can't revoke an already-accepted invite.'", async () => {
    mockOwnerSession();
    mockRoleAccess("OWNER");
    vi.mocked(db.invitation.findUnique).mockResolvedValueOnce({
      id: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      revokedAt: null,
      acceptedAt: new Date("2026-04-10"),
    } as never);

    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ error: "Can't revoke an already-accepted invite." });
    expect(vi.mocked(db.invitation.update)).not.toHaveBeenCalled();
  });

  test("[INVT-02] non-OWNER caller: returns OWNER-gate error", async () => {
    mockOwnerSession();
    mockRoleAccess("MEMBER");

    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ error: "Only household owners can revoke invite links." });
    expect(vi.mocked(db.invitation.update)).not.toHaveBeenCalled();
  });
});
