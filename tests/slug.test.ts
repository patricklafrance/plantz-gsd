import { expect, test, describe } from "vitest";

describe("generateHouseholdSlug (D-10 corrected per RESEARCH Pattern 4)", () => {
  test("default length is 8 characters", async () => {
    const { generateHouseholdSlug } = await import("@/lib/slug");
    expect(generateHouseholdSlug()).toHaveLength(8);
  });

  test("custom length argument is honoured", async () => {
    const { generateHouseholdSlug } = await import("@/lib/slug");
    expect(generateHouseholdSlug(12)).toHaveLength(12);
  });

  test("generated slugs never contain ambiguous characters 0, O, I, l, 1", async () => {
    const { generateHouseholdSlug } = await import("@/lib/slug");
    const forbidden = /[0OIl1]/;
    for (let i = 0; i < 1000; i++) {
      const slug = generateHouseholdSlug();
      expect(slug).toHaveLength(8);
      expect(slug).not.toMatch(forbidden);
    }
  });

  test("UNAMBIGUOUS_ALPHABET constant is 54 chars and excludes 0/O/I/l/1", async () => {
    const { UNAMBIGUOUS_ALPHABET } = await import("@/lib/slug");
    expect(UNAMBIGUOUS_ALPHABET).toHaveLength(54);
    expect(UNAMBIGUOUS_ALPHABET).not.toMatch(/[0OIl1]/);
  });
});
