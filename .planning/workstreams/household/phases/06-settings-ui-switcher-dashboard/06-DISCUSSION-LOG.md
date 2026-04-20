# Phase 6: Settings UI + Switcher + Dashboard - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-20
**Phase:** 06-settings-ui-switcher-dashboard
**Workstream:** household
**Mode:** assumptions
**Areas analyzed:** Settings route shape + non-owner access; Household switcher placement + route preservation; Mark-default-household action; Rotation reorder UX; Member list + ownership actions; Invitations UI; Dashboard assignee-ambient cycle banner; Owner settings form; Availability form UI; Service layer additions (3 new actions)

## Assumptions Presented

### Settings route shape + non-owner access

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Single `/h/[householdSlug]/settings/page.tsx` Server Component with stacked `<Card>` sections (no sub-routes) | Confident | `HOUSEHOLD_PATHS.settings` single-path constant; 8 existing `revalidatePath(HOUSEHOLD_PATHS.settings)` call sites would break under sub-routes |
| Non-OWNERs see reduced surface (page renders, owner-only sections hidden); not a redirect | Likely | `getCurrentHousehold` returns `role`; `getHouseholdMembers`/`getHouseholdAvailabilities` are any-member reads; hiding whole page forces second route for availability |

### Household switcher placement + route preservation

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `<HouseholdSwitcher>` as DropdownMenu in top-nav logo slot (layout.tsx:143-146); no `command`/`sheet` install | Likely | `dropdown-menu.tsx` present; `getUserHouseholds` already returns `isDefault`; `command`/`sheet` flagged missing in ROADMAP pitfalls |
| Mobile switcher placement inside UserMenu (not a new BottomTabBar slot) | Likely | BottomTabBar 4-slot lock per Phase 5 D-21; UserMenu is the natural mobile home for account-level nav |
| Route-preservation: replace second URL segment; detail routes fall back to list | Likely | Phase 1 D-06 enforces householdId scoping; cross-household ID triggers not-found |

### Mark-default-household (HSET-02)

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New `setDefaultHousehold` Server Action, atomic `$transaction` toggle; any member can call | Confident | `HouseholdMember.isDefault` column exists (line 68); no action currently toggles it |
| Auth resolver sort change: `[{ isDefault: desc }, { createdAt: asc }]` at auth.ts:29 AND legacy `/dashboard` stub | Confident | auth.ts:29 currently `createdAt asc`; HSET-02 requires post-login landing target — column alone insufficient |
| Switcher "Make default" per-row action, NOT settings-page radio | Confident | Colocates default-pick with household-list; settings radio would force landing on each household first |

### Rotation reorder (ROTA-01)

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Numbered up/down arrow buttons, NOT HTML5 DnD | Likely | ROADMAP pitfall allows both, bans DnD libraries; arrows are mobile-first and keyboard-first |
| `reorderRotation({ householdId, orderedMemberUserIds })` atomic array-replace, not pairwise swaps | Likely | Atomic-replace is race-safe by construction; pairwise swaps need optimistic locking |
| Optimistic UI with `useTransition`; revert on error | Likely | Success criterion "new order reflected immediately" + React 19.2 idiomatic pattern |

### Member list + ownership actions

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Compact `<Card>` rows with 3-dot DropdownMenu (role-conditional actions); reuses DestructiveLeaveDialog for sole-owner-last-member | Likely | 5 actions exist; inline buttons clutter narrow viewports; DestructiveLeaveDialog present |
| No separate "Transfer ownership" section — two-click flow via promoteToOwner + demoteToMember | Likely | Matches Phase 4 D-14 design; avoids duplicating existing logic |
| Invite flow = Dialog with copy-once URL at creation; existing-invite rows show no copy button | Confident | `createInvitation` returns raw token ONCE; `getHouseholdInvitations` returns only `tokenHash` |

### Dashboard assignee-ambient cycle banner

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| NEW fifth banner `cycle-countdown-banner.tsx` for assignee when no unread event | Confident | Phase 5's four banners cover only unread-event and non-assignee cases; steady-state assignee uncovered |
| Insertion point between ReassignmentBanner and PassiveStatusBanner | Confident | Mutual-exclusivity rules compose cleanly with Phase 5 D-13 order |
| Amber urgency variant when ≤1 day left; single-member copy variant suppresses "X is next" | Confident | Dashboard already fetches `cycle.endDate` + `findNextAssignee`; no new query needed |

### Owner settings form

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Single `updateHouseholdSettings` action (not split three ways) | Likely | `schema.ts` createHousehold pattern precedent; one action = one revalidate = one form submit |
| Cycle duration = preset Select (1/3/7/14), not custom input | Likely | REQUIREMENTS.md ROTA-03 literal preset list; math integrity |
| Timezone = native `<select>` from `Intl.supportedValuesOf('timeZone')`; no `command` install | Likely | Node 20+ and all modern browsers support it; CLAUDE.md tech stack confirms min runtime |

### Availability form UI

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Section within settings page (NOT separate `/settings/availability` sub-route) | Confident | `HOUSEHOLD_PATHS.settings` is sole route; createAvailability/deleteAvailability already revalidate it |
| Two Calendar + Popover pickers, optional reason Input; delete gated on self-row or OWNER | Confident | ROADMAP Phase 6 pitfall explicitly dictates; `calendar.tsx`+`popover.tsx` present; Phase 4 `deleteAvailability` self-or-owner enforcement |

## Corrections Made

No corrections — user confirmed all assumptions with "Yes, proceed" (single AskUserQuestion round).

## Auto-Resolved

N/A — not auto mode.

## External Research

- `Intl.supportedValuesOf('timeZone')` — confirmed supported in Node 20+ (Next.js 16 minimum) and in Chrome 99+, Safari 15.4+, Firefox 93+. No polyfill needed for CLAUDE.md tech stack.
- shadcn `command` / `sheet` — flagged as missing by ROADMAP Phase 6 pitfall; deferred per D-03 / D-15 as not needed for v1.
- HTML5 DnD touch accessibility — not needed given arrow-based reorder decision (D-10).

## Analyzer Agent Report

- **Agent:** gsd-assumptions-analyzer
- **Calibration tier:** standard (no USER-PROFILE.md; default)
- **Phase dependency tree analyzed:** Phases 1-5 CONTEXT.md files + ROADMAP.md + REQUIREMENTS.md + PROJECT.md + CLAUDE.md
- **Key code paths read:** `src/features/household/{actions,queries,schema,paths,context,cycle}.ts`, `src/app/(main)/h/[householdSlug]/{layout,dashboard/page}.tsx`, `src/app/(main)/dashboard/page.tsx`, `auth.ts`, `auth.config.ts`, `prisma/schema.prisma`, `src/components/ui/` directory, `src/components/household/` directory, `src/components/layout/bottom-tab-bar.tsx`, `src/components/auth/user-menu.tsx`
- **Files confirmed present:** calendar, popover, dropdown-menu, alert-dialog, dialog, drawer, form, select shadcn components; DestructiveLeaveDialog; findNextAssignee; all 4 Phase 5 banners
- **Files confirmed missing:** `src/components/ui/command.tsx`, `src/components/ui/sheet.tsx` — both deferred per decisions
- **Schema columns confirmed present:** `HouseholdMember.isDefault` (default false), `HouseholdMember.rotationOrder` (default 0), `Household.cycleDuration` (default 7), `Household.timezone` (default "UTC")
