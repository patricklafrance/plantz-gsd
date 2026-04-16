import { expect, test, describe, vi, beforeEach } from "vitest";

// Mock Prisma client and db before any imports (Plan 04 guard/resolver tests)
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: vi.fn(),
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: { findFirst: vi.fn() },
    household: { findUnique: vi.fn() },
  },
}));

vi.mock("../auth", () => ({
  auth: vi.fn(),
}));

// --- Schema shape assertions (Plan 02 fills in via fs.readFileSync of prisma/schema.prisma) ---

describe("Prisma schema — household models (D-01)", () => {
  test("schema.prisma contains 'model Household {'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("model Household {");
  });

  test("schema.prisma contains 'model HouseholdMember {'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("model HouseholdMember {");
  });

  test("schema.prisma contains 'model Cycle {'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("model Cycle {");
  });

  test("schema.prisma contains 'model Availability {'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("model Availability {");
  });

  test("schema.prisma contains 'model Invitation {'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("model Invitation {");
  });
});

describe("Prisma schema — Plant/Room reparenting (D-04, AUDT-02)", () => {
  test("Plant model has 'householdId String' field", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model Plant \{[\s\S]*?householdId\s+String\b/);
  });

  test("Plant model has 'createdByUserId String?' (nullable audit column)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model Plant \{[\s\S]*?createdByUserId\s+String\?/);
  });

  test("Plant.createdBy relation uses onDelete: SetNull", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/createdBy\s+User\?\s+@relation\("PlantCreatedBy"[\s\S]*?onDelete:\s*SetNull/);
  });

  test("Plant.household relation uses onDelete: Cascade", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model Plant \{[\s\S]*?household\s+Household\s+@relation\([\s\S]*?onDelete:\s*Cascade/);
  });

  test("Room model has 'householdId String' field", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model Room \{[\s\S]*?householdId\s+String\b/);
  });

  test("Room model has 'createdByUserId String?' (nullable audit column)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model Room \{[\s\S]*?createdByUserId\s+String\?/);
  });
});

describe("Prisma schema — audit columns (AUDT-01)", () => {
  test("WateringLog has 'performedByUserId String?'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model WateringLog \{[\s\S]*?performedByUserId\s+String\?/);
  });

  test("Note has 'performedByUserId String?'", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/model Note \{[\s\S]*?performedByUserId\s+String\?/);
  });
});

describe("Prisma schema — composite indexes (D-03, Pitfall 3)", () => {
  test("Plant has @@index([householdId, archivedAt])", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("@@index([householdId, archivedAt])");
  });

  test("Cycle has @@index([householdId, status])", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("@@index([householdId, status])");
  });

  test("Room has @@index([householdId])", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("@@index([householdId])");
  });

  test("HouseholdMember has @@unique([householdId, userId]) (Pitfall 5)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toContain("@@unique([householdId, userId])");
  });
});

describe("WateringLog functional unique index (D-03, Pitfall 15)", () => {
  test("migration.sql contains CREATE UNIQUE INDEX on (plantId, date_trunc('day', wateredAt))", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationsDir = "prisma/migrations";
    const dirs = fs.readdirSync(migrationsDir).filter((d) =>
      fs.statSync(path.join(migrationsDir, d)).isDirectory()
    );
    expect(dirs.length).toBeGreaterThan(0);
    // Concatenate all migration.sql files (only one for Phase 1, but be defensive)
    const sql = dirs
      .map((d) => fs.readFileSync(path.join(migrationsDir, d, "migration.sql"), "utf8"))
      .join("\n");
    expect(sql).toContain('CREATE UNIQUE INDEX "WateringLog_plantId_day_key"');
    expect(sql).toMatch(/date_trunc\(\s*'day'\s*,\s*"wateredAt"/);
  });
});

// --- Signup transaction (Plan 03 fills in) ---

