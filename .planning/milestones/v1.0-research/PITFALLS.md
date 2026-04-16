# Pitfalls Research

**Domain:** Indoor plant care / watering tracking web app (Plant Minder)
**Researched:** 2026-04-13
**Confidence:** HIGH (domain-specific pitfalls drawn from competitor app reviews, Next.js App Router official docs, Prisma production guides, timezone best practices)

---

## Critical Pitfalls

### Pitfall 1: Timezone-Naive Date Storage Breaks Overdue Logic

**What goes wrong:**
Watering log timestamps stored as plain `TIMESTAMP` (without timezone) or as `DATE` strings produce incorrect "overdue" and "next watering" calculations for users in non-server timezones. A user in UTC-5 who waters at 11pm their time gets a log stored as 4am UTC the next day — their plant immediately appears one day behind schedule. Conversely, a user who logs at midnight their local time may see their water event shifted to the "wrong" calendar day entirely. Real-world apps have shipped bugs where the app thought the date was 6 days earlier than actual, preventing correct entry of watering dates.

**Why it happens:**
Developers think in local time during development, store naive timestamps, and discover the bug only when a user in a different timezone reports that their schedule is wrong. The `DATE` type in PostgreSQL drops timezone context entirely; `TIMESTAMP` (no TZ) doesn't convert on retrieval.

**How to avoid:**
- Always use `TIMESTAMPTZ` (timestamp with time zone) in PostgreSQL — Prisma maps this to `DateTime` by default, which stores UTC internally.
- Store all watering log timestamps as UTC `DateTime` in Prisma, never bare dates.
- When computing "due today" on the server, pass the user's local date from the client (via a query param or header) rather than using `new Date()` server-side which reads server timezone.
- "Next watering date" computations should be done by adding the interval in calendar days from the perspective of the user's local timezone, not UTC midnight.
- On the front end, format dates with the browser's `Intl.DateTimeFormat` or date-fns `format` with an explicit timezone.

**Warning signs:**
- Dashboard "due today" list differs from user expectation by exactly one day.
- Users in UTC-5 through UTC-12 report plants always show as overdue despite fresh watering.
- Integration tests pass locally (UTC dev machine) but fail in CI with a different TZ environment variable.

**Phase to address:** Core data model phase (before any watering log UI ships). Prisma schema should use `DateTime` for every timestamp field from day one.

---

### Pitfall 2: Watering Interval Resets After Retroactive Logs Produce Wrong Schedule

**What goes wrong:**
When a user adds a retroactive watering log ("I actually watered this on Tuesday, not today"), the "next watering" date recalculates from that past date, often placing it in the past immediately — causing the plant to show as overdue the moment the user logs the retroactive event. Duplicate watering logs on the same day also artificially shift the schedule.

**Why it happens:**
The naive implementation computes `nextWatering = lastLog.createdAt + intervalDays`. When `lastLog.createdAt` is in the past, `nextWatering` is in the past too. No deduplication guard exists for multiple same-day logs.

