# Phase 6: Settings UI + Switcher + Dashboard — Research

**Researched:** 2026-04-20
**Domain:** Next.js 16 App Router UI assembly on top of an existing Server Action + Prisma layer (no new data layer work, no new external libraries, no schema migration)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md was gathered in assumptions mode and the user confirmed all assumptions without correction. All 45 decisions (D-01..D-45) are locked. The key ones the planner must honor verbatim:

- **D-01** — Single page at `src/app/(main)/h/[householdSlug]/settings/page.tsx` with five stacked `<Card>` sections (General → Members + Rotation → Invitations → My Availability → Danger Zone). **No sub-routes.** Splitting would silently break 8 existing `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` call sites — verified to exist at lines 248, 294, 346, 412, 629, 723, 772, 832 of `src/features/household/actions.ts`.
- **D-02** — Role-branched rendering in the same page. OWNER sees all five; MEMBER sees General (read-only), Members (read-only roster), My Availability (full CRUD), Danger Zone (leave only). Each mutating action self-enforces OWNER at the server layer, so the UI hide is defense-in-depth.
- **D-03** — `<HouseholdSwitcher>` is a `DropdownMenu` (existing primitive) in the top-nav logo slot. **No `command` install.**
- **D-04** — Mobile switcher lives inside the existing `UserMenu` dropdown. **No fifth BottomTabBar slot** (bar is locked at 4 by Phase 5 D-21). **No `sheet` install.**
- **D-05** — Route-preservation on switch: list routes preserve suffix verbatim; detail routes (`/plants/[id]`, `/rooms/[id]`) fall back to their list root. Implemented via `usePathname()` + segment-replace.
- **D-06** — New `setDefaultHousehold` Server Action: any member, 7-step template, atomic `db.$transaction` that clears all `HouseholdMember.isDefault` for the user then sets the target. No `unstable_update` needed — JWT does not carry `isDefault`.
- **D-07** — Auth resolver at `auth.ts:26-30` must change from `orderBy: { createdAt: "asc" }` to `orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]`.
- **D-08** — Legacy `/dashboard` redirect stub at `src/app/(main)/dashboard/page.tsx:25-29` must use the same sort. These are the ONLY two post-login landing resolvers — planner's audit confirms no third site exists (`session.user.activeHouseholdId` is consumed read-only in 9 files; none of them resolve landing targets independently).
- **D-09** — Default toggle lives IN the switcher row (not on the settings page).
- **D-10** — Numbered up/down arrow buttons (Lucide `ArrowUp` / `ArrowDown`), not HTML5 DnD. Top row's up disabled; bottom row's down disabled. ROTA-01 literal.
- **D-11** — `reorderRotation({ householdId, orderedMemberUserIds: string[] })` — atomic array-replace inside `$transaction`, length+set assertion against current DB members to catch stale client state.
- **D-12** — Optimistic UI on arrow click via `useTransition`; revert on error; disable all arrows during pending.
- **D-13** — Single `updateHouseholdSettings` Server Action covers name/timezone/cycleDuration. Does NOT touch active Cycle — `transitionCycle` re-reads `household.cycleDuration` at each boundary (verified at `src/features/household/cycle.ts:248-269`).
- **D-14** — cycleDuration = preset `<Select>` (1/3/7/14 days), not custom input. Ensures `floor(daysSinceAnchor / cycleDuration)` never divides by zero.
- **D-15** — Timezone = native `<select>` from `Intl.supportedValuesOf('timeZone')`. No `command` install.
- **D-16** — react-hook-form + Zod v4 resolver for the General form. No optimistic UI on form submit.
- **D-17..D-19** — Members list ordered by `rotationOrder asc`; 3-dot menu is role-conditional. Ownership transfer = `promoteToOwner` + `demoteToMember` two-step (no atomic transferOwnership action).
- **D-20..D-22** — Invitations: "Invite people" → `<Dialog>` (via `ResponsiveDialog`) with three phases (idle → success with copyable URL → error). Existing invitations row shows revoke only (no copy — raw token not recoverable per Phase 4 D-01 tokenHash binding). Pending invites do NOT render in the Members list.
- **D-23..D-26** — New `cycle-countdown-banner.tsx`, fifth banner. Render condition: assignee + active cycle + no unread `cycle_started` / `cycle_reassigned_*` event. Slotted between `ReassignmentBanner` and `PassiveStatusBanner`. Reuses existing `currentCycle`, `findNextAssignee`, `cycleEvents` props — no new query.
- **D-27..D-30** — Availability section inside settings (not separate route). Two Calendar+Popover pickers (no third-party range picker). Shows all members' periods with delete button gated to self OR OWNER.
- **D-31..D-32** — Three new Server Actions + three new Zod schemas in the household feature folder. All three use the Phase 2 D-12 7-step template.
- **D-33..D-35** — Test strategy: mocked Prisma for all three action unit tests + five component tests. One real-Prisma integration test (concurrent reorderRotation + removeMember) confirming D-11's set-mismatch guard.

### Claude's Discretion

