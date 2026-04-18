/**
 * ROTA-04 cron route handler — unit tests with mocked advanceAllHouseholds.
 *
 * Pins the bearer-auth contract (D-13) and the D-12 response shape. Uses a
 * vi.mock on the cron module so tests can assert whether the orchestrator was
 * called without touching Postgres. process.env.CRON_SECRET is set in
 * beforeEach and restored in afterEach.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/features/household/cron", () => ({
  advanceAllHouseholds: vi.fn(),
}));

const { advanceAllHouseholds } = await import("@/features/household/cron");
const { POST, runtime, dynamic } = await import(
  "@/app/api/cron/advance-cycles/route"
);

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret-value";
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("POST /api/cron/advance-cycles", () => {
  test("exports runtime = 'nodejs' and dynamic = 'force-dynamic' (T-3-EDGE-RUNTIME, T-3-HANDLER-CACHE)", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  test("missing Authorization header → 401 { error: 'unauthorized' } and orchestrator NOT called", async () => {
    const req = new NextRequest("http://localhost/api/cron/advance-cycles", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(vi.mocked(advanceAllHouseholds)).not.toHaveBeenCalled();
  });

  test("wrong bearer secret → 401 and orchestrator NOT called (T-3-AUTH-CRON)", async () => {
    const req = new NextRequest("http://localhost/api/cron/advance-cycles", {
      method: "POST",
      headers: { authorization: "Bearer wrong-value" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(vi.mocked(advanceAllHouseholds)).not.toHaveBeenCalled();
  });

  test("correct bearer → 200 with D-12 summary shape", async () => {
    vi.mocked(advanceAllHouseholds).mockResolvedValueOnce({
      ranAt: "2026-04-17T14:00:00.000Z",
      totalHouseholds: 2,
      transitions: [
        {
          householdId: "clx1",
          fromCycleNumber: 3,
          toCycleNumber: 4,
          reason: "cycle_end",
          assignedUserId: "clu1",
        },
      ],
      errors: [],
    });
    const req = new NextRequest("http://localhost/api/cron/advance-cycles", {
      method: "POST",
      headers: { authorization: "Bearer test-secret-value" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ranAt: expect.any(String),
      totalHouseholds: 2,
      transitions: expect.arrayContaining([
        expect.objectContaining({
          householdId: "clx1",
          reason: "cycle_end",
        }),
      ]),
      errors: [],
    });
    expect(vi.mocked(advanceAllHouseholds)).toHaveBeenCalledOnce();
  });

  test("header with lowercase 'bearer' (case-sensitivity check per D-13 plain ===) → 401", async () => {
    const req = new NextRequest("http://localhost/api/cron/advance-cycles", {
      method: "POST",
      headers: { authorization: "bearer test-secret-value" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(vi.mocked(advanceAllHouseholds)).not.toHaveBeenCalled();
  });
});
