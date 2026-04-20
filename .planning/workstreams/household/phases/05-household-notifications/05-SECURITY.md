---
phase: 05
slug: household-notifications
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-20
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client → Server Action (`markNotificationsRead`) | Untrusted JSON-serialized input from the `useTransition` in `NotificationBell`. | `{ notificationIds: string[], cycleId?: string }` — CUIDs (potentially forged). |
| Server Action → DB (`updateMany`) | Prisma query builder parameterizes SQL; no raw template strings. | Filter: `recipientUserId`, `readAt: null`, `id IN (ids)`. Update: `readAt: now()`. |
| Layout SC → reminders queries | `sessionUser.id` (from `auth()`) passed explicitly; queries do not call `auth()` themselves. | User id (trusted). |
| Dashboard SC → banner components | Props-only Server Components; no client bundle; no URL/cookie path. | Names (already public household metadata), counts, dates. |
| Route Handler `/demo` (WR-adjacent) | Hard 302 for demo sign-in, bypasses router cache. | No user data beyond demo seed. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01-01 | Tampering | Phase 5 schema migration | mitigate | Additive nullable `readAt` column; reviewable migration SQL; no DEFAULT, no data loss. `prisma/migrations/20260419225747_add_household_notification_read_at/migration.sql` | closed |
| T-05-01-02 | Information Disclosure | `readAt` column value | accept | See AR-05-01. | closed |
| T-05-01-03 | Denial of Service | `(recipientUserId, readAt)` index | accept | See AR-05-02. | closed |
| T-05-01-04 | Tampering | `it.todo` test scaffolds | mitigate | All 64 stubs replaced with real assertions; `tests/phase-05/*` 64/64 green. | closed |
| T-05-02-01 | Spoofing | `markNotificationsRead` forged `notificationIds` | mitigate | `z.array(z.cuid()).min(1)` at `schema.ts:185`; `recipientUserId = session.user.id` predicate filters forged ids to zero-count at SQL level (`actions.ts:883`). | closed |
| T-05-02-02 | Tampering | Cross-user write via `markNotificationsRead` | mitigate | `recipientUserId` is read exclusively from session at `actions.ts:857`, never from input. | closed |
| T-05-02-03 | Repudiation | `readAt` overwrite on replay | mitigate | `readAt: null` in `updateMany.where` excludes already-read rows; timestamp is never overwritten (`actions.ts:884`). | closed |
| T-05-02-04 | Information Disclosure | `getUnreadCycleEventCount` cross-household leak | mitigate | `householdId` scoping (`queries.ts:94`); layout chokepoint uses `requireHouseholdAccess` / `getCurrentHousehold` (`layout.tsx:38`). | closed |
| T-05-02-05 | Information Disclosure | `getCycleNotificationsForViewer` returns other users' rows | mitigate | `recipientUserId: userId` + `cycleId` filter (`queries.ts:130`); D-06 derivational clearing. | closed |
| T-05-02-06 | Information Disclosure | Reminder counts leak to non-assignees (Pitfall 13) | mitigate | Assignee gate early-returns 0 / [] before plant queries (`src/features/reminders/queries.ts:28,80`). | closed |
| T-05-02-07 | Denial of Service | `markNotificationsRead` with huge `notificationIds` array | accept | See AR-05-03. | closed |
| T-05-02-08 | Elevation of Privilege | Unauthenticated caller of `markNotificationsRead` | mitigate | `if (!session?.user?.id) return { error: "Not authenticated." }` (`actions.ts:857`). | closed |
| T-05-03-01 | Information Disclosure | Banner renders names from another household | mitigate | Props-only Server Components; names flow from `getCycleNotificationsForViewer` (filtered by householdId + recipientUserId + cycleId); `getCurrentHousehold` enforces membership before data reaches banner region (`dashboard/page.tsx:136`). | closed |
| T-05-03-02 | Tampering | Banner props manipulated via URL/cookie | accept | See AR-05-04. | closed |
| T-05-03-03 | Spoofing | XSS via name props in banners | mitigate | Zero `dangerouslySetInnerHTML`; all names rendered as React text nodes (JSX auto-escape); all 4 banner files confirmed Server Components (no `"use client"`). | closed |
| T-05-03-04 | Elevation of Privilege | `FallbackBanner` exposes owner name to non-owners | accept | See AR-05-05. | closed |
| T-05-04-01 | Tampering | Client modifies `notificationIds` in devtools | mitigate | Defense-in-depth: Plan 02 `recipientUserId` predicate filters tampered ids to zero-count writes (`actions.ts:883`). | closed |
| T-05-04-02 | Denial of Service | Rapid bell dropdown open/close | accept | See AR-05-06. | closed |
| T-05-04-03 | Information Disclosure | Cycle event copy leaks cross-household names in bell | mitigate | `cycleEvents` prop flows from `getCycleNotificationsForViewer` (scoped). WR-02 added `priorAssigneeUserId` snapshot — included directly in query at `queries.ts:139`, no new authz surface (user id was already in household member set). | closed |
| T-05-04-04 | Spoofing | Malicious prop injection via foreign CUID in `cycleEvents` | accept | See AR-05-07. | closed |
| T-05-05-01 | Information Disclosure | Dashboard banner sourced from another household's notification | mitigate | Triple-gated: `getCurrentHousehold` membership, `getCycleNotificationsForViewer` scoping, `getCurrentCycle` household scoping (all in `dashboard/page.tsx` and `queries.ts`). | closed |
| T-05-05-02 | Tampering | Bogus slug bookmark | mitigate | `getCurrentHousehold` throws `ForbiddenError` for non-members and `notFound()` for unknown slugs (`layout.tsx:38`). | closed |
| T-05-05-03 | Elevation of Privilege | Non-assignee sees `CycleStartBanner` | mitigate | Double-gated: `viewerIsAssignee && unreadEvent?.type === "cycle_started"` (`dashboard/page.tsx:266`); Phase 3 emits with `recipientUserId = newAssignee.id`. | closed |
| T-05-05-04 | Information Disclosure | `PassiveStatusBanner` reveals next-assignee identity | accept | See AR-05-08. | closed |
| T-05-05-05 | Denial of Service | `findNextAssignee` `$transaction` held open | accept | See AR-05-09. | closed |
| T-05-05-06 | Tampering | UAT walkthrough missed a regression | mitigate | 12-scenario Chrome DevTools MCP walkthrough (`05-HUMAN-UAT.md`); 2 regressions caught and fixed inline (commits `a668285`, `3cd9fe9`). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01-02 | `readAt` is timestamp-only (no PII); read access is recipient-scoped. | Phase 05 | 2026-04-20 |
| AR-05-02 | T-05-01-03 | Low-volume table; read benefit outweighs write overhead on the new index. | Phase 05 | 2026-04-20 |
| AR-05-03 | T-05-02-07 | Unbounded `notificationIds` array tolerable (10k CUIDs fit Postgres `IN`); demo guard short-circuits; per-user rate limit deferred. | Phase 05 | 2026-04-20 |
| AR-05-04 | T-05-03-02 | Banner props flow through Next.js serialized RSC tree; no client bundle; no client injection path. | Phase 05 | 2026-04-20 |
| AR-05-05 | T-05-03-04 | Owner name is public household metadata visible throughout the app; not PII in this context. | Phase 05 | 2026-04-20 |
| AR-05-06 | T-05-04-02 | `readAt: null` predicate makes all but first call zero-count no-ops; `useTransition` dedupes concurrent fires. | Phase 05 | 2026-04-20 |
| AR-05-07 | T-05-04-04 | Props come from RSC serialization; Plan 02 `recipientUserId` predicate is defense in depth. | Phase 05 | 2026-04-20 |
| AR-05-08 | T-05-05-04 | Intentional feature (HNTF-04); next-up preview visible to all household members by design. | Phase 05 | 2026-04-20 |
| AR-05-09 | T-05-05-05 | Read-only `$transaction`; availability query + rotation walk; <50ms observed in UAT. | Phase 05 | 2026-04-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-20 | 26 | 26 | 0 | gsd-security-auditor (sonnet) |

**Notes on 2026-04-20 audit:**
- Post-review fixes verified: WR-01 (`b68bba6`, `getCurrentCycle` React.cache wrap — security-neutral) and WR-02 (`6a39e09`, `priorAssigneeUserId` snapshot — no new authz surface; column populated from `outgoing.assignedUserId` already in scope).
- Other post-execution commits reviewed and classified security-neutral: `a668285` (removeChild portal race → async `startTransition`), `3cd9fe9` (demo 404 → Route Handler hard 302).
- SUMMARY.md files contained no explicit `## Threat Flags` section — the threat register comes entirely from the 5 PLAN.md `<threat_model>` blocks. All 26 plan-level threat entries accounted for.
- Pre-existing failing tests (`tests/reminders.test.ts` × 3, `tests/household.test.ts` × 1) are Phase-2 test-mock drift and fall outside this audit scope.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-20
