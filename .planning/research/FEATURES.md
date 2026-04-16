# Feature Research

**Domain:** Shared household plant care — multi-user workspace + rotation scheduling
**Researched:** 2026-04-16
**Confidence:** HIGH (core patterns verified against PagerDuty, Opsgenie, Notion, Linear, on-call rotation literature)

---

## Category 1: Multi-Household Membership

### Table Stakes

| Feature | Why Expected | Complexity | v1 Dependencies |
|---------|--------------|------------|-----------------|
| User belongs to one or more households | Any collaborative app lets you be in multiple groups | MEDIUM | AUTH-01..05, plant schema reparenting |
| One default/active household | Slack, Notion, Linear all have a "current" workspace concept — users expect the app to remember where they were | LOW | Session / cookie store |
| Household switcher (dropdown or sidebar) | Standard in all multi-workspace apps; Notion uses top-left dropdown; Slack uses sidebar icons | LOW | Active household in session |
| URL includes household context (`/h/[slug]/...`) | Path-based routing is the standard for web apps without custom DNS; subdomain is for enterprise | MEDIUM | Next.js dynamic route `[householdSlug]` |
| Household name + optional timezone | Users want to name their household; timezone drives cycle-transition timing | LOW | Household creation form |
| Member list visible to all members | Transparency into who is in the household | LOW | HouseholdMember query |
| Leave household (non-destructive) | Standard in every group app; user loses access, plants stay | LOW | Non-destructive soft remove |
| Ownership transfer (owner → another member) | Required before owner can leave; prevents orphaned households | MEDIUM | Role model (owner vs member) |
| Auto-create solo household on signup | Removes friction; v1.0 users migrate seamlessly to household model | LOW | Signup hook, plant reparenting migration |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Next-cycle assignee preview in switcher | Shows at a glance "Bob's turn in 3 days" without entering settings | LOW | Computed from active cycle |
| Household settings page with rotation config | One canonical place to manage cycle duration, member order, availability | MEDIUM | Settings layout, forms |

### Anti-Features

| Feature | Why Requested | Why Not in v1 | What Instead |
|---------|---------------|---------------|--------------|
| Per-household profile photos / avatars | Personalization feel | File upload infra explicitly deferred; adds no core value | Display name initials as avatar (shadcn/ui Avatar) |
| Household "discovery" or public directory | Team apps have invite-only groups | This is a private household, not a community | Invite link only |
| Archiving / deleting a household | Feels like natural CRUD | Complex cascade (plants, cycles, members); high error risk | Deactivate + prompt ownership transfer; no hard delete in v1 |

---

## Category 2: Membership Invitations (No App-Sent Email)

### Table Stakes

| Feature | Why Expected | Complexity | v1 Dependencies |
|---------|--------------|------------|-----------------|
| Shareable join-link (URL with token) | Notion's "copy invite link" is the canonical no-email invite pattern; widely understood | MEDIUM | Invitation table, UUID/CSPRNG token |
| Link has configurable or default expiry (7 days) | Security standard; industry default is 7 days for workspace invites | LOW | `expiresAt` column, check at accept time |
| Owner can revoke / regenerate link | Notion and Figma both support disabling the current link | LOW | Delete + recreate Invitation row |
| Accept flow handles both logged-out and logged-in users | Invite recipient may not have an account yet | MEDIUM | Token passed through auth redirect, stored in cookie until session established |
| Pending state visible to inviter | Owner should see "invitation pending" in member list | LOW | Invitation rows with `acceptedAt IS NULL` |
| Resend (copy link again) | Invitee may have lost the link | LOW | Re-read existing token or regenerate |

### State Machine: Invitation Lifecycle

```
[Created] → link shared → [Pending]
[Pending] + expiry passed → [Expired]
[Pending] + owner revokes → [Revoked]
[Pending] + recipient accepts → [Accepted] → recipient becomes HouseholdMember
[Expired or Revoked] + owner regenerates → [Created] (new token)
```

Accept flow for a logged-out user:
```
GET /invite/[token]
  → validate token (not expired, not revoked, not already accepted)
  → if logged in: confirm join → POST /api/households/join
  → if logged out: redirect to /signup?invite=[token]
      → on signup complete: auto-join household
      → on login complete: auto-join household
  → redirect to household dashboard
```

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| QR code rendered from the invite link | Let household owner share on a physical note or show phone screen; useful in a home context | LOW | `qrcode` npm package, render server-side or in-browser; pure nice-to-have |
| Invite link shows household name + plant count on accept page | Personalizes the "you're being invited to X" screen | LOW | Fetch Household by token before login |

### Anti-Features

