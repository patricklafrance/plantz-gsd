import { describe, test, expect } from "vitest";
import {
  computeInitialCycleBoundaries,
  computeNextCycleBoundaries,
} from "@/features/household/cycle";

/**
 * ROTA-05 timezone-aware boundaries. Real @date-fns/tz TZDate — no mocks.
 */
describe("cycle boundaries — computeInitialCycleBoundaries / computeNextCycleBoundaries (ROTA-05)", () => {
  test("computeInitialCycleBoundaries: anchorDate === startDate", () => {
    const now = new Date("2026-04-17T14:30:00Z");
    const { anchorDate, startDate } = computeInitialCycleBoundaries(
      now,
      "America/New_York",
      7,
    );
    expect(anchorDate.getTime()).toBe(startDate.getTime());
  });

  test("NY (EDT): anchorDate === start of next local day, materialized as UTC", () => {
    const now = new Date("2026-04-17T14:30:00Z"); // April 17 10:30 EDT
    const { startDate, endDate } = computeInitialCycleBoundaries(
      now,
      "America/New_York",
      7,
    );
    // Next local midnight NY = April 18 00:00 EDT = April 18 04:00Z
    expect(startDate.toISOString()).toBe("2026-04-18T04:00:00.000Z");
    // +7 days wall-clock in NY (no DST cross here) = April 25 00:00 EDT = April 25 04:00Z
    expect(endDate.toISOString()).toBe("2026-04-25T04:00:00.000Z");
  });

  test("Tokyo (JST +9): anchorDate === next JST midnight", () => {
    const now = new Date("2026-04-17T14:30:00Z"); // April 17 23:30 JST
    const { startDate } = computeInitialCycleBoundaries(now, "Asia/Tokyo", 7);
    // Next JST midnight = April 18 00:00 JST = April 17 15:00Z
    expect(startDate.toISOString()).toBe("2026-04-17T15:00:00.000Z");
  });

  test("UTC zone: anchorDate === next UTC midnight", () => {
    const now = new Date("2026-04-17T14:30:00Z");
    const { startDate } = computeInitialCycleBoundaries(now, "UTC", 7);
    expect(startDate.toISOString()).toBe("2026-04-18T00:00:00.000Z");
  });

  test("computeNextCycleBoundaries: startDate === outgoing endDate (contiguous cycles)", () => {
    const outgoingEnd = new Date("2026-04-25T04:00:00Z");
    const { startDate, endDate } = computeNextCycleBoundaries(
      outgoingEnd,
      "America/New_York",
      7,
    );
    expect(startDate.toISOString()).toBe(outgoingEnd.toISOString());
    // +7 wall-clock days in NY from April 25 00:00 EDT = May 2 00:00 EDT = May 2 04:00Z
    expect(endDate.toISOString()).toBe("2026-05-02T04:00:00.000Z");
  });
});
