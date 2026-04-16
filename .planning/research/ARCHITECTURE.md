# Architecture Research

**Domain:** Multi-tenant household + rotation integration into existing Next.js App Router + Prisma codebase
**Researched:** 2026-04-16
**Confidence:** HIGH — based on direct inspection of the v1.0 codebase, not inference

---

## 1. Data Model Refactor Path

### Current state

Every resource is scoped by `userId` at the model level:

- `Plant.userId` — hard FK to `User`
- `Room.userId` — hard FK to `User`
- `Reminder.userId` — FK used in `@@unique([plantId, userId])`
- `WateringLog`, `Note`, `HealthLog` — no userId; ownership is derived through `plant.userId`

### Target state

Plants and Rooms must belong to a `Household`. A `Household` has N `HouseholdMember` rows (one per user). Users look up their active household at request time.

### Migration strategy: single additive migration, no dual-write

Do not dual-write. The scope change is surgical enough that a single migration with a data backfill script is the correct approach. Dual-write only makes sense when you must support two traffic patterns simultaneously. This app has no mobile clients or external API consumers — all traffic is Next.js Server Components and Server Actions that you control and can redeploy atomically.

**Migration sequence (one Prisma migration file):**

```sql
-- Step 1: Create Household and HouseholdMember tables
-- Step 2: Create Cycle, Availability, Invitation tables
-- Step 3: Add householdId (nullable) to Plant and Room
-- Step 4: Data backfill (script or migration inline):
--   For each distinct userId in Plant:
--     Create a Household (name = user.name + "'s Household", timezone from user.timezone)
--     Create a HouseholdMember row (householdId, userId, role=OWNER, rotationOrder=0)
--     UPDATE Plant SET householdId = <new id> WHERE userId = <user id>
--     UPDATE Room SET householdId = <new id> WHERE userId = <user id>
-- Step 5: Add NOT NULL constraint and foreign keys now that data is populated
-- Step 6: Keep Plant.userId and Room.userId in schema but rename/repurpose:
--   Plant.userId → Plant.createdByUserId (audit field, nullable)
--   Room.userId can be dropped or kept as createdByUserId
```

**Why keep audit fields:** The spec calls for `createdByUserId` and `lastActionByUserId` on Plant. Repurposing the existing `userId` column to `createdByUserId` avoids a data-destroying column drop and preserves the existing data semantics.

**Indexes needed on new tables:**

```prisma
model Plant {
  householdId       String
  household         Household     @relation(...)
  createdByUserId   String?       // renamed from userId
  lastActionByUserId String?      // new — updated on every watering log

  @@index([householdId])
  @@index([householdId, archivedAt])   // dashboard query pattern
  @@index([householdId, nextWateringAt]) // urgency sort
}

model Room {
  householdId String
  household   Household @relation(...)

  @@index([householdId])
}

model HouseholdMember {
  @@unique([householdId, userId])
  @@index([userId])                // for "which households does this user belong to?"
}

model Cycle {
  @@index([householdId, status])   // "find active cycle for household" is on every page load
}
```

**Cascade behavior:**
- `Household` → `Plant`: `onDelete: Cascade` (deleting a household removes its plants)
- `Household` → `HouseholdMember`: `onDelete: Cascade`
- `Household` → `Cycle`: `onDelete: Cascade`
- `Plant` → `WateringLog`, `Note`, `Reminder`: keep existing `onDelete: Cascade`
- `HouseholdMember` removal: do NOT cascade-delete plants; plants belong to the household, not the member

**New schema models (abbreviated):**