| Feature | Why Requested | Why Not in v1 | What Instead |
|---------|---------------|---------------|--------------|
| App-sent invitation email | Feels more "professional" | Explicitly deferred; requires Resend/SendGrid infra | Owner copies link and pastes it (WhatsApp, iMessage, etc.) |
| Role-based invite (invite as observer) | Granular access control | Observer role is deferred; only owner + member in v1 | All new members join as regular members |
| Invite expiry longer than 30 days or "never expire" | Convenience | Security risk; perpetual links become a liability | 7-day default; owner can regenerate anytime |
| Per-email invitation (one link per person) | Targeted invites | Email-delivery dependency; adds implementation cost | Reusable link until revoked is simpler and sufficient |

---

## Category 3: Rotation / Cycle Engine

### Table Stakes

| Feature | Why Expected | Complexity | v1 Dependencies |
|---------|--------------|------------|-----------------|
| Sequential rotation through member list | The obvious, expected pattern; every chore app uses round-robin | LOW | HouseholdMember.rotationOrder |
| Configurable cycle duration (1/3/7/14 days, default 7) | Households have different rhythms; 7-day weekly is the most common | LOW | Household.cycleDurationDays |
| Exactly one active assignee at all times | Core invariant; eliminates the "whose job is it?" ambiguity | MEDIUM | Cycle table with active record |
| Deterministic anchor-date calculation | Industry standard (PagerDuty, Opsgenie): `currentIndex = floor(daysSinceAnchor / duration) % memberCount` — no need to create new Cycle rows on every transition | LOW | Household.cycleStartDate anchor |
| Assignee shown prominently on dashboard | "You are responsible this cycle" banner; non-assignees see "Alice is responsible" | LOW | DASH-01..05, active cycle query |
| Cycle countdown visible ("3 days left") | Creates predictability; matches expectations from on-call scheduling tools | LOW | Computed from cycleStartDate + duration |
| Next-cycle preview ("Bob is next") | Users want to know who's after them | LOW | `(currentIndex + 1) % memberCount` |
| Reorder rotation members (drag-drop or up/down) | Households want to control who goes when | MEDIUM | Update HouseholdMember.rotationOrder |
| Handle member removal mid-cycle | Member leaves → rotation recalculates from remaining members, current cycle continues if active assignee stays | MEDIUM | Cascade recalculation on member remove |
| Handle member addition | New member added to end of rotation by default | LOW | Append to rotationOrder |

### Rotation Math Detail

**Anchor-date approach (recommended — no stateful Cycle rows required for normal operation):**
```
daysSinceAnchor = floor((now - cycleStartDate) / cycleDurationDays)
currentIndex    = daysSinceAnchor % activeMembers.length
```
This is the same algorithm used by PagerDuty and documented by OneUptime's on-call guide. It is purely deterministic, requires no scheduled jobs for normal transitions, and survives server restarts without losing state.

**When to create a Cycle row:** Only for non-routine events: manual skips, availability-driven reassignments, and override records. This keeps the audit trail clean while avoiding spurious row creation.

**Transition trigger:** Lazy evaluation at request time (compute on page load) is preferred over a cron job, because the calculation is O(1) and always accurate. A background job is only needed for generating notifications at cycle boundaries.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual rotation order in settings (Avatar chain: A → B → C → A) | Makes the cycle tangible and immediately understandable | LOW | CSS flex row of member avatars with arrows |
| "Fairness counter" showing how many cycles each member has had | Transparency; useful when members dispute balance | LOW | Count Cycle rows per member + infer from anchor |

### Anti-Features

| Feature | Why Requested | Why Not in v1 | What Instead |
|---------|---------------|---------------|--------------|
| Weighted rotation (Alice gets 2x cycles) | Power users want fine control | Complex to explain; adds edge cases | Equal sequential rotation; reordering gives implicit weighting |
| Per-plant assignment (Alice owns the fiddle-leaf) | Granular responsibility | Scope explicitly deferred; adds a new assignment model | Household-level assignee applies to all plants |
| Random rotation | Some teams prefer it | Non-deterministic; users can't predict their turn | Sequential only in v1 |
| Fairness auto-balancing (skip penalizes less) | Sounds fair | Complex algorithm; unpredictable from user perspective | Manual reorder handles imbalances |

---

## Category 4: Availability / Skip Handling

### Table Stakes

