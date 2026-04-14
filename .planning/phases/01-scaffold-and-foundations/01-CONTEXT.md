# Phase 1: Scaffold and Foundations - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A working Next.js 16 project exists with the correct foundational decisions baked in — schema, Prisma singleton, auth config, proxy.ts middleware, and test harness — so nothing needs to be retrofitted. This phase is pure infrastructure; no user-facing features are delivered.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **D-01:** `src/` directory alongside `app/` — `app/` contains routes only, all shared code lives in `src/components/`, `src/lib/`, `src/hooks/`
- **D-02:** Feature-based component grouping — `src/components/plants/`, `src/components/dashboard/`, `src/components/auth/`, plus `src/components/ui/` for shadcn/ui primitives
- **D-03:** Route groups separate auth from main app — `app/(auth)/login`, `app/(auth)/register` for public auth pages; `app/(main)/dashboard`, `app/(main)/plants` for protected pages, each group with its own layout
- **D-04:** Server-side code co-located by feature — `src/features/plants/actions.ts`, `src/features/plants/queries.ts`, `src/features/plants/schema.ts` (each domain owns its server logic, queries, and Zod schemas)

### Claude's Discretion
- Database schema scope — how much of the full data model to define in Phase 1 vs later phases
- Auth & route protection details — proxy.ts configuration, session strategy, protected route patterns
- Dev environment setup — Docker Compose vs local PostgreSQL, seed script approach
- Path aliases, barrel export conventions, naming patterns
- Test harness configuration details (Vitest + Playwright setup)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in the following project files:

### Project context
- `.planning/PROJECT.md` — Project vision, constraints, tech stack, UX direction, data model entities
- `.planning/REQUIREMENTS.md` — Full v1 requirement list; Phase 1 has no user-facing requirements (infrastructure only)
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 items: dev server, Prisma schema, singleton, NextAuth config, test harness)

### Tech stack (from CLAUDE.md)
- `CLAUDE.md` §Technology Stack — Pinned versions: Next.js 16.2.2, React 19.2, TypeScript 6.0, Tailwind CSS 4.x, Prisma 7.7.0, NextAuth v5 beta, Zod v4, Vitest 4.1.4, Playwright 1.59.1
- `CLAUDE.md` §What NOT to Use — Explicit exclusions: no middleware.ts (use proxy.ts), no tailwind.config.js (use CSS @theme), no Zod v3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no source code exists yet

### Established Patterns
- None — this phase establishes the patterns all subsequent phases follow

### Integration Points
- This phase creates the foundation that Phase 2 (Authentication and Onboarding) builds on directly
- Prisma schema and singleton must support all 7 data model entities (User, Plant, Room, WateringLog, HealthLog, CareProfile, Reminder)
- NextAuth config must be ready for Phase 2 to add login/register UI
- Route group structure must accommodate both public (auth) and protected (main) page sets

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scaffold-and-foundations*
*Context gathered: 2026-04-13*
