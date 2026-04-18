/**
 * POST /api/cron/advance-cycles
 *
 * External hourly trigger from cron-job.org (D-10). Bearer auth via CRON_SECRET
 * env var (D-13). Node runtime is mandatory — Prisma is incompatible with edge
 * (T-3-EDGE-RUNTIME).
 *
 * proxy.ts matcher excludes /api/cron/* (Plan 02) so NextAuth session middleware
 * does not wrap this route. The bearer check below is the ONLY auth.
 *
 * Response shape (200) is the D-12 summary produced by advanceAllHouseholds().
 * Auth failures return 401 with the generic body `{ error: "unauthorized" }`
 * — no hint about expected format (T-3-CRON-ENV-LEAK mitigation).
 */
import { NextRequest } from "next/server";
import { advanceAllHouseholds } from "@/features/household/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Read env inside POST (not at module scope) so test-time env mutation is
  // effective. Plain `===` per D-13; constant-time compare deferred because
  // traffic is 24 req/day from a single source.
  //
  // CR-01 fail-closed: if CRON_SECRET is unset or empty, refuse to serve.
  // Without this guard, an attacker sending `Authorization: Bearer undefined`
  // (or the empty-suffix variant) would match the interpolated expected value.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured");
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;

  if (!authHeader || authHeader !== expected) {
    console.warn("[cron] unauthorized", {
      ip: request.headers.get("x-forwarded-for"),
      ua: request.headers.get("user-agent"),
    });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await advanceAllHouseholds();
  return Response.json(result, { status: 200 });
}
