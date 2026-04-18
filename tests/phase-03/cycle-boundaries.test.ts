import { describe, test } from "vitest";

/**
 * ROTA-05 timezone-aware boundaries. Wave 2 fills with real assertions against
 * `computeInitialCycleBoundaries(now, tz, duration)` and `computeNextCycleBoundaries`.
 */
describe("cycle boundaries — computeInitialCycleBoundaries / computeNextCycleBoundaries (ROTA-05)", () => {
  test.todo("NY (EDT): anchorDate === start of next local day, materialized as UTC");
  test.todo("NY (EDT): endDate === anchorDate + 7 wall-clock days");
  test.todo("Tokyo (JST +9): anchorDate === next JST midnight");
  test.todo("UTC zone: anchorDate === next UTC midnight");
  test.todo("computeNextCycleBoundaries: startDate === outgoing endDate (contiguous cycles)");
});