```prisma
model Household {
  id                 String            @id @default(cuid())
  name               String
  timezone           String            @default("UTC")
  cycleDurationDays  Int               @default(7)
  createdAt          DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime          @updatedAt @db.Timestamptz(3)
  members            HouseholdMember[]
  plants             Plant[]
  rooms              Room[]
  cycles             Cycle[]
  invitations        Invitation[]
}

model HouseholdMember {
  id                 String      @id @default(cuid())
  householdId        String
  household          Household   @relation(fields: [householdId], references: [id], onDelete: Cascade)
  userId             String
  user               User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  role               MemberRole  @default(MEMBER)
  rotationOrder      Int         @default(0)
  participationStatus ParticipationStatus @default(ACTIVE)
  createdAt          DateTime    @default(now()) @db.Timestamptz(3)

  @@unique([householdId, userId])
  @@index([userId])
}

model Cycle {
  id              String      @id @default(cuid())
  householdId     String
  household       Household   @relation(fields: [householdId], references: [id], onDelete: Cascade)
  assignedUserId  String
  assignedUser    User        @relation(fields: [assignedUserId], references: [id])
  startDate       DateTime    @db.Timestamptz(3)
  endDate         DateTime    @db.Timestamptz(3)
  status          CycleStatus @default(ACTIVE)
  createdAt       DateTime    @default(now()) @db.Timestamptz(3)

  @@index([householdId, status])
}

model Availability {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  householdId String
  startDate   DateTime  @db.Timestamptz(3)
  endDate     DateTime  @db.Timestamptz(3)
  reason      String?
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)

  @@index([userId, householdId])
}

model Invitation {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  token       String    @unique
  expiresAt   DateTime  @db.Timestamptz(3)
  acceptedAt  DateTime? @db.Timestamptz(3)
  revokedAt   DateTime? @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)

  @@index([token])       // join link lookup is always by token
}

enum MemberRole { OWNER MEMBER }
enum ParticipationStatus { ACTIVE SILENT }
enum CycleStatus { ACTIVE COMPLETED SKIPPED }
```

**Migration script placement:** Write a standalone `prisma/migrations/household-backfill/seed.ts` (or inline as a `migration.sql` DO block). Run it between `addNullable` and `makeNotNull` steps using `prisma migrate dev --create-only` + manual edit.

---

## 2. Session / Active Household

### Decision: JWT claim for `activeHouseholdId`, refreshed on household switch

**Recommendation:** Store `activeHouseholdId` in the JWT token (same mechanism as `isDemo` and `id`). Do not use URL path segments, server cookies, or a `defaultHouseholdId` DB column as the primary mechanism.

**Rationale:**
- The `user_tz` cookie pattern already exists and works for a similar "per-request context" problem. But timezone is a display hint; household scoping is a security boundary. A JWT claim is tamper-proof (signed); a plain cookie is not.
- URL path (`/h/[householdId]/dashboard`) would require rewriting every route and every link in the app — high migration cost for v1 where users belong to exactly one household by default. Defer URL-scoped routing to a future milestone when multi-household switcher is needed.
- A `User.defaultHouseholdId` DB column works but requires an extra DB lookup on every page load to resolve context. The JWT approach front-loads this cost to session issuance.

**Implementation:**

```typescript
// auth.ts — extend jwt callback
async jwt({ token, user, trigger, session }) {
  if (user) {
    token.id = user.id;
    // Look up the user's household membership on login
    const membership = await db.householdMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" }, // first household = default
      select: { householdId: true },
    });
    token.activeHouseholdId = membership?.householdId ?? null;
    token.isDemo = /* existing logic */;
  }
  // Allow explicit update trigger (household switcher)
  if (trigger === "update" && session?.activeHouseholdId) {
    token.activeHouseholdId = session.activeHouseholdId;
  }
  return token;
},
async session({ session, token }) {
  session.user.id = token.id as string;
  session.user.isDemo = token.isDemo === true;
  session.user.activeHouseholdId = token.activeHouseholdId as string | null;
  return session;
},
```

```typescript
// src/types/next-auth.d.ts — extend the Session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isDemo: boolean;
      activeHouseholdId: string | null; // NEW
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isDemo?: boolean;
    activeHouseholdId?: string | null; // NEW
  }
}
```

**Switching households:** Call `update()` from NextAuth v5 to refresh the JWT in-place without a full re-login. The household switcher UI component calls a Server Action that calls `update({ activeHouseholdId: newId })`.

**How Server Components / Server Actions derive current household:**

```typescript
// Every query function and action already follows the pattern:
//   const session = await auth();
//   const householdId = session.user.activeHouseholdId;
// No helper wrapper needed. A scoped Prisma helper (prismaForHousehold) would
// only be valuable if you needed row-level security at the DB level.
// For this stack, explicit householdId in every where clause is simpler,
// explicit, and testable.
```

**Scoped helper vs inline where clause:** Do not create a `prismaForHousehold(id)` wrapper. PostgreSQL RLS (row-level security) would be the right primitive for that pattern, but Prisma's client does not support RLS session parameters cleanly. Inline `where: { householdId }` in every query function is the correct pattern here — it mirrors what v1 already does with `userId` and requires no new abstraction.

