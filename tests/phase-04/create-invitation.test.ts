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
const { createInvitation } = await import("@/features/household/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

const OWNER_ID = "usr_owner_cuid";
const HOUSEHOLD_ID = "clh1234567890abcdefghijkl";
const HOUSEHOLD_SLUG = "alices-house";

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

describe("createInvitation", () => {
  test("[INVT-01] OWNER caller returns { success, token, invitationId } with 64-char hex token", async () => {
    mockOwnerSession();
    mockRoleAccess("OWNER");
    vi.mocked(db.invitation.create).mockResolvedValueOnce({ id: "inv_cuid" } as never);

    const result = await createInvitation({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toMatchObject({ success: true, invitationId: "inv_cuid" });
    expect((result as { token: string }).token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test((result as { token: string }).token)).toBe(true);
  });

  test("[INVT-01] non-OWNER caller: returns 'Only household owners can generate invite links.'", async () => {
    mockOwnerSession();
    mockRoleAccess("MEMBER");

    const result = await createInvitation({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toEqual({ error: "Only household owners can generate invite links." });
    expect(vi.mocked(db.invitation.create)).not.toHaveBeenCalled();
  });

  test("[INVT-01] demo-mode session: returns demo-disabled error", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: OWNER_ID, isDemo: true },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const result = await createInvitation({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toEqual({
      error: "This action is disabled in demo mode. Sign up to get your own household.",
    });
  });

  test("[INVT-01] persists only tokenHash, not the raw token", async () => {
    mockOwnerSession();
    mockRoleAccess("OWNER");
    vi.mocked(db.invitation.create).mockResolvedValueOnce({ id: "inv_cuid" } as never);

    const result = await createInvitation({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    const callArg = vi.mocked(db.invitation.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(callArg.data.tokenHash).toBeDefined();
    expect(typeof callArg.data.tokenHash).toBe("string");
    expect((callArg.data.tokenHash as string)).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(callArg.data.tokenHash as string)).toBe(true);
    // tokenHash (SHA-256) must differ from raw token
    expect(callArg.data.tokenHash).not.toBe((result as { token: string }).token);
    // no raw token key in the persisted data
    expect(callArg.data).not.toHaveProperty("token");
    expect(Object.values(callArg.data)).not.toContain((result as { token: string }).token);
  });
});
