import { test, describe } from "vitest";
import { getDb, emailFor, RUN_ID } from "./fixtures";

// Wave 0 real-Prisma integration stub — single placeholder for D-35.
// Wave 4 (Plan 06+) replaces with a live concurrent-transaction test.
// Using pure imports (RUN_ID/emailFor/getDb) avoids eager DATABASE_URL coupling.
void RUN_ID;
void emailFor;
void getDb;

describe("reorderRotation + removeMember concurrency (D-35)", () => {
  test.todo(
    "D-35 Concurrent reorderRotation (with stale orderedMemberUserIds) + removeMember: reorder fails with MEMBERS_CHANGED, member is removed, no torn state"
  );
});
