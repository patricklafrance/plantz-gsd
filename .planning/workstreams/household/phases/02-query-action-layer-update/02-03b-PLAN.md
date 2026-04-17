---
phase: 02-query-action-layer-update
plan: 03b
type: execute
wave: 5
depends_on: ["02-03a"]
files_modified:
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/plants/page.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/rooms/page.tsx
  - src/app/(main)/rooms/[id]/page.tsx
autonomous: true
requirements: [HSLD-02, HSLD-03]
tags: [legacy-redirects, route-bridge, nextjs-redirect, bookmark-compatibility]

must_haves:
  truths:
    - "Every legacy route (/dashboard, /plants, /plants/[id], /rooms, /rooms/[id]) replaces its former page.tsx with a redirect stub that resolves session.user.activeHouseholdId → slug and 307-redirects to /h/[slug]/<suffix>"
    - "Legacy stubs handle the WR-01 normalized null/undefined activeHouseholdId gracefully — if the id is missing, redirect to /login"
    - "auth.config.ts:22 post-login landing target remains `/dashboard` — the legacy dashboard stub handles the slug lookup and re-redirect"
    - "Every stub is ≤ 25 lines (thin forwarder)"
  artifacts:
    - path: "src/app/(main)/dashboard/page.tsx"
      provides: "Legacy redirect stub — forwards to /h/[slug]/dashboard"
      contains: "redirect"
      min_lines: 15
    - path: "src/app/(main)/plants/page.tsx"
      provides: "Legacy redirect stub — forwards to /h/[slug]/plants"
    - path: "src/app/(main)/plants/[id]/page.tsx"
      provides: "Legacy dynamic redirect stub — forwards with plant id"
    - path: "src/app/(main)/rooms/page.tsx"
      provides: "Legacy redirect stub — forwards to /h/[slug]/rooms"
    - path: "src/app/(main)/rooms/[id]/page.tsx"
      provides: "Legacy dynamic redirect stub — forwards with room id"
  key_links:
    - from: "src/app/(main)/dashboard/page.tsx"
      to: "session.user.activeHouseholdId + db.household.findUnique"
      via: "slug lookup then redirect"
      pattern: "activeHouseholdId|redirect\\(\\`/h/"
    - from: "auth.config.ts:22"
      to: "src/app/(main)/dashboard/page.tsx"
      via: "post-login landing stays /dashboard; stub handles slug resolution"
      pattern: "/dashboard"
---

<objective>
Replace the 5 legacy route files (`src/app/(main)/{dashboard,plants,plants/[id],rooms,rooms/[id]}/page.tsx`) with thin redirect stubs that forward to `/h/[householdSlug]/...` via `session.user.activeHouseholdId` → slug lookup. This plan preserves bookmark-compatibility with v1 URLs and ensures the `auth.config.ts` post-login landing (`/dashboard`) still works without JWT-slug changes.

Purpose: After Plan 03a, the new `/h/[slug]/` routes exist but old `/dashboard`, `/plants`, etc. still render the pre-move code — which now fails to compile because it expects `userId` args that Plan 04 + Plan 05 removed. This plan replaces those files with forwarders so the build compiles and bookmarks continue to work.

Output: 5 legacy stub files, each ≤ 25 lines. No new features; pure routing bridge.
</objective>

<execution_context>
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/workflows/execute-plan.md
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/household/STATE.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-RESEARCH.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-UI-SPEC.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-01-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-03a-PLAN.md
@CLAUDE.md

# Source files the executor MUST read before editing
@src/app/(main)/dashboard/page.tsx
@src/app/(main)/plants/page.tsx
@src/app/(main)/plants/[id]/page.tsx
@src/app/(main)/rooms/page.tsx
@src/app/(main)/rooms/[id]/page.tsx
@auth.ts
@auth.config.ts

<interfaces>
<!-- Canonical stub pattern from RESEARCH §Code Examples "Legacy redirect stub" -->

```typescript
import { auth } from "../../../../auth";      // depth-dependent relative path
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

/**
 * Legacy redirect stub (D-02, Q3) — bookmark-compatibility bridge.
 * Resolves the user's active household slug and re-redirects to
 * /h/[slug]/<suffix>. Falls back to /login if session is missing or
 * activeHouseholdId is null/undefined (WR-01 closed by Plan 01 normalization).
 */
export default async function LegacyDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = session.user.activeHouseholdId;
  if (!id) redirect("/login");

  const household = await db.household.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!household) redirect("/login");

  redirect(`/h/${household.slug}/dashboard`);
}
```

**Import path depth table** (relative to the file location — `auth.ts` lives at repo root):

