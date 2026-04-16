# Requirements: Plant Minder — Milestone `household`

**Defined:** 2026-04-16
**Milestone name:** Household and Rotation
**Workstream:** `household`
**Core Value:** Users can see at a glance which plants need watering today and log it in one action — extended to multi-user households with rotating responsibility.

## Milestone Requirements

Requirements for milestone `household`. Each maps to a roadmap phase.

### Household model & migration

- [ ] **HSLD-01**: User's solo household is auto-created on signup; user is its owner
- [ ] **HSLD-02**: User can create additional households from settings (becomes owner of each)
- [ ] **HSLD-03**: User can view a list of all households they belong to, with their role in each
- [ ] **HSLD-04**: Existing v1 users are auto-migrated on first login after deployment: their plants, rooms, watering logs, notes, and reminders reparent to an auto-created solo household; user becomes its owner
- [ ] **HSLD-05**: Each household has configurable fields — name, timezone (defaults from creator), default cycle duration (default 7 days), rotation strategy (sequential only in v1)
- [ ] **HSLD-06**: Plants, rooms, watering logs, notes, and reminders are scoped to household — all members of a household share the same collection; cross-household data is never visible

### Membership & invitations

- [ ] **INVT-01**: Owner can generate a shareable invitation link for a household (CSPRNG token, no expiry, revocable)
- [ ] **INVT-02**: Owner can view all active invitation links and revoke any (revocation invalidates the link atomically)
- [ ] **INVT-03**: Opening an invitation link while logged out routes to login/signup; the token is preserved through authentication and applied on successful login
- [ ] **INVT-04**: Opening an invitation link while logged in shows a confirm-join screen with household name, owner, and member count; user explicitly accepts to join
- [ ] **INVT-05**: User can leave any household they are a member of; if the user is the sole owner and the last member, the household and its plants are deleted (confirmed via destructive-action dialog)
- [ ] **INVT-06**: Owner can remove any non-owner member from a household; owner can transfer ownership to another member before leaving

### Rotation engine & cron transitions

- [ ] **ROTA-01**: Household has an ordered rotation list of members; owner can reorder via up/down controls (v1: HTML5 drag-and-drop or numbered arrows, not a DnD library)
- [ ] **ROTA-02**: At any time, exactly one member is the active assignee per household — computed deterministically from rotation start date, cycle duration, and member order (anchor-date formula: `floor(daysSinceAnchor / cycleDuration) % memberCount`)
- [ ] **ROTA-03**: Cycle duration is configurable per household (preset options: 1, 3, 7, 14 days); duration changes take effect at the next cycle boundary, not mid-cycle
- [ ] **ROTA-04**: A `/api/cron/advance-cycles` endpoint advances all households' cycles at cron trigger; protected by `CRON_SECRET` bearer-header auth, idempotent, returns JSON summary of transitions
- [ ] **ROTA-05**: Cycle transitions are timezone-aware — boundaries respect the household's configured timezone; DST transitions do not skew 7-day cycles (implemented via `@date-fns/tz`)
- [ ] **ROTA-06**: Cycle transitions are race-safe — two concurrent cron invocations or a cron + admin action cannot double-advance the same household (row-level lock or unique constraint on `(householdId, cycleNumber)`)
- [ ] **ROTA-07**: Adding or removing a member mid-cycle does not retroactively change the current assignee; the rotation recomputes cleanly for the next cycle

### Availability & skip

- [ ] **AVLB-01**: Member can declare an unavailability period (start date, end date, optional reason) from their settings
- [ ] **AVLB-02**: Member can view and delete their own availability periods; overlapping periods are collapsed to the union
- [ ] **AVLB-03**: When the cron advances a cycle, unavailable members are auto-skipped and responsibility passes to the next available member; skipped members are not dropped from the rotation
- [ ] **AVLB-04**: Active assignee can manually skip their current cycle from the dashboard; cycle immediately advances to the next available member and a reassignment notification fires
- [ ] **AVLB-05**: When all members are unavailable, the household falls back to the owner as assignee and surfaces a banner indicating the fallback state

### Assignee-scoped notifications