**Membership verification guard** (add to the shared layer):

```typescript
// src/lib/require-household.ts
export async function requireHouseholdAccess(
  userId: string,
  householdId: string
): Promise<void> {
  const membership = await db.householdMember.findFirst({
    where: { userId, householdId },
  });
  if (!membership) throw new Error("Forbidden");
}
```

Call this at the start of every Server Action that mutates household-owned data, just like v1 does `plant.userId === session.user.id` checks today.

---

## 3. Rotation Engine Placement

### Decision: Lazy transition at request time + periodic Vercel Cron safety-net

**Recommendation:** Hybrid. Primary mechanism is lazy (request-time). Safety-net is a Vercel Cron job once per day.

**Why not pure scheduled (cron-only):**
- Cron fires at a fixed time, but cycle end is deterministic per household and per timezone. A 7-day cycle that started at 14:32 UTC ends at 14:32 UTC 7 days later. If cron runs at 00:00 UTC, the cycle would not transition until the next cron after the deadline — up to 24 hours late. Users would see a stale assignee badge all morning.
- Scheduled-only creates a system with invisible failure modes: if a cron job errors, you have no fallback, and users see wrong state silently.

**Why not pure lazy:**
- If no user opens the app for 2+ days (holiday), no transition fires. The active assignee is stale. The safety-net cron catches this.

**Hybrid implementation:**

The transition engine is a pure function `advanceCycle(householdId)` in `src/features/cycles/engine.ts`:

```typescript
// src/features/cycles/engine.ts
export async function maybeAdvanceCycle(householdId: string): Promise<void> {
  const activeCycle = await db.cycle.findFirst({
    where: { householdId, status: "ACTIVE" },
  });
  if (!activeCycle) {
    await createFirstCycle(householdId);
    return;
  }
  const now = new Date();
  if (now < activeCycle.endDate) return; // still within the cycle window

  await advanceCycle(householdId, activeCycle);
}

async function advanceCycle(householdId: string, expiredCycle: Cycle): Promise<void> {
  // 1. Mark current cycle as COMPLETED
  // 2. Find next available member (respecting Availability and rotationOrder)
  // 3. Create new Cycle row with startDate=now, endDate=now+cycleDurationDays
  // 4. Create notification records for new assignee
  // This runs in a db.$transaction() for atomicity
}
```

Call `maybeAdvanceCycle(householdId)` at the top of:
- `getDashboardPlants(householdId, ...)` — every dashboard load
- The cycle-status Server Component in the layout

Vercel Cron (`/api/cron/advance-cycles`) iterates all households with an expired ACTIVE cycle and calls `advanceCycle` on each. Runs once per hour (not daily — hourly balances freshness vs cron invocation cost).

**Timezone note:** Cycle boundaries are stored as absolute UTC timestamps (`TIMESTAMPTZ`). The "7-day cycle" is computed as `startDate + 7 * 86400 seconds`, not "7 calendar days in the household's timezone." This is intentional: it avoids DST edge cases and matches the existing `nextWateringAt` pattern in v1.

---

## 4. Notification Center Refactor

### Current state

`src/features/reminders/queries.ts`:
- `getReminderCount(userId, todayStart, todayEnd)` — queries `Plant WHERE userId = ?`
- `getReminderItems(userId, todayStart, todayEnd)` — same pattern

`Reminder` model: `@@unique([plantId, userId])` — one reminder setting per plant per user.

`src/app/(main)/layout.tsx`:
- Calls both query functions with `session.user.id`
- Passes count + items to `NotificationBell` and `BottomTabBar`

### What changes

**Schema change AND query filter change — both required.**

The `Reminder` model's `userId` field currently serves two purposes: ownership check and "who to notify." After the household reparent, Plant no longer has `userId`, so `Reminder` must also reparent ownership to household while keeping per-user notification preferences.

New `Reminder` model semantics:
- `Reminder.plantId` — unchanged
- `Reminder.userId` — keep as "which user's preference is this"
- Add `Reminder.householdId` — denormalized for faster queries (avoids join through plant)
- The `@@unique([plantId, userId])` constraint stays correct

**New notification types to add to `Reminder` (or a separate `HouseholdNotification` model):**

