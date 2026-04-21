/**
 * HDMO-02 — Demo guard audit.
 *
 * Static regression gate: every exported async function in
 * `src/features/**\/actions.ts` must contain the literal `session.user.isDemo`.
 * A `SKIP_FUNCTIONS` allowlist captures the 4 functions that are legitimately
 * guard-free (demo entry point, pre-auth register, read-only paginators).
 *
 * Any future phase (Phase 8 snooze onward) that adds a mutating Server Action
 * without the guard fails this test. The test does NOT import from src/ —
 * it reads source files as text (Pitfall 4 / RESEARCH.md §Anti-Patterns).
 *
 * Mirrors the static-audit idiom from tests/phase-06/links-audit.test.ts.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Function names that are legitimately guard-free.
 * - startDemoSession: demo entry point itself (creates the demo session)
 * - registerUser: pre-auth (no session.user to check)
 * - loadMoreWateringHistory / loadMoreTimeline: read-only paginators
 *
 * Keyed by function name, NOT by file path (Pitfall 6): file-level exclusion
 * would let future mutating additions in watering/notes/demo slip past.
 */
const SKIP_FUNCTIONS = new Set<string>([
  "startDemoSession",
  "registerUser",
  "loadMoreWateringHistory",
  "loadMoreTimeline",
]);

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

/**
 * Extract every `export async function <name>(...) { ... }` from source text.
 *
 * Finds the closing `)` of the parameter list by tracking paren depth, then
 * finds the function body `{` after that closing `)`. This correctly handles
 * TypeScript inline parameter type literals such as `data: { email: string }`,
 * which would otherwise be mistaken for the function body if we searched for
 * the first `{` after the function name.
 *
 * Tracks brace depth from the opening body `{` so nested blocks (if/for/try)
 * don't prematurely close the extraction.
 */
function extractFunctionBodies(
  src: string,
): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  // The regex ends with \s*\( so m[0] ends at the opening paren of the param list
  const funcRegex = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = funcRegex.exec(src)) !== null) {
    const name = m[1];
    // Position of the opening ( of the parameter list (last char of m[0])
    const openParen = m.index + m[0].length - 1;

    // Track paren depth to find the matching closing )
    let parenDepth = 0;
    let i = openParen;
    while (i < src.length) {
      if (src[i] === "(") parenDepth++;
      else if (src[i] === ")") {
        parenDepth--;
        if (parenDepth === 0) break;
      }
      i++;
    }
    // i is now at the closing ) of the parameter list.
    // Find the first { after the closing ) — skipping return type annotations.
    let openBrace = -1;
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === "{") {
        openBrace = j;
        break;
      }
      // Stop if we hit another export keyword (safety net for malformed source)
      if (src.slice(j, j + 6) === "export") break;
    }
    if (openBrace === -1) continue;

    // Track brace depth from the opening { of the function body
    let depth = 0;
    let k = openBrace;
    while (k < src.length) {
      if (src[k] === "{") depth++;
      else if (src[k] === "}") {
        depth--;
        if (depth === 0) break;
      }
      k++;
    }
    results.push({ name, body: src.slice(openBrace, k + 1) });
  }
  return results;
}

describe("HDMO-02 — demo guard audit", () => {
  test("Every exported async function in features/**/actions.ts contains session.user.isDemo", () => {
    const featuresRoot = "src/features";
    const actionFiles = walk(featuresRoot).filter((f) =>
      f.replace(/\\/g, "/").endsWith("/actions.ts"),
    );

    // Sanity check: we expect to find the 8 action files catalogued in
    // RESEARCH.md §Guard Audit Baseline. Fewer files means the walk is broken;
    // more files means a new surface was added and should be reviewed.
    expect(actionFiles.length).toBeGreaterThanOrEqual(8);

    const offenders: Array<{ file: string; functionName: string }> = [];

    for (const file of actionFiles) {
      const src = readFileSync(file, "utf8");
      const functions = extractFunctionBodies(src);
      for (const { name, body } of functions) {
        if (SKIP_FUNCTIONS.has(name)) continue;
        if (!body.includes("session.user.isDemo")) {
          offenders.push({ file, functionName: name });
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file} :: ${o.functionName}`)
        .join("\n");
      throw new Error(
        `HDMO-02 violations — missing \`session.user.isDemo\` guard:\n${report}\n\n` +
          `If one of these is legitimately guard-free, add it to SKIP_FUNCTIONS in this test file and justify in the PR description.`,
      );
    }
    expect(offenders.length).toBe(0);
  });
});
