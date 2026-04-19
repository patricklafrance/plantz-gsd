/**
 * Shared fixtures for Phase 5 mocked-Prisma test suites (tests/phase-05/*.test.ts).
 *
 * Phase 5 test policy (see 05-CONTEXT D-26, 05-PATTERNS §tests/phase-05/*):
 *   - Every test file under tests/phase-05/ uses vi.mock for the Prisma client. No
 *     real-DB integration tests live here (Phase 4 owns the real-DB invitation suite).
 *   - This fixtures file mirrors tests/phase-04/fixtures.ts lines 20-42 so afterAll
 *     cleanup patterns carry over IF a downstream plan adds a real-DB helper later.
 *   - Keep this file minimal: only RUN_ID, EMAIL_PREFIX, emailFor, and getDb.
 *
 * References:
 *   CONTEXT D-26 — mocked-Prisma over integration for Phase 5 coverage
 *   PATTERNS §tests/phase-05/* — namespacing + lazy-db helper
 */
import { randomUUID } from "node:crypto";

export const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
export const EMAIL_PREFIX = `phase05-test-${RUN_ID}`;

/** Deterministic test-email helper; keep user tags short (e.g., "owner", "m1"). */
export function emailFor(userTag: string): string {
  return `${EMAIL_PREFIX}-${userTag}@test.local`;
}

/**
 * [Rule 1 fix] Lazy-loaded db handle. Top-level `import { db } from "@/lib/db"` crashes
 * at module-load time when DATABASE_URL isn't set (src/lib/db.ts:11 throws at client
 * construction). Stubs in Wave 0 only import `EMAIL_PREFIX` for their afterAll hook —
 * they should not pay the price of a live Prisma client during module load. If a
 * downstream plan ever adds a real-DB test, it calls `getDb()` inside the test body,
 * at which point DATABASE_URL is expected.
 */
export async function getDb() {
  const mod = await import("@/lib/db");
  return mod.db;
}