The existing `Reminder` model is a per-plant preference store (enabled/snoozed). It is not a general-purpose notification queue. Cycle-start and reassignment banners are not plant-specific — they need a separate `HouseholdNotification` model:

```prisma
model HouseholdNotification {
  id          String                   @id @default(cuid())
  householdId String
  household   Household                @relation(...)
  userId      String                   // recipient
  user        User                     @relation(...)
  type        HouseholdNotifType       // CYCLE_START | REASSIGNMENT | SKIP_CONFIRMED
  readAt      DateTime?                @db.Timestamptz(3)
  payload     Json                     // { cycleId, fromUserId, reason, etc. }
  createdAt   DateTime                 @default(now()) @db.Timestamptz(3)

  @@index([userId, readAt])
  @@index([householdId])
}

enum HouseholdNotifType { CYCLE_START REASSIGNMENT SKIP_CONFIRMED }
```

**Query filter changes in `reminders/queries.ts`:**

```typescript
// BEFORE
export async function getReminderCount(userId: string, ...) {
  db.plant.count({ where: { userId, ... } })
}

// AFTER
export async function getReminderCount(
  userId: string,
  householdId: string,
  ...
) {
  // Plants are now scoped to householdId
  // Only show reminders to the current assignee
  const activeCycle = await db.cycle.findFirst({
    where: { householdId, status: "ACTIVE" },
    select: { assignedUserId: true },
  });
  const isAssignee = activeCycle?.assignedUserId === userId;
  if (!isAssignee) return 0; // non-assignees see no plant-care badges

  db.plant.count({ where: { householdId, ... } })
}
```

**`src/app/(main)/layout.tsx` changes:**
- Pass `session.user.activeHouseholdId` to both reminder query functions
- Add a `HouseholdNotification` count query for the cycle/reassignment banner count (separate from the plant-reminder count)

**`src/types/reminders/types.ts`:** `ReminderItem` type requires no structural change — it carries plantId, nickname, etc. The query that populates it changes to use `householdId`.

**`NotificationBell` and `BottomTabBar`:** No structural change needed. They receive `count` and `items` as props from the layout Server Component. The layout changes what it queries, not what it passes down.

---

## 5. Invitation State Machine

### Routes needed

| Route | Protection | Purpose |
|-------|------------|---------|
| `/join/[token]` | **Public** (unauthenticated visitors must reach it) | Invitation landing page |
| `/join/[token]` (POST via Server Action) | Session required or signup | Accept invitation |
| `/settings/household` | Authenticated | Manage household, view invites, resend, revoke |

**`/join/[token]` must be added to the public paths list in `auth.config.ts`:**

```typescript
// auth.config.ts
const publicPaths = ["/login", "/register", "/demo", "/join"]; // ADD /join
```

And the proxy.ts matcher must NOT block `/join/`:

```typescript
// proxy.ts
matcher: [
  "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo|join).*)",
]
```

### State machine

```
Invitation states: PENDING → ACCEPTED | EXPIRED | REVOKED

/join/[token] page logic (Server Component):
  1. Look up Invitation by token
  2. If not found → 404
  3. If revokedAt is set → "This invitation was revoked" page
  4. If expiresAt < now → "This invitation has expired" page + option to request new one
  5. If acceptedAt is set → "Already accepted" page with login link
  6. If user is logged in → show "Join [Household Name]?" confirm screen
  7. If user is not logged in → show login/register form with token persisted
```

**Token persistence during login/register flow:**

The visitor who receives the link is not logged in. They need to:
1. Click link → `/join/[token]`
2. Register or log in
3. Land back at `/join/[token]` and confirm the join

Use a URL query param to thread the token through auth: after register/login, redirect to `/join/[token]` rather than `/dashboard`. The `redirectTo` parameter in `signIn()` handles this:

```typescript
// Server Action: acceptInvitation
await signIn("credentials", {
  ...,
  redirectTo: `/join/${token}`, // returns user to join page after auth
});
```

**Server Actions for invite lifecycle:**

```typescript
// src/features/household/actions.ts
export async function createInvitation(householdId: string): Promise<{ token: string }>
export async function revokeInvitation(invitationId: string): Promise<void>
export async function acceptInvitation(token: string): Promise<void>
  // 1. Validate session
  // 2. Look up Invitation, check expiry and revocation
  // 3. Check user is not already a member
  // 4. Create HouseholdMember row
  // 5. If user had their own solo household with no other members, handle cleanup (defer to phase)
  // 6. Update session activeHouseholdId to new household
  // 7. redirect("/dashboard")
```