| Feature | Why Expected | Complexity | v1 Dependencies |
|---------|--------------|------------|-----------------|
| Manual "skip my cycle" action | Immediate need: "I'm sick today, pass to next person" | LOW | Skip Cycle record, reassign to next available |
| Availability period (date range: unavailable from X to Y) | Standard in every scheduling tool (Calendly, PagerDuty, Google Calendar out-of-office) | MEDIUM | Availability table, date range picker |
| Auto-skip when cycle hits an unavailability block | System automatically assigns to next available member during declared period | MEDIUM | Check Availability rows during lazy cycle evaluation |
| Re-entry after availability period ends | Member automatically returns to rotation after their unavailability ends | LOW | Availability has `endDate`; lazy eval resumes them |
| In-app notification to new assignee when reassigned | New assignee needs to know they've been bumped up | LOW | RMDR-01..05 notification center |
| All-members-unavailable fallback | Edge case: system must not crash or produce null assignee | LOW | Fallback to "last known assignee" or "owner" |

### Unavailability Evaluation Logic (Lazy)

```
function resolveAssignee(household, now):
  orderedMembers = members sorted by rotationOrder
  anchorIndex    = computeAnchorIndex(household, now)
  for offset in 0..len(orderedMembers)-1:
    candidate = orderedMembers[(anchorIndex + offset) % len]
    if not isUnavailable(candidate, now):
      return candidate
  // All unavailable
  return fallback: owner or most-recently-active member
```

### UX for Declaring Availability

Industry pattern from calendar/scheduling apps:
- Single dialog: "I'm unavailable" with a date-range picker (start + end date)
- Pre-populated with "today" as start date
- Optional reason field (displayed to other members)
- Edit / delete from "My availability" section in household settings
- No recurring patterns in v1 (e.g., "every weekend") — single date ranges only

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Availability visible in rotation preview | Other members see "Alice is away Jun 10-17" in the rotation UI | LOW | Surface Availability rows in rotation settings |
| "Skip and I'll be back in X days" shortcut | Common case: one-week vacation skip | LOW | Pre-fills unavailability form with +7 days |

### Anti-Features

| Feature | Why Requested | Why Not in v1 | What Instead |
|---------|---------------|---------------|--------------|
| Recurring unavailability ("every weekend") | Power users | Adds cron-like complexity to evaluation; rare use case for plant care | Single date ranges cover all real scenarios |
| Absence approval workflow (owner must approve) | Enterprise pattern | Overkill for a household; creates friction | Self-service: any member can declare own unavailability |
| Integration with external calendar (Google, iCal) | "Sync my vacation" | Requires OAuth scopes and webhook infrastructure | Manual date entry is sufficient for plant care cadence |

---

## Category 5: Assignee-Scoped Notifications

### Table Stakes

| Feature | Why Expected | Complexity | v1 Dependencies |
|---------|--------------|------------|-----------------|
| Daily due/overdue alerts go to current assignee only | Core invariant; non-assignees should not be nagged | LOW | RMDR-01..05, resolveAssignee() at notification generation time |
| Cycle-start banner: "You're responsible this week" | On-call tools (PagerDuty, Opsgenie) always notify on handoff | LOW | RMDR notification + notification center |
| Reassignment notification when skipped or availability bump | New assignee needs to know immediately | LOW | Triggered by skip or availability auto-skip action |
| Non-assignee dashboard shows "Alice is responsible" | Clear passive state; no confusion about who to ask | LOW | DASH-01, assignee display component |
| Notification badge count scoped to actionable items | Badge should only count items relevant to you (due plants, reassignments) — not other members' events | LOW | RMDR-01 filter by userId |

### Notification Routing Pattern

```
At notification generation time (cron or on-demand):
  assignee = resolveAssignee(household, now)
  create Notification for assignee.userId only
  → due today alert   → assignee only
  → overdue alert     → assignee only
  → cycle start       → incoming assignee only
  → skip confirmation → outgoing member (skip actor)
  → reassignment      → incoming assignee
```

This matches the PagerDuty / Opsgenie model: notifications are routed to the "current on-call" identity resolved at alert-creation time, not to a static list.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Notification shows which member is now responsible after reassignment | "You are now responsible (Alice was, she skipped)" — context reduces confusion | LOW | Include previous assignee name in notification body |
| Snooze on cycle-start banner | Reduces notification fatigue; already in v1 snooze system (RMDR-04) | LOW | Reuse existing snooze mechanism |
| "Who last watered this?" shown on plant card | Audit trail surfaces naturally; builds accountability | LOW | Plant.lastActionByUserId + User display name |

### Anti-Features

