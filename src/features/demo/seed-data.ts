export const DEMO_EMAIL = "demo@plantminder.app";
export const DEMO_PASSWORD = "demo-password-not-secret";

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