describe("registerUser transactional household creation (HSLD-01, D-08)", () => {
  test("source uses db.$transaction interactive form (Pattern 1)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toMatch(/db\.\$transaction\(\s*async\s*\(\s*tx\s*\)/);
  });

  test("source creates User, Household, HouseholdMember inside the transaction", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    // Extract the transaction block greedily — stops at the LAST '});' before
    // the trailing '// 5. Auto-login' comment / signIn call. Non-greedy would
    // stop at the first inner `});` (e.g. tx.user.create's closing).
    const txMatch = src.match(/db\.\$transaction\(\s*async[\s\S]*?\}\);\s*\n\s*\n\s*\/\/\s*5\./);
    expect(txMatch).not.toBeNull();
    const txBody = txMatch![0];
    expect(txBody).toContain("tx.user.create");
    expect(txBody).toContain("tx.household.create");
    expect(txBody).toContain("tx.householdMember.create");
  });

  test("auto-created household uses name 'My Plants' (D-09)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toMatch(/name:\s*"My Plants"/);
  });

  test("auto-created household uses cycleDuration 7 (D-12)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toMatch(/cycleDuration:\s*7/);
  });

  test("auto-created household uses rotationStrategy 'sequential' (D-12)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toMatch(/rotationStrategy:\s*"sequential"/);
  });

  test("timezone defaults to UTC when not provided (D-12)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toMatch(/parsed\.data\.timezone\s*\?\?\s*"UTC"/);
  });

  test("HouseholdMember.role is 'OWNER' for the signing-up user (D-08)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toMatch(/role:\s*"OWNER"/);
  });

  test("uses generateHouseholdSlug from @/lib/slug (D-10)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toContain("generateHouseholdSlug");
    expect(src).toMatch(/from\s+["']@\/lib\/slug["']/);
  });

  test("preserves isRedirectError re-throw and signIn call (regression guard)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/auth/actions.ts", "utf8");
    expect(src).toContain("isRedirectError(error)");
    expect(src).toContain('signIn("credentials"');
    expect(src).toContain('redirectTo: "/dashboard"');
  });
});

// --- requireHouseholdAccess guard (Plan 04) ---

describe("ForbiddenError class (D-19)", () => {
  test("instanceof Error returns true", async () => {
    const { ForbiddenError } = await import("@/features/household/guards");
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(Error);
  });

  test("instanceof ForbiddenError returns true (Object.setPrototypeOf works)", async () => {
    const { ForbiddenError } = await import("@/features/household/guards");
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  test("error.name is ForbiddenError", async () => {
    const { ForbiddenError } = await import("@/features/household/guards");
    const err = new ForbiddenError("denied");
    expect(err.name).toBe("ForbiddenError");
  });

  test("error.statusCode is 403", async () => {
    const { ForbiddenError } = await import("@/features/household/guards");
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  test("error message defaults to Access denied but accepts override", async () => {
    const { ForbiddenError } = await import("@/features/household/guards");
    expect(new ForbiddenError().message).toBe("Access denied");
    expect(new ForbiddenError("custom").message).toBe("custom");
  });
});

describe("requireHouseholdAccess guard (HSLD-06, D-16..D-20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws ForbiddenError when session has no user.id", async () => {
    const { auth } = await import("../auth");
    const { requireHouseholdAccess, ForbiddenError } = await import(
      "@/features/household/guards"
    );
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(requireHouseholdAccess("hh_1")).rejects.toBeInstanceOf(
      ForbiddenError
    );
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(requireHouseholdAccess("hh_1")).rejects.toThrow(
      "Not authenticated"
    );
  });

  test("throws ForbiddenError when user is not a member of the household", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    const { requireHouseholdAccess, ForbiddenError } = await import(
      "@/features/household/guards"
    );
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", isDemo: false },
    });
    (db.householdMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    await expect(requireHouseholdAccess("hh_1")).rejects.toBeInstanceOf(
      ForbiddenError
    );
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", isDemo: false },
    });
    (db.householdMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    await expect(requireHouseholdAccess("hh_1")).rejects.toThrow(
      "Not a member of this household"
    );
  });

  test("returns household, member, role for valid member", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    const { requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );
    const fakeHousehold = { id: "hh_1", name: "My Plants", slug: "abc12345" };
    const fakeMember = {
      id: "m_1",
      householdId: "hh_1",
      userId: "user_1",
      role: "MEMBER",
      household: fakeHousehold,
    };
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", isDemo: false },
    });
    (db.householdMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      fakeMember
    );
    const result = await requireHouseholdAccess("hh_1");
    expect(result.household).toEqual(fakeHousehold);
    expect(result.member).toEqual(fakeMember);
    expect(result.role).toBe("MEMBER");
  });

  test("returned role is OWNER for owner member rows", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    const { requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", isDemo: false },
    });
    (db.householdMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "m_1",
      householdId: "hh_1",
      userId: "user_1",
      role: "OWNER",
      household: { id: "hh_1", name: "x", slug: "y" },
    });
    const result = await requireHouseholdAccess("hh_1");
    expect(result.role).toBe("OWNER");
  });

  test("returned role is MEMBER for non-owner member rows", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    const { requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_2", isDemo: false },
    });
    (db.householdMember.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "m_2",
      householdId: "hh_1",
      userId: "user_2",
      role: "MEMBER",
      household: { id: "hh_1", name: "x", slug: "y" },
    });
    const result = await requireHouseholdAccess("hh_1");
    expect(result.role).toBe("MEMBER");
  });
});

