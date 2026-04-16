---
phase: 01-scaffold-and-foundations
plan: 02
subsystem: auth
tags: [nextauth, jwt, credentials, proxy, route-protection]
dependency_graph:
  requires: [01-01]
  provides: [auth-config, route-protection, nextauth-handler]
  affects: [all-protected-routes, login-flow, register-flow]
tech_stack:
  added: [next-auth@beta, bcryptjs, zod/v4]
  patterns: [nextauth-split-config, jwt-sessions, proxy-ts-route-protection]
key_files:
  created:
    - auth.config.ts
    - auth.ts
    - proxy.ts
    - src/app/api/auth/[...nextauth]/route.ts
  modified: []
decisions:
  - "Used relative imports (./auth, ../../../../../auth) instead of @/auth because tsconfig @/* maps to ./src/* and auth.ts lives at project root"
  - "proxy.ts uses ./auth relative import — must stay in sync with auth.ts location at project root"
metrics:
  duration: "1m 22s"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 1 Plan 2: NextAuth v5 Auth Configuration Summary

**One-liner:** NextAuth v5 Credentials/JWT auth with edge-safe split config and proxy.ts route protection for /dashboard, /plants, /rooms.

## What Was Built

Configured NextAuth v5 authentication using the split-config pattern required for Next.js 16's edge runtime:

- **auth.config.ts** (edge-safe): JWT strategy, authorized callback protecting /dashboard, /plants, /rooms, and redirecting logged-in users away from /login and /register
- **auth.ts** (Node.js): Credentials provider with Zod v4 input validation, Prisma user lookup, bcryptjs password comparison, exports auth/handlers/signIn/signOut
- **proxy.ts**: Next.js 16 route protection using named `proxy` export (replaces deprecated middleware.ts)
- **src/app/api/auth/[...nextauth]/route.ts**: NextAuth HTTP handler mounting GET/POST

## Tasks

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create NextAuth v5 split config (auth.config.ts + auth.ts) | 69d76ad |
| 2 | Create proxy.ts route protection and NextAuth route handler | f51b6f0 |

## Decisions Made

1. **Relative imports for auth.ts**: The project's tsconfig maps `@/*` to `./src/*`, so `@/auth` would resolve to `src/auth.ts` (non-existent). Since auth.ts is at project root (outside src/), proxy.ts uses `"./auth"` and the route handler uses a relative path `"../../../../../auth"`.

2. **proxy.ts matcher regex**: Pattern `/((?!api|_next/static|_next/image|favicon.ico|login|register).*)` intercepts all routes except excluded prefixes, then the `authorized` callback in auth.config.ts enforces the actual protection logic on /dashboard, /plants, /rooms.

## Security Notes

Threat model mitigations applied:
- **T-02-01**: Zod v4 validates email format and password min-length before any DB access; returns null (not error) on all failure paths to prevent user enumeration
- **T-02-02**: Matcher excludes only specific safe prefixes; authorized callback defaults-closed for protected app routes
- **T-02-03**: Both "user not found" and "wrong password" paths return null — no distinction exposed to caller

## Deviations from Plan

None — plan executed exactly as written. The import path deviation (relative vs @/ alias) was anticipated and documented in the plan's action section.

## Known Stubs

None — this plan contains no UI or data rendering stubs.

## Threat Flags

None — all new surface (auth endpoints, route protection) is within the plan's threat model.

## Self-Check: PASSED

Files verified:
- auth.config.ts: FOUND
- auth.ts: FOUND
- proxy.ts: FOUND
- src/app/api/auth/[...nextauth]/route.ts: FOUND

Commits verified:
- 69d76ad: FOUND
- f51b6f0: FOUND
