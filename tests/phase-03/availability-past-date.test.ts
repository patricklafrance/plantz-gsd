import { describe, test } from "vitest";

/**
 * AVLB-01 past-date rejection via Zod refinement (Pitfall 12). Wave 3 (03-04) fills.
 */
describe("createAvailability past-date rejection (AVLB-01, Pitfall 12)", () => {
  test.todo("startDate < today → Zod refinement fails with 'Availability cannot start in the past.'");
  test.todo("startDate === today (00:00 local) → accepted");
  test.todo("endDate < startDate → Zod refinement fails with 'End date must be after start date.'");
});
