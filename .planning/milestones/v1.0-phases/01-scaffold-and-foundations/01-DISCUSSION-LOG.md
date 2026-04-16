# Phase 1: Scaffold and Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 01-Scaffold and Foundations
**Areas discussed:** Project structure

---

## Gray Areas Presented

| Area | Selected |
|------|----------|
| Database schema scope | |
| Project structure | Yes |
| Auth & route protection | |
| Dev environment & seeding | |

---

## Project Structure

### Shared code location

| Option | Description | Selected |
|--------|-------------|----------|
| src/ alongside app/ (Recommended) | app/ for routes only, src/components/, src/lib/, src/hooks/ for shared code. Clean separation of routing from logic. | Yes |
| Everything under app/ | Co-locate components and utils inside app/ route folders. | |
| Top-level directories | components/, lib/, hooks/ at project root next to app/. | |

**User's choice:** src/ alongside app/
**Notes:** None

### Component organization

| Option | Description | Selected |
|--------|-------------|----------|
| Feature-based grouping (Recommended) | src/components/plants/, src/components/dashboard/, src/components/auth/ plus src/components/ui/ for shadcn primitives. | Yes |
| Flat with prefixes | All components in one folder with name prefixes. | |
| Atomic design | atoms/, molecules/, organisms/ hierarchy. | |

**User's choice:** Feature-based grouping
**Notes:** None

### Route group organization

| Option | Description | Selected |
|--------|-------------|----------|
| Auth group + main group (Recommended) | app/(auth)/ for public auth pages, app/(main)/ for protected pages. Separate layouts per group. | Yes |
| Flat routes | No grouping, one root layout for everything. | |
| You decide | Claude picks during planning. | |

**User's choice:** Auth group + main group
**Notes:** None

### Server-side code organization

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located with features (Recommended) | src/features/plants/actions.ts, queries.ts, schema.ts — each feature owns its server logic. | Yes |
| Centralized by type | src/actions/, src/queries/, src/schemas/ — grouped by type. | |
| You decide | Claude picks during planning. | |

**User's choice:** Co-located with features
**Notes:** None

---

## Claude's Discretion

- Database schema scope (user chose not to discuss)
- Auth & route protection details (user chose not to discuss)
- Dev environment & seeding (user chose not to discuss)
- Path aliases, barrel exports, naming conventions

## Deferred Ideas

None