| Feature | Why Requested | Why Not in v1 | What Instead |
|---------|---------------|---------------|--------------|
| Email notifications for duty cycle | Full loop of responsibility awareness | Explicitly deferred (email infra not in v1) | In-app notification center only (RMDR-01..05) |
| Push notifications to mobile | Always-on awareness | Native push requires PWA service worker or native app | In-app bell + badge on next visit |
| Digest / weekly summary for all members | Nice overview | Email infra required; deferred | Dashboard rotation panel achieves same awareness passively |
| Notifications to non-assignees for every watering event | "I want to know when Bob waters" | Notification spam; every action becomes noisy | Show in unified plant timeline (NOTE-01..03) passively |

---

## Category 6: Audit Trail

### Table Stakes

| Feature | Why Expected | Complexity | v1 Dependencies |
|---------|--------------|------------|-----------------|
| "Watered by Alice" shown in plant timeline | Shared households need attribution; any collaborative tool shows who did what | LOW | WateringLog.userId + User.name |
| "Added by Bob" on plant detail | Provenance for shared plant collections | LOW | Plant.createdByUserId |
| Audit visible to all household members | Transparency is the default expectation | LOW | Existing timeline (NOTE-01..03) enriched with User display |

### Anti-Features

| Feature | Why Requested | Why Not in v1 | What Instead |
|---------|---------------|---------------|--------------|
| Edit / delete other members' log entries | Admin power | Creates conflict and trust issues in households | Each member manages only their own entries |
| Full audit log export (CSV) | Enterprise compliance | Way out of scope for a plant care app | N/A |

---

## Feature Dependencies

```
Household creation
    └──requires──> User authentication (AUTH-01..05)
    └──triggers──> Plant reparenting (Plant.householdId replaces Plant.userId)

Invitation accept flow
    └──requires──> Household exists
    └──requires──> Invitation token (CSPRNG UUID, stored in DB)
    └──requires──> Auth redirect preserves invite token through login/signup

Rotation engine (lazy eval)
    └──requires──> HouseholdMember with rotationOrder
    └──requires──> Household.cycleStartDate anchor
    └──enhances──> Availability table (skip members with active unavailability)

Manual skip
    └──requires──> Rotation engine resolveAssignee()
    └──creates──> Cycle override record for audit
    └──triggers──> Notification to new assignee

Availability period
    └──requires──> Availability table (userId, startDate, endDate)
    └──modifies──> Rotation engine's resolveAssignee() evaluation
    └──triggers──> Auto-skip + notification when current assignee becomes unavailable

Assignee-scoped notifications
    └──requires──> resolveAssignee() at notification creation time
    └──requires──> Notification center (RMDR-01..05) already built in v1.0
    └──extends──> Existing Reminder/Notification model with household context

Audit trail
    └──requires──> WateringLog.userId + Plant.createdByUserId (partially in v1.0)
    └──requires──> User display name accessible in timeline queries
    └──enhances──> Plant timeline (NOTE-01..03)
```

---

## MVP Definition (This Milestone)

### Launch With

- [x] Auto-create solo household on signup + migrate v1.0 plants to householdId
- [x] Household name, timezone, cycle duration settings
- [x] Shareable invite link (CSPRNG token, 7-day expiry, revocable)
- [x] Accept flow: logged-out redirect preserves token through signup/login
- [x] Member list with role (owner / member)
- [x] Leave household (non-destructive); ownership transfer before last owner leaves
- [x] Sequential rotation with configurable order (rotationOrder field)
- [x] Anchor-date deterministic cycle resolution (lazy, no cron for normal transitions)
- [x] Dashboard banner: "You are responsible" / "Alice is responsible"
- [x] Cycle countdown + next-assignee preview
- [x] Manual skip (creates override Cycle record, notifies new assignee)
- [x] Availability period (date range picker, single dialog)
- [x] Auto-skip when cycle hits unavailability block
- [x] All-members-unavailable fallback (owner or last assignee)
- [x] Assignee-scoped due/overdue notifications (routes to resolveAssignee() result)
- [x] Cycle-start + reassignment notifications to incoming assignee
- [x] Audit trail: "Watered by Alice" in plant timeline

### Add After Validation (v1.x)

- [ ] QR code on invite page — trigger: user feedback that copy-link is not enough
- [ ] Rotation fairness counter (cycles per member) — trigger: complaints about imbalance
- [ ] "Skip and back in 7 days" shortcut — trigger: common skip + availability pattern
- [ ] Availability shown in rotation settings preview — trigger: confusion about who is next

### Future Consideration (v2+)

