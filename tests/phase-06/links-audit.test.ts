import { test, describe } from "vitest";

// Wave 0 audit stub (HSET-01 / Pitfall 17). The real implementation in Wave 4
// reads files under src/components/household and src/app/(main)/h and
// asserts every internal navigation target is /h/[slug]/-prefixed.

describe("Internal link prefix audit (HSET-01 / Pitfall 17)", () => {
  test.todo(
    "HSET-01 every internal Link href or router.push target in src/components/household and src/app/(main)/h uses /h/[slug]/ prefix (no bare /plants, /rooms, /dashboard, /settings)"
  );
});
