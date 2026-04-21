export const DEMO_EMAIL = "demo@plantminder.app";
export const DEMO_PASSWORD = "demo-password-not-secret";

/**
 * HDMO-01 — Sample household members seeded alongside the demo user.
 * These are real User rows with HouseholdMember entries in the Demo Household
 * so rotation math, availability-driven auto-skip, and assignee-gated
 * notifications all function against the seeded data.
 *
 * Security invariants (T-07-01 / T-07-02 — RESEARCH.md §Security Domain):
 * - Passwords MUST be unusable (see prisma/seed.ts unusable-hash construction);
 *   these accounts exist as data, not as login targets.
 * - Emails MUST use a distinct domain from DEMO_EMAIL so the JWT `isDemo`
 *   derivation (`token.isDemo = dbUser?.email === DEMO_EMAIL`) never flips
 *   true for sample members (D-03).
 */
export const DEMO_SAMPLE_MEMBERS = [
  {
    email: "alice@demo.plantminder.app",
    name: "Alice",
    rotationOrder: 1,
  },
  {
    email: "bob@demo.plantminder.app",
    name: "Bob",
    rotationOrder: 2,
  },
] as const;

// These reference CareProfile.name values from prisma/data/catalog.ts
// Used by prisma/seed.ts to create demo user's plants
export const DEMO_PLANTS = [
  { catalogName: "Monstera Deliciosa", nickname: "Monty", daysAgoWatered: 8, intervalDays: 7 },
  { catalogName: "Snake Plant", nickname: "Snakey", daysAgoWatered: 1, intervalDays: 14 },
  { catalogName: "Pothos", nickname: "Goldie", daysAgoWatered: 3, intervalDays: 7 },
  { catalogName: "Peace Lily", nickname: "Lily", daysAgoWatered: 0, intervalDays: 5 },
  { catalogName: "Spider Plant", nickname: "Spidey", daysAgoWatered: 5, intervalDays: 7 },
  { catalogName: "Fiddle Leaf Fig", nickname: "Fiddle", daysAgoWatered: 12, intervalDays: 10 },
  { catalogName: "ZZ Plant", nickname: "Ziggy", daysAgoWatered: 2, intervalDays: 14 },
  { catalogName: "Rubber Plant", nickname: "Stretch", daysAgoWatered: 6, intervalDays: 10 },
] as const;

// Subset offered during onboarding starter plant seeding (DEMO-03)
// These are common beginner-friendly plants
export const STARTER_PLANTS = [
  "Pothos",
  "Snake Plant",
  "Spider Plant",
  "Peace Lily",
  "ZZ Plant",
] as const;