**How to avoid:**
- Distinguish `wateredAt` (the actual moment the user says they watered, which may be in the past) from `loggedAt` (when the record was created in the DB). Use `wateredAt` for schedule calculations.
- When displaying "next watering," always use `MAX(wateredAt)` for a plant, not the latest inserted row, to handle retroactive inserts correctly.
- Cap retroactive dates: reject logs dated more than 90 days in the past (or warn and require confirmation). Log entries in the future beyond today should be blocked entirely.
- Debounce the "log watering" button for 3–5 seconds and offer a brief undo window to prevent accidental duplicate taps (a documented bug in Planta where marking a task launches a spinning state but doesn't persist).
- Add a DB-level constraint or application-level check to prevent two logs for the same plant within a configurable minimum interval (e.g., 4 hours).

**Warning signs:**
- A plant flips back to "overdue" immediately after logging because the user accidentally chose yesterday.
- Two taps on the watering button within 2 seconds create two log rows.
- Users report "I just watered it but it still shows overdue."

**Phase to address:** Watering log feature phase. Write integration tests covering retroactive logs, same-day duplicate logs, and interval-change scenarios before shipping this feature.

---

### Pitfall 3: NextAuth.js Credentials Provider with Database Sessions Doesn't Work

**What goes wrong:**
The project uses NextAuth.js with email/password (credentials provider). If the session strategy is set to `database` (default for OAuth flows), credentials-based login silently fails to persist sessions. Users can log in but the session is never written to the DB; `getServerSession()` returns null on subsequent requests.

**Why it happens:**
NextAuth.js explicitly documents that the credentials provider only supports the `jwt` session strategy, not `database` sessions. Developers familiar with OAuth setups assume database sessions work universally. This is a systemic known issue with multiple open GitHub issues as of 2025.

**How to avoid:**
- Set `session: { strategy: "jwt" }` explicitly in `next-auth` options when using the credentials provider. Never rely on the default.
- Store only non-sensitive user identifiers (userId, email) in the JWT payload — do not put the full user object.
- Set `NEXTAUTH_SECRET` as a 32-byte random string in all environments. Missing this in production causes cryptic session failures.
- Be aware JWT sessions cannot be remotely invalidated before expiry. For "sign out all devices," you need a token blocklist or short JWT expiry (15–30 minutes) plus a refresh mechanism.
- The 4KB cookie size limit can silently truncate large JWT payloads. Keep the JWT lean.

**Warning signs:**
- `getServerSession()` returns null inside server components despite successful login.
- Users are logged out on every page refresh.
- Session works in dev but not in production (usually missing `NEXTAUTH_SECRET`).
- Console shows `[next-auth][error][JWT_SESSION_ERROR]` in logs.

**Phase to address:** Authentication phase (must be correct before building any feature that requires a logged-in user). Write a server-side test that confirms `getServerSession()` returns a valid user after credentials login.

---

### Pitfall 4: Dashboard Stale After Watering — Forgetting Cache Revalidation in Server Actions

**What goes wrong:**
User taps "Log watering" on the dashboard. The server action runs, inserts the WateringLog row, returns success — but the dashboard still shows the plant as "overdue." The Next.js App Router has cached the page; without explicit revalidation the user sees stale data until the next manual refresh. This is a top-reported UX frustration in competitor apps ("I just watered it but it still shows the old status").

**Why it happens:**
The Next.js App Router aggressively caches route segments. Server actions that mutate data must call `revalidatePath()` or `revalidateTag()` to bust the cache. Developers often test mutations in development where caching is lighter and miss this in production.

**How to avoid:**
- Every server action that mutates plant data (watering log, plant edit, room change) must call `revalidatePath('/dashboard')` and `revalidatePath('/plants/[id]')` before returning.
- Prefer `revalidateTag()` with semantic cache tags (e.g., `plant-${id}`, `dashboard-plants`) for surgical invalidation rather than revalidating all paths.
- Use `updateTag()` (not `revalidateTag()`) inside server actions for immediate cache expiration (read-your-own-writes) on the current user's session.
- In development, set `const dynamic = 'force-dynamic'` on dashboard pages temporarily during development to confirm correct data; remove before shipping to production.

**Warning signs:**
- Watering log appears in the plant detail history but dashboard urgency list hasn't updated.
- Only a hard browser refresh reflects the new watering state.
- Works fine in local dev (`next dev`) but breaks in deployed build (`next build && next start`).

**Phase to address:** Dashboard and watering log feature phase. Add an end-to-end test (Playwright) that verifies the plant leaves the "overdue" column immediately after the log action.

---

### Pitfall 5: Prisma Client Instantiation Causes Connection Pool Exhaustion in Development

**What goes wrong:**
During development, Next.js hot reload creates a new Prisma Client instance on every file save. Each instance holds its own connection pool. After a few saves the database hits "too many connections" and queries start failing. This manifests as intermittent 500 errors during development that go away on server restart.

**Why it happens:**
The natural pattern of `const prisma = new PrismaClient()` inside a module gets re-executed on hot reload. Unlike production (single process), dev mode re-runs module initialization repeatedly.

**How to avoid:**
- Use the official Next.js + Prisma singleton pattern from day one:
  ```typescript
  // lib/prisma.ts
  import { PrismaClient } from '@prisma/client'
  const globalForPrisma = global as unknown as { prisma: PrismaClient }
  export const prisma = globalForPrisma.prisma ?? new PrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  ```
- Never call `new PrismaClient()` outside `lib/prisma.ts`.
- In production serverless environments, set `connection_limit=1` in the Prisma connection string to prevent exhaustion across function invocations.
- Never call `prisma.$disconnect()` inside request handlers — only on process shutdown.

**Warning signs:**
- `Error: Can't reach database server` only after several file saves in dev.
- Database `pg_stat_activity` shows many idle connections from `node` processes.
- Errors stop after `ctrl+c` + restart of the dev server.

**Phase to address:** Project scaffolding / data layer setup phase. The singleton should be in the initial scaffold commit, not retrofitted.

---

### Pitfall 6: Guest/Demo Mode Data Bleeds Into Real User Data

**What goes wrong:**
The demo mode shows pre-loaded sample plants to anonymous visitors. If demo data is stored in a shared demo user account in the production database (not isolated), and if the server action for "log watering" doesn't enforce ownership checks, a crafted request from a guest session could mutate another user's plant data or accumulate unbounded demo logs that grow the database indefinitely.

**Why it happens:**
Demo mode is often bolted on at the end as an afterthought. Developers verify it works visually but don't threat-model the authorization boundary. Guest sessions use the same server actions as authenticated users but without ownership verification.

**How to avoid:**
- Demo mode should serve read-only seed data from a static JSON file or a completely separate read-only database query, not through a shared live demo user account in production.
- Alternatively: create ephemeral in-memory demo state per visitor session (no DB writes) — plant data is pre-seeded from constants, "watering" updates only session state, lost on tab close.
- All server actions that write to the database must verify `session.user.id === plant.userId` before committing — never trust client-supplied plant IDs without ownership check.
- Add middleware that blocks non-GET requests from unauthenticated (guest) sessions to mutation routes.

**Warning signs:**
- Demo watering logs accumulate in the database over time (growing `WateringLog` table with no userId or a shared demo userId).
- Guest session can POST to `/api/plants/[id]/water` without a valid auth session.
- Any server action uses `plantId` from request body without a `where: { id: plantId, userId: session.user.id }` Prisma filter.

**Phase to address:** Demo mode implementation phase and auth/security review phase. Authorization ownership checks should be in the server actions from the start, not added as a security patch.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing timestamps as bare `DATE` or local `TIMESTAMP` | Simpler Prisma schema, no TZ logic | Broken schedules for users outside server timezone; hard to migrate existing rows | Never |
| Skipping `revalidatePath()` in server actions | Faster to code | Stale dashboard after mutations; user confusion; requires cache busting retrofit | Never |
| `new PrismaClient()` outside singleton | Simpler code | Connection pool exhaustion in dev; connection leak in serverless | Never in app code |
| Hardcoding `new Date()` on server for "today" date | Trivial implementation | Wrong "due today" for users in UTC-offset timezones | Only if all users guaranteed to be in server timezone |
| Demo mode writing to shared DB user | Works end-to-end fast | Unbounded log growth; authorization boundary risk | Only acceptable in staging, never production |
| Skipping ownership checks in server actions | Faster action code | Any user can mutate any plant if they know the ID | Never |
| Loading all plants + all logs in one query without pagination | Simple dashboard query | Fails at 100+ plants; slow dashboard for enthusiast users | Only in Phase 1 scaffold; add pagination before v1 ship |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NextAuth.js credentials provider | Defaulting to or switching to `database` session strategy | Explicitly set `session: { strategy: "jwt" }` in NextAuth config |
| NextAuth.js + Prisma adapter | Installing Prisma adapter expecting it to enable database sessions for credentials | Prisma adapter enables user/account table sync for OAuth; credentials still requires JWT strategy |
| Prisma + Next.js App Router | Calling `prisma.$connect()` / `prisma.$disconnect()` per request | Use singleton pattern; Prisma manages its connection pool automatically |
| Zod + Server Actions | Validating only client-side with Zod, skipping server-side re-validation | Always re-validate server action inputs with Zod on the server; client validation is UX-only |
| shadcn/ui `asChild` prop | Wrapping a `div` instead of a focusable element, breaking keyboard navigation | `asChild` child must be `button`, `a`, or `input`; must spread props and forward ref |
| shadcn/ui Select component | Assuming Tab key cycles through options like a native `<select>` | Radix Select uses arrow keys, not Tab, for option navigation — document this in UI if needed |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full watering history for all plants on dashboard render | Dashboard slow with 20+ plants each having 100+ log entries | Fetch only `lastWateredAt` (max log per plant) for the dashboard summary; load full history only on the plant detail page | ~15 plants x 50 logs = noticeable lag |
| N+1 queries: fetching each plant's last log individually | Proportionally slow dashboard; one DB query per plant | Use Prisma `include: { wateringLogs: { take: 1, orderBy: { wateredAt: 'desc' } } }` or a raw SQL `DISTINCT ON` query | Starts hurting at 10+ plants |
| No database index on `wateringLogs.plantId` + `wateredAt` | "Due today" query scans full log table | Add composite index `(plantId, wateredAt DESC)` in Prisma schema at migration time | ~1000 log rows |
| Re-computing `nextWatering` on every dashboard render | CPU spike on each page load for large collections | Persist `nextWateringDate` as a computed column updated after each log write (denormalization is acceptable here) | 50+ plants with frequent refreshes |
| No pagination on plant list | Room view with 50+ plants crashes or OOMs browser | Default `take: 20` with cursor pagination from the start; add virtualization for very large collections | ~100 plants in a single list |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Server actions that accept `plantId` from client without ownership verification | Any authenticated user can water/delete another user's plant if they know the ID (IDOR) | Always use `prisma.plant.findFirst({ where: { id: plantId, userId: session.user.id } })` before mutation |
| Exposing full Prisma model objects in client components (including `passwordHash` or other sensitive user fields) | Data leakage to browser | Use `select` in Prisma queries to return only the fields needed; never pass raw DB rows to client components |
| Missing `NEXTAUTH_SECRET` in production environment | Sessions fail to encrypt/decrypt; login broken; potential JWT forgery | Document required environment variables; validate presence at app startup |
| Allowing watering logs with `plantId` belonging to another user | Cross-user data corruption | Ownership check on every write mutation, not just read |
| Demo mode served from authenticated server actions without guest session checks | Guest can trigger write mutations if demo uses real server action paths | Separate demo data from live data; block mutation server actions for unauthenticated sessions at middleware level |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Guilt-heavy overdue language ("Your plant is DYING!" or red skull icons) | Users feel anxious and avoid opening the app; churn | Use calm, neutral language ("Needs water today", soft amber/green status colors); the PROJECT.md explicitly calls out "avoid guilt-heavy language" |
| No undo or debounce on "Log watering" button | Accidental double-taps create phantom logs that shift the schedule by an interval | 3-second undo toast after logging; debounce the button; show confirmation count if second log is within 4 hours |
| Opaque "next watering" date with no explanation | Users don't trust the date, re-enter it manually | Show "Next watering: April 18 (in 5 days, based on your 14-day schedule)" so the logic is transparent |
| Onboarding asks too many questions before showing value | Users bounce before adding first plant | Minimal onboarding (plant count + reminder pref per PROJECT.md), then immediately to "Add your first plant" — demo mode lets them explore before committing |
| Dashboard sorted alphabetically or by recency instead of urgency | Users miss overdue plants buried in the list | Sort by urgency: Overdue first, then Due Today, then Upcoming — this is already specified in PROJECT.md but easy to implement wrong |
| Plant deletion without archiving | Users lose all care history for a plant they removed accidentally | Soft-delete / archive by default, hard delete requires second confirmation; show history for archived plants |
| Changing watering interval after history exists with no explanation | Schedule feels broken; user distrust | When interval changes, show "Your next watering date will recalculate from your last log" confirmation |
| "Unknown" plant species leaves care profile blank | Users with unidentified plants have no defaults, see empty fields | Provide a sensible "Unknown plant" default care profile (medium water, weekly interval) that users can adjust |

---

## "Looks Done But Isn't" Checklist

- [ ] **Watering log action:** Verify `revalidatePath('/dashboard')` fires after every log — check that the plant card updates without manual refresh
- [ ] **"Due today" logic:** Verify it uses the user's local date, not the server's UTC date — test with a browser set to UTC-8 timezone
- [ ] **NextAuth session:** Verify `getServerSession()` returns a valid user inside a protected server component — not just on the client with `useSession()`
- [ ] **Ownership checks:** Verify every server action checks `userId === plant.userId` — test by calling the action with a valid session but a plantId belonging to another user
- [ ] **Retroactive logs:** Verify adding a log dated 7 days ago doesn't immediately mark the plant as overdue — check `nextWateringDate` recalculation
- [ ] **Demo mode write isolation:** Verify an unauthenticated browser session cannot POST to any mutation route — check middleware blocks guest write requests
- [ ] **Prisma singleton:** Verify only one PrismaClient instance exists — check that hot reload in dev doesn't cause "too many connections" after 10 file saves
- [ ] **Archived plants:** Verify archived plants don't appear on the dashboard "due today" or "overdue" lists — check both the query filter and any cached views
- [ ] **Duplicate log guard:** Verify two rapid taps on "Log watering" don't create two WateringLog rows — check debounce and/or DB constraint
- [ ] **shadcn/ui keyboard navigation:** Verify all plant actions (add, edit, archive, delete, water) are reachable and operable via keyboard alone

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Timezone-naive dates in prod DB | HIGH | Data migration script to convert all `TIMESTAMP` to `TIMESTAMPTZ` UTC; regression-test all schedule calculations; communicate to users that dates may shift by ±1 day |
| Missing cache revalidation (stale dashboard) | LOW | Add `revalidatePath()` calls to server actions; deploy; cache busts on next mutation |
| NextAuth JWT vs database session misconfiguration | MEDIUM | Update `session: { strategy: "jwt" }` in config; existing sessions invalidated on deploy (users re-login once) |
| Prisma connection pool exhaustion | LOW | Add singleton pattern; restart dev server; no data loss |
| IDOR vulnerability (missing ownership checks) | HIGH | Audit all server actions; add ownership filters; rotate any API secrets; assess if any cross-user data was accessed |
| Demo mode wrote logs to production DB | MEDIUM | Delete demo user's log rows; add migration guard; switch demo to static/session-only data |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Timezone-naive date storage | Phase 1: Data model / Prisma schema setup | Integration test: insert log at midnight UTC-8, verify `nextWateringDate` is in user's local calendar day |
| Watering log retroactive/duplicate issues | Phase 2: Watering log feature | Integration tests for retroactive log, same-day duplicate, rapid double-tap |
| NextAuth credentials JWT strategy | Phase 1: Authentication setup | Server-side test: `getServerSession()` returns user after credentials login |
| Stale dashboard after mutations | Phase 2: Dashboard + logging feature | Playwright E2E: log watering, verify dashboard updates without reload |
| Prisma connection pool exhaustion | Phase 0: Project scaffold | Dev smoke test: 20 hot reloads, verify no "too many connections" errors |
| Demo mode data isolation | Phase 3: Demo mode implementation | Security test: unauthenticated POST to mutation route returns 401/403 |
| Missing ownership checks (IDOR) | Phase 1: Authentication + data layer | Security test: authenticated user A attempts to mutate user B's plant via server action |
| Guilt-heavy UX language | Phase 2: Dashboard UI | Design review checklist: audit all status labels and empty states for shame language |
| Dashboard performance (N+1, no pagination) | Phase 2: Dashboard + Phase 4: Polish | Load test with 100 plants; verify dashboard load < 500ms |

---

## Sources

- Competitor app reviews (Planta, Greg, PlantIn, Plant Daddy, PlantPal): App Store, justuseapp.com, Jane Perrone blog (2023)
- NextAuth.js credentials provider official docs: https://next-auth.js.org/providers/credentials
- NextAuth GitHub issues #12858, #3970 (database session + credentials incompatibility)
- Clerk article on NextAuth session persistence: https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues
- Vercel official: Common mistakes with Next.js App Router: https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them
- Prisma production pitfalls (DEV Community): https://dev.to/whoffagents/prisma-in-production-patterns-and-pitfalls-after-a-dozen-projects-2ep8
- Prisma + Next.js connection leak guide: https://eastondev.com/blog/en/posts/dev/20251220-nextjs-prisma-complete-guide/
- PostgreSQL timestamp best practices: https://www.tinybird.co/blog/database-timestamps-timezones
- DEV Community timezone bug article: https://dev.to/kcsujeet/how-to-handle-date-and-time-correctly-to-avoid-timezone-bugs-4o03
- shadcn/ui accessibility customization: https://eastondev.com/blog/en/posts/dev/20260330-shadcn-radix-accessibility/
- Radix UI Select keyboard navigation issue: https://github.com/shadcn-ui/ui/discussions/6534
- UX abandonment patterns (NN/G, UXmatters): https://www.uxmatters.com/mt/archives/2025/01/mobile-ux-design-patterns-and-their-impacts-on-user-retention.php
- Next.js security guide: https://nextjs.org/blog/security-nextjs-server-components-actions

---
*Pitfalls research for: Indoor plant care / watering tracking web app (Plant Minder)*
*Researched: 2026-04-13*