// --- resolveHouseholdBySlug (Plan 04) ---

describe("resolveHouseholdBySlug (D-17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns id+name for an existing slug", async () => {
    const { db } = await import("@/lib/db");
    const { resolveHouseholdBySlug } = await import(
      "@/features/household/queries"
    );
    (db.household.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "hh_1",
      name: "My Plants",
    });
    const result = await resolveHouseholdBySlug("abc12345");
    expect(result).toEqual({ id: "hh_1", name: "My Plants" });
    expect(db.household.findUnique).toHaveBeenCalledWith({
      where: { slug: "abc12345" },
      select: { id: true, name: true },
    });
  });

  test("returns null for an unknown slug", async () => {
    const { db } = await import("@/lib/db");
    const { resolveHouseholdBySlug } = await import(
      "@/features/household/queries"
    );
    (db.household.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await resolveHouseholdBySlug("zzzzzzzz");
    expect(result).toBeNull();
  });
});

describe("household schema enums", () => {
  test("householdRoleSchema accepts OWNER and MEMBER, rejects others", async () => {
    const { householdRoleSchema } = await import(
      "@/features/household/schema"
    );
    expect(householdRoleSchema.safeParse("OWNER").success).toBe(true);
    expect(householdRoleSchema.safeParse("MEMBER").success).toBe(true);
    expect(householdRoleSchema.safeParse("ADMIN").success).toBe(false);
  });

  test("rotationStrategySchema accepts only sequential in v1 (D-12)", async () => {
    const { rotationStrategySchema } = await import(
      "@/features/household/schema"
    );
    expect(rotationStrategySchema.safeParse("sequential").success).toBe(true);
    expect(rotationStrategySchema.safeParse("priority").success).toBe(false);
  });

  test("schema.ts uses zod/v4 import path (project hard rule)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/features/household/schema.ts", "utf8");
    expect(src).toMatch(/from\s+["']zod\/v4["']/);
  });
});

// --- JWT/session extension (Plan 03 fills in) ---

describe("JWT activeHouseholdId extension (D-13, D-15)", () => {
  test("auth.ts jwt callback queries householdMember when user is present", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("auth.ts", "utf8");
    // db.householdMember.findFirst must be inside the if (user) block of jwt callback
    expect(src).toMatch(/if \(user\)[\s\S]*?db\.householdMember\.findFirst/);
    expect(src).toContain("token.activeHouseholdId");
  });

  test("auth.ts session callback copies token.activeHouseholdId to session.user.activeHouseholdId", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("auth.ts", "utf8");
    expect(src).toMatch(/session\.user\.activeHouseholdId\s*=\s*token\.activeHouseholdId/);
  });

  test("src/types/next-auth.d.ts Session.user has activeHouseholdId?: string", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/types/next-auth.d.ts", "utf8");
    expect(src).toMatch(/activeHouseholdId\?\s*:\s*string\b/);
  });

  test("src/types/next-auth.d.ts JWT has activeHouseholdId?: string | null", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/types/next-auth.d.ts", "utf8");
    expect(src).toMatch(/activeHouseholdId\?\s*:\s*string\s*\|\s*null/);
  });
});
