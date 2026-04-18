import { describe, test } from "vitest";

/**
 * AVLB-02 overlap rejection (mocked-Prisma unit test). Wave 3 (03-04) fills with
 * real assertions against `createAvailability(data)` using vi.mock("@/lib/db").
 */
describe("createAvailability overlap rejection (AVLB-02, D-06, Pitfall 11)", () => {
  test.todo("no overlap → db.availability.create called with parsed input");
  test.todo("overlapping period found → returns { error } with message naming existing period's start/end dates");
  test.todo("silently-merge behavior is NOT invoked (no auto-merge on overlap)");
});