**Token generation:** `crypto.randomBytes(32).toString('hex')` — 64-char hex string. Expiry default: 72 hours from creation.

---

## 6. Household Switcher UI Placement

### Decision: Top-nav dropdown, no URL path prefix

For v1, users belong to one household. The switcher is for the future "join a second household" path. Build it now but keep it minimal:

**Placement:** Replace or extend the `UserMenu` component in `src/components/auth/user-menu.tsx`. Add a "Households" section to the dropdown that lists the user's memberships. On click, fire a Server Action that calls `update({ activeHouseholdId })` and `router.refresh()`.

**Not a modal/sheet:** A simple dropdown item is sufficient. A full sheet/modal is overkill when users have 1-2 households in v1.

**Mobile:** The `BottomTabBar` has a fixed 4-slot layout (Dashboard, Plants, Rooms, Alerts). Do not add a 5th tab. The household switcher lives in the top nav only — acceptable because switching households is infrequent, not a primary navigation action.

**Household settings page:** `/settings/household` — linked from `UserMenu`. Contains: household name, member list with rotation order, invite link generation, leave household. Use the existing `ResponsiveDialog` pattern for edit flows within the page.

---

## 7. Build Order

The dependency graph below is strict — each item unblocks the next. Work within a phase can proceed in parallel; work across phase boundaries cannot.

```
Phase H1: Schema migration (foundation — nothing else can start without this)
  └── prisma/schema.prisma: add Household, HouseholdMember, Cycle, Availability, Invitation
  └── prisma/migrations/: additive migration + backfill script
  └── src/types/next-auth.d.ts: add activeHouseholdId to Session and JWT
  └── auth.ts: extend jwt + session callbacks
  └── src/features/household/: new feature folder with basic queries

Phase H2: Query and action layer updates (unblocked by H1)
  ├── src/features/plants/queries.ts: userId → householdId
  ├── src/features/plants/actions.ts: userId → householdId + membership check
  ├── src/features/rooms/queries.ts: userId → householdId
  ├── src/features/rooms/actions.ts: userId → householdId + membership check
  ├── src/features/watering/queries.ts: userId → householdId
  ├── src/features/watering/actions.ts: ownership check through householdId
  ├── src/features/notes/queries.ts: ownership check through householdId
  ├── src/features/notes/actions.ts: same
  └── src/features/reminders/queries.ts: userId → householdId + assignee filter

Phase H3: Rotation engine (unblocked by H1; run in parallel with H2)
  └── src/features/cycles/engine.ts: maybeAdvanceCycle, advanceCycle, nextAvailableMember
  └── src/features/cycles/queries.ts: getActiveCycle, getCycleHistory
  └── src/features/cycles/actions.ts: skipCycle, overrideCycle
  └── src/app/api/cron/advance-cycles/route.ts: Vercel Cron endpoint

Phase H4: Household notifications (unblocked by H2 + H3)
  └── HouseholdNotification model (second migration)
  └── src/features/household/notifications.ts: create, read, mark-read
  └── src/app/(main)/layout.tsx: add householdId to reminder queries, add notification banner

Phase H5: Invitation system (unblocked by H1)
  └── auth.config.ts: add /join to publicPaths
  └── proxy.ts: add join to matcher exclusion
  └── src/app/(auth)/join/[token]/page.tsx: NEW public page
  └── src/features/household/actions.ts: createInvitation, acceptInvitation, revokeInvitation

Phase H6: Household settings UI (unblocked by H2, H3, H5)
  └── src/app/(main)/settings/household/page.tsx: NEW page
  └── src/components/household/household-switcher.tsx: NEW component (extends UserMenu)
  └── src/components/household/member-list.tsx: NEW component (rotation reorder)
  └── src/components/household/availability-form.tsx: NEW component
  └── src/app/(main)/dashboard/page.tsx: add assignee banner + cycle countdown

Phase H7: Demo mode compatibility (unblocked by H5)
  └── src/features/demo/actions.ts: seed a demo Household when creating demo user
  └── proxy.ts: /join must stay public even for demo
```

