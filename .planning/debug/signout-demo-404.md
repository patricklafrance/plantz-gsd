---
slug: signout-demo-404
status: resolved
trigger: "Sign-out → 'Explore the demo' → 404 'page not found' on first load. Clicking the reload/retry button then lands on the dashboard correctly. Surfaced during Phase 5 UAT. Suspected: demo-session redirect + revalidation race after sign-out; possibly stale cookies or cache entry from the authenticated session."
created: 2026-04-19
updated: 2026-04-19
---

## Symptoms

- **Expected:** Sign-out → clicking "Explore the demo" lands the user directly on the dashboard.
- **Actual:** First click lands on "page not found" (404); clicking the reload button then lands on the dashboard correctly.
- **Error text:** 404 page not found rendered by Next.js. No console error text captured yet.
- **Timeline:** Surfaced during Phase 5 UAT (workstream: household, phase 05-household-notifications). Scope: phase-wide, sign-out + demo flow — not strictly Phase 5 scope.
- **Reproduction:** Sign out from an authenticated session, then click "Explore the demo" from the landing/auth page. Intermittent but observed multiple times by the UAT user.
- **Severity:** major.

## Suspected Area (from UAT notes)

- Demo-session redirect + revalidation race after sign-out.
- Possibly stale cookies or cache entry from the prior authenticated session interfering with the demo-seed-and-redirect flow.
- Check:
  - `src/app/(auth)` sign-out handler — what does it clear, what does it redirect to, does it revalidate?
  - Whatever route "Explore the demo" links to — likely a demo-seed-and-redirect endpoint (Server Action or route handler) that creates/claims a demo session then redirects into `/h/<slug>/dashboard`.
  - NextAuth v5 session cookie clearing behavior + any `proxy.ts` rules that might match the demo path while a stale cookie is still being read.
  - Next.js 16 router cache: if the demo endpoint redirects to a path that was cached for the prior authenticated user, a stale RSC payload may be served with a now-invalid household slug → 404.

Reference context docs:
- `.planning/workstreams/household/phases/05-household-notifications/05-HUMAN-UAT.md` (Gaps section, lines ~218-226)

## Current Focus

- hypothesis: CONFIRMED — stale Next.js client-side router cache + anti-pattern of calling signIn() inside a Server Action from useEffect.
- test: null
- expecting: null
- next_action: null (resolved)
- reasoning_checkpoint: null
- tdd_checkpoint: null

## Evidence

- timestamp: 2026-04-19T00:00:00Z
  type: code-read
  file: src/app/(auth)/demo/page.tsx
  finding: >
    DemoPage was a Client Component that called startDemoSession() inside useEffect.
    startDemoSession() calls NextAuth signIn("credentials", { redirectTo: "/dashboard" })
    which throws NEXT_REDIRECT. The redirect was delivered to the client-side router as a
    soft navigation (router.push). After sign-out, the Next.js in-memory router cache
    (30s TTL, not cleared by signOut) could hold stale entries from the previous session,
    causing the soft-nav redirect chain to resolve to a stale or inaccessible household slug
    → notFound() → "Household not found" / "page not found".

- timestamp: 2026-04-19T00:00:00Z
  type: code-read
  file: proxy.ts
  finding: >
    The proxy matcher already excludes /demo from NextAuth session gating:
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo|join).*)"
    This means /demo can be freely converted to a Route Handler without proxy interaction.

- timestamp: 2026-04-19T00:00:00Z
  type: code-read
  file: src/components/auth/login-form.tsx
  finding: >
    "Explore without signing up" used <Link href="/demo"> — a Next.js soft navigation.
    Soft navigation does NOT clear the in-memory router cache. Hard navigation (<a href>)
    does clear the cache on full page load. This was the entry point of the stale-cache bug.

- timestamp: 2026-04-19T00:00:00Z
  type: pattern-match
  finding: >
    The "reload → dashboard" symptom is the definitive fingerprint of Next.js client-side
    router cache staleness. A browser reload bypasses the in-memory router cache entirely,
    making fresh server requests at every step of the redirect chain.

## Eliminated

- Cookie timing race: signIn sets Set-Cookie in the Server Action response headers, which
  browsers apply before the fetch promise resolves. The cookie IS present when the client
  router makes the follow-up request to /dashboard.
- Server-side DB race: the demo user is created in a transaction before signIn is called.
  The householdMember row is committed and queryable when the JWT callback runs.
- NextAuth JWT staleness: the LegacyDashboardPage has a live DB fallback for activeHouseholdId
  when the JWT hint is stale (WR-03). This path works correctly.

## Resolution

- root_cause: >
    The /demo entry point was a Client Component that invoked startDemoSession() (a Server
    Action that calls NextAuth signIn + redirect) from useEffect. signIn throws NEXT_REDIRECT
    which the framework converts to a client-side router.push() — a soft navigation. After
    sign-out, the Next.js in-memory router cache (default 30s TTL, never cleared by signOut)
    holds stale RSC payloads and redirect entries from the previous authenticated session.
    The soft-navigation redirect chain through /dashboard → /h/[slug]/dashboard resolved
    against this stale cache instead of making fresh server requests, causing the router to
    navigate to an incorrect or inaccessible household slug and rendering a "not found" page.
    On browser reload, all requests are fresh (cache bypassed), so the correct slug is used.
- fix: >
    Two changes:
    1. Deleted src/app/(auth)/demo/page.tsx (Client Component with useEffect anti-pattern).
       Created src/app/(auth)/demo/route.ts — a Route Handler that calls startDemoSession()
       server-side. signIn throws NEXT_REDIRECT which Next.js converts to an HTTP 302 response.
       The browser follows the 302 as a hard navigation, bypassing the client-side router cache
       entirely at every step of the redirect chain.
    2. Changed <Link href="/demo"> to <a href="/demo"> in src/components/auth/login-form.tsx.
       A Route Handler must be reached via hard navigation (browser GET), not soft navigation.
       This also ensures the router cache is cleared before the demo flow begins.
- verification: Type-checks pass for src/ (pre-existing test-file TS errors are unrelated).
- files_changed:
    - src/app/(auth)/demo/page.tsx (deleted)
    - src/app/(auth)/demo/route.ts (created)
    - src/components/auth/login-form.tsx (Link → a for demo entry)
