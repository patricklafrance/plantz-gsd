/**
 * Shared fixtures for Phase 6 mocked-Prisma test suites (tests/phase-06/*.test.ts).
 *
 * Phase 6 test policy (see 06-CONTEXT D-33, 06-PATTERNS §tests/phase-06/*):
 *   - Most files under tests/phase-06/ use vi.mock for the Prisma client.
 *   - `reorder-rotation-concurrency.test.ts` is the lone real-Prisma integration
 *     stub (D-35); it calls `getDb()` lazily inside the test body so pure-import
 *     consumers do not pay the cost of a live Prisma client during module load.
 *   - Keep this file minimal: only RUN_ID, EMAIL_PREFIX, emailFor, and getDb —
 *     mirrors tests/phase-05/fixtures.ts to preserve the grep-and-replace TDD
 *     handoff shape.
 *
 * References:
 *   CONTEXT D-33 — mocked-Prisma for action layers, real-Prisma only for D-35
 *   PATTERNS §tests/phase-06/* — namespacing + lazy-db helper
 */
import { randomUUID } from "node:crypto";

export const RUN_ID = `phase-06-${Date.now()}-${randomUUID().slice(0, 8)}`;
export const EMAIL_PREFIX = `p06-test-${RUN_ID}`;

/** Deterministic test-email helper; keep user tags short (e.g., "owner", "m1"). */
export function emailFor(userTag: string): string {
  return `${EMAIL_PREFIX}-${userTag}@test.local`;
}

/**
 * Lazy-loaded db handle. Top-level `import { db } from "@/lib/db"` crashes at
 * module-load time when DATABASE_URL isn't set (src/lib/db.ts:11 throws at
 * client construction). Stubs in Wave 0 only import pure constants for their
 * afterAll hook — they should not pay the price of a live Prisma client during
 * module load. The D-35 concurrency test calls `getDb()` inside the test body,
 * at which point DATABASE_URL is expected.
 */
export async function getDb() {
  const mod = await import("@/lib/db");
  return mod.db;
}