- **D-36** — Copy strings for switcher default-toggle button
- **D-37** — Switcher row content (recommend: name + role only; no member count)
- **D-38** — Mobile switcher exact layout within UserMenu (recommend: separator above household list)
- **D-39** — "Copy link" toast copy (recommend: "Link copied — share it with people you want to invite.")
- **D-40** — Toast library = sonner (already wired)
- **D-41** — Tailwind tokens for the amber urgency variant of CycleCountdown (recommend: reuse the fallback-banner's amber palette per UI-SPEC — which maps to `bg-destructive/10 border-destructive/30 text-destructive`)
- **D-42** — Whether `reorderRotation` uses `updateMany`-per-row or a single `$executeRaw` CASE-statement (recommend: updateMany inside `$transaction` for readability)
- **D-43** — Availability sort direction (recommend: asc — earliest upcoming first)
- **D-44** — Empty-state copy for Members (impossible) and Invitations ("No active invitations yet.")
- **D-45** — Whether to opportunistically fix tech debt from PROJECT.md (recommend: skip; Phase 6 is already large)

### Deferred Ideas (OUT OF SCOPE)

- Separate `/settings/members`, `/settings/invitations` sub-routes — rejected per D-01
- shadcn `command` install (filterable switcher, filterable timezone picker) — rejected per D-03, D-15
- shadcn `sheet` install (mobile switcher drawer) — rejected per D-04
- HTML5 drag-and-drop for rotation reorder — rejected per D-10
- Pairwise swap API for rotation — rejected per D-11
- Atomic `transferOwnership` Server Action — rejected per D-19
- Re-copy raw token from existing invite — rejected per D-21 (Phase 4 D-01 binding)
- Custom cycleDuration input — rejected per D-14
- Member-count/plant-count badges in switcher rows — deferred per D-37
- Past-availability history — not in Phase 6 scope
- Settings-page mobile Sheet/Drawer chrome — deferred
- HouseholdSwitcher virtualization — not needed at v1 counts
- Fifth BottomTabBar slot — rejected per D-04 / Phase 5 D-21
- Explicit "Settings" link in desktop top-nav next to Plants/Rooms — deferred
- Real-DB integration tests for setDefaultHousehold and updateHouseholdSettings — rejected per D-35
- CycleCountdown variant for non-assignees — rejected per D-25 (PassiveStatusBanner already covers)
- Mark-read-on-dashboard-scroll — rejected (bell-open is the acknowledgement surface per Phase 5 D-16)
- Cycle snooze UI — Phase 8
- Demo household seeding UI — Phase 7
- Phase 5 banner modifications (besides insertion-order) — out of scope
- Opportunistic fixes to `completeOnboarding` revalidatePath / `dueToday` boundary tech debt — deferred per D-45

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HSET-01 | Authenticated routes live under `/h/<householdSlug>/...`; the layout provides a household switcher in the top nav that navigates between households while preserving the current route suffix | Route tree and layout chokepoint already built in Phase 2 (§Verified State). `<HouseholdSwitcher>` component spec and route-preservation logic (D-05) documented in §Architecture Patterns. Existing primitives — `DropdownMenu`, `usePathname()`, `router.push` — are sufficient; no new libraries. |
| HSET-02 | User can mark any household as "default" — it becomes the active household destination on login | `HouseholdMember.isDefault` column exists and is READ-surfaced by `getUserHouseholds` (§Verified State). Write path is the new `setDefaultHousehold` action (D-06, 7-step template). Resolver sort changes (D-07, D-08) close the landing-target loop; auth.ts:26-30 and dashboard/page.tsx:25-29 are the ONLY two resolvers — verified by grep of `session.user.activeHouseholdId`. |
| HSET-03 | Owner can access a household settings page: edit name/timezone/cycle duration, view and reorder member list, generate/revoke invitation links, remove members, transfer ownership | All supporting actions exist (`createInvitation`, `revokeInvitation`, `removeMember`, `promoteToOwner`, `demoteToMember`, `leaveHousehold` — §Verified State). Phase 6 adds `updateHouseholdSettings` (D-13) and `reorderRotation` (D-11). cycleDuration effective-at-next-boundary is verified automatic via `transitionCycle` re-reading `household.cycleDuration` at lines 248-269 of `cycle.ts`. |
| ROTA-01 | Household has an ordered rotation list of members; owner can reorder via up/down controls (v1: HTML5 drag-and-drop or numbered arrows, not a DnD library) | Numbered arrows chosen per D-10 (mobile-first, keyboard-first). `rotationOrder` column verified at schema.prisma:67. `getHouseholdMembers` already returns rows ordered by `rotationOrder asc` (queries.ts:305). Atomic array-replace design (D-11) documented in §Don't Hand-Roll. |
</phase_requirements>

## Summary

Phase 6 is a UI-assembly phase with a narrow, well-scoped data-layer delta. All required Prisma columns (`HouseholdMember.isDefault`, `HouseholdMember.rotationOrder`, `Household.cycleDuration`, `Household.timezone`) exist [VERIFIED: prisma/schema.prisma lines 46, 67-68, 180]. All query helpers (`getUserHouseholds`, `getHouseholdMembers`, `getHouseholdInvitations`, `getHouseholdAvailabilities`, `resolveHouseholdBySlug`, `getCurrentCycle`, `findNextAssignee`, `getCycleNotificationsForViewer`) exist with the shapes Phase 6 needs [VERIFIED: src/features/household/queries.ts, cycle.ts]. Thirteen existing Server Actions (`createHousehold`, `createInvitation`, `revokeInvitation`, `createAvailability`, `deleteAvailability`, `skipCurrentCycle`, `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember`, `acceptInvitation`, `markNotificationsRead`) all have UI-ready `{ success, error }` return shapes and already call `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` [VERIFIED: 8 occurrences at actions.ts:248/294/346/412/629/723/772/832].

Phase 6's delta is **three new Server Actions, three new Zod schemas, one new route page, one new dashboard banner, one new switcher component, six new settings sub-components, and two line-level changes to landing resolvers** — all using existing libraries (Next.js 16 App Router, React 19.2, Prisma 7, react-hook-form 7.72, Zod 4.3, date-fns 4.1, sonner 2.0, lucide-react) and the existing shadcn primitives. No new npm installs. No schema migration. No new third-party libraries.

**Primary recommendation:** Follow the Phase 2 D-12 seven-step Server Action template (session → demo guard → Zod parse → requireHouseholdAccess → role check → $transaction → revalidatePath) for the three new actions, verbatim. Reuse `getUserHouseholds`, `getHouseholdMembers`, `getHouseholdInvitations`, `getHouseholdAvailabilities`, `getCurrentCycle`, and `findNextAssignee` exactly as they are; they are all Phase 6-ready. Keep all UI composition inside `src/components/household/` and `src/components/household/settings/`, reusing `DropdownMenu`, `AlertDialog`, `Dialog`/`Drawer` (via existing `ResponsiveDialog`), `Calendar`, `Popover`, `Card`, `Form`, `Select`, `Input`, `Button`, and `sonner` — all confirmed present.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render `/h/[slug]/settings` page shell, fetch household + members + invites + availabilities | Frontend Server (RSC) | — | Server Component in App Router; direct Prisma via `getCurrentHousehold` + existing queries. No API layer needed per CLAUDE.md "Server Components with direct Prisma queries" pattern. |
| Role-branched section rendering (OWNER vs MEMBER) | Frontend Server (RSC) | Browser | RSC reads `role` from `getCurrentHousehold`; client sub-components receive pre-filtered props. Server is authoritative; client visibility is UX polish per D-02. |
| `<HouseholdSwitcher>` UI (dropdown, route-rewrite, default toggle click) | Browser (Client Component) | Frontend Server | Client: `usePathname`, `useRouter.push`, `useTransition`. Server action `setDefaultHousehold` is the mutation boundary. |
| Route preservation on switch (`/h/old/plants/id` → `/h/new/plants`) | Browser | — | Pure client-side string rewrite; no server hop needed. |
| Rotation reorder optimistic UI | Browser | Frontend Server | Client optimistic state via `useTransition`; server action `reorderRotation` is authoritative via `revalidatePath`. |
| Cycle-boundary behavior for cycleDuration change | API / Backend (`transitionCycle`) | — | `transitionCycle` re-reads `household.cycleDuration` at each boundary [VERIFIED: cycle.ts:248-269]; the settings action ONLY updates the column. NO Cycle-table mutation from the settings write. |
| Auth session carries `activeHouseholdId` | API / Backend (`auth.ts` JWT callback) | — | JWT resolves landing target at sign-in only. HSET-02 "default household" changes the ORDER the callback queries — no session-update call needed because `isDefault` is never cached in the JWT. |
| CycleCountdown render decision | Frontend Server (RSC) | Browser | RSC computes `hasUnreadEvent` from `cycleEvents` and passes a boolean; client banner only renders visual. |
| Invite-link creation dialog (tokenHash write + raw token surface) | API / Backend (`createInvitation`) | Browser | Server writes tokenHash, returns raw token once in response [VERIFIED: actions.ts:336-349]. Client surfaces URL and clipboard copy. |
| Availability CRUD | API / Backend (`createAvailability`, `deleteAvailability`) | Browser | Existing actions; Phase 6 only adds client form UI. |

## Standard Stack

### Core

All of these are already in `package.json` and already used throughout the codebase — no installs needed.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | ^16.2.2 | App Router, Server Components, Server Actions, `revalidatePath` | [VERIFIED: package.json:27] Phase 6 ships zero new `next` APIs — consumes what Phase 2 already established. |
| `react` | (bundled with Next 16) | Client components, `useTransition`, `useState`, `useOptimistic` available | `useTransition` is the established optimistic-UI primitive in this project (Phase 5 bell mark-read, Phase 2 watering log). |
| `next-auth` | ^5.0.0-beta.30 | `auth()` in Server Components + Server Actions | [VERIFIED: package.json:28] Phase 6 changes ONE line in auth.ts (D-07); NO need for `unstable_update` on `setDefaultHousehold` because JWT does not carry `isDefault`. |
| `@prisma/client` | (Prisma 7.x) | DB queries, `$transaction` for atomic writes | Phase 6's three new actions use `db.$transaction` verbatim. |
| `zod` | ^4.3.6 | Input validation via `zod/v4` import | [VERIFIED: package.json:40] Three new schemas in `schema.ts`. Follow existing `createHouseholdSchema` pattern. |
| `react-hook-form` | ^7.72.1 | Form state for General form, Invite form, Availability form | [VERIFIED: package.json:35] Pairs with `@hookform/resolvers` + Zod; used in existing `createHouseholdSchema` consumer. |
| `date-fns` | ^4.1.0 | `differenceInDays` (CycleCountdown), `format` (date pickers), `formatDistanceToNow` (invite rows) | [VERIFIED: package.json:25] Already used by Phase 5 banners. |
| `lucide-react` | latest | Icons: `ArrowUp`, `ArrowDown`, `Star`, `MoreHorizontal`, `Check`, `ChevronDown`, `Calendar`, `Clock`, `Leaf` | Project icon library (CLAUDE.md). |
| `sonner` | ^2.0.7 | All action confirmations | [VERIFIED: package.json] Already wired at `src/components/ui/sonner.tsx`. |

### shadcn/ui components (all confirmed present in `src/components/ui/`)

[VERIFIED: directory listing 2026-04-20]

`alert-dialog`, `badge`, `button`, `calendar`, `card`, `dialog`, `drawer`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `tooltip`

**Confirmed MISSING but NOT required** per CONTEXT D-03 / D-15:
- `command` — would be needed for a filterable switcher or filterable timezone picker; deferred
- `sheet` — would be needed for a mobile drawer switcher; deferred

### Supporting (project-internal)

| Component | Path | Purpose |
|-----------|------|---------|
| `ResponsiveDialog` | `src/components/shared/responsive-dialog.tsx` | Dialog-on-desktop / Drawer-on-mobile via `useMediaQuery("(max-width: 639px)")`. Use for invite-people dialog AND for every AlertDialog that needs mobile UX parity. [VERIFIED: component exists and exports full set of Trigger/Content/Header/Footer/Title/Description/Close slots] |
| `DestructiveLeaveDialog` | `src/components/household/destructive-leave-dialog.tsx` | Existing Phase 4 dialog for sole-OWNER + sole-member leave branch. D-18 requires routing to this for that specific case. |
| `EmptyState` | `src/components/shared/empty-state.tsx` | Shared empty-state with icon + heading + body + optional action |
| `FocusHeading` | `src/components/shared/focus-heading.tsx` | `<h1 tabIndex={-1}>` pattern for page-change focus |
| Four Phase 5 banners | `src/components/household/{cycle-start,reassignment,passive-status,fallback}-banner.tsx` | Do NOT modify; insertion-order only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lucide `ArrowUp`/`ArrowDown` arrow buttons | `@dnd-kit/core`, `react-beautiful-dnd`, native HTML5 DnD | CONTEXT D-10 rejects all DnD. Arrows are mobile-first and keyboard-accessible without a polyfill. ROTA-01 literally allows "numbered arrows". |
| Two `Calendar` + `Popover` pickers | `react-day-picker` range mode (already ships with shadcn calendar), any third-party range picker | CONTEXT D-28 + ROADMAP Phase 6 pitfall reject third-party range pickers. Two independent pickers keep each state isolated and validation simpler (endDate >= startDate is a single client-side check). |
| Native `<select>` for timezone | shadcn `Select` (not Radix-backed list) | CONTEXT D-15: `~400` IANA zones + native select is acceptable for v1. shadcn `Select` has known a11y/keyboard quirks with very long option lists; native is faster. |
| `DropdownMenu` for switcher | `command` (combobox with filter) | CONTEXT D-03: user counts ≤10 per user at v1; filter UX is unnecessary overhead. |

**No installation commands.** Phase 6 ships no new dependencies.

**Version verification:** All versions above cross-checked against `package.json` on 2026-04-20. No drift vs CLAUDE.md recommended stack.

## Architecture Patterns

### System Architecture Diagram

```
          ┌───────────────────────────────────────────────────────┐
          │ Browser — Next.js client navigation                   │
          │                                                       │
          │  [URL: /h/<slug>/settings or .../dashboard]           │
          │        │                                              │
          │        ▼                                              │
          │  usePathname() ── ▶ HouseholdSwitcher (Client)        │
          │                        │                              │
          │                        │ onSelect(newSlug)            │
          │                        │  → buildSwitchPath(pathname, │
          │                        │       newSlug)               │
          │                        │  → router.push(newPath)      │
          │                        ▼                              │
          │                   useTransition → setDefaultHousehold │
          │                   useTransition → reorderRotation     │
          │                                  (optimistic)         │
          └───────────────────────────┬───────────────────────────┘
                                      │ (request)
                                      ▼
          ┌───────────────────────────────────────────────────────┐
          │ Frontend Server — Next.js 16 App Router RSC           │
          │                                                       │
          │  (main)/h/[householdSlug]/layout.tsx  (Plan 02)       │
          │     │ getCurrentHousehold(slug) → { household, role } │
          │     │ getUserHouseholds(userId)   (NEW consumer)      │
          │     └ passes to <HouseholdSwitcher variant="desktop"> │
          │                                                       │
          │  ├── .../settings/page.tsx  (NEW — D-01)              │
          │  │     Promise.all([ getHouseholdMembers,             │
          │  │                   getHouseholdInvitations,         │
          │  │                   getHouseholdAvailabilities ])    │
          │  │     → role-branched render of 5 <Card> sections    │
          │  │                                                    │
          │  └── .../dashboard/page.tsx  (Phase 5 — AMEND)        │
          │        (existing currentCycle, members, nextAssignee, │
          │         cycleEvents props — UNCHANGED)                │
          │        └ insert <CycleCountdownBanner> between        │
          │          ReassignmentBanner and PassiveStatusBanner   │
          └───────────────────────────┬───────────────────────────┘
                                      │ (Server Action calls)
                                      ▼
          ┌───────────────────────────────────────────────────────┐
          │ API / Backend — Server Actions in actions.ts          │
          │                                                       │
          │  Existing (13):                                       │
          │    createHousehold, createInvitation, revokeInvitation│
          │    createAvailability, deleteAvailability             │
          │    skipCurrentCycle, leaveHousehold, removeMember     │
          │    promoteToOwner, demoteToMember, acceptInvitation   │
          │    markNotificationsRead, ...                         │
          │                                                       │
          │  NEW (3 — D-31):                                      │
          │    setDefaultHousehold       — 7-step, any member     │
          │    updateHouseholdSettings   — 7-step, OWNER          │
          │    reorderRotation           — 7-step, OWNER, atomic  │
          │                                                       │
          │  All three: auth() → demo guard → zod parse →         │
          │             requireHouseholdAccess → role check →     │
          │             db.$transaction(...) → revalidatePath     │
          └───────────────────────────┬───────────────────────────┘
                                      │ (Prisma queries/writes)
                                      ▼
          ┌───────────────────────────────────────────────────────┐
          │ Database — PostgreSQL via Prisma 7                    │
          │                                                       │
          │  Household.cycleDuration  (read by transitionCycle    │
          │                            at each boundary — no      │
          │                            retro-mutation of active   │
          │                            Cycle row)                 │
          │  HouseholdMember.isDefault    (read by auth.ts JWT    │
          │                                callback for landing)  │
          │  HouseholdMember.rotationOrder (written by            │
          │                                 reorderRotation)      │
          │  Invitation.tokenHash     (never raw token; Phase 4)  │
          │  HouseholdNotification.readAt (feeds CycleCountdown's │
          │                                hasUnreadEvent gate)   │
          └───────────────────────────────────────────────────────┘
```

### Recommended Project Structure (deltas only — additive)

```
src/
├── app/(main)/
│   ├── dashboard/page.tsx                 # EXISTING — amend line 25-29 sort (D-08)
│   └── h/[householdSlug]/
│       ├── layout.tsx                     # EXISTING — amend: add getUserHouseholds to Promise.all, replace lines 143-146 Link with <HouseholdSwitcher>
│       ├── dashboard/page.tsx             # EXISTING — insert <CycleCountdownBanner> per D-24
│       └── settings/
│           └── page.tsx                   # NEW — D-01 settings Server Component
├── components/
│   ├── auth/
│   │   └── user-menu.tsx                  # EXISTING — amend per D-04 mobile switcher
│   └── household/
│       ├── cycle-countdown-banner.tsx     # NEW — D-23
│       ├── household-switcher.tsx         # NEW — D-03/D-04/D-05/D-09
│       └── settings/                      # NEW directory
│           ├── general-form.tsx           # NEW — D-13/D-14/D-15/D-16
│           ├── members-list.tsx           # NEW — D-10/D-17/D-18/D-19
│           ├── invitations-card.tsx       # NEW — D-20/D-21/D-22
│           ├── availability-section.tsx   # NEW — D-27/D-28/D-29/D-30
│           └── danger-zone-card.tsx       # NEW (UI-SPEC §Danger Zone)
└── features/household/
    ├── actions.ts                         # EXISTING — append three new actions (D-31)
    └── schema.ts                          # EXISTING — append three new schemas (D-32)

auth.ts                                    # EXISTING — amend line 26-30 sort (D-07)
```

### Pattern 1: Seven-step Server Action template (binding for all three new actions)

**What:** Each household-scoped mutation follows a fixed prologue that enforces authn, demo mode, input shape, authz, and cache invalidation in a consistent order. This is the Phase 2 D-12 template verified across all 13 existing actions.

**When to use:** EVERY Phase 6 Server Action. Non-negotiable.

**Example (anchored on the existing `createInvitation` implementation):**

```typescript
// Source: src/features/household/actions.ts (VERIFIED in-repo, Phase 4 shipped pattern)
"use server";

export async function setDefaultHousehold(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard
  if (session.user.isDemo) {
    return { error: "This action is disabled in demo mode. Sign up to get your own household." };
  }

  // Step 3: Zod parse
  const parsed = setDefaultHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access (required — requireHouseholdAccess throws ForbiddenError)
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: role authz — N/A for setDefaultHousehold (any member can pick their default)
  //          — OWNER-only for updateHouseholdSettings and reorderRotation

  // Step 6: write — atomic $transaction
  await db.$transaction(async (tx) => {
    await tx.householdMember.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
    await tx.householdMember.update({
      where: {
        userId_householdId: { userId: session.user.id, householdId: parsed.data.householdId },
      },
      data: { isDefault: true },
    });
  });

  // Step 7: revalidate
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true as const };
}
```

### Pattern 2: Hidden `householdId` / `householdSlug` form field (Phase 2 D-04 binding)

**What:** Every client form submits `householdId` (authz key for `requireHouseholdAccess`) AND `householdSlug` (used by the server action's `revalidatePath`) as hidden inputs. This keeps the server action agnostic to routing.

**When to use:** General form, Availability form, Invite dialog, Rotation reorder (not a form per se — action call with explicit args).

**Example:**

```tsx
// Source: src/features/household/schema.ts — existing createAvailabilitySchema at line 48
<form action={handler}>
  <input type="hidden" name="householdId" value={householdId} />
  <input type="hidden" name="householdSlug" value={householdSlug} />
  {/* visible fields */}
</form>
```

All three new Zod schemas follow this pattern (D-32): `householdId: z.cuid()` + (for slug-requiring actions) `householdSlug: z.string().min(1)`.

### Pattern 3: Request-cached Server Component composition

**What:** `src/features/household/context.ts` exposes `getCurrentHousehold(slug)` wrapped in `React.cache()`. Multiple RSC calls within the same request share one DB hit.

**When to use:** The settings Server Component calls `getCurrentHousehold(householdSlug)` to get `{ household, member, role }` [VERIFIED: context.ts:20]. It is ALREADY called by the layout chokepoint — so the settings page gets a cache hit.

**Example:**

```typescript
// Source: src/features/household/context.ts:20 (VERIFIED)
export const getCurrentHousehold = cache(async (slug: string) => {
  const summary = await resolveHouseholdBySlug(slug);
  if (!summary) notFound();
  return await requireHouseholdAccess(summary.id);
});
```

### Pattern 4: Optimistic UI with `useTransition` + server-authoritative refresh

**What:** The client updates local state immediately, calls the server action inside `useTransition`, and the action's `revalidatePath` triggers a fresh RSC render that confirms (or overrides) the optimistic state.

**When to use:** Rotation reorder (D-12). Also the established pattern for Phase 5 bell mark-read.

**Example:**

```typescript
// Pattern adapted from Phase 5 notification-bell-variant (VERIFIED in-repo)
const [isPending, startTransition] = useTransition();
const [localMembers, setLocalMembers] = useState(members);

function moveUp(index: number) {
  const next = [...localMembers];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  setLocalMembers(next);
  startTransition(async () => {
    const result = await reorderRotation({
      householdId,
      orderedMemberUserIds: next.map((m) => m.userId),
    });
    if (result.error) {
      setLocalMembers(members); // revert
      toast.error(result.error);
    }
  });
}
```

### Pattern 5: Role-branched RSC rendering (D-02 binding)

**What:** The Server Component reads `role` from `getCurrentHousehold` and conditionally renders owner-only sections. MEMBER sees a reduced surface; there is no redirect.

**When to use:** The settings page root composes all five sections but wraps owner-only ones in `{role === "OWNER" && <...>}`.

**Why this is safe:** Every mutating action self-enforces `role === "OWNER"` at step 5 of the 7-step template (for OWNER-only actions). A MEMBER who somehow fires an action call gets `ForbiddenError` from the server.

### Pattern 6: Route-preservation segment replace (D-05 binding)

```typescript
// Source: buildSwitchPath utility — new, spec'd in UI-SPEC §Route-preservation logic
function buildSwitchPath(currentPathname: string, newSlug: string): string {
  const segments = currentPathname.split("/"); // ["", "h", "old-slug", "plants", "abc123"]
  const suffix = segments.slice(3).join("/");

  const detailPattern = /^[a-z0-9]{20,}$/i; // CUID heuristic
  const isDetailRoute = segments.length >= 5 && detailPattern.test(segments[4] ?? "");

  if (isDetailRoute) {
    return `/h/${newSlug}/${segments[3]}`;
  }
  return `/h/${newSlug}/${suffix}`;
}
```

### Anti-Patterns to Avoid

- **Splitting settings into sub-routes** (`/settings/members`, `/settings/invitations`) — rejected per D-01. Breaks 8 existing `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` call sites [VERIFIED]. The planner MUST NOT propose this.
- **Pairwise swap API** (`swapRotation(a, b)`) — rejected per D-11. Race-unsafe: two browsers clicking adjacent swaps can interleave to produce an inconsistent order. Atomic array-replace with set-mismatch guard is the right primitive.
- **Calling `unstable_update` on `setDefaultHousehold`** — unnecessary. JWT does NOT carry `isDefault` [VERIFIED: auth.ts:22-31 only sets `activeHouseholdId`]. The JWT `activeHouseholdId` is a landing-target hint resolved at sign-in; Phase 6 changes the ORDER of the resolver query (D-07). Next login picks up the new default automatically. Mid-session users keep their current `activeHouseholdId` hint; the switcher + legacy redirect both respect the new sort on their next resolution.
- **Mutating the active Cycle row when cycleDuration changes** — NO. `transitionCycle` re-reads `household.cycleDuration` at boundary [VERIFIED: cycle.ts:248-269]. Retro-mutating an in-flight cycle would violate ROTA-07 ("membership / settings changes don't retroactively change the current assignee").
- **Fifth BottomTabBar slot for settings** — rejected per D-04 / Phase 5 D-21 [VERIFIED: `src/components/layout/bottom-tab-bar.tsx` uses fixed 4-slot layout: Dashboard, Plants, Rooms, NotificationBell].
- **Installing `command` or `sheet`** — rejected per D-03, D-15. The existing `DropdownMenu` covers switcher affordances.
- **Using a third-party date-range picker** — rejected per ROADMAP Phase 6 pitfall and D-28. Use two independent `Calendar` + `Popover` pickers.
- **Re-copying the raw invitation token from an existing invite row** — impossible. Phase 4 D-01 stores only `tokenHash` [VERIFIED: schema.prisma:180-215 and actions.ts:334-349 writes tokenHash, returns raw token in creation response only]. Revoke-and-regenerate is the only recovery path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Household-to-household route rewrite | Custom URL parser that knows every route shape | Segment-replace + CUID regex (D-05 pattern 6 above) | App Router URLs have a stable 3-segment prefix `/h/<slug>/<section>/...`; a naïve segment-replace is correct by construction and tested by one unit test. |
| Atomic rotation reorder | Pairwise swap API + conflict resolution | Array-replace inside `$transaction` with set-mismatch guard (D-11) | Race-safe by construction: the full post-state is the input, so concurrent reorders cannot interleave into an inconsistent state. Set-mismatch catches stale client state from concurrent member-add/remove. |
| Default-household toggle | `unstable_update` + JWT manipulation | Simple `updateMany` + `update` inside `$transaction` (D-06) | JWT does not carry `isDefault`; the resolver re-reads on each request via `orderBy`. `revalidatePath` handles UI refresh. |
| Timezone list | Static `IANA_ZONES` constant in a shipped file | `Intl.supportedValuesOf('timeZone')` [CITED: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf] | Node 20+ (Next.js 16 minimum) and all modern browsers support this. Bundling ~400 zone names as a constant is ~10KB of dead weight. Fallback constant only if runtime returns empty. |
| Date-range picker | Custom two-calendar range component with linked selection | Two independent `Calendar` + `Popover` pickers + client-side `endDate >= startDate` check (D-28) | Server (Phase 3 Pitfall 12) is the authority on date validity; client is UX polish. Linked selection adds state complexity for no compliance gain. |
| Copy-to-clipboard | Fallback to `document.execCommand("copy")` + textarea hack | `navigator.clipboard.writeText(url)` + toast on failure [CITED: developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText] | The Clipboard API is supported in all modern browsers. Failure path: sonner error toast per D-39, user manually selects the URL in the `<Input readOnly>`. |
| Dialog/drawer responsive swap | Media-query listener inside each dialog | Existing `ResponsiveDialog` wrapper [VERIFIED: src/components/shared/responsive-dialog.tsx] | Already handles `(max-width: 639px)` and swaps Dialog ↔ Drawer via React context. |
| Toast notifications | Custom toast component + portal | Existing `sonner` wired in `src/components/ui/sonner.tsx` | Already available; D-40 picks it. |
| Relative date formatting for invite rows | Custom "3 days ago" calculator | `date-fns` `formatDistanceToNow(createdAt)` | Already a dependency [VERIFIED: package.json:25]; used elsewhere. |
| Cycle countdown number | `Math.ceil((endDate - now) / msPerDay)` hand math | `date-fns` `differenceInDays(cycle.endDate, new Date())` + `Math.max(0, ...)` clamp | Handles DST correctly; clamp prevents negative display on overdue cycles not yet cron-advanced. |
| Session update to force landing-target refresh | `unstable_update({ activeHouseholdId })` after `setDefaultHousehold` | Nothing — next login resolves via the new sort order | JWT hint is not authoritative; `requireHouseholdAccess` on every protected page is. Mid-session forcing a re-login for a preference change is user-hostile. |

**Key insight:** Every "deceptively complex" problem in Phase 6 already has an in-repo answer. The right approach is to read and reuse existing patterns from Phases 2–5, not to invent new primitives.

## Runtime State Inventory

Phase 6 is additive UI + three new Server Actions. It modifies zero stored-data shape; the schema is fully provisioned by Phase 1. Still, this inventory is required because the phase touches runtime state-reading paths.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `HouseholdMember.isDefault`, `HouseholdMember.rotationOrder`, `Household.cycleDuration`, `Household.timezone`, `Household.name` all already exist [VERIFIED: schema.prisma:46, 67-68, 180] | None — reads and writes use the existing columns. No data backfill needed; Phase 2's existing defaults are correct (`isDefault: false` default + Phase 2 D-01 migration that set the solo household to `isDefault: true`). |
| Live service config | None — no external services (cron continues to hit `/api/cron/advance-cycles` unchanged) | None |
| OS-registered state | None — no scheduled tasks, no pm2, no systemd units being registered or renamed | None |
| Secrets/env vars | `CRON_SECRET` consumed by cron route (unchanged); no new secrets introduced | None |
| Build artifacts | Prisma client at `src/generated/prisma/*` — regenerated on schema changes. Phase 6 makes ZERO schema changes, so no regeneration needed. | None |
| JWT in-flight sessions | `session.user.activeHouseholdId` hint. D-07's sort-order change affects the JWT callback `jwt()` which only runs at sign-in. Existing sessions keep their current hint. | None — stale hints are self-healing: the legacy `/dashboard` redirect stub's live-fallback query (D-08 sort change) resolves correctly on any request. |
| Revalidation contract | 8 existing `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` call sites [VERIFIED: actions.ts lines 248, 294, 346, 412, 629, 723, 772, 832] | None — Phase 6 keeps the settings path single-segment (D-01); the three new actions ADD more calls to the same path. Splitting routes would break these. |

**The canonical question:** After Phase 6 ships, what runtime systems still have the old state cached, stored, or registered? **Answer: Nothing material.** JWTs issued before deploy remain valid (they carry `activeHouseholdId` only, which is a hint; on login after deploy the new sort kicks in). No data migration is required.

## Common Pitfalls

### Pitfall 1: Forgetting that `params` is a Promise in Next.js 16

**What goes wrong:** Accessing `params.householdSlug` directly returns `undefined` because `params` is a Promise in Next.js 16 App Router (breaking change from 15.x).

**Why it happens:** Next.js 16 made async params/searchParams the default [CITED: nextjs.org/blog/next-16 "async params/searchParams, middleware renamed to proxy.ts"]. Copy-paste from Next.js 15 docs will silently fail at runtime.

**How to avoid:** Always `const { householdSlug } = await params;`. Every existing page in `src/app/(main)/h/[householdSlug]/` already does this correctly [VERIFIED: layout.tsx:37, dashboard/page.tsx:135]. The settings page must follow the same pattern.

**Warning signs:** `params.householdSlug` appearing as `undefined` in server logs; 404 or ForbiddenError thrown by `getCurrentHousehold(undefined)`.

### Pitfall 2: Splitting settings into sub-routes

**What goes wrong:** The 8 existing `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` calls silently stop invalidating sub-route caches. Users see stale settings after a mutation.

**Why it happens:** Adding `src/app/(main)/h/[householdSlug]/settings/members/page.tsx` makes the root `/settings` path no longer the render target for the members list.

**How to avoid:** Honor D-01. Single page, stacked cards. If future UX pressure demands sub-routes, that's a separate phase with a `HOUSEHOLD_PATHS` expansion AND a sweep of every existing `revalidatePath` call.

### Pitfall 3: Cycle-duration change retro-mutating the active cycle

**What goes wrong:** Writing cycleDuration AND touching the active Cycle row causes the current assignee's cycle boundary to move mid-cycle, violating ROTA-07.

**Why it happens:** A well-intentioned implementer thinks "oh, I'll update `cycle.endDate` to reflect the new duration."

**How to avoid:** `updateHouseholdSettings` writes ONLY the Household row (D-13). `transitionCycle` already re-reads `household.cycleDuration` at each boundary [VERIFIED: cycle.ts:248-269]. Unit test: assert no `db.cycle.update` call in `updateHouseholdSettings`.

### Pitfall 4: Rotation reorder race with concurrent member-add/remove

**What goes wrong:** Owner A clicks "move Bob up" while Owner B removes Carol. If A's action replays an orderedMemberUserIds array containing Carol, the post-state is inconsistent (Carol appears with undefined rotationOrder or is re-added).

**Why it happens:** Client-state is a snapshot; concurrent mutations by another session invalidate it.

**How to avoid:** D-11's set-mismatch guard. Inside `$transaction`, load all `HouseholdMember` rows for the household, assert `rows.length === input.orderedMemberUserIds.length` AND `new Set(rows.map(r => r.userId))` equals `new Set(input.orderedMemberUserIds)`. Throw `ValidationError` on mismatch with copy "Member list changed — reload and try again." (from UI-SPEC error strings).

### Pitfall 5: Pitfall 17 — absolute internal links skipping `/h/[slug]/` prefix

**What goes wrong:** An `<a href="/plants/abc123">` or `router.push("/settings")` bypasses the household-scoped route tree, hits the legacy redirect stub, and bounces the user to their DEFAULT household — not the one they were viewing.

**Why it happens:** Copy-paste from Phase 2-era code that predates URL scoping.

**How to avoid:** ALL internal navigation uses the `/h/${householdSlug}/...` template. The `householdSlug` is threaded through every client component that navigates. The BottomTabBar, layout nav links, and all existing code do this correctly [VERIFIED: layout.tsx:143, 149, 155; bottom-tab-bar.tsx:33-35]. Phase 6's switcher and settings sub-components must propagate `householdSlug` as a prop.

**Warning signs:** Any `<Link href=` or `router.push` with a leading `/` NOT followed by `h/${householdSlug}`.

### Pitfall 6: Copy-paste of clipboard API without permission-denial fallback

**What goes wrong:** `navigator.clipboard.writeText(url)` throws on sandboxed iframes, non-HTTPS origins, or when permission is denied. User thinks copy worked, shares empty clipboard.

**How to avoid:** Wrap in try/catch. On catch, show an error toast: `"Couldn't copy — try selecting and copying the link manually."` and ensure the URL is visible in a `<Input readOnly>` so the user can select-and-copy with keyboard.

### Pitfall 7: `unstable_update` side-effect on setDefaultHousehold

**What goes wrong:** Calling `unstable_update({ activeHouseholdId: newDefault })` triggers a JWT reissue AND forces a re-render of the current page. If the user clicked "Set as default" on a household they're NOT currently viewing, the reissue could bounce them unexpectedly.

**How to avoid:** Don't call `unstable_update`. The default is a LANDING preference, not a session-active pointer. Current session continues; next login resolves via the new sort.

### Pitfall 8: Banner insertion order bugs that double-render or skip

**What goes wrong:** If `hasUnreadEvent` is false but the developer forgets to check assignee in CycleCountdown, both PassiveStatusBanner (non-assignee branch) and CycleCountdown render for the same viewer.

**How to avoid:** D-25's mutual-exclusivity matrix: assignee + no unread event → CycleCountdown; non-assignee + active cycle → PassiveStatus; assignee + unread → CycleStart or Reassignment. The dashboard RSC's `viewerIsAssignee` check is the gate [VERIFIED: dashboard/page.tsx:199]. CycleCountdown checks the complement set.

### Pitfall 9: Timezone form submit sending non-IANA string

**What goes wrong:** A native `<select>` populated from `Intl.supportedValuesOf('timeZone')` is safe, but a malicious form submit could POST `timezone: "'; DROP TABLE users--"`. Prisma's prepared statements protect the DB, but the value then flows into `TZDate(..., timezone)` which throws on invalid zones.

**How to avoid:** Zod validates `timezone: z.string().min(1)` in `updateHouseholdSettingsSchema`. The Prisma write stores whatever string the user sent. `TZDate` is called only at cycle-boundary time by `transitionCycle`; if the zone is invalid the next cron tick surfaces an error per-household (other households unaffected per Phase 3 D-05 orchestrator pattern). Recommend a defensive `try/catch` inside `updateHouseholdSettings` that pre-validates with `Intl.DateTimeFormat("en", { timeZone: input.timezone })` before writing — returns a user-friendly error rather than letting cron blow up.

## Code Examples

### Example 1: setDefaultHousehold action (D-06)

```typescript
// Source: anchored on src/features/household/actions.ts existing pattern (VERIFIED)
// File: src/features/household/actions.ts (append)

export async function setDefaultHousehold(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) {
    return { error: "This action is disabled in demo mode. Sign up to get your own household." };
  }

  const parsed = setDefaultHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  await db.$transaction(async (tx) => {
    await tx.householdMember.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
    await tx.householdMember.update({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: parsed.data.householdId,
        },
      },
      data: { isDefault: true },
    });
  });

  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true as const };
}
```

### Example 2: Auth resolver sort update (D-07)

```typescript
// Source: auth.ts:26-30 — replace the existing orderBy
// BEFORE:
const membership = await db.householdMember.findFirst({
  where: { userId: user.id },
  select: { householdId: true },
  orderBy: { createdAt: "asc" },
});

// AFTER (D-07):
const membership = await db.householdMember.findFirst({
  where: { userId: user.id },
  select: { householdId: true },
  orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
});
```

### Example 3: Legacy dashboard stub sort update (D-08)

```typescript
// Source: src/app/(main)/dashboard/page.tsx:25-29 — replace existing orderBy
// BEFORE:
const membership = await db.householdMember.findFirst({
  where: { userId },
  orderBy: { createdAt: "asc" },
  select: { household: { select: { slug: true } } },
});

// AFTER (D-08):
const membership = await db.householdMember.findFirst({
  where: { userId },
  orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  select: { household: { select: { slug: true } } },
});
```

### Example 4: reorderRotation action (D-11) — set-mismatch guard

```typescript
// File: src/features/household/actions.ts (append)

export async function reorderRotation(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) {
    return { error: "This action is disabled in demo mode. Sign up to get your own household." };
  }

  const parsed = reorderRotationSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }
  if (access.role !== "OWNER") {
    return { error: "Only household owners can reorder the rotation." };
  }

  try {
    await db.$transaction(async (tx) => {
      const current = await tx.householdMember.findMany({
        where: { householdId: parsed.data.householdId },
        select: { userId: true },
      });

      const currentSet = new Set(current.map((r) => r.userId));
      const inputSet = new Set(parsed.data.orderedMemberUserIds);
      if (
        current.length !== parsed.data.orderedMemberUserIds.length ||
        currentSet.size !== inputSet.size ||
        ![...currentSet].every((id) => inputSet.has(id))
      ) {
        throw new Error("MEMBERS_CHANGED");
      }

      for (let i = 0; i < parsed.data.orderedMemberUserIds.length; i++) {
        await tx.householdMember.update({
          where: {
            userId_householdId: {
              userId: parsed.data.orderedMemberUserIds[i],
              householdId: parsed.data.householdId,
            },
          },
          data: { rotationOrder: i },
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "MEMBERS_CHANGED") {
      return { error: "Member list changed — reload and try again." };
    }
    throw err;
  }

  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true as const };
}
```

### Example 5: Three new Zod v4 schemas (D-32)

```typescript
// File: src/features/household/schema.ts (append)

export const setDefaultHouseholdSchema = z.object({
  householdId: z.cuid(),
});
export type SetDefaultHouseholdInput = z.infer<typeof setDefaultHouseholdSchema>;

export const updateHouseholdSettingsSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  name: z.string().min(1, "Household name is required.").max(100),
  timezone: z.string().min(1),
  cycleDuration: z
    .enum(["1", "3", "7", "14"], { message: "Please select a valid cycle duration (1, 3, 7, or 14 days)." })
    .transform(Number),
});
export type UpdateHouseholdSettingsInput = z.infer<typeof updateHouseholdSettingsSchema>;

export const reorderRotationSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  orderedMemberUserIds: z.array(z.cuid()).nonempty(),
});
export type ReorderRotationInput = z.infer<typeof reorderRotationSchema>;
```

### Example 6: CycleCountdown render gate (D-23/D-25)

```typescript
// File: src/app/(main)/h/[householdSlug]/dashboard/page.tsx (insert between ReassignmentBanner and PassiveStatusBanner)

const hasUnreadCycleEvent =
  unreadEvent !== null &&
  unreadEvent.readAt === null &&
  (unreadEvent.type === "cycle_started" ||
    unreadEvent.type.startsWith("cycle_reassigned_"));

const daysLeft = currentCycle
  ? Math.max(0, differenceInDays(currentCycle.endDate, new Date()))
  : 0;

{/* CycleCountdownBanner — D-24 position between ReassignmentBanner and PassiveStatusBanner */}
{viewerIsAssignee &&
  currentCycle?.status === "active" &&
  !hasUnreadCycleEvent && (
    <CycleCountdownBanner
      daysLeft={daysLeft}
      nextAssigneeName={nextAssigneeName}
      cycleEndDate={currentCycle.endDate}
      isSingleMember={members.length === 1}
    />
  )}
```

### Example 7: HouseholdSwitcher trigger (D-03 desktop)

```tsx
// File: src/components/household/household-switcher.tsx — NEW client component
"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Leaf, ChevronDown, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setDefaultHousehold } from "@/features/household/actions";

function buildSwitchPath(currentPathname: string, newSlug: string): string {
  const segments = currentPathname.split("/");
  const detailPattern = /^[a-z0-9]{20,}$/i;
  const isDetailRoute = segments.length >= 5 && detailPattern.test(segments[4] ?? "");
  if (isDetailRoute) return `/h/${newSlug}/${segments[3]}`;
  return `/h/${newSlug}/${segments.slice(3).join("/")}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for route protection | `proxy.ts` | Next.js 16 (Oct 2025) | Phase 6 uses existing proxy.ts — NO change [VERIFIED: `proxy.ts` exists at repo root; no `middleware.ts`] |
| Sync `params` access in page/layout | `const { param } = await params;` | Next.js 16 (Oct 2025) | ALL Phase 6 pages must await. Existing layout/dashboard already do. |
| `tailwind.config.js` | CSS-first `@theme` in globals.css | Tailwind v4 (Jan 2025) | Phase 6 uses existing tokens — no config changes. |
| Zod v3 default import | `import { z } from "zod/v4"` | Zod 4 stable (2025) | Existing codebase already on v4 [VERIFIED: schema.ts imports `zod/v4`]. |
| NextAuth v4 (Pages Router) | NextAuth v5 beta (App Router) | Next.js 14+ | Already using v5 beta [VERIFIED: package.json:28]. |

**Deprecated/outdated:**
- Any `middleware.ts`-based route protection — use `proxy.ts` (Phase 6 inherits existing).
- `moment.js` — not used; `date-fns` 4 is the standard.

## Assumptions Log

All claims in this research are either [VERIFIED] against the current repo state (files, line numbers cited), [CITED] against official documentation (MDN, Next.js blog, CLAUDE.md stack table which itself cites primary sources), or explicitly drawn from CONTEXT.md D-01..D-45 (which the user confirmed in the discuss-phase, so they are locked decisions, not assumptions).

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**This table is empty — all claims in this research were verified or cited. No user confirmation needed beyond what CONTEXT.md already captured.**

## Open Questions

1. **Should `updateHouseholdSettings` pre-validate timezone with `Intl.DateTimeFormat`?**
   - What we know: Zod schema accepts any `z.string().min(1)`. Native `<select>` populated from `Intl.supportedValuesOf('timeZone')` should only produce valid zones, but a direct action call could bypass the UI.
   - What's unclear: Whether to add defense-in-depth validation server-side (recommended for graceful error UX; strict validation throws inside cron if invalid).
   - Recommendation: Add `try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { return { error: "Please select a valid timezone." }; }` at step 5.5 (between authz and write). Low cost, high value.

2. **Where exactly does the mobile switcher's "Set as default" trigger live?**
   - What we know: D-04 mentions a "secondary tap affordance" and UI-SPEC recommends a small `Star` outline icon button on the right of each non-default row.
   - What's unclear: Whether this fits the mobile touch-target guideline (min 44px) without cluttering the row.
   - Recommendation: Try the right-side star first; fall back to a long-press context menu if QA finds it cramped. Claude's discretion per D-36/D-38.

3. **For the OWNER role pill, is `text-amber-800 on bg-amber-100` compliant?**
   - What we know: UI-SPEC §Color flags this as un-audited.
   - What's unclear: Actual measured contrast ratio against the WCAG 4.5:1 baseline for 12px text.
   - Recommendation: Executor runs a contrast check (Chrome DevTools MCP has an Accessibility panel). If <4.5:1, fall back to `bg-muted text-foreground` (5.4:1, already audited). Spec'd in UI-SPEC.

4. **Is the CycleCountdown banner visible immediately after mark-read on the bell?**
   - What we know: Phase 5 D-20 uses `useTransition` + `revalidatePath` to refresh after mark-read. The dashboard re-renders and CycleCountdown's gate (`hasUnreadEvent === false`) flips to true.
   - What's unclear: Timing — is there a frame where both the banner and the (now-cleared) CycleStart/Reassignment banner render?
   - Recommendation: Planner verifies with a playwright integration test in the UI-wiring plan. If a flash is visible, wrap the dashboard banner region in a `Suspense` boundary.

## Environment Availability

Phase 6 has no external dependencies beyond the existing project toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥20 | Next.js 16 minimum | ✓ | (project requirement) | — |
| PostgreSQL | Prisma reads/writes | ✓ | 17.x | — |
| Prisma 7 client | Generated at `src/generated/prisma/*` | ✓ | 7.x | — |
| Next.js 16 | App Router | ✓ | 16.2.2 | — |
| Vitest 4 | Test runner | ✓ | [VERIFIED: vitest.config.mts exists] | — |
| Chrome DevTools MCP | UI verification per CLAUDE.md | ✓ (per CLAUDE.md convention) | — | Manual verification if unavailable |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.mts` [VERIFIED] — `environment: "jsdom"`, `include: ["tests/**/*.{test,spec}.{ts,tsx}"]` |
| Quick run command | `npx vitest run tests/phase-06/<target>.test.ts` |
| Full suite command | `npm test` (maps to `vitest run`) [VERIFIED: package.json:11] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| HSET-01 | Switcher navigates between households preserving suffix | unit (component) | `npx vitest run tests/phase-06/household-switcher.test.tsx` | ❌ Wave 0 |
| HSET-01 | Switcher detail-route fallback to list | unit (component) | `npx vitest run tests/phase-06/household-switcher.test.tsx -t "detail route"` | ❌ Wave 0 |
| HSET-01 | All internal links carry `/h/[slug]/` prefix | integration (grep-audit + render) | `npx vitest run tests/phase-06/links-audit.test.ts` | ❌ Wave 0 |
| HSET-02 | `setDefaultHousehold` atomic toggle | unit (mocked Prisma) | `npx vitest run tests/phase-06/set-default-household.test.ts` | ❌ Wave 0 |
| HSET-02 | Non-member gets ForbiddenError | unit | `npx vitest run tests/phase-06/set-default-household.test.ts -t "non-member"` | ❌ Wave 0 |
| HSET-02 | Demo mode returns error | unit | `npx vitest run tests/phase-06/set-default-household.test.ts -t "demo"` | ❌ Wave 0 |
| HSET-02 | auth.ts resolver sort change picks default first | unit | `npx vitest run tests/auth.test.ts -t "default household first"` | ⚠️ extend existing |
| HSET-02 | Legacy dashboard stub sort change | integration | `npx vitest run tests/phase-06/dashboard-redirect.test.ts` | ❌ Wave 0 |
| HSET-03 | `updateHouseholdSettings` happy path | unit | `npx vitest run tests/phase-06/update-household-settings.test.ts` | ❌ Wave 0 |
| HSET-03 | `updateHouseholdSettings` non-OWNER rejected | unit | `npx vitest run tests/phase-06/update-household-settings.test.ts -t "non-OWNER"` | ❌ Wave 0 |
| HSET-03 | `updateHouseholdSettings` invalid cycleDuration | unit | `npx vitest run tests/phase-06/update-household-settings.test.ts -t "invalid cycleDuration"` | ❌ Wave 0 |
| HSET-03 | `updateHouseholdSettings` does NOT touch active Cycle | unit (assert no db.cycle.update) | `npx vitest run tests/phase-06/update-household-settings.test.ts -t "preserves active cycle"` | ❌ Wave 0 |
| HSET-03 | General form RHF + Zod integration | unit (component) | `npx vitest run tests/phase-06/settings-general-form.test.tsx` | ❌ Wave 0 |
| HSET-03 | Invitations card — create, revoke, copy | unit (component) | `npx vitest run tests/phase-06/invitations-card.test.tsx` | ❌ Wave 0 |
| HSET-03 | Members list — role-conditional 3-dot menu | unit (component) | `npx vitest run tests/phase-06/members-list.test.tsx` | ❌ Wave 0 |
| HSET-03 | Availability form — two-picker validation | unit (component) | `npx vitest run tests/phase-06/availability-form.test.tsx` | ❌ Wave 0 |
| ROTA-01 | `reorderRotation` atomic array-replace | unit (mocked Prisma) | `npx vitest run tests/phase-06/reorder-rotation.test.ts` | ❌ Wave 0 |
| ROTA-01 | `reorderRotation` stale-client-state detected | unit | `npx vitest run tests/phase-06/reorder-rotation.test.ts -t "members changed"` | ❌ Wave 0 |
| ROTA-01 | Rotation reorder optimistic UI + revert | unit (component) | `npx vitest run tests/phase-06/rotation-reorder.test.tsx` | ❌ Wave 0 |
| ROTA-01 | Concurrent reorderRotation + removeMember (integration) | integration (real Prisma) | `npx vitest run tests/phase-06/reorder-rotation-concurrency.test.ts` | ❌ Wave 0 — D-35 |
| D-23 | CycleCountdown renders for assignee, no unread event | unit (component) | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx` | ❌ Wave 0 |
| D-23 | CycleCountdown does NOT render for non-assignee | unit | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx -t "non-assignee"` | ❌ Wave 0 |
| D-23 | CycleCountdown hides when `hasUnreadEvent` true | unit | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx -t "suppressed by unread"` | ❌ Wave 0 |
| D-23 | CycleCountdown urgency variant when N ≤ 1 | unit | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx -t "urgency"` | ❌ Wave 0 |
| D-23 | CycleCountdown single-member copy variant | unit | `npx vitest run tests/phase-06/cycle-countdown-banner.test.tsx -t "single-member"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/phase-06/<touched>.test.{ts,tsx}`
- **Per wave merge:** `npx vitest run tests/phase-06/`
- **Phase gate:** `npm test` (full suite green) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/phase-06/` directory — does not exist; create
- [ ] `tests/phase-06/fixtures.ts` — shared helpers (mirror `tests/phase-05/fixtures.ts` pattern: RUN_ID, EMAIL_PREFIX, emailFor, getDb) [CITED: tests/phase-05/fixtures.ts]
- [ ] 11 mocked-Prisma unit test stubs for the three new actions + integration stubs
- [ ] 7 component test stubs for the new UI surfaces
- [ ] 1 concurrency integration test stub for D-35 (reorderRotation + removeMember)
- [ ] Framework install: none (Vitest already installed)

## Security Domain

Phase 6 security-enforcement must honor these controls.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | NextAuth v5 session via `auth()` in every action — [VERIFIED: all 13 existing actions use this] |
| V3 Session Management | yes | JWT strategy ([VERIFIED: auth.config.ts:8 `strategy: "jwt"`]); session resolved by `auth()` per-request; `activeHouseholdId` is an UNTRUSTED hint — `requireHouseholdAccess` is the authorization source |
| V4 Access Control | yes | `requireHouseholdAccess` guard + explicit `role === "OWNER"` check in 3-of-3 new actions (setDefault excluded per D-06 rationale); per-row authz in `deleteAvailability` (self OR owner) [VERIFIED: actions.ts:280] |
| V5 Input Validation | yes | Zod v4 schemas for all three new actions; `z.cuid()` on all ID fields; `z.enum` for cycleDuration preset; `z.array(z.cuid()).nonempty()` for rotation order |
| V6 Cryptography | N/A | Phase 6 introduces no new crypto; Phase 4's tokenHash is consumed unchanged |
| V7 Error Handling | yes | Errors return `{ error: "..." }` shape — never leak internal details. `ForbiddenError` surfaces message "Not a member of this household" (safe) |
| V8 Data Protection | yes | Raw invitation token is never re-surfaced (Phase 4 D-01 binding); Phase 6 honors this at D-21 (no copy-link for existing invites) |
| V11 Business Logic | yes | Last-OWNER guard on demoteToMember/removeMember/leaveHousehold already server-enforced (Phase 4); Phase 6 UI only disables buttons as defense-in-depth per D-18 |
| V13 API & Service | yes | Server Actions are the only mutation surface; no new REST endpoints; CSRF baked into Next.js Server Action POST |

### Known Threat Patterns for Phase 6

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Member of household A calls `updateHouseholdSettings({ householdId: B })` | Elevation of Privilege (Tampering) | `requireHouseholdAccess(householdId)` at step 4; returns ForbiddenError (403) if not a member. [VERIFIED pattern in all 13 existing actions] |
| Non-OWNER calls `reorderRotation` or `updateHouseholdSettings` | Elevation of Privilege | Explicit `access.role !== "OWNER"` check at step 5 (D-11 step 4, D-13 implicit). Returns user-friendly error. |
| Stale client-state attack on `reorderRotation` (submits orderedMemberUserIds containing a removed member) | Tampering | Set-mismatch guard in `$transaction` (D-11 step 6). Returns "Member list changed — reload and try again." |
| Forging `setDefaultHousehold({ householdId: not-mine })` | Tampering | `requireHouseholdAccess(householdId)` rejects non-members. |
| JWT-hint stampede: user is removed, stale JWT still claims `activeHouseholdId = X` | Spoofing | `requireHouseholdAccess` is a LIVE DB check on every request [VERIFIED: guards.ts:31]. Stale JWT hints hit ForbiddenError at the next navigation. |
| Timezone-injection causes TZDate crash in cron | DoS | Defensive `Intl.DateTimeFormat` pre-validation recommended in updateHouseholdSettings (see Open Question 1). Per-household try/catch in cron orchestrator [VERIFIED Phase 3 pattern] limits blast radius to one household. |
| CSRF on Server Action | Tampering | Next.js Server Actions include built-in CSRF protection [CITED: nextjs.org docs — Server Actions security]; all three new actions benefit automatically. |
| Clipboard API leak (token visible in URL history/logs) | Info Disclosure | `createInvitation` returns raw token in response, never logs. Dialog Phase B displays URL inside a `<Input readOnly>` — not copied to `router.push` or `window.location`. |
| Role-pill XSS via household name injection | Injection | Zod `name: z.string().min(1).max(100)` bounds length; React auto-escapes `{name}` in JSX. [CITED: react.dev "Rendering with JSX" — default XSS protection] |
| Demo-mode bypass | Elevation of Privilege | Step 2 (`session.user.isDemo` check) in all three new actions + existing actions — verified pattern [VERIFIED: actions.ts:47-49 and 11 other locations] |

## Verified State (codebase anchor points)

Items marked ✓ were verified via file read or `ls` on 2026-04-20. These are the concrete facts the planner can rely on without re-verifying:

- ✓ Prisma schema has `HouseholdMember.isDefault` (line 68), `HouseholdMember.rotationOrder` (line 67), `Household.cycleDuration` (line 46), `Household.timezone` (line 45). NO migration required.
- ✓ `HOUSEHOLD_PATHS.settings = "/h/[householdSlug]/settings"` defined at paths.ts:21.
- ✓ 8 existing `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` call sites in `actions.ts`: lines 248, 294, 346, 412, 629, 723, 772, 832.
- ✓ Layout chokepoint `src/app/(main)/h/[householdSlug]/layout.tsx` renders a static `<Link href={/h/${householdSlug}/dashboard}>` at lines 143-146 — this is the slot `<HouseholdSwitcher variant="desktop">` replaces.
- ✓ Layout already does `Promise.all` of 4 queries (lines 62-67); adding `getUserHouseholds(sessionUser.id)` makes it 5.
- ✓ Dashboard Server Component fetches `currentCycle`, `members`, `nextAssignee`, `unreadEvent` and renders 4 banners (Fallback, CycleStart, Reassignment, PassiveStatus) with the D-13 Phase 5 render order preserved [VERIFIED: dashboard/page.tsx:253-304]. CycleCountdown inserts between ReassignmentBanner (ends at line 288) and PassiveStatusBanner (starts at line 291).
- ✓ `auth.ts` JWT callback at line 26-30 uses `orderBy: { createdAt: "asc" }` to resolve `activeHouseholdId` at sign-in only.
- ✓ Legacy `/dashboard` redirect stub uses the same sort at `src/app/(main)/dashboard/page.tsx:25-29`.
- ✓ No third landing resolver — `session.user.activeHouseholdId` appears in 9 files; all consume as a hint, none re-resolve it.
- ✓ `transitionCycle` re-reads `household.cycleDuration` at each boundary [VERIFIED: cycle.ts:248-250, 269]. Duration change takes effect at next boundary automatically — NO code needs to schedule this.
- ✓ `getCurrentHousehold` wrapped in `React.cache()` [VERIFIED: context.ts:20]; settings page benefits from request-level dedup with layout.
- ✓ `getHouseholdMembers` returns rows ordered `rotationOrder asc` and exposes `{ userId, userName, userEmail, role, rotationOrder, joinedAt }` [VERIFIED: queries.ts:295-317].
- ✓ `getUserHouseholds` orders by `createdAt asc` and returns `{ household, role, isDefault, joinedAt }` [VERIFIED: queries.ts:34-47]. NOTE: this sort may need to change to `[{ isDefault: "desc" }, { createdAt: "asc" }]` for switcher row ordering (pending D-03 clarification — CONTEXT.md only specifies the auth.ts + dashboard resolvers; switcher sort is Claude's discretion, recommend matching).
- ✓ `getHouseholdInvitations` returns only non-revoked, non-accepted rows with inviter name [VERIFIED: queries.ts:269-281].
- ✓ `getHouseholdAvailabilities` exists [VERIFIED: queries.ts:162].
- ✓ `findNextAssignee` is a tx-scoped function exposed from `cycle.ts:110`. Dashboard page already wraps it in `db.$transaction` [VERIFIED: dashboard/page.tsx:185-196].
- ✓ `proxy.ts` exists at repo root; no `middleware.ts` [VERIFIED: directory listing].
- ✓ All shadcn primitives declared present in UI-SPEC are in `src/components/ui/` [VERIFIED: ls directory listing — alert-dialog, badge, button, calendar, card, dialog, drawer, dropdown-menu, form, input, label, popover, select, separator, skeleton, sonner, switch, tooltip].
- ✓ `src/components/household/` has 5 files: `cycle-start-banner.tsx`, `destructive-leave-dialog.tsx`, `fallback-banner.tsx`, `passive-status-banner.tsx`, `reassignment-banner.tsx`. Phase 6 adds: `cycle-countdown-banner.tsx`, `household-switcher.tsx`, and the `settings/` subdirectory.
- ✓ Vitest config: jsdom, `tests/**/*.{test,spec}.{ts,tsx}` [VERIFIED: vitest.config.mts].
- ✓ `ResponsiveDialog` exists and handles `(max-width: 639px)` swap [VERIFIED: src/components/shared/responsive-dialog.tsx].
- ✓ Onboarding-related guards: demo-mode guard is idiomatic step 2 in every mutation action [VERIFIED: pattern at actions.ts:47-49, 261-263, 308-314, etc.].

## Project Constraints (from CLAUDE.md)

The planner MUST honor:

- **Tech stack is not negotiable:** Next.js 16 + TypeScript + Prisma 7 + PostgreSQL. No alternative frameworks or ORMs.
- **NextAuth v5 beta only** (App Router). v4 is dead-end for this project.
- **Tailwind v4** CSS-first. No `tailwind.config.js`.
- **`zod/v4` import path**, not default `zod`.
- **`proxy.ts`**, not `middleware.ts`.
- **Server Components call Prisma directly** for reads; **Server Actions + Zod + Prisma writes** for mutations. No REST API layer.
- **Chrome DevTools MCP verification is mandatory** for UI changes — CLAUDE.md "Validating UI Output" section is authoritative.
- **GSD workflow is enforced** — no direct edits outside a GSD command per CLAUDE.md "GSD Workflow Enforcement".
- **No emoji, no exclamation marks, calm/direct tone** — UI-SPEC tone rules inherited from all prior phases.
- **Commit permission:** Local commits are fine; pushing/PR requires user approval (CLAUDE global memory: feedback_no_commit_without_approval).
- **Autonomy:** Treat user's phase-execution approval as authorization for the whole phase (global memory: feedback_prefer_autonomy).
- **UAT handoff specificity:** Any UAT ask must embed seed command, login user, URL, clicks, expected text (global memory: feedback_concrete_test_procedures).

## Sources

### Primary (HIGH confidence)

- `CLAUDE.md` §Technology Stack — verified versions for next@^16.2.2, next-auth@5.0.0-beta.30, prisma@7.x, zod@^4, date-fns@^4.1, react-hook-form@7.72.x, sonner@2.0.7 — cross-checked against `package.json`
- `src/features/household/{actions,queries,schema,context,cycle,paths,guards}.ts` — all VERIFIED by direct read, 2026-04-20
- `src/app/(main)/h/[householdSlug]/{layout,dashboard/page}.tsx` — VERIFIED by direct read
- `src/app/(main)/dashboard/page.tsx` (legacy stub) — VERIFIED by direct read
- `auth.ts`, `auth.config.ts`, `proxy.ts` — VERIFIED
- `prisma/schema.prisma` lines 45-68, 180 — VERIFIED
- `src/components/ui/` and `src/components/household/` and `src/components/shared/` directory listings — VERIFIED
- `vitest.config.mts`, `package.json` — VERIFIED
- `.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-CONTEXT.md` D-01..D-45 — locked decisions
- `.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-UI-SPEC.md` — visual contract
- `.planning/workstreams/household/REQUIREMENTS.md` HSET-01/02/03, ROTA-01
- Prior phase CONTEXT.md files for binding decisions (Phase 2 D-04/D-12/D-16/D-17, Phase 3 D-08/D-20, Phase 4 D-01/D-14/D-15, Phase 5 D-11/D-12/D-13/D-16/D-20/D-21)

### Secondary (MEDIUM confidence)

- Next.js 16 release blog (quoted via CLAUDE.md) — async params, proxy.ts rename
- Tailwind v4 release blog (quoted via CLAUDE.md) — CSS-first `@theme`
- MDN `Intl.supportedValuesOf` — browser support matrix
- MDN `navigator.clipboard.writeText` — permission model

### Tertiary (LOW confidence)

- None material. All recommendations trace to either verified repo state, locked CONTEXT decisions, or CLAUDE.md-backed stack choices.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified against package.json; every shadcn primitive verified by directory listing
- Architecture: HIGH — patterns come from existing Phase 2-5 code; all anchor points and line numbers verified
- Pitfalls: HIGH — all 9 pitfalls either trace to verified in-repo invariants (e.g. `transitionCycle` re-read, revalidatePath call count) or documented Next.js 16 breaking changes
- Server Action templates: HIGH — 7-step template verified across all 13 existing actions
- CycleCountdown gate logic: HIGH — reuses existing dashboard page's `viewerIsAssignee` + `unreadEvent` computation
- Route preservation: MEDIUM — CUID regex heuristic is a simplification; recommend a unit test that covers all route shapes in `HOUSEHOLD_PATHS`

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — stack is stable, nothing time-sensitive here)
