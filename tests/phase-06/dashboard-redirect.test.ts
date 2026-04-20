import { test, describe } from "vitest";

// Wave 0 stub for the legacy /dashboard redirect stub orderBy change (D-08).
// The redirect stub lives at src/app/(main)/dashboard/page.tsx and picks the
// user default membership first, then falls back to the oldest createdAt.

describe("Legacy /dashboard redirect stub (D-08)", () => {
  test.todo("HSET-02 orderBy [isDefault desc, createdAt asc]: picks isDefault=true membership first");
  test.todo("HSET-02 no default set: falls back to oldest membership by createdAt asc");
  test.todo("HSET-02 no memberships: redirects to onboarding (pre-existing behavior unchanged)");
});
