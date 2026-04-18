import { describe, test } from "vitest";

/**
 * ROTA-02 / ROTA-03 / ROTA-07. Wave 2 fills with real assertions against
 * `computeAssigneeIndex(anchor, now, cycleDuration, memberCount)`.
 */
describe("rotation formula — computeAssigneeIndex (ROTA-02, ROTA-03, ROTA-07)", () => {
  test.todo("at anchor returns 0");
  test.todo("single-member household always returns 0 (Pitfall 8)");
  test.todo("one cycleDuration later returns 1");
  test.todo("memberCount × cycleDuration later wraps to 0");
  test.todo("cycleDuration change applies at next boundary, not retroactively (ROTA-03)");
  test.todo("membership change mid-cycle does not rewrite assignee (ROTA-07)");
});
