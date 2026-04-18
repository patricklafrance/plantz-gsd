import { describe, test } from "vitest";

/**
 * ROTA-04 cron route handler (mocked advanceAllHouseholds). Wave 4 (03-05) fills.
 */
describe("POST /api/cron/advance-cycles (ROTA-04, D-10, D-13)", () => {
  test.todo("no Authorization header → 401 with { error: 'unauthorized' }");
  test.todo("wrong bearer token → 401 with { error: 'unauthorized' }");
  test.todo("correct bearer → 200 with D-12 JSON shape (ranAt, totalHouseholds, transitions[], errors[])");
  test.todo("route runtime === 'nodejs' (Prisma incompatible with edge)");
});
