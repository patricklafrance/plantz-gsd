# Phase 6: Settings UI + Switcher + Dashboard - Context

**Gathered:** 2026-04-20 (assumptions mode)
**Status:** Ready for planning
**Workstream:** `household`

<domain>
## Phase Boundary

Assemble the owner-facing control surface and the user-facing navigation layer on top of the data + action + notification foundation shipped by Phases 1–5. Scope: (1) a new `/h/[householdSlug]/settings` page (stacked sections — General / Members + Rotation / Invitations / My Availability / Danger zone) wired to the 13 existing Server Actions plus 3 NEW actions (`setDefaultHousehold`, `updateHouseholdSettings`, `reorderRotation`); (2) a new `<HouseholdSwitcher>` dropdown rendered in the top-nav logo slot (desktop) and inside `UserMenu` (mobile) that preserves the current route suffix when switching; (3) the auth resolver + legacy `/dashboard` redirect stub updated to order memberships by `isDefault desc, createdAt asc` so HSET-02 post-login landing honors the user's default pick; (4) a NEW `cycle-countdown-banner.tsx` that renders for the CURRENT assignee on the dashboard when no unread cycle event is pending — closes Phase 6 goal #5 (countdown + next-assignee preview) that Phase 5's four banners don't cover; (5) the availability form UI (two `Calendar` + `Popover` pickers, existing-periods list) that Phase 3 deferred to this phase.

**Explicitly not in this phase:** new Server Actions beyond the three named above; any schema migration (all columns already exist — `isDefault`, `rotationOrder`, `cycleDuration` per Phase 1/2); any change to Phase 5's four banner components beyond insertion-order adjustment; notifications surface rework (Phase 5 D-22 is final); demo-mode seeding (Phase 7); cycle-snooze UI (Phase 8); shadcn `command`/`sheet` component installs (deferrable — v1 uses `DropdownMenu`); any DnD library (ROTA-01 pitfall); any third-party date-range picker (ROADMAP pitfall); per-plant/per-room notification overrides (deferred milestone).

</domain>

<decisions>
## Implementation Decisions

### Settings page route shape (HSET-03)

- **D-01:** **Single page at `/h/[householdSlug]/settings/page.tsx`**, Server Component, stacked `<Card>` sections in render order: General → Members + Rotation → Invitations → My Availability → Danger zone. No nested sub-routes. The chokepoint layout at `src/app/(main)/h/[householdSlug]/layout.tsx` already supplies auth + `requireHouseholdAccess`; the settings page inherits it. Binding: `HOUSEHOLD_PATHS.settings = "/h/[householdSlug]/settings"` in `src/features/household/paths.ts` is the authoritative path and is already consumed by 8 `revalidatePath` call sites in `src/features/household/actions.ts` (createAvailability:248, deleteAvailability:294, createInvitation:346, revokeInvitation:412, removeMember:723, promoteToOwner:772, demoteToMember:832, leaveHousehold:629). Splitting into sub-routes (`settings/members`, `settings/invitations`, …) would silently stop invalidating those existing calls — planner must NOT propose a split.

- **D-02:** **Role-branched rendering, single page (non-OWNERs see reduced surface, not a redirect).** The Server Component reads `role` from `getCurrentHousehold(householdSlug)` and conditionally renders owner-only sections.
  - **OWNER sees:** all five sections.
  - **MEMBER sees:** General (read-only — name/timezone/cycleDuration as muted text, no `<Form>`), Members list (read-only roster, no 3-dot menu), My Availability (full CRUD on own rows), Danger zone (Leave household).
  - **MEMBER does NOT see:** Invitations card, Rotation reorder arrows, Transfer/Remove member controls, Edit household form controls.
  - Rationale: `getHouseholdMembers` (`src/features/household/queries.ts:295`) and `getHouseholdAvailabilities` (Phase 3 D-08) are documented as any-member reads. Hiding the whole page would force a second route just for availability. Each mutating action self-enforces OWNER checks, so the UI hide is defense-in-depth — a member who crafts an action call still gets `ForbiddenError`.

### Household switcher (HSET-01)

- **D-03:** **`<HouseholdSwitcher>` client component rendered in the top-nav logo slot** at `src/app/(main)/h/[householdSlug]/layout.tsx:143-146` (currently static "Plant Minder" label + `Leaf` icon + home `Link`). Becomes the `DropdownMenu` trigger. Menu content: one row per household from `getUserHouseholds(sessionUser.id)` ordered by `[{ isDefault: "desc" }, { createdAt: "asc" }]`, showing household name + role pill + filled-star icon for the current default. Active household row is disabled (non-navigable). Built on existing `dropdown-menu.tsx` — **no `command` or `sheet` install in v1**.

- **D-04:** **Mobile switcher placement = inside `UserMenu` dropdown**, NOT a new BottomTabBar slot (BottomTabBar is locked at 4 by Phase 5 D-21). Row order in `UserMenu`: current household name (disabled header) → list of other households → Separator → "Household settings" link → "Account preferences" link → Separator → Sign out. The same component body renders — `variant="desktop" | "mobile"` prop tweaks trigger styling and menu alignment; data fetching is identical. Deferred alternative (`Sheet`-based mobile switcher) stays in `<deferred>` unless user research shows the DropdownMenu feels cramped at 5+ households.