**Why this order:**
- H1 must be first because every subsequent query change depends on the new schema columns existing in the database. A deploy without H1 would break all plant queries.
- H2 and H3 can proceed in parallel after H1 because they touch different files.
- H4 (notifications) needs both a working `householdId` query layer (H2) and a working cycle engine (H3) to know who the current assignee is.
- H5 (invitations) only needs H1 — the `Invitation` model is created there. The join page can be built and deployed before household settings exist.
- H6 (settings UI) needs H2 (so the page can read household members) and H5 (so it can generate invite links).
- H7 (demo) is last because demo seeds data; it needs the final schema shape to create valid demo households.

---

## 8. Files Likely to Change

### New files

```
prisma/migrations/<timestamp>_household_foundation/
  migration.sql
  backfill.ts                            # data migration script

src/features/household/
  actions.ts                             # createHousehold, createInvitation, acceptInvitation, revokeInvitation, switchHousehold, leaveHousehold, updateHousehold
  queries.ts                             # getHousehold, getHouseholdMembers, getUserHouseholds
  schemas.ts                             # Zod schemas for household actions
  notifications.ts                       # HouseholdNotification CRUD

src/features/cycles/
  engine.ts                              # maybeAdvanceCycle, advanceCycle, nextAvailableMember
  queries.ts                             # getActiveCycle, getCycleMembers
  actions.ts                             # skipCycle
  schemas.ts

src/app/(auth)/join/
  [token]/page.tsx                       # Public invitation landing page

src/app/(main)/settings/
  household/page.tsx                     # Household management page

src/components/household/
  household-switcher.tsx                 # Extends UserMenu dropdown
  member-list.tsx                        # Rotation order drag-reorder
  availability-form.tsx                  # Set unavailable period
  cycle-banner.tsx                       # "You are responsible this cycle" banner
  invite-link.tsx                        # Generate / copy invitation link

src/app/api/cron/
  advance-cycles/route.ts               # Vercel Cron endpoint
```

### Modified files (with change description)

```
prisma/schema.prisma
  + Household, HouseholdMember, Cycle, Availability, Invitation, HouseholdNotification models
  ~ Plant: add householdId (NOT NULL), rename userId → createdByUserId, add lastActionByUserId
  ~ Room: add householdId (NOT NULL), keep or drop userId
  ~ Reminder: add householdId (denormalized for query performance)
  ~ User: add householdMemberships relation, cycles relation, availability relation

auth.ts
  ~ jwt callback: add activeHouseholdId lookup on login
  ~ jwt callback: handle "update" trigger for household switching
  ~ session callback: expose activeHouseholdId

auth.config.ts
  ~ publicPaths: add "/join"

proxy.ts
  ~ matcher: add "join" to exclusion pattern

src/types/next-auth.d.ts
  + activeHouseholdId: string | null on Session.user and JWT

src/features/plants/queries.ts
  ~ getPlants: userId → householdId parameter
  ~ getPlant: ownership check → householdId membership check
  ~ getDashboardPlants: userId → householdId

src/features/plants/actions.ts
  ~ All actions: ownership check from userId match → householdId membership check
  ~ createPlant: set householdId, createdByUserId; no longer sets userId

src/features/rooms/queries.ts
  ~ All queries: userId → householdId

src/features/rooms/actions.ts
  ~ All actions: ownership via householdId membership

src/features/watering/queries.ts
  ~ getDashboardPlants: userId → householdId
  ~ getWateringHistory: ownership check through householdId

src/features/watering/actions.ts
  ~ logWatering: ownership through householdId; update Plant.lastActionByUserId
  ~ All other actions: same ownership pattern change

src/features/notes/queries.ts
  ~ getTimeline: ownership through householdId

src/features/notes/actions.ts
  ~ All actions: ownership through householdId

src/features/reminders/queries.ts
  ~ getReminderCount: add householdId param; filter by active cycle assignee
  ~ getReminderItems: same

src/features/reminders/actions.ts
  ~ Ownership checks: userId → householdId membership

src/features/demo/actions.ts
  ~ startDemoSession: create a solo Household + HouseholdMember for demo user
  ~ startDemoSession: set up a first Cycle with demo user as assignee
  ~ seedStarterPlants: use householdId instead of userId

src/app/(main)/layout.tsx
  ~ Pass activeHouseholdId to reminder queries
  ~ Add householdId to getReminderCount / getReminderItems calls
  ~ Add cycle-aware HouseholdNotification banner render

src/app/(main)/dashboard/page.tsx
  ~ getDashboardPlants: userId → householdId
  ~ Add CycleBanner component showing current assignee + countdown
  ~ Add "next assignee" preview if within 24 hours of cycle end

src/app/(main)/plants/page.tsx
  ~ getPlants: userId → householdId
  ~ Show "last watered by [member]" on plant cards (optional, from lastActionByUserId)

src/app/(main)/rooms/[id]/page.tsx
  ~ getRoom: householdId membership check

src/app/(main)/plants/[id]/page.tsx
  ~ getPlant: householdId membership check
  ~ Timeline: WateringLog needs lastActionByUserId join for "watered by [member]" label

src/components/auth/user-menu.tsx
  ~ Add "Households" section with switcher items
  ~ Add link to /settings/household
```

