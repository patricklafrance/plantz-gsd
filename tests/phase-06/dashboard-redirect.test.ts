import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Source-grep assertions for the two single-line D-07 / D-08 sort changes.
// These are behavioral surrogates: the JWT callback in auth.ts is bound to
// NextAuth's configuration and is not trivially invokable in a unit test,
// and the legacy /dashboard stub is a Next.js Server Component whose default
// export side-effects `redirect()`. The source grep is sufficient to gate
// the HSET-02 landing-sort contract; Plan 03's integration surfaces will
// exercise the end-to-end behavior.

const projectRoot = resolve(__dirname, "..", "..");

function readSource(relative: string) {
  return readFileSync(resolve(projectRoot, relative), "utf8");
}

describe("Legacy /dashboard redirect stub (D-08)", () => {
  test("HSET-02 orderBy [isDefault desc, createdAt asc]: picks isDefault=true membership first", () => {
    const src = readSource("src/app/(main)/dashboard/page.tsx");
    expect(src).toContain(
      'orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]',
    );
  });

  test("HSET-02 no default set: falls back to oldest membership by createdAt asc (secondary sort key present)", () => {
    const src = readSource("src/app/(main)/dashboard/page.tsx");
    // Secondary sort is createdAt asc; when no isDefault=true row exists,
    // Prisma applies the second key so behavior collapses to the pre-plan
    // oldest-membership selection.
    expect(src).toMatch(/createdAt:\s*"asc"/);
  });

  test("HSET-02 no memberships: redirects to /login?error=no_household (pre-existing behavior unchanged)", () => {
    const src = readSource("src/app/(main)/dashboard/page.tsx");
    // The null-fallback redirect path must still exist so brand-new users
    // without any membership aren't silently bounced (WR-03 binding).
    expect(src).toContain("/login?error=no_household");
  });
});

describe("Auth resolver sort (D-07)", () => {
  test("HSET-02 auth.ts JWT callback uses orderBy [isDefault desc, createdAt asc]", () => {
    const src = readSource("auth.ts");
    expect(src).toContain(
      'orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]',
    );
  });

  test("HSET-02 no stale single-key createdAt sort remains in auth.ts", () => {
    const src = readSource("auth.ts");
    // Guard: the plain `orderBy: { createdAt: "asc" }` form (single-key)
    // must not appear anywhere in auth.ts — D-07 replaces it with the array
    // form. The array form contains `createdAt: "asc"` but with a preceding
    // bracket, so a negative lookahead-style match is simulated here by
    // asserting the exact single-key form is absent.
    expect(src).not.toMatch(/orderBy:\s*\{\s*createdAt:\s*"asc"\s*\}/);
  });
});
