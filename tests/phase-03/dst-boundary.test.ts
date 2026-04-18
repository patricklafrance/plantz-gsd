import { describe, test, expect } from "vitest";
import { computeNextCycleBoundaries } from "@/features/household/cycle";

/**
 * BINDING acceptance gate per RESEARCH.md §Validation Architecture line 1016.
 * These tests exercise the real @date-fns/tz IANA lookup — no mocks, no stubs.
 * They verify the wall-clock preservation invariant across DST transitions:
 * +N days in a zoned calendar is NOT equivalent to +N*86400000 ms UTC when
 * a DST transition falls inside the window.
 *
 * A regression that refactors `addDays(startInZone, cycleDuration)` into
 * `new Date(startInZone.getTime() + N * 86400 * 1000)` would fail these
 * assertions.
 */
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

describe("DST boundary — America/New_York 2026 transitions (ROTA-05, ROTA-06 binding gate)", () => {
  test("spring-forward: anchor 2026-03-08T05:00:00Z + 7 days preserves wall-clock local time (23h short of 168h UTC)", () => {
    // 2026-03-08 00:00 EST = 2026-03-08 05:00Z; DST begins that day at 02:00 local
    // (clock jumps to 03:00 EDT). +7 wall-clock days in NY lands on
    // 2026-03-15 00:00 EDT = 2026-03-15 04:00Z (one hour less than 168h UTC).
    const outgoingEnd = new Date("2026-03-08T05:00:00Z");
    const { startDate, endDate } = computeNextCycleBoundaries(
      outgoingEnd,
      "America/New_York",
      7,
    );
    expect(startDate.toISOString()).toBe(outgoingEnd.toISOString());
    expect(endDate.toISOString()).toBe("2026-03-15T04:00:00.000Z");
    expect(endDate.getTime() - outgoingEnd.getTime()).toBe(
      7 * MS_PER_DAY - MS_PER_HOUR,
    );
  });

  test("fall-back: anchor 2026-11-01T04:00:00Z + 7 days preserves wall-clock local time (25h long of 168h UTC)", () => {
    // 2026-11-01 00:00 EDT = 2026-11-01 04:00Z; DST ends that day at 02:00 local
    // (clock falls back to 01:00 EST). +7 wall-clock days in NY lands on
    // 2026-11-08 00:00 EST = 2026-11-08 05:00Z (one hour more than 168h UTC).
    const outgoingEnd = new Date("2026-11-01T04:00:00Z");
    const { startDate, endDate } = computeNextCycleBoundaries(
      outgoingEnd,
      "America/New_York",
      7,
    );
    expect(startDate.toISOString()).toBe(outgoingEnd.toISOString());
    expect(endDate.toISOString()).toBe("2026-11-08T05:00:00.000Z");
    expect(endDate.getTime() - outgoingEnd.getTime()).toBe(
      7 * MS_PER_DAY + MS_PER_HOUR,
    );
  });

  test("zones without DST (UTC, Asia/Tokyo): +7 days === 168 hours UTC exactly", () => {
    const outgoingEnd = new Date("2026-03-08T00:00:00Z");

    const utcResult = computeNextCycleBoundaries(outgoingEnd, "UTC", 7);
    expect(utcResult.endDate.getTime() - outgoingEnd.getTime()).toBe(
      7 * MS_PER_DAY,
    );

    const tokyoResult = computeNextCycleBoundaries(
      outgoingEnd,
      "Asia/Tokyo",
      7,
    );
    expect(tokyoResult.endDate.getTime() - outgoingEnd.getTime()).toBe(
      7 * MS_PER_DAY,
    );
  });
});