| File | Path to auth.ts |
|------|-----------------|
| `src/app/(main)/dashboard/page.tsx` | `../../../../auth` (4 levels up: dashboard → (main) → app → src → root) |
| `src/app/(main)/plants/page.tsx` | `../../../../auth` |
| `src/app/(main)/plants/[id]/page.tsx` | `../../../../../auth` (5 levels — one more for `[id]`) |
| `src/app/(main)/rooms/page.tsx` | `../../../../auth` |
| `src/app/(main)/rooms/[id]/page.tsx` | `../../../../../auth` |

Verify the depth against the ORIGINAL file's import before writing — if the current file uses a different convention (e.g., `@/lib/auth` alias), match that. The `@/lib/db` alias is stable and should be used uniformly.

**auth.config.ts:22 decision (per W-6):**

The file currently has `Response.redirect(new URL("/dashboard", nextUrl))` in the `authorized` callback. This plan does NOT change that line — it remains `/dashboard`. The legacy `/dashboard/page.tsx` stub handles the slug resolution + re-redirect. Acceptance criterion below enforces this.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace 5 legacy pages with redirect stubs; verify auth.config.ts landing target unchanged</name>
  <files>src/app/(main)/dashboard/page.tsx, src/app/(main)/plants/page.tsx, src/app/(main)/plants/[id]/page.tsx, src/app/(main)/rooms/page.tsx, src/app/(main)/rooms/[id]/page.tsx</files>
  <read_first>
    - src/app/(main)/dashboard/page.tsx (current — read to confirm import patterns + identify any hidden redirects)
    - src/app/(main)/plants/page.tsx (current)
    - src/app/(main)/plants/[id]/page.tsx (current)
    - src/app/(main)/rooms/page.tsx (current)
    - src/app/(main)/rooms/[id]/page.tsx (current)
    - auth.ts (confirm activeHouseholdId narrowing is in place from Plan 01 — `typeof token.activeHouseholdId === "string" ? ... : undefined`)
    - auth.config.ts (confirm line 22 has `Response.redirect(new URL("/dashboard", nextUrl))`)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-RESEARCH.md §Code Examples "Legacy redirect stub"
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-UI-SPEC.md §Legacy redirect stubs
  </read_first>
  <action>
    Step 1 — Replace `src/app/(main)/dashboard/page.tsx` with the following EXACT content (adjust the `auth` import path if the current file uses a different convention — read it before writing):

    ```typescript
    import { auth } from "../../../../auth";
    import { db } from "@/lib/db";
    import { redirect } from "next/navigation";

    /**
     * Legacy redirect stub (D-02) — bookmark-compatibility bridge.
     * Resolves the user's active household slug and re-redirects to
     * /h/[slug]/dashboard. Falls back to /login if session is missing or
     * activeHouseholdId is null/undefined (WR-01 closed by Plan 01).
     *
     * This stub is also the post-login landing target — auth.config.ts:22
     * redirects to /dashboard, and this file forwards to the household-scoped
     * dashboard. Keeping that indirection here (rather than adding slug to JWT)
     * avoids an edge-runtime DB call in the Auth.js authorized callback.
     */
    export default async function LegacyDashboard() {
      const session = await auth();
      if (!session?.user?.id) redirect("/login");

      const id = session.user.activeHouseholdId;
      if (!id) redirect("/login");

      const household = await db.household.findUnique({
        where: { id },
        select: { slug: true },
      });
      if (!household) redirect("/login");

      redirect(`/h/${household.slug}/dashboard`);
    }
    ```

    Step 2 — Replace `src/app/(main)/plants/page.tsx`:

    ```typescript
    import { auth } from "../../../../auth";
    import { db } from "@/lib/db";
    import { redirect } from "next/navigation";

    export default async function LegacyPlants() {
      const session = await auth();
      if (!session?.user?.id) redirect("/login");

      const id = session.user.activeHouseholdId;
      if (!id) redirect("/login");

      const household = await db.household.findUnique({
        where: { id },
        select: { slug: true },
      });
      if (!household) redirect("/login");

      redirect(`/h/${household.slug}/plants`);
    }
    ```

    Step 3 — Replace `src/app/(main)/plants/[id]/page.tsx` (one extra level deep → different relative path for `auth`):

    ```typescript
    import { auth } from "../../../../../auth";
    import { db } from "@/lib/db";
    import { redirect } from "next/navigation";

    export default async function LegacyPlantDetail({
      params,
    }: {
      params: Promise<{ id: string }>;
    }) {
      const session = await auth();
      if (!session?.user?.id) redirect("/login");

      const id = session.user.activeHouseholdId;
      if (!id) redirect("/login");

      const household = await db.household.findUnique({
        where: { id },
        select: { slug: true },
      });
      if (!household) redirect("/login");

      const { id: plantId } = await params;
      redirect(`/h/${household.slug}/plants/${plantId}`);
    }
    ```

    Step 4 — Replace `src/app/(main)/rooms/page.tsx` with the same pattern as Step 2, but redirect suffix `/rooms`.

    Step 5 — Replace `src/app/(main)/rooms/[id]/page.tsx` with the same pattern as Step 3, but redirect suffix `/rooms/${roomId}` where `roomId` is destructured from params.

    Step 6 — Verify `auth.config.ts:22` remains `Response.redirect(new URL("/dashboard", nextUrl))` (or equivalent) — do NOT change it. Grep the file to confirm.

    Step 7 — Run `npx tsc --noEmit 2>&1 | grep "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]\\(dashboard\\|plants\\|rooms\\)"`. Should return zero errors.

    Step 8 — Run `npm run build`. This is the full-build gate. With Plan 03a + 03b combined, the entire route tree compiles — legacy stubs forward, new `/h/[slug]/` pages render. Expected: exit 0.

    Step 9 — Stage all 5 files. Do NOT run `git commit` — notify the developer.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - All 5 legacy files exist at `src/app/(main)/{dashboard,plants,plants/[id],rooms,rooms/[id]}/page.tsx`
    - Each file: grep `redirect\(` returns ≥ 3 matches (no-session, no-activeHouseholdId, success forward)
    - Each file: grep `activeHouseholdId` returns 1 match
    - Each file: grep `db\.household\.findUnique` returns 1 match (slug lookup)
    - Each file: grep `redirect\(\`/h/\$\{household\.slug\}` returns 1 match (forward to household-scoped path)
    - `plants/[id]/page.tsx` and `rooms/[id]/page.tsx`: grep `await params` returns 1 match (forward dynamic id)
    - Each file ≤ 30 lines
    - auth.config.ts grep `Response.redirect.*dashboard` returns ≥ 1 match (post-login landing UNCHANGED)
    - `npx tsc --noEmit` reports zero errors in the 5 legacy stub files
    - `npm run build` exits 0 — combined build of Plan 03a + 03b is green
  </acceptance_criteria>
  <done>5 legacy stubs replace original page.tsx files; auth.config.ts post-login landing unchanged; full build passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Session → activeHouseholdId | Session is server-derived; `activeHouseholdId` is in the JWT (Phase 1 D-13). Stub reads from session.user, not URL — no client-controlled household reference. |
