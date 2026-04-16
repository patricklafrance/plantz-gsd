import { expect, test, describe } from "vitest";

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
  test.todo("creates User + Household + HouseholdMember(OWNER) atomically");
  test.todo("rolls back the user when household creation fails");
  test.todo("HouseholdMember.role is 'OWNER' for the signing-up user");
  test.todo("created Household has name 'My Plants' (D-09)");
  test.todo("created Household has rotationStrategy 'sequential' (D-12)");
  test.todo("created Household has cycleDuration 7 (D-12)");
  test.todo("created Household uses passed timezone, falls back to UTC (D-12)");
});

// --- requireHouseholdAccess guard (Plan 04 fills in) ---

describe("requireHouseholdAccess guard (HSLD-06, D-16..D-20)", () => {
  test.todo("returns { household, member, role } for valid member");
  test.todo("throws ForbiddenError when session has no user.id");
  test.todo("throws ForbiddenError when user is not a member of the household");
  test.todo("returned role is 'OWNER' for owner member rows");
  test.todo("returned role is 'MEMBER' for non-owner member rows");
});

describe("ForbiddenError class (D-19)", () => {
  test.todo("instanceof Error returns true");
  test.todo("error.name === 'ForbiddenError'");
  test.todo("error.statusCode === 403");
});

// --- resolveHouseholdBySlug (Plan 04 fills in) ---

describe("resolveHouseholdBySlug (D-17)", () => {
  test.todo("returns { id, name } for an existing slug");
  test.todo("returns null for an unknown slug");
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
