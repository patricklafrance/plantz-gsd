import { describe, test, expect } from "vitest";
import { computeAssigneeIndex } from "@/features/household/cycle";

/**
 * ROTA-02 / ROTA-03 / ROTA-07 — deterministic index math. Pure function tests.
 */
describe("rotation formula — computeAssigneeIndex (ROTA-02, ROTA-03, ROTA-07)", () => {
  const anchor = new Date("2026-04-17T04:00:00Z");

  test("at exact anchor returns 0", () => {
    expect(computeAssigneeIndex(anchor, anchor, 7, 3)).toBe(0);
  });

  test("single-member household always returns 0 (Pitfall 8)", () => {
    const later = new Date("2027-04-17T04:00:00Z");
    expect(computeAssigneeIndex(anchor, later, 7, 1)).toBe(0);
  });

  test("one cycleDuration later returns 1", () => {
    const next = new Date(anchor.getTime() + 7 * 86400 * 1000);
    expect(computeAssigneeIndex(anchor, next, 7, 4)).toBe(1);
  });

  test("memberCount × cycleDuration later wraps to 0", () => {
    const next = new Date(anchor.getTime() + 4 * 7 * 86400 * 1000);
    expect(computeAssigneeIndex(anchor, next, 7, 4)).toBe(0);
  });

  test("3-day cycle with 3 members: day 9 → index 0 (full wrap)", () => {
    const later = new Date(anchor.getTime() + 9 * 86400 * 1000);
    expect(computeAssigneeIndex(anchor, later, 3, 3)).toBe(0);
  });

  test("1-day cycle with 2 members: day 1 → 1, day 2 → 0", () => {
    const day1 = new Date(anchor.getTime() + 1 * 86400 * 1000);
    const day2 = new Date(anchor.getTime() + 2 * 86400 * 1000);
    expect(computeAssigneeIndex(anchor, day1, 1, 2)).toBe(1);
    expect(computeAssigneeIndex(anchor, day2, 1, 2)).toBe(0);
  });
});
