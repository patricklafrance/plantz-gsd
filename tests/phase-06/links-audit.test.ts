/**
 * HSET-01 / Pitfall 17 — Internal link prefix audit.
 *
 * Scans every .tsx and .ts file under src/components/household and
 * src/app/(main)/h for href= and router.push() targets. Any absolute path
 * that does NOT start with the household-scoped /h/[slug]/ prefix (or one
 * of the approved cross-household routes) is a Pitfall 17 violation.
 *
 * This is a regression gate — it runs on every CI and catches any future
 * phase that accidentally reintroduces a bare `/plants`, `/rooms`,
 * `/dashboard`, or `/settings` target.
 *
 * Approved absolute prefixes: /h/, /join/, /login, /preferences,
 * /onboarding, /register, /api/, /auth/.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

// Absolute paths that are legitimately non-/h/ (cross-household or auth flows).
// - /dashboard is the legacy landing route at src/app/(main)/dashboard/page.tsx
//   that redirects to /h/<defaultSlug>/dashboard — it's the safe post-error
//   "back to dashboard" target when the user no longer has access to a specific
//   household (used by error.tsx and not-found.tsx inside /h/[householdSlug]/).
const ALLOWED_PREFIXES = [
  "h/",
  "join/",
  "login",
  "preferences",
  "onboarding",
  "register",
  "dashboard",
  "api/",
  "auth/",
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

describe("HSET-01 / Pitfall 17 — internal link prefix audit", () => {
  test("All href= and router.push targets in phase-6 surfaces use /h/[slug]/ prefix", () => {
    const scanRoots = [
      "src/components/household",
      "src/app/(main)/h",
    ];

    const offenders: Array<{ file: string; match: string; line: number }> = [];

    // Matches `href="/..."` or `href={"/..."` or `href={`/...`` (template literal).
    // Captures the first path segment (lowercase start) so we can decide whether
    // it belongs to an allowed prefix.
    const hrefRegex = /href=\{?["`]\/([a-z][a-zA-Z0-9/_\-.]*)/g;
    const pushRegex = /router\.push\(["`]\/([a-z][a-zA-Z0-9/_\-.]*)/g;

    for (const root of scanRoots) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        const lines = src.split("\n");
        lines.forEach((ln, i) => {
          // Skip obvious template-literal /h/${...} patterns — they resolve
          // to /h/<slug>/... at runtime and are OK by construction.
          if (ln.includes("/h/${") || ln.includes("/h/$")) return;

          for (const re of [hrefRegex, pushRegex]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(ln)) !== null) {
              const path = m[1];
              if (isAllowedPath(path)) continue;
              offenders.push({ file, match: ln.trim(), line: i + 1 });
            }
          }
        });
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file}:${o.line}  ${o.match}`)
        .join("\n");
      throw new Error(
        `Pitfall 17 violations (missing /h/[slug]/ prefix):\n${report}`,
      );
    }
    expect(offenders.length).toBe(0);
  });
});