- [ ] **HNTF-01**: Only the current assignee receives daily due + overdue in-app notifications for their household's plants; non-assignees see a badge count of 0 for that household
- [ ] **HNTF-02**: When a new cycle starts, the new assignee receives a cycle-start banner notification on their dashboard with number of due plants and cycle end date
- [ ] **HNTF-03**: When responsibility changes mid-cycle (manual skip, auto-skip, membership change), the new assignee receives a reassignment notification; previous assignee's assignment banner is removed within the same refresh
- [ ] **HNTF-04**: Non-assignees see a passive household status banner — e.g., "Alice is responsible this week" with next-cycle preview ("Bob is next")

### Audit trail

- [ ] **AUDT-01**: Plant actions (watering logs, notes) record `performedByUserId`; attribution is visible in unified timeline entries ("Watered by Alice")
- [ ] **AUDT-02**: Plants and rooms record `createdByUserId`; visible on plant detail page

### Household settings & switcher UI

- [ ] **HSET-01**: Authenticated routes live under `/h/<householdSlug>/...`; the layout provides a household switcher in the top nav that navigates the user between their households while preserving the current route suffix
- [ ] **HSET-02**: User can mark any household they belong to as "default" — it becomes the active household destination on login
- [ ] **HSET-03**: Owner can access a household settings page: edit name/timezone/cycle duration, view and reorder member list, generate/revoke invitation links, remove members, transfer ownership

### Demo mode compatibility

- [ ] **HDMO-01**: Demo user is a member of a pre-seeded "Demo Household" with sample members, an active cycle, and a sample availability period
- [ ] **HDMO-02**: All household-mutating actions (invite, skip, reorder, settings, member removal) are blocked in demo mode using the existing read-only guard pattern

## Deferred Requirements (future milestones)

Tracked but not in this roadmap.

### Email notifications (dedicated future milestone)
- **EMAIL-01**: Email delivery infrastructure (Resend or equivalent)
- **EMAIL-02**: Daily reminder + overdue email to current assignee
- **EMAIL-03**: Cycle-start, reassignment, skip-confirmation emails
- **EMAIL-04**: Per-user email preferences (receive when assigned, summary emails)
- **EMAIL-05**: Invitation email delivery (replaces manual link-sharing)

### Advanced rotation
- **ROTAX-01**: Per-room or per-plant member assignment (override rotation for specific plants)
- **ROTAX-02**: Fairness balancing (auto-adjust rotation based on past effort)
- **ROTAX-03**: Recurring availability patterns (every weekend, etc.)

### Extended membership
- **MEMBX-01**: Observer role (visible, never assigned to cycles)
- **MEMBX-02**: Bulk member actions (remove many at once)
- **MEMBX-03**: Inter-household plant transfer (move plants when leaving)

### Household summary
- **SUMMX-01**: Weekly household summary (who handled last cycle, upcoming rotation) — in-app now, email when EMAIL-* lands

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email notification delivery | Explicitly deferred to a dedicated future milestone; requires SMTP infrastructure and templating |
| Push / native-mobile notifications | Out of scope per project constraint (responsive web only, no native mobile) |
| Viewing data from multiple households merged in one dashboard | URL-scoped routing is per-tab; aggregated dashboards require a different UX model (out of scope) |
| Inter-household plant transfer | Leaving a solo household deletes it in v1; plant transfer deferred to `MEMBX-03` in a future milestone |
| Custom rotation algorithms (priority, load-aware, fairness) | Sequential-only for v1; algorithm variants deferred to `ROTAX-*` |
| Real-time live updates when another member acts | Server Components refresh on nav; WebSocket/SSE push is out of scope |
| Invitation via app-sent email | No email infrastructure in this milestone; owners share link via their own channel |
| Plant photo uploads (now household-scoped) | Photo storage still deferred project-wide (placeholder icons only) |
| Per-plant / per-room notification overrides | Keep v1 household-scoped; per-plant overrides are v2+ |
| Multi-timezone per household | Single household timezone (configurable) for v1; per-member timezone is v2 |

## Traceability

(Empty — populated during roadmap creation.)

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- Milestone requirements: 35 total
- Mapped to phases: 0
- Unmapped: 35 ⚠️ (pending roadmap)

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after initial definition for milestone `household`*