---

## Data Flow: Household-Aware Request

```
Browser request → proxy.ts (NextAuth edge check, no householdId needed at edge)
    ↓
Server Component (e.g. dashboard/page.tsx)
    ↓ await auth()
Session { user.id, user.activeHouseholdId }
    ↓
maybeAdvanceCycle(activeHouseholdId)    ← lazy rotation check
    ↓
getDashboardPlants(activeHouseholdId, todayStart, todayEnd)
    db.plant.findMany({ where: { householdId: activeHouseholdId, archivedAt: null } })
    ↓
classifyAndSort(plants, ...)            ← pure function, unchanged
    ↓
<DashboardClient groups={groups} />
```

```
Server Action (e.g. logWatering)
    ↓ await auth()
session.user.id, session.user.activeHouseholdId
    ↓ requireHouseholdAccess(userId, householdId)   ← membership guard
    ↓ db.plant.findFirst({ where: { id, householdId } })  ← ownership via household
    ↓ db.wateringLog.create(...)
    ↓ db.plant.update({ lastActionByUserId: userId, ... })
    ↓ revalidatePath(...)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Dual `userId` + `householdId` on Plant during a "transition period"

**What it looks like:** Keeping `Plant.userId` as a required field post-migration and writing both `userId` and `householdId` on every new plant.

**Why wrong:** Creates two sources of truth for ownership. Queries diverge — some check `userId`, others check `householdId`. This is how data integrity bugs enter. The migration is a one-time event; there is no "transition period" in a web app where you control all deployments.

**Do this instead:** Rename `userId` to `createdByUserId` in the same migration that adds `householdId`. Deploy atomically.

### Anti-Pattern 2: Checking cycle state in UI components

**What it looks like:** `DashboardPlantCard` fetches the active cycle itself to show assignee info.

**Why wrong:** Cycle state is queried per-household, not per-plant. Having leaf components fetch household state creates N+1-style fan-out and makes caching hard.

**Do this instead:** Resolve active cycle once in the dashboard page Server Component and pass `activeCycle` as a prop to `DashboardClient`. Client components receive it as data.

### Anti-Pattern 3: Using `session.update()` from a Server Action for activeHouseholdId

**What it looks like:** A Server Action directly mutates the JWT token by calling `auth.update()` inside the action body.

**Why wrong:** NextAuth v5's `update()` is a client-callable function, not a server-side primitive. Calling it from a Server Action works in some configurations but is not officially supported.

**Do this instead:** The household switcher is a Client Component that calls `update({ activeHouseholdId })` directly (NextAuth v5 exposes `update` to client components). Follow the NextAuth v5 pattern for session updates.

### Anti-Pattern 4: Storing invitation email in `Invitation` model as the join key

**What it looks like:** `Invitation.email` is required and the join flow validates that the accepting user's email matches the invitation email.

**Why wrong:** The spec calls for shareable links without email as a required field. This would break the "share a link in a group chat" use case.

**Do this instead:** `Invitation` has only a token and householdId. Any authenticated user who has the valid, non-expired token can join. The optional email field can be stored for display purposes but must not gate acceptance.

---

## Sources

- v1.0 codebase (direct inspection, April 2026) — HIGH confidence
- Next.js 16 App Router + Server Actions patterns — validated from existing code
- NextAuth v5 `update()` for JWT mutation: https://authjs.dev/reference/nextjs#update — MEDIUM confidence (beta tag applies)
- Prisma migration workflow with multi-step nullable → not-null: https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/customizing-migrations — HIGH confidence

---
*Architecture research for: Plant Minder household + rotation milestone*
*Researched: 2026-04-16*
