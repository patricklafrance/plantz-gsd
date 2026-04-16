import { expect, test, describe } from "vitest";

// --- Schema shape assertions (Plan 02 fills in via fs.readFileSync of prisma/schema.prisma) ---

describe("Prisma schema — household models (D-01)", () => {
  test.todo("schema.prisma contains 'model Household {'");
  test.todo("schema.prisma contains 'model HouseholdMember {'");
  test.todo("schema.prisma contains 'model Cycle {'");
  test.todo("schema.prisma contains 'model Availability {'");
  test.todo("schema.prisma contains 'model Invitation {'");
});

describe("Prisma schema — Plant/Room reparenting (D-04, AUDT-02)", () => {
  test.todo("Plant model has 'householdId String' field");
  test.todo("Plant model has 'createdByUserId String?' (nullable audit column)");
  test.todo("Plant.createdBy relation uses onDelete: SetNull");
  test.todo("Plant.household relation uses onDelete: Cascade");
  test.todo("Room model has 'householdId String' field");
  test.todo("Room model has 'createdByUserId String?' (nullable audit column)");
});

describe("Prisma schema — audit columns (AUDT-01)", () => {
  test.todo("WateringLog has 'performedByUserId String?'");
  test.todo("Note has 'performedByUserId String?'");
});

describe("Prisma schema — composite indexes (D-03, Pitfall 3)", () => {
  test.todo("Plant has @@index([householdId, archivedAt])");
  test.todo("Cycle has @@index([householdId, status])");
  test.todo("Room has @@index([householdId])");
  test.todo("HouseholdMember has @@unique([householdId, userId]) (Pitfall 5)");
});

describe("WateringLog functional unique index (D-03, Pitfall 15)", () => {
  test.todo(
    "migration.sql contains CREATE UNIQUE INDEX on (plantId, date_trunc('day', wateredAt))"
  );
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
  test.todo("auth.ts jwt callback queries householdMember when user is present");
  test.todo("auth.ts session callback copies token.activeHouseholdId to session.user.activeHouseholdId");
  test.todo("src/types/next-auth.d.ts Session.user has activeHouseholdId?: string");
  test.todo("src/types/next-auth.d.ts JWT has activeHouseholdId?: string | null");
});
