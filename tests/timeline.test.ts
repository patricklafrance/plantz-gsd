import { expect, test, describe } from "vitest";

// Tests for the mergeTimeline pure function — no DB mocking needed.
// The mergeTimeline function is a pure utility that takes watering logs and notes
// and returns them merged and sorted by timestamp descending.
// Task 2 will implement mergeTimeline in @/features/notes/queries.

describe("getTimeline merge and sort", () => {
  test.todo("merges watering logs and notes into a single sorted array");
  test.todo("respects skip and take for pagination (D-03)");
  test.todo("returns correct total count across both types");
  test.todo("handles empty notes with only watering logs");
  test.todo("handles empty watering logs with only notes");
});
