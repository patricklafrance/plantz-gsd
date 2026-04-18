/**
 * AVLB-01 past-date rejection via Zod refinement (Pitfall 12). Unit test on the
 * schema — no db, no auth, no server action.
 */
import { expect, test, describe } from "vitest";
import { addDays, startOfDay } from "date-fns";
import { createAvailabilitySchema } from "@/features/household/schema";

describe("createAvailability past-date rejection (AVLB-01, Pitfall 12)", () => {
  const baseInput = {
    // CUID format so z.string().cuid() passes — refinements still run since
    // Zod v4 runs refinements after the base object check.
    householdId: "clh1234567890abcdefghijkl",
    householdSlug: "test-slug",
  };

  test("startDate < today → refinement fails with 'past' message on startDate path", () => {
    const yesterday = addDays(startOfDay(new Date()), -1);
    const tomorrow = addDays(startOfDay(new Date()), 1);

    const result = createAvailabilitySchema.safeParse({
      ...baseInput,
      startDate: yesterday,
      endDate: tomorrow,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "startDate");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/past/i);
  });

  test("startDate === today (00:00 local) → accepted", () => {
    const todayMidnight = startOfDay(new Date());
    const tomorrow = addDays(todayMidnight, 1);

    const result = createAvailabilitySchema.safeParse({
      ...baseInput,
      startDate: todayMidnight,
      endDate: tomorrow,
    });

    expect(result.success).toBe(true);
  });

  test("endDate < startDate → refinement fails with 'after' message on endDate path", () => {
    const todayMidnight = startOfDay(new Date());
    const tomorrow = addDays(todayMidnight, 1);
    const dayAfter = addDays(todayMidnight, 2);

    // startDate = dayAfter, endDate = tomorrow → endDate < startDate
    const result = createAvailabilitySchema.safeParse({
      ...baseInput,
      startDate: dayAfter,
      endDate: tomorrow,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "endDate");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/after/i);
  });
});