- **D-05:** **Route-preservation strategy on switch** = replace only the second URL segment, with fallback for detail routes:
  - List/index routes (`/plants`, `/rooms`, `/settings`, `/dashboard`) preserve the suffix verbatim: `/h/<old>/plants` → `/h/<new>/plants`.
  - Detail routes (`/plants/[id]`, `/rooms/[id]`) **fall back to their list**: `/h/<old>/plants/abc123` → `/h/<new>/plants`. Rationale: Phase 1 D-06 scopes every query by `householdId`; a cross-household ID resolves to `null` and triggers `not-found.tsx`.
  - `/join/[token]` is not under `/h/` so it is never a source for the switcher.
  - Implementation: client-side `usePathname()` + segment-replace (same pattern as `BottomTabBar`'s active-state at `src/components/layout/bottom-tab-bar.tsx:30`). Switcher `onSelect` fires `router.push(newPath)` with the rewritten path.

### Mark-default-household (HSET-02)

- **D-06:** **New `setDefaultHousehold({ householdId })` Server Action** in `src/features/household/actions.ts`. Follows the 7-step D-12 template from Phase 2:
  1. `session` via `auth()`
  2. Demo-mode guard (return `{ error }`)
  3. Zod v4 parse (`setDefaultHouseholdSchema` in `src/features/household/schema.ts`, field `{ householdId: z.string().cuid() }`)
  4. `requireHouseholdAccess(householdId)` — user must be a member
  5. No OWNER check — **any member** can pick any of their households as default
  6. `db.$transaction` atomic write: `updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })` then `update({ where: { userId_householdId: { userId, householdId } }, data: { isDefault: true } })`
  7. `revalidatePath` on `HOUSEHOLD_PATHS.settings` (so switcher star re-renders) AND on `/dashboard` (so the legacy redirect stub re-evaluates).
  Returns `{ success: true }`. No `unstable_update` needed — JWT doesn't carry `isDefault`; the resolver re-reads on each request.

- **D-07:** **Auth resolver sort change** at `auth.ts:29`. Current: `orderBy: { createdAt: "asc" }`. New: `orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]`. This is the single place that populates `session.user.activeHouseholdId` on token creation. HSET-02 acceptance ("becomes the post-login landing target") fails without this change — the column alone isn't enough.

- **D-08:** **Legacy `/dashboard` redirect stub update** at `src/app/(main)/dashboard/page.tsx:25-29`. Current: selects oldest membership via `createdAt asc`. New: same sort as D-07 (`[{ isDefault: "desc" }, { createdAt: "asc" }]`). These two sites (auth.ts + dashboard stub) are the ONLY post-login landing resolvers; planner's audit must confirm no third site exists.

- **D-09:** **Switcher UI affordance for default toggle** = per-row "Make default" action in the DropdownMenu. Rendered as a secondary item under the household name (or as a trailing star icon button). The current default row shows a filled star; non-default rows show an outline star on hover. NOT a settings-page radio group — colocating with the switcher list keeps "pick your default" next to "switch to this one."

### Rotation reorder (ROTA-01)

- **D-10:** **Numbered up/down arrow buttons** per member row (Lucide `ArrowUp` / `ArrowDown`). Top row's up-arrow is disabled; last row's down-arrow is disabled. **Not HTML5 drag-and-drop.** Rationale: ROADMAP Phase 6 pitfall allows both but forbids DnD libraries; HTML5 DnD is notoriously touch-hostile on mobile; arrows are trivially keyboard-accessible (already a `<button>`) and work with single-finger touch. Success-criterion #4 ("reorder using up/down controls") is literal for this choice.

- **D-11:** **`reorderRotation({ householdId, orderedMemberUserIds: string[] })` Server Action** — atomic array-replace, NOT pairwise swaps. Action body:
  1-4. Standard 7-step template, OWNER-only check at step 5 (role === "OWNER" from `requireHouseholdAccess`).
  5. Zod v4 schema validates `orderedMemberUserIds` is a non-empty array of cuid strings.
  6. `db.$transaction` — load all `HouseholdMember` rows for `householdId`, assert `rows.length === input.orderedMemberUserIds.length` AND the set of userIds matches (throw `ValidationError` on mismatch — catches stale client state from a concurrent add/remove). Then `updateMany`-per-row OR `$executeRaw` CASE-statement update of `rotationOrder` to new indices.
  7. `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` AND `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")` (next-assignee preview may change).
  Rationale: pairwise swap API (`swapRotation(memberA, memberB)`) has an obvious race when two browsers click adjacent swaps — atomic-replace is race-safe because the full post-state is the input. The length+set assertion closes the stale-client-state gap (member was removed between render and click).

- **D-12:** **Optimistic UI on arrow click.** Client component maintains local order state; clicking an arrow immediately reorders the local list AND fires `reorderRotation` via `useTransition`. On action error, revert local state and surface toast (sonner). Next `revalidatePath` refresh confirms server-authoritative order. Rationale: success-criterion #4 says "new order reflected in the rotation immediately"; optimistic + server-authoritative refresh is the React 19.2 idiomatic pattern and matches the existing watering-log optimistic pattern (Phase 2-era).

### Owner settings form — General section (HSET-03 name/timezone/cycleDuration)

- **D-13:** **Single `updateHouseholdSettings` Server Action** (not split into three). Accepts `{ householdId, name, timezone, cycleDuration }`, all validated. 7-step template, OWNER-only (step 5). Writes `db.household.update({ where: { id }, data: { name, timezone, cycleDuration } })`. Does NOT touch the active `Cycle` row — ROTA-03's "takes effect next cycle boundary" is satisfied automatically because `transitionCycle` reads `household.cycleDuration` fresh at each boundary (verify via grep during planning). Revalidates `HOUSEHOLD_PATHS.settings`, `HOUSEHOLD_PATHS.dashboard` (cycle end date display), and — if `name` changed — `HOUSEHOLD_PATHS.plants`/`rooms` (URL slug is immutable per Phase 1 D-06; switcher re-renders with new name).

- **D-14:** **Cycle duration = preset `<Select>` dropdown with 4 options (1, 3, 7, 14)** per ROTA-03. Shared `cycleDurationSchema` in `src/features/household/schema.ts` validates `z.enum(["1","3","7","14"]).transform(Number)` or equivalent. Form copy under the field: "Changes take effect at the next cycle boundary, not immediately." **Not a custom number `<Input>`** — custom values would break the `floor(daysSinceAnchor / cycleDuration)` math for non-integer or zero/negative inputs.

- **D-15:** **Timezone selector = native `<select>` populated from `Intl.supportedValuesOf('timeZone')`**, alpha-sorted. No `command` install. Node 20+ (Next.js 16 min) and modern browsers (Chrome 99+, Safari 15.4+, Firefox 93+) all support `Intl.supportedValuesOf`. Fallback: if the list is empty (old runtime), populate from a static `IANA_ZONES` constant shipped in the client bundle (defer the constant to the planner — only implement if the analyzer finds the empty case plausible). Default pre-selected value = current `household.timezone`.

- **D-16:** **React-hook-form + Zod v4 resolver** for the General form, following the existing `createHouseholdSchema` pattern at `src/features/household/schema.ts:25-28`. Submit on "Save changes" button; disabled while `isSubmitting`. Optimistic UI here is NOT needed — the form is infrequent and the round trip is fast; standard pending-state is sufficient.

### Members list + ownership actions (HSET-03 member management, INVT-05/06)

- **D-17:** **Member list = compact `<Card>` with one row per member**, sorted by `rotationOrder asc`. Each row displays: member name (fallback to email), role pill (OWNER amber / MEMBER neutral), rotation-order number (as subtle prefix badge), up/down arrow buttons (OWNER view only, per D-10), 3-dot `DropdownMenu` trigger (OWNER view, or self-row for any member). Pending-invitation rows do NOT render here (they live in the Invitations card, D-21).

- **D-18:** **3-dot DropdownMenu actions — role-conditional:**
  - **OWNER viewing MEMBER row:** "Make owner" → `promoteToOwner`. "Remove from household" → `AlertDialog` confirm → `removeMember`.
  - **OWNER viewing OWNER row (not self):** "Remove from owners" → `demoteToMember` (only if ≥2 OWNERs — last-OWNER guard from Phase 4 is server-enforced). "Remove from household" → `AlertDialog` confirm → `removeMember`. Both gated client-side on `ownerCount > 1`.
  - **Any viewer viewing own row:** "Leave household" → branch:
    - If user is sole OWNER + sole member → open existing `src/components/household/destructive-leave-dialog.tsx` (Phase 4 D-15) → `leaveHousehold` with confirmation (deletes household + plants).
    - Otherwise → `AlertDialog` confirm → `leaveHousehold`.
  - **Own row when sole OWNER with other members:** "Leave household" is DISABLED with tooltip "Transfer ownership first" (mirrors the server-side `lastOwnerCannotLeaveWhileMembersExist` check in `leaveHousehold`).
  - Rationale: `removeMember` at `src/features/household/actions.ts:658` already rejects self-target with a specific error message; the menu must route self vs non-self to different actions or duplicate server errors in UI.

- **D-19:** **No separate "Transfer ownership" section.** Ownership transfer is achieved via "Make owner" on a target member (`promoteToOwner`) + "Remove from owners" on the current owner (`demoteToMember`). This matches the Phase 4 D-14 action design — there is no atomic `transferOwnership` action; the flow is two clicks. UI copy in the `promoteToOwner` confirm dialog clarifies: "Alice will become an additional owner. To transfer solo ownership, demote yourself afterwards." This is acceptable for v1 per INVT-06's literal "transfer ownership to another member" (two-step atomic-per-step = transfer).

### Invitations card (HSET-03 invitation management)

- **D-20:** **"Invite people" button → `<Dialog>`** containing a minimal form. Form body:
  - Phase A (pre-submit): short description "Anyone with the link can join this household. Revoke links anytime."; single "Create invite" submit button.
  - Phase B (post-submit success): dialog body swaps to display the composed URL `${window.location.origin}/join/${response.token}` in a read-only `<Input>` with a "Copy link" button adjacent. "Done" closes the dialog.
  - Phase C (post-submit error): inline error message + Retry button.
  Rationale: `createInvitation` at `src/features/household/actions.ts:303` returns `{ success, token: rawToken, invitationId }` with `token` only available at creation time. Surfacing the URL inside the dialog immediately after creation is the only moment the raw token is visible.

- **D-21:** **Active-invitations list below the "Invite people" button** in the Invitations card. Each row shows: creator name + creation date (relative, e.g., "Alice · 3 days ago") + a "Revoke" button → `AlertDialog` confirm → `revokeInvitation`. **No "Copy link" button on existing rows** — only `tokenHash` is persisted (Phase 4 D-01 "stateless hash"), and the raw token is not recoverable. If the user needs to re-share, they revoke the old invite and generate a new one. The empty-state copy is "No active invitations — create one above to invite members."

- **D-22:** **Pending invitations do NOT render as rows in the Members list** (D-17). They live only in the Invitations card. Rationale: `Invitation` and `HouseholdMember` are separate models; conflating them in the Members UI muddies "who is in this household right now."

### Dashboard cycle-countdown banner (Phase 6 goal #5)

- **D-23:** **NEW fifth banner component `src/components/household/cycle-countdown-banner.tsx`.** Renders on the dashboard Server Component (`src/app/(main)/h/[householdSlug]/dashboard/page.tsx`) for the CURRENT assignee **when**:
  - `currentCycle !== null` AND `currentCycle.status === 'active'` AND
  - `currentCycle.assignedUserId === sessionUser.id` AND
  - **No** unread `cycle_started` or `cycle_reassigned_*` notification exists for the viewer on this cycle (derive from the `cycleEvents` array already computed in the layout at `src/app/(main)/h/[householdSlug]/layout.tsx:80-125`).

  Content: "You're up this week — [N] days left. [Next assignee] is next."
  - N = `differenceInDays(cycle.endDate, now)` (date-fns).
  - [Next assignee] name from the existing `findNextAssignee` call at `dashboard/page.tsx:185-196`.
  - When N ≤ 1 (last day): amber/warning variant styling ("Last day — tomorrow passes to [Next]").
  - When single-member household (next === self): suppress the "X is next" line; copy becomes "You're on rotation — [N] days left in this cycle."

- **D-24:** **Render-order insertion point on the dashboard Server Component:** slot it immediately AFTER `ReassignmentBanner` and BEFORE `PassiveStatusBanner`, matching Phase 5 D-13's precedence (fallback → cycle-start → reassignment → **cycle-countdown (new)** → passive-status → existing sections). The two unread-event banners (CycleStart, Reassignment) still take priority — once marked-read via bell open (Phase 5 D-20), the countdown takes over as the steady-state assignee banner. PassiveStatusBanner remains non-assignee-only (Phase 5 D-12 is unchanged).

- **D-25:** **Derivation rules for mutual exclusivity:**
  - Assignee + unread cycle event → CycleStart or Reassignment (one of).
  - Assignee + no unread event → CycleCountdown (NEW).
  - Non-assignee + active cycle → PassiveStatus (unchanged).
  - Paused cycle or all-unavailable fallback → Fallback (unchanged).
  At most ONE of {CycleCountdown, PassiveStatus, CycleStart, Reassignment} renders per viewer per dashboard load; Fallback stacks above any of them per Phase 5 D-13.

- **D-26:** **Data fetching reuses existing dashboard queries** — NO new query added. Dashboard Server Component already fetches `currentCycle`, `nextAssignee` (via `findNextAssignee`), and `cycleEvents` (via `getCycleNotificationsForViewer`). The CycleCountdown banner reads these props; compute `hasUnreadEvent = cycleEvents.some(e => e.readAt === null && (e.type === 'cycle_started' || e.type.startsWith('cycle_reassigned_')))` and branch on it.

### Availability form UI (AVLB-01/02 — deferred from Phase 3)

- **D-27:** **Availability section within the settings page** (NOT a separate `/settings/availability` sub-route). Binding reason: HOUSEHOLD_PATHS.settings is already the sole availability route for revalidation (`createAvailability` / `deleteAvailability` both call `revalidatePath(HOUSEHOLD_PATHS.settings, "page")`). Rendered as a `<Card>` titled "My availability" (member-self scope). Split into two sub-areas: "Add availability" form + "Upcoming availability" list.

- **D-28:** **Two-picker date range UI** (ROADMAP pitfall-binding): two `Calendar` + `Popover` pickers side-by-side (or stacked on mobile) for start date + end date. Optional `reason` `<Input>` (max 200 chars per existing `createAvailabilitySchema` at `src/features/household/schema.ts`). Submit → `createAvailability`. **No third-party range picker.** Client-side validation: `endDate >= startDate` AND `startDate >= today` (server-side Phase 3 Pitfall 12 check is the authority — client check is UX polish). `calendar.tsx` + `popover.tsx` are both confirmed present in `src/components/ui/`.

- **D-29:** **Existing-availability list = all members' periods, visible to all members.** `getHouseholdAvailabilities(householdId)` returns all members' rows per Phase 3 D-08. Each row displays: owner name (or "You") + date range + reason (if present). Delete button renders only on rows where `row.userId === sessionUser.id` OR `viewerRole === 'OWNER'` (Phase 4's `deleteAvailability` self-or-owner check). Delete → `AlertDialog` confirm → `deleteAvailability`. **Past availabilities** (endDate < today) do NOT render in this list — they're auto-filtered in the query or a client filter; planner decides which layer. Future+current only.

- **D-30:** **Member-view access to own availability CRUD:** non-OWNER members can see D-27's section and add/delete their own rows. Settings-page role-branching (D-02) gates only OWNER-only sections; availability is member-scoped.

### Service layer additions (three NEW Server Actions, three NEW Zod schemas)

- **D-31:** **Three new Server Actions added to `src/features/household/actions.ts`:**
  1. `setDefaultHousehold` (D-06) — any member → sets their `isDefault` pointer.
  2. `updateHouseholdSettings` (D-13) — OWNER → name/timezone/cycleDuration.
  3. `reorderRotation` (D-11) — OWNER → atomic array-replace of rotation order.
  All three follow the Phase 2 D-12 7-step template verbatim: session → demo guard → Zod parse → `requireHouseholdAccess` → role check (setDefault has none; others gate on OWNER) → `$transaction` write → `revalidatePath`.

- **D-32:** **Three new Zod v4 schemas added to `src/features/household/schema.ts`:**
  1. `setDefaultHouseholdSchema` = `{ householdId: z.string().cuid() }`.
  2. `updateHouseholdSettingsSchema` = `{ householdId: z.string().cuid(), name: z.string().min(1).max(100), timezone: z.string().min(1), cycleDuration: z.enum(["1","3","7","14"]).transform(Number) }`. `timezone` does NOT validate against `Intl.supportedValuesOf('timeZone')` at the schema layer (avoids runtime-env dependency in validation); Prisma write is the authority.
  3. `reorderRotationSchema` = `{ householdId: z.string().cuid(), orderedMemberUserIds: z.array(z.string().cuid()).nonempty() }`.

### Test strategy (mocked Prisma, consistent with Phase 2 D-16/D-17)

- **D-33:** **Server Action tests = mocked Prisma, following Phase 2 D-12 pattern.** One test file per new action:
  - `setDefaultHousehold.test.ts` — happy path (default pointer moves atomically); non-member → `ForbiddenError`; demo mode → `{ error }`.
  - `updateHouseholdSettings.test.ts` — happy path (all three fields update); non-OWNER → `ForbiddenError`; invalid cycleDuration (not in preset enum) → Zod validation error; demo mode → `{ error }`.
  - `reorderRotation.test.ts` — happy path (array replace); stale-client-state (input length mismatch or set mismatch) → validation error; non-OWNER → `ForbiddenError`; demo mode → `{ error }`; race: not required at unit level (atomic `$transaction` covers, like Phase 4 D-23).

- **D-34:** **Component tests = React Testing Library for the new UI surfaces:**
  - `household-switcher.test.tsx` — renders households from prop; default indicator on starred row; clicking non-active row invokes route-rewrite logic; detail-route fallback to list.
  - `rotation-reorder.test.tsx` — arrow-click invokes action with expected new order; first-row up / last-row down disabled.
  - `cycle-countdown-banner.test.tsx` — renders for assignee with no unread event; does NOT render for non-assignee; does NOT render when `hasUnreadEvent`; amber variant when `N ≤ 1`; single-member copy variant.
  - `settings-general-form.test.tsx` — RHF + Zod integration; submit invokes action; pending-state disables button.
  - `availability-form.test.tsx` — two-picker interaction; client-side `endDate >= startDate` enforcement; existing-list delete button visibility (self vs others vs owner).

- **D-35:** **Integration tests (real-Prisma) scope-limited to ONE case:** concurrent `reorderRotation` + `removeMember` — confirms the input-set validation (D-11 step 6 "set matches") catches the stale-client-state case in practice. All other actions are TypeScript branch logic over writes that Phase 2/4 already integration-tested at the query layer. No dedicated real-DB tests for `setDefaultHousehold` (single-user transaction) or `updateHouseholdSettings` (no concurrency concern).

### Claude's Discretion

- **D-36:** Exact copy strings for switcher default-toggle ("Make default" vs "Set as default" vs "Pin as default"); pick what aligns with existing app voice.
- **D-37:** Whether the switcher row shows just the household name, or household name + member count + role. Recommend name + role only (member count would require an extra count query per household).
- **D-38:** Mobile switcher exact layout within `UserMenu` — separator above/below vs inline. Recommend separator above household list (so the "current household" header is visually grouped with the household rows).
- **D-39:** "Copy link" toast-on-click copy string. Recommend "Link copied — share it with people you want to invite."
- **D-40:** Toast library — sonner is already present (`src/components/ui/sonner.tsx`); use it for invite-created, link-copied, member-removed confirmations. No other notification library.
- **D-41:** Exact Tailwind tokens for the CycleCountdown banner's amber variant. Reuse the fallback-banner's amber palette (Phase 5 D-15 precedent).
- **D-42:** Whether `reorderRotation` uses `updateMany`-per-row (clearer, 5 queries for 5 members) or a single `$executeRaw` CASE-statement (one query). Recommend updateMany-per-row inside `$transaction` for readability; optimize if audit shows a p95 issue.
- **D-43:** Whether availability sort is asc (earliest upcoming first) or desc. Recommend asc — "next up" is the useful mental model.
- **D-44:** Empty-state copy for Members card (impossible — household always has ≥1 member). Empty-state copy for Invitations: "No active invitations yet."
- **D-45:** Whether to opportunistically fix PROJECT.md known tech debt (`completeOnboarding` revalidatePath, `dueToday` boundary `<` vs `<=`) during this phase. Recommend skip — Phase 6 is already large.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/workstreams/household/ROADMAP.md` §Phase 6 — Goal, success criteria, pitfall flags (shadcn component pre-check, DnD library ban, two-picker availability form pitfall, URL-prefix discipline Pitfall 17)
- `.planning/workstreams/household/REQUIREMENTS.md` §Household settings & switcher UI — HSET-01, HSET-02, HSET-03
- `.planning/workstreams/household/REQUIREMENTS.md` §Rotation engine — ROTA-01 (rotation reorder), ROTA-03 (cycle duration presets: 1/3/7/14), ROTA-07 (membership changes don't retro-change assignee)
- `.planning/workstreams/household/REQUIREMENTS.md` §Availability & skip — AVLB-01, AVLB-02 (member sets / views / deletes their own availability; overlapping periods collapse to union)

### Prior phase binding decisions (foundation this phase assembles into UI)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` — Household slug model (binding for `/h/[slug]/` routing across all phase 6 UI); `HouseholdMember.isDefault`, `rotationOrder`, `role` column semantics
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-01 — `HouseholdMember.isDefault` column migration (already landed); Phase 6 D-06/D-07/D-08 execute the READ-SIDE use of this column
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-03 — layout chokepoint `src/app/(main)/h/[householdSlug]/layout.tsx`; settings page inherits auth + `getCurrentHousehold` from here
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-12 — 7-step Server Action template (binding for D-06, D-13, D-11)
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-04 — hidden-field `householdId` form pattern (binding for all three new forms: settings-general, rotation-reorder-client, availability-form)
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-16, D-17 — mocked-Prisma unit test precedent (binding for D-33)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-08 — `getHouseholdAvailabilities` is any-member readable (binding for D-29)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-20 — `findNextAssignee` export; single-member short-circuit (binding for D-23 cycle-countdown banner "X is next" suppression)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` — Pitfall 12 server-side "startDate >= today" enforcement (binding for D-28 client-side polish — server is the authority)
- `.planning/workstreams/household/phases/04-invitation-system/04-CONTEXT.md` §D-01 — Invitation `tokenHash` persistence; raw token only available at creation (binding for D-20/D-21 "no re-copy existing invite" UX)
- `.planning/workstreams/household/phases/04-invitation-system/04-CONTEXT.md` §D-14 — Ownership transfer via `promoteToOwner` + `demoteToMember` (binding for D-19 two-step transfer flow)
- `.planning/workstreams/household/phases/04-invitation-system/04-CONTEXT.md` §D-15 — `DestructiveLeaveDialog` for sole-OWNER-last-member leave (binding for D-18)
- `.planning/workstreams/household/phases/04-invitation-system/04-CONTEXT.md` — last-OWNER guard on `demoteToMember`, `leaveHousehold`, `removeMember` (binding for D-18 client-side disabled-button gating)
- `.planning/workstreams/household/phases/05-household-notifications/05-CONTEXT.md` §D-11, D-12, D-13 — dashboard banner precedence; four banners already built (binding for D-23/D-24 insertion rules; CycleCountdown is the FIFTH banner)
- `.planning/workstreams/household/phases/05-household-notifications/05-CONTEXT.md` §D-16, D-20 — mark-read-on-open-not-on-render; bell is the acknowledgement surface (binding for D-23 "no unread event" trigger condition)
- `.planning/workstreams/household/phases/05-household-notifications/05-CONTEXT.md` §D-21 — BottomTabBar 4-slot lock (binding for D-04 "switcher goes in UserMenu on mobile, not a new tab")

### Pitfalls (binding)
- ROADMAP Phase 6 pitfall: **shadcn `calendar`, `popover`, `command`, `sheet` pre-check** — verify before install. Phase 6 confirms `calendar` + `popover` present; `command` + `sheet` deferred (D-03 uses DropdownMenu)
- ROADMAP Phase 6 pitfall: **Availability form MUST use two Calendar + Popover pickers; do NOT use a third-party date-range picker** (binding for D-28)
- ROADMAP Phase 6 pitfall: **ROTA-01 uses HTML5 drag-and-drop OR numbered arrows; NO DnD library** (binding for D-10 arrow choice)
- ROADMAP Phase 6 pitfall: **Pitfall 17 — URL routing established in Phase 1; ensure all internal links use `/h/[slug]/` prefix** (binding for D-05 switcher route rewrite)

### Project & tech stack
- `.planning/PROJECT.md` §UX direction — "Mobile bottom-nav with responsive dialog-to-drawer sheets"; supports D-04 mobile switcher placement in UserMenu
- `.planning/PROJECT.md` §Known tech debt — deferred per D-45
- `CLAUDE.md` §Technology Stack — Next.js 16 App Router (Server Components + Server Actions), React 19.2 (`useTransition` for D-12), Prisma 7, Zod v4, shadcn/ui, Tailwind v4
- `CLAUDE.md` §Stack Patterns — Server Components call Prisma directly; Server Actions + Zod + Prisma writes; `revalidatePath` on mutation; `proxy.ts` (not `middleware.ts`) on Next.js 16

### Existing codebase anchor points (paths the planner will modify or extend)
- `prisma/schema.prisma` — `HouseholdMember.isDefault` (line 68), `HouseholdMember.rotationOrder` (line 67), `Household.cycleDuration` (line 46), `Household.timezone` (line 45) all EXIST; Phase 6 ships NO migration
- `src/features/household/paths.ts` — `HOUSEHOLD_PATHS.settings` already defined; no additions needed
- `src/features/household/queries.ts` — `getUserHouseholds`, `getHouseholdMembers`, `getHouseholdInvitations`, `getHouseholdAvailabilities`, `resolveHouseholdBySlug` all exist; no new queries needed
- `src/features/household/actions.ts` — adds `setDefaultHousehold`, `updateHouseholdSettings`, `reorderRotation` (D-31). Existing actions consumed by UI: `createHousehold`, `skipCurrentCycle`, `createAvailability`, `deleteAvailability`, `createInvitation`, `revokeInvitation`, `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember`
- `src/features/household/schema.ts` — adds `setDefaultHouseholdSchema`, `updateHouseholdSettingsSchema`, `reorderRotationSchema` (D-32)
- `src/features/household/guards.ts` — `requireHouseholdAccess` already present; no changes
- `src/features/household/context.ts` — `getCurrentHousehold` already returns `{ household, member, role }`; consumed by settings page for role-branching (D-02)
- `src/features/household/cycle.ts` — `findNextAssignee` already exported; consumed by CycleCountdown banner (D-23, D-26)
- `auth.ts` line 29 — **MUST CHANGE** sort from `createdAt asc` to `[{ isDefault: "desc" }, { createdAt: "asc" }]` (D-07)
- `src/app/(main)/dashboard/page.tsx` lines 25-29 — legacy redirect stub; **MUST CHANGE** same sort as D-07 (D-08)
- `src/app/(main)/h/[householdSlug]/layout.tsx` lines 143-146 — top-nav logo slot becomes `<HouseholdSwitcher>` trigger (D-03)
- `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` — insert `<CycleCountdownBanner>` between ReassignmentBanner and PassiveStatusBanner (D-24)
- `src/app/(main)/h/[householdSlug]/settings/page.tsx` — NEW file (D-01)
- `src/components/household/cycle-countdown-banner.tsx` — NEW (D-23)
- `src/components/household/household-switcher.tsx` — NEW (D-03, D-04)
- `src/components/household/settings/` — NEW directory for settings page sub-components (General form, Members list, Rotation reorder, Invitations card, Availability section, Danger zone)
- `src/components/auth/user-menu.tsx` — extend with mobile household switcher variant (D-04)
- `src/components/household/destructive-leave-dialog.tsx` — existing; consumed by D-18
- `src/components/ui/` confirmed present: `alert-dialog`, `badge`, `button`, `calendar`, `card`, `dialog`, `drawer`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `tooltip`. Confirmed MISSING but NOT REQUIRED for Phase 6 per D-03/D-15: `command`, `sheet`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 3/4 action suite** (`src/features/household/actions.ts`) — all 13 existing Server Actions have UI-ready contracts (returns `{ success, error }` shape, already revalidate `HOUSEHOLD_PATHS.settings`). Phase 6 UI wires them up with zero action-layer changes.
- **Phase 4 `DestructiveLeaveDialog`** (`src/components/household/destructive-leave-dialog.tsx`) — exactly the surface needed for D-18's sole-OWNER-last-member branch.
- **Phase 5 banner composition pattern** (`src/app/(main)/h/[householdSlug]/dashboard/page.tsx`) — four banners already render in prescribed order (D-13); CycleCountdown (D-23) slots in at position 4 without disturbing existing logic.
- **Phase 2 layout chokepoint** (`src/app/(main)/h/[householdSlug]/layout.tsx`) — already fetches user + `getCurrentHousehold` + `cycleEvents`; switcher consumes `getUserHouseholds(sessionUser.id)` (a new call added to the layout's `Promise.all`).
- **`findNextAssignee`** (`src/features/household/cycle.ts`) — already battle-tested for the PassiveStatusBanner; CycleCountdown reuses verbatim.
- **`responsive-dialog.tsx`** (`src/components/shared/responsive-dialog.tsx`) — project's established pattern for Dialog-on-desktop / Drawer-on-mobile. Use for the "Invite people" modal (D-20) and destructive confirms.
- **`sonner`** (`src/components/ui/sonner.tsx`) — toast surface already wired; use for all action confirmations (invite-created, link-copied, member-removed, order-saved).
- **`dropdown-menu.tsx`** — confirmed present; base for `<HouseholdSwitcher>` (D-03) and member-row 3-dot menus (D-18).
- **`calendar.tsx` + `popover.tsx`** — confirmed present; base for availability two-picker (D-28).
- **`alert-dialog.tsx`** — confirmed present; base for all destructive confirmations (D-18 remove member, D-21 revoke invite, D-29 delete availability).
- **`form.tsx` + react-hook-form + Zod v4** — pattern established by `createHouseholdSchema` and the existing register form; use verbatim for settings-general form (D-13/D-16) and availability form (D-28).

### Established Patterns
- **Feature-folder pattern** — `src/features/household/` for all three new actions + schemas (D-31, D-32).
- **7-step Server Action template** (Phase 2 D-12) — binding for D-06, D-11, D-13.
- **Hidden-field `householdId` form pattern** (Phase 2 D-04) — binding for all new forms.
- **String status/role columns (not Prisma enums)** — `HouseholdMember.role`, `Cycle.status`, `HouseholdNotification.type` all string; rotation UI branches on `role === "OWNER"` comparison.
- **`revalidatePath` on `HOUSEHOLD_PATHS.*`** — Phase 2 convention; all three new actions revalidate the same paths the existing actions do (D-06/D-11/D-13).
- **Mocked-Prisma unit tests for shape/branch assertions** (Phase 2 D-16/D-17) — binding for D-33.
- **React 19.2 `useTransition`** — used for optimistic UI on rotation reorder (D-12) and for mark-read on bell open (Phase 5 precedent).
- **`responsive-dialog` for Dialog/Drawer swap** — project's mobile-friendly modal pattern.
- **Role-branched Server Component rendering** — Phase 6 D-02 makes explicit what existing plant/room pages do implicitly (OWNER sees more actions).

### Integration Points
- **Layout chokepoint extension** — `src/app/(main)/h/[householdSlug]/layout.tsx` adds `getUserHouseholds(sessionUser.id)` to its existing Promise.all and passes the result to `<HouseholdSwitcher>` alongside the current household + slug. Bell + reminder queries unchanged.
- **Auth resolver change** — `auth.ts:29` and `src/app/(main)/dashboard/page.tsx:25-29` are the two sites for HSET-02 post-login landing (D-07, D-08). Planner's audit must confirm no third site.
- **Settings page composition** — `src/app/(main)/h/[householdSlug]/settings/page.tsx` (NEW) reads `role` + `household` from `getCurrentHousehold`, calls `getHouseholdMembers`, `getHouseholdInvitations`, `getHouseholdAvailabilities` in parallel, passes props down to the six sub-sections. Non-OWNERs receive a subset of sub-sections.
- **Dashboard banner insertion** — `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` adds `<CycleCountdownBanner>` between existing `<ReassignmentBanner>` and `<PassiveStatusBanner>` (D-24). No new query; consumes existing `currentCycle`, `nextAssignee`, `cycleEvents` props.
- **Phase 7 demo seeding awareness** — demo household will need a default-household pointer (Phase 7 seeds it with `isDefault=true`) and will exercise the new `setDefaultHousehold` guard's demo-mode branch. Phase 6 leaves the action demo-guarded per D-06 step 2.

</code_context>

<specifics>
## Specific Ideas

- **"One settings page, stacked cards, role-branched"** — derived from the fact that `HOUSEHOLD_PATHS.settings` is already single-segment and every existing action revalidates it. Downstream agents should NOT propose a multi-segment split; the existing revalidation contract is the anchor.
- **"Switcher in the logo slot, UserMenu on mobile"** — the natural home given the locked BottomTabBar (Phase 5 D-21) and the fact that the logo area is currently a static Link with no interactive affordance. Do NOT add a fifth BottomTabBar slot.
- **"Default-household toggle lives on the switcher, not on settings"** — colocating "pick your default" next to "switch to this one" keeps the default UX close to where it's consumed. A settings-page radio would require landing on each household's settings separately, which is a worse UX for picking a default from a list.
- **"Fifth banner for assignee-ambient countdown"** — Phase 5's four banners cover unread-event and non-assignee cases; the assignee steady-state was literally uncovered. Don't extend PassiveStatusBanner — a new component is clearer and aligns with the existing one-component-per-role-×-event-type split (Phase 5 D-12).
- **"Numbered arrows, not HTML5 DnD"** — arrows are mobile-first, keyboard-first, and don't require touch-event handling or a DnD polyfill. Don't re-litigate.
- **"Atomic-replace reorder, not pairwise swap"** — race-safe by construction. Don't design a `swapRotation(a, b)` API.
- **"Transfer ownership is two clicks, not one atomic action"** — matches existing Phase 4 D-14 design; adding an atomic `transferOwnership` would duplicate logic already in `promoteToOwner` + `demoteToMember`.
- **"Copy link once at creation, never again"** — direct consequence of Phase 4 D-01's tokenHash-only persistence. Don't add a column to store the raw token just for UX convenience.
- **"Native `<select>` for timezone, not shadcn `command`"** — `Intl.supportedValuesOf('timeZone')` + native select gets us to v1 without installing a new shadcn primitive. Upgrade later if user research shows the long list needs filtering.
- **"Preset cycleDuration (1/3/7/14), not custom input"** — literal ROTA-03 requirement and also the only way to guarantee the rotation math doesn't divide by zero or arbitrary values.

</specifics>

<deferred>
## Deferred Ideas

- **Separate `/settings/members`, `/settings/invitations` sub-routes** — rejected per D-01 (breaks 8 existing revalidatePath calls). Revisit only if the settings page grows beyond a reasonable single-page scroll.
- **shadcn `command` for filterable household switcher** — rejected for v1 (D-03). Revisit when users belong to >10 households (not in current scope).
- **shadcn `sheet` for mobile switcher** — rejected in favor of UserMenu inline (D-04). Revisit if user testing shows DropdownMenu feels cramped at 5+ households.
- **HTML5 drag-and-drop for rotation reorder** — rejected (D-10) in favor of numbered arrows (mobile-first, a11y-first). Revisit only with a well-tested touch-compatible implementation.
- **Pairwise swap API for rotation** — rejected (D-11) due to concurrent-owner race.
- **Dedicated atomic `transferOwnership` Server Action** — rejected (D-19). Two-click flow via `promoteToOwner` + `demoteToMember` is sufficient for v1.
- **Re-copy raw token from existing invite row** — rejected (D-21). Token-hash persistence is a deliberate Phase 4 security property; don't subvert it for UX convenience.
- **Custom cycle duration input** — rejected (D-14). Presets enforce math invariants.
- **shadcn `command` timezone filterable picker** — rejected for v1 (D-15). Native `<select>` with ~400 IANA zones is acceptable; revisit if user feedback shows the scroll is painful.
- **Opportunistic fix of `completeOnboarding` revalidatePath / `dueToday` boundary tech debt** — deferred per D-45.
- **Member-count or plant-count badges in switcher rows** — deferred per D-37 recommendation; would require extra counts.
- **Past-availability history view** — not in Phase 6 scope (D-29 filters to future+current). Revisit if users ask for an audit log of availability.
- **Settings page mobile Sheet/Drawer chrome** — deferred; render as a scrollable page per D-02 role-branching. Revisit if mobile UX feels cramped (PROJECT.md's "dialog-to-drawer" pattern applies to modals, not pages).
- **HouseholdSwitcher virtualization** — not needed at v1 household counts (≤10 per user typical).
- **Fifth "settings" slot in BottomTabBar** — rejected (D-04). BottomTabBar is locked at 4 by Phase 5 D-21.
- **Explicit "Settings" link in desktop top-nav (next to Plants/Rooms)** — deferred; settings is reachable via UserMenu + switcher-row "Settings" in the Household Settings menu. Revisit if discoverability tests fail.
- **Real-DB integration tests for `setDefaultHousehold` and `updateHouseholdSettings`** — rejected per D-35. Single `reorderRotation` + `removeMember` concurrency test covers the stale-client-state case.
- **CycleCountdown variant for non-assignees** — rejected (D-25). PassiveStatusBanner from Phase 5 D-12 already covers non-assignees.
- **Mark-read-on-dashboard-scroll** — rejected (Phase 5 D-16 precedent). Bell-open is the acknowledgement surface.

</deferred>

---

*Phase: 06-settings-ui-switcher-dashboard*
*Workstream: household*
*Context gathered: 2026-04-20 (assumptions mode, user confirmed all assumptions without correction)*