| activeHouseholdId → DB | `findUnique({ where: { id } })` with the session-derived id. Prisma parameterizes; no injection risk. |
| Null/undefined activeHouseholdId → /login | WR-01 narrowing from Plan 01 ensures null collapses to undefined; falsy check handles both. No crash on legacy redirect. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03b-01 | T (Tampering) | Legacy redirect stubs | mitigate | Stubs read `session.user.activeHouseholdId` from the JWT (session-bound), NOT URL params. WR-01 narrowing ensures null handling. DB lookup uses session-derived id. If the JWT id references a deleted household, `findUnique` returns null → `/login` fallback. No tampering surface. |
| T-02-03b-02 | I | Stub errors leak info | accept | `findUnique` returning null causes `redirect("/login")` — the user sees a fresh login screen, not an error message. No information disclosure. |
| T-02-03b-03 | E | Post-login landing loop | mitigate | auth.config.ts `/dashboard` → legacy stub `/dashboard` → `/h/[slug]/dashboard`. Two redirects on login. Not a loop (terminates at the household-scoped route, which renders). If activeHouseholdId is somehow missing on a fresh login, stub redirects to `/login` which then logs the user back in — unusual edge case but not a loop (the session still completes). |
</threat_model>

<verification>
- `npm run build` — Next.js + TypeScript build exits 0
- Manual smoke-test (developer runs, records in SUMMARY):
  - Log in as seeded user → lands on `/dashboard` → forwards to `/h/<slug>/dashboard` (307)
  - Visit `/plants` directly → forwards to `/h/<slug>/plants`
  - Visit `/plants/<id>` directly → forwards to `/h/<slug>/plants/<id>` with id preserved
  - Visit `/rooms/<id>` → forwards to `/h/<slug>/rooms/<id>`
- auth.config.ts:22 unchanged — grep confirms `/dashboard` target preserved
</verification>

<success_criteria>
- 5 legacy stubs replace the former page content; bookmarks continue to work
- `npm run build` clean — Phase 2 route tree is fully build-green (legacy + new tree)
- Post-login flow routes through the legacy dashboard stub → forwards to household-scoped dashboard (no JWT slug field needed)
- WR-01 null/undefined handling exercised by the `if (!id) redirect("/login")` fallback in every stub
</success_criteria>

<output>
After completion, create `.planning/workstreams/household/phases/02-query-action-layer-update/02-03b-SUMMARY.md` including:
- Line count per legacy stub (should all be ≤ 30)
- auth.config.ts:22 verbatim text confirmed unchanged
- Smoke-test result (redirects manually verified?)
- Full-build exit code
- Any deviations (import path differences, etc.)
</output>
</content>
</invoke>