- [ ] Email notifications for cycle events (requires Resend/SendGrid infra)
- [ ] Per-room or per-plant assignee override
- [ ] Observer role (see but don't appear in rotation)
- [ ] Recurring unavailability patterns ("every weekend")
- [ ] External calendar sync (Google Calendar, iCal)
- [ ] Push notifications (PWA service worker)
- [ ] Multiple households per user (currently one default is the v1 model per PROJECT.md)
- [ ] Weighted / fairness-balanced rotation

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auto-create household on signup + plant migration | HIGH | MEDIUM | P1 |
| Shareable invite link | HIGH | MEDIUM | P1 |
| Anchor-date rotation engine + resolveAssignee() | HIGH | MEDIUM | P1 |
| Dashboard assignee banner + countdown | HIGH | LOW | P1 |
| Assignee-scoped notifications | HIGH | LOW | P1 |
| Cycle-start + reassignment notifications | HIGH | LOW | P1 |
| Manual skip | HIGH | LOW | P1 |
| Availability period + auto-skip | HIGH | MEDIUM | P1 |
| Audit trail (watered by) | MEDIUM | LOW | P1 |
| Leave household + ownership transfer | MEDIUM | MEDIUM | P1 |
| Invite accept flow (token through auth) | HIGH | MEDIUM | P1 |
| Reorder rotation members | MEDIUM | MEDIUM | P2 |
| Next-cycle preview | MEDIUM | LOW | P2 |
| All-members-unavailable fallback display | MEDIUM | LOW | P2 |
| QR code for invite link | LOW | LOW | P3 |
| Rotation fairness counter | LOW | LOW | P3 |

---

## Domain Precedents Consulted

| Domain | App / Source | Pattern Applied |
|--------|-------------|-----------------|
| On-call scheduling | PagerDuty, Opsgenie, OneUptime, Xurrent | Anchor-date rotation math, lazy eval, override records |
| Multi-workspace membership | Notion, Slack (via WorkOS blog, Notion help docs) | Workspace switcher, URL-slug routing, leave flow |
| Shareable invite links | Notion (help docs), Figma, WorkOS AuthKit | CSPRNG token, 7-day expiry, revocable, reusable |
| Chore rotation apps | Sweepy, Donetick, Chap | Round-robin assignment, "who is responsible" dashboard UI |
| Invite accept state machine | WorkOS docs, Auth0, Logto, Userpilot | Token-through-auth redirect, new vs existing user paths |
| Availability date ranges | General scheduling UX (NNG, Smashing Magazine) | Single dialog, date-range picker, no recurring patterns in v1 |

---

## Sources

- [PagerDuty Schedule Basics](https://support.pagerduty.com/main/docs/schedule-basics) — Handoff time, rotation types, schedule layers (HIGH confidence, official docs)
- [Opsgenie On-Call Rotations](https://support.atlassian.com/opsgenie/docs/manage-on-call-schedules-and-rotations/) — Anchor-based calculation from starting date, restriction windows (HIGH confidence, official docs)
- [OneUptime On-Call Rotation Guide](https://oneuptime.com/blog/post/2026-02-02-on-call-rotations/view) — Anchor-date formula, lazy evaluation pattern, override records (MEDIUM confidence, third-party guide with working code)
- [Notion Help: Create, Join & Leave Workspaces](https://www.notion.com/help/create-delete-and-switch-workspaces) — Workspace switcher, leave flow, danger zone pattern (HIGH confidence, official docs)
- [Notion Help: Members & Guests](https://www.notion.com/help/add-members-admins-guests-and-groups) — Reusable invite link, copy-link UX (HIGH confidence, official docs)
- [Achromatic Dev: Multi-Tenant Next.js](https://www.achromatic.dev/blog/multi-tenant-architecture-nextjs) — Path-based `/org/[slug]/` vs subdomain routing, OrgSwitcher pattern (MEDIUM confidence, community article)
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) — Official Next.js recommendation (HIGH confidence, official docs, last updated 2026-04-15)
- [WorkOS Invitation Docs](https://workos.com/docs/authkit/invitations) — Token invite, signup-with-token flow, pending/accepted/expired states (HIGH confidence, official docs)
- [Donetick GitHub](https://github.com/donetick/donetick) — Round-robin chore rotation, least-completed and sequential assignment (MEDIUM confidence, OSS project)
- [Cloudron Forum: Invite token 7-day expiry](https://forum.cloudron.io/topic/4760/user-invite-token-please-note-that-the-invite-link-will-expire-in-7-days) — Community-confirmed 7-day standard (LOW confidence, community)
- [Logto: Invite Organization Members](https://docs.logto.io/end-user-flows/organization-experience/invite-organization-members) — State machine for invite (pending → accepted/expired/revoked) (HIGH confidence, official docs)

---
*Feature research for: Plant Minder — household + rotation milestone*
*Researched: 2026-04-16*
