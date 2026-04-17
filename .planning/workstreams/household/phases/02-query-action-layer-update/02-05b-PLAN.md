---
phase: 02-query-action-layer-update
plan: 05b
type: execute
wave: 3
depends_on: ["02-01", "02-04", "02-05a"]
files_modified:
  - src/features/watering/actions.ts
  - src/features/watering/schemas.ts
  - src/features/notes/actions.ts
  - src/features/notes/schemas.ts
  - src/features/reminders/actions.ts
  - src/features/reminders/schemas.ts
  - src/features/demo/actions.ts
  - src/components/watering/log-watering-dialog.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/components/watering/watering-history.tsx
  - src/components/watering/watering-history-entry.tsx
  - src/components/timeline/timeline.tsx
  - src/components/timeline/timeline-entry.tsx
  - src/components/timeline/note-input.tsx
  - src/components/reminders/snooze-pills.tsx
  - src/components/reminders/plant-reminder-toggle.tsx
autonomous: true
requirements: [HSLD-02, HSLD-03]
tags: [server-actions, d-04, d-12, d-13, pitfall-16, audit-columns, rhf, hidden-input, household-scope, watering, notes, reminders, demo]

must_haves:
  truths:
    - "Every mutating Server Action in watering/notes/reminders follows the D-12 7-step shape"
    - "WateringLog + Note mutations use nested `plant: { householdId }` ownership filter for edit/delete (D-10 Pattern 4)"
    - "Audit columns wired: WateringLog.performedByUserId + Note.performedByUserId populated from session.user.id"
    - "deleteWateringLog signature changes from positional `logId: string` to `data: unknown` (per D-12 step 3)"
    - "Reminder create/upsert preserves per-user-per-plant scope (D-13) — the literal where-clause is `{ plantId_userId: { plantId, userId: session.user.id } }` for snoozeReminder, snoozeCustomReminder, togglePlantReminder"
    - "toggleGlobalReminders is NOT migrated — it writes User.remindersEnabled (per-user User column, no household scope)"
    - "loadMoreWateringHistory + loadMoreTimeline gain `householdId` and delegate to migrated query functions"
    - "updateNote is migrated alongside createNote and deleteNote (all 3 notes mutating actions)"
    - "demo/actions.ts startDemoSession wraps bootstrap in `$transaction` creating Household + HouseholdMember(OWNER, isDefault: true) + Room + Plant with householdId/createdByUserId"
  artifacts:
    - path: "src/features/watering/actions.ts"
      provides: "logWatering, editWateringLog, deleteWateringLog, loadMoreWateringHistory migrated"
    - path: "src/features/notes/actions.ts"
      provides: "createNote, updateNote, deleteNote, loadMoreTimeline migrated"
    - path: "src/features/reminders/actions.ts"
      provides: "snoozeReminder, snoozeCustomReminder, togglePlantReminder migrated; toggleGlobalReminders unchanged"
    - path: "src/features/demo/actions.ts"
      provides: "startDemoSession fixed — creates Household + HouseholdMember for demo user"
  key_links:
    - from: "src/features/watering/actions.ts (logWatering)"
      to: "performedByUserId: session.user.id"
      via: "AUDT-01 audit column write"
      pattern: "performedByUserId:\\s*session\\.user\\.id"
    - from: "src/features/notes/actions.ts (createNote)"
      to: "performedByUserId: session.user.id"
      via: "AUDT-01 audit column write"
      pattern: "performedByUserId:\\s*session\\.user\\.id"
    - from: "src/features/reminders/actions.ts"
      to: "db.reminder.upsert where: { plantId_userId: { plantId, userId: session.user.id } }"
      via: "D-13 per-user-per-plant compound-key preserved"
      pattern: "plantId_userId:\\s*\\{\\s*plantId"
    - from: "src/features/demo/actions.ts"
      to: "db.$transaction creating Household + HouseholdMember"
      via: "demo user bootstrap fix"
      pattern: "db\\.\\$transaction|isDefault:\\s*true"
---

<objective>
Migrate the remaining mutating Server Actions — watering (4), notes (4 including `updateNote` and `loadMoreTimeline`), reminders (3 plant-scoped, plus `toggleGlobalReminders` untouched), and demo (startDemoSession bootstrap fix) — from `userId`-based ownership to `householdId`-based ownership following the D-12 7-step canonical shape. Thread `householdId` into 9 client components that submit these actions. Standardise `deleteWateringLog` to the `data: unknown` signature.

Purpose: Closes Pitfall 16 for the remaining action surface. Completes the code-only half of the build-breakage repair — once 05a + 05b land, `npm run build` compiles cleanly. The demo bootstrap fix is required because `startDemoSession` currently references dropped `Plant.userId`/`Room.userId` columns.

Output: 4 action files migrated + 3 schema files extended + 9 client components wired with `householdId` prop threading.
</objective>

<execution_context>
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/workflows/execute-plan.md
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/household/STATE.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-RESEARCH.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-04-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-05a-PLAN.md
@CLAUDE.md

# Source files the executor MUST read before editing
@src/features/watering/actions.ts
@src/features/watering/schemas.ts
@src/features/notes/actions.ts
@src/features/notes/schemas.ts
@src/features/reminders/actions.ts
@src/features/reminders/schemas.ts
@src/features/demo/actions.ts
@src/features/demo/seed-data.ts
@src/features/auth/actions.ts
@src/features/household/guards.ts
@src/lib/slug.ts
@prisma/schema.prisma

# Component files the executor MUST read before editing
@src/components/watering/log-watering-dialog.tsx
@src/components/watering/dashboard-client.tsx
@src/components/watering/dashboard-plant-card.tsx
@src/components/watering/watering-history.tsx
@src/components/watering/watering-history-entry.tsx
@src/components/timeline/timeline.tsx
@src/components/timeline/timeline-entry.tsx
@src/components/timeline/note-input.tsx
@src/components/reminders/snooze-pills.tsx
@src/components/reminders/plant-reminder-toggle.tsx

<interfaces>
<!-- Action signature changes mandated by D-12 step 3 (Zod parse must validate householdId) -->

| Action | BEFORE | AFTER | Call sites |
|--------|--------|-------|------------|
| `logWatering(data)` | `data: unknown` | same shape; schema gains `householdId: z.cuid()` | log-watering-dialog.tsx:102, dashboard-client.tsx:89 |
| `editWateringLog(data)` | `data: unknown` | same shape; schema gains `householdId: z.cuid()` | log-watering-dialog.tsx:89 |
| `deleteWateringLog(logId: string)` | positional | `deleteWateringLog(data: unknown)` where `data = { householdId, logId }` | watering-history-entry.tsx:58, timeline-entry.tsx:94 |
| `loadMoreWateringHistory(plantId, skip)` | positional | `loadMoreWateringHistory(plantId, householdId, skip)` OR `loadMoreWateringHistory(data: unknown)` where `data = { householdId, plantId, skip }` — this plan picks the OBJECT-PAYLOAD shape for consistency | watering-history.tsx:40 |
| `createNote(data)` | `data: unknown` | same shape; schema gains `householdId` | note-input.tsx (grep in file) |
| `updateNote(data)` | `data: unknown` | same shape; schema gains `householdId` | timeline-entry.tsx:71 |
| `deleteNote(data)` | `data: unknown` | same shape; schema gains `householdId` | timeline-entry.tsx:93 |
| `loadMoreTimeline(data)` | `data: unknown` | same shape; schema gains `householdId` | timeline.tsx:44, 57 |
| `snoozeReminder(data)` | `data: unknown` | same shape; schema gains `householdId` | snooze-pills.tsx:39, dashboard-plant-card.tsx (inline snooze) |
| `snoozeCustomReminder(data)` | `data: unknown` | same shape; schema gains `householdId` | snooze-pills.tsx |
| `togglePlantReminder(data)` | `data: unknown` | same shape; schema gains `householdId` | plant-reminder-toggle.tsx:34 |
| `toggleGlobalReminders(data)` | `data: unknown` | **UNCHANGED** — per-user User.remindersEnabled write, no household scope | preferences-form.tsx |

**Schema additions required in this plan** (Plan 04 added `householdId: z.cuid()` to create/edit schemas; this plan adds it to snooze + toggle + delete-watering-log shapes):

```typescript
// watering/schemas.ts — append:
export const deleteWateringLogSchema = z.object({
  householdId: z.cuid(),
  logId: z.string().min(1, "Log ID is required."),
});
export type DeleteWateringLogInput = z.infer<typeof deleteWateringLogSchema>;

export const loadMoreWateringHistorySchema = z.object({
  householdId: z.cuid(),
  plantId: z.string().min(1),
  skip: z.number().int().min(0),
});

// notes/schemas.ts — Plan 04 adds householdId to existing createNoteSchema / updateNoteSchema /
// deleteNoteSchema. This plan only adds loadMoreTimelineSchema (currently inlined in actions.ts):
export const loadMoreTimelineSchema = z.object({
  householdId: z.cuid(),
  plantId: z.string().min(1),
  skip: z.number().int().min(0),
});
// Note: actions.ts currently inlines `loadMoreTimelineSchema` — move to schemas.ts for consistency.

// reminders/schemas.ts — Plan 04 adds householdId to snoozeSchema / snoozeCustomSchema /
// toggleReminderSchema. Verify each has the field before this plan runs. No new schemas in 05b for reminders.
```

**D-13 per-user Reminder preservation — literal where-clause to use in upsert/update:**

For `snoozeReminder`, `snoozeCustomReminder`, AND `togglePlantReminder`, the reminder upsert is:

```typescript
await db.reminder.upsert({
  where: { plantId_userId: { plantId, userId: session.user.id } },
  update: { /* fields */ },
  create: { plantId, userId: session.user.id, enabled: true, /* fields */ },
});
```

The `plantId_userId` compound unique key is the Prisma-generated identifier for the `@@unique([plantId, userId])` constraint on the Reminder model (Phase 1 schema). Preserve it verbatim. Do NOT change the upsert to key by household.

**demo/actions.ts bootstrap — $transaction shape:**

```typescript
import { generateHouseholdSlug } from "@/lib/slug";
// ... existing imports ...

const { demoUser, household } = await db.$transaction(async (tx) => {
  const demoUser = await tx.user.create({
    data: { email: DEMO_EMAIL, passwordHash, name: "Demo User", onboardingCompleted: true, remindersEnabled: true },
  });

  let slug: string;
  let attempts = 0;
  do {
    slug = generateHouseholdSlug();
    const existing = await tx.household.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    if (++attempts > 10) throw new Error("Slug generation failed after 10 attempts");
  } while (true);

  const household = await tx.household.create({
    data: { name: "Demo Plants", slug, timezone: "UTC", cycleDuration: 7, rotationStrategy: "sequential" },
  });

  await tx.householdMember.create({
    data: { userId: demoUser.id, householdId: household.id, role: "OWNER", rotationOrder: 0, isDefault: true },
  });

  return { demoUser, household };
});

// Outside the transaction — existing room/plant create logic, but with household.id + createdByUserId:
const room = await db.room.create({
  data: { name: "Living Room", householdId: household.id, createdByUserId: demoUser.id },
});

const plant = await db.plant.create({
  data: {
    nickname: "Sample Plant",
    /* ... existing species/interval/dates ... */
    householdId: household.id,
    createdByUserId: demoUser.id,
    roomId: room.id,
    reminders: {
      create: { userId: demoUser.id, enabled: true },
    },
  },
});
```

**Client-component call-site cheatsheet (verified by grep before this plan was written):**

| Component | Current call | New call |
|-----------|--------------|----------|
| log-watering-dialog.tsx:89 | `editWateringLog({ logId, wateredAt, note })` | `editWateringLog({ householdId, logId, wateredAt, note })` |
| log-watering-dialog.tsx:102 | `logWatering({ plantId, wateredAt, note })` | `logWatering({ householdId, plantId, wateredAt, note })` |
| dashboard-client.tsx:89 | `logWatering({ plantId: plant.id })` | `logWatering({ householdId, plantId: plant.id })` |
| watering-history.tsx:40 | `loadMoreWateringHistory(plantId, logs.length)` | `loadMoreWateringHistory({ householdId, plantId, skip: logs.length })` |
| watering-history-entry.tsx:58 | `deleteWateringLog(log.id)` | `deleteWateringLog({ householdId, logId: log.id })` |
| timeline-entry.tsx:71 | `updateNote({ noteId, content })` | `updateNote({ householdId, noteId, content })` |
| timeline-entry.tsx:93 | `deleteNote({ noteId })` + `deleteWateringLog(entry.id)` | `deleteNote({ householdId, noteId })` + `deleteWateringLog({ householdId, logId: entry.id })` |
| timeline.tsx:44, 57 | `loadMoreTimeline({ plantId, skip })` | `loadMoreTimeline({ householdId, plantId, skip })` |
| note-input.tsx | `createNote({ plantId, content })` | `createNote({ householdId, plantId, content })` |
| snooze-pills.tsx:39 | `snoozeReminder({ plantId, days })` | `snoozeReminder({ householdId, plantId, days })` |
| snooze-pills.tsx (custom) | `snoozeCustomReminder({ plantId, snoozedUntil })` | `snoozeCustomReminder({ householdId, plantId, snoozedUntil })` |
| plant-reminder-toggle.tsx:34 | `togglePlantReminder({ plantId, enabled })` | `togglePlantReminder({ householdId, plantId, enabled: checked })` |
| dashboard-plant-card.tsx (inline snooze) | `snoozeReminder({ plantId, days })` | `snoozeReminder({ householdId, plantId, days })` |

Every client component that calls one of these actions must accept `householdId: string` as a prop (or receive it via `useContext` if we introduce a `HouseholdContext` — out of scope for Phase 2, use prop drilling).

The parent Server Component that renders each is:
- `/h/[householdSlug]/plants/[id]/page.tsx` → plant-detail.tsx → timeline.tsx / timeline-entry.tsx / note-input.tsx / watering-history.tsx / watering-history-entry.tsx / plant-reminder-toggle.tsx / snooze-pills.tsx (Plan 03a ships these parent pages with `household.id` already available)
- `/h/[householdSlug]/dashboard/page.tsx` → dashboard-client.tsx → dashboard-plant-card.tsx
- The log-watering-dialog.tsx is invoked both from plant-detail (via log-watering-button flow) and from timeline-entry.tsx (edit-watering flow)

All these parents either render the component directly (in which case they pass `householdId={household.id}` as a prop) or render a higher-level client component that receives and forwards `householdId`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate watering/actions.ts + notes/actions.ts + their schemas and wire all 7 watering/notes client components</name>
  <files>src/features/watering/actions.ts, src/features/watering/schemas.ts, src/features/notes/actions.ts, src/features/notes/schemas.ts, src/components/watering/log-watering-dialog.tsx, src/components/watering/dashboard-client.tsx, src/components/watering/dashboard-plant-card.tsx, src/components/watering/watering-history.tsx, src/components/watering/watering-history-entry.tsx, src/components/timeline/timeline.tsx, src/components/timeline/timeline-entry.tsx, src/components/timeline/note-input.tsx</files>
  <behavior>
    - `logWatering(data)`: Zod parses includes householdId, calls guard, plant lookup by `{ id, householdId, archivedAt: null }`, creates WateringLog with `performedByUserId: session.user.id`.
    - `editWateringLog(data)`: parse, guard, findFirst by `{ id, plant: { householdId } }` nested filter.
    - `deleteWateringLog(data)`: signature flipped from positional `logId: string` to `data: unknown`. Uses new `deleteWateringLogSchema` (householdId + logId). findFirst by `{ id, plant: { householdId } }`.
    - `loadMoreWateringHistory(data)`: signature flipped to `data: unknown` with `loadMoreWateringHistorySchema` (householdId + plantId + skip). Delegates to `getWateringHistory(plantId, householdId, skip, 20)`.
    - `createNote(data)`, `updateNote(data)`, `deleteNote(data)`: parse, guard, plant lookup by `{ id, householdId }` (createNote) or nested `plant: { householdId }` (updateNote + deleteNote). createNote writes Note with `performedByUserId: session.user.id`.
    - `loadMoreTimeline(data)`: parse with `loadMoreTimelineSchema` (householdId + plantId + skip), delegates to `getTimeline(plantId, householdId, skip, 20)`. No guard needed — read action, callers supply validated householdId.
    - All 7 client components accept `householdId: string` prop and pass it in the action call payload.
  </behavior>
  <read_first>
    - src/features/watering/actions.ts (current — 4 exports, note deleteWateringLog + loadMoreWateringHistory are positional)
    - src/features/watering/schemas.ts (current — Plan 04 added householdId to logWateringSchema + editWateringLogSchema)
    - src/features/notes/actions.ts (current — 4 exports including inline loadMoreTimelineSchema on line 88-91)
    - src/features/notes/schemas.ts (current — Plan 04 added householdId to createNoteSchema + updateNoteSchema + deleteNoteSchema)
    - src/components/watering/log-watering-dialog.tsx (RHF dialog; line 89 + 102 have the action calls)
    - src/components/watering/dashboard-client.tsx (line 89 logWatering call)
    - src/components/watering/dashboard-plant-card.tsx (inline snooze calls; also renders WaterButton that triggers dashboard-client's handler)
    - src/components/watering/watering-history.tsx (line 40 loadMoreWateringHistory call)
    - src/components/watering/watering-history-entry.tsx (line 58 deleteWateringLog call)
    - src/components/timeline/timeline.tsx (lines 44, 57 loadMoreTimeline calls)
    - src/components/timeline/timeline-entry.tsx (lines 71, 93 — updateNote, deleteNote, deleteWateringLog)
    - src/components/timeline/note-input.tsx (createNote call)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md §src/features/{watering,notes}/
  </read_first>
  <action>
    Step 1 — Extend `src/features/watering/schemas.ts`:

    ```typescript
    // Plan 04 already added householdId: z.cuid() to logWateringSchema + editWateringLogSchema.
    // Append:
    export const deleteWateringLogSchema = z.object({
      householdId: z.cuid(),
      logId: z.string().min(1, "Log ID is required."),
    });
    export type DeleteWateringLogInput = z.infer<typeof deleteWateringLogSchema>;

    export const loadMoreWateringHistorySchema = z.object({
      householdId: z.cuid(),
      plantId: z.string().min(1),
      skip: z.number().int().min(0),
    });
    export type LoadMoreWateringHistoryInput = z.infer<typeof loadMoreWateringHistorySchema>;
    ```

    Step 2 — Extend `src/features/notes/schemas.ts`:

    ```typescript
    // Plan 04 already added householdId to createNoteSchema + updateNoteSchema + deleteNoteSchema.
    // Append (moved in from inlined definition in actions.ts lines 88-91):
    export const loadMoreTimelineSchema = z.object({
      householdId: z.cuid(),
      plantId: z.string().min(1),
      skip: z.number().int().min(0),
    });
    export type LoadMoreTimelineInput = z.infer<typeof loadMoreTimelineSchema>;
    ```

    Step 3 — Migrate `src/features/watering/actions.ts`:

    a. Update imports: add `import { requireHouseholdAccess } from "@/features/household/guards";` and update the `./schemas` import to include `deleteWateringLogSchema` + `loadMoreWateringHistorySchema`.

    b. `logWatering(data: unknown)`:

    ```typescript
    export async function logWatering(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = logWateringSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const plant = await db.plant.findFirst({
        where: {
          id: parsed.data.plantId,
          householdId: parsed.data.householdId,
          archivedAt: null,
        },
      });
      if (!plant) return { error: "Plant not found." };

      // Preserve existing duplicate-check logic verbatim
      const wateredAt = parsed.data.wateredAt ?? new Date();
      const dayStart = new Date(wateredAt);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const existingLog = await db.wateringLog.findFirst({
        where: {
          plantId: parsed.data.plantId,
          wateredAt: { gte: dayStart, lt: dayEnd },
        },
      });
      if (existingLog) return { error: "DUPLICATE" };

      await db.wateringLog.create({
        data: {
          plantId: plant.id,
          wateredAt,
          note: parsed.data.note ?? null,
          performedByUserId: session.user.id,  // AUDT-01
        },
      });

      // Preserve existing recalculation logic verbatim
      const mostRecent = await db.wateringLog.findFirst({
        where: { plantId: plant.id },
        orderBy: { wateredAt: "desc" },
      });

      const lastWateredAt = mostRecent!.wateredAt;
      const nextWateringAt = addDays(lastWateredAt, plant.wateringInterval);

      await db.plant.update({
        where: { id: plant.id },
        data: { lastWateredAt, nextWateringAt },
      });

      revalidatePath("/h/[householdSlug]/dashboard", "page");
      revalidatePath("/h/[householdSlug]/plants/[id]", "page");

      return { success: true, nextWateringAt, plantNickname: plant.nickname };
    }
    ```

    c. `editWateringLog(data: unknown)` — same pattern; the plant-ownership filter via nested relation:

    ```typescript
    const parsed = editWateringLogSchema.safeParse(data);
    if (!parsed.success) return { error: "Invalid input." };
    const { household } = await requireHouseholdAccess(parsed.data.householdId);

    const log = await db.wateringLog.findFirst({
      where: {
        id: parsed.data.logId,
        plant: { householdId: parsed.data.householdId },
      },
      include: { plant: true },
    });
    if (!log) return { error: "Log not found." };

    await db.wateringLog.update({
      where: { id: parsed.data.logId },
      data: {
        wateredAt: parsed.data.wateredAt,
        note: parsed.data.note ?? null,
      },
    });

    // Preserve existing recalculation logic verbatim
    const mostRecent = await db.wateringLog.findFirst({
      where: { plantId: log.plantId },
      orderBy: { wateredAt: "desc" },
    });

    if (mostRecent) {
      const nextWateringAt = addDays(mostRecent.wateredAt, log.plant.wateringInterval);
      await db.plant.update({
        where: { id: log.plantId },
        data: { lastWateredAt: mostRecent.wateredAt, nextWateringAt },
      });
    }

    revalidatePath("/h/[householdSlug]/dashboard", "page");
    revalidatePath("/h/[householdSlug]/plants/[id]", "page");

    return { success: true };
    ```

    d. `deleteWateringLog(data: unknown)` — signature flipped from positional:

    ```typescript
    export async function deleteWateringLog(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = deleteWateringLogSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const log = await db.wateringLog.findFirst({
        where: {
          id: parsed.data.logId,
          plant: { householdId: parsed.data.householdId },
        },
        include: { plant: true },
      });
      if (!log) return { error: "Log not found." };

      await db.wateringLog.delete({ where: { id: parsed.data.logId } });

      // Preserve existing recalculation-from-remaining-logs logic verbatim (Pitfall 4)
      const mostRecent = await db.wateringLog.findFirst({
        where: { plantId: log.plantId },
        orderBy: { wateredAt: "desc" },
      });

      let lastWateredAt: Date | null;
      let nextWateringAt: Date;
      if (mostRecent) {
        lastWateredAt = mostRecent.wateredAt;
        nextWateringAt = addDays(mostRecent.wateredAt, log.plant.wateringInterval);
      } else {
        lastWateredAt = null;
        nextWateringAt = addDays(new Date(), log.plant.wateringInterval);
      }

      await db.plant.update({
        where: { id: log.plantId },
        data: { lastWateredAt, nextWateringAt },
      });

      revalidatePath("/h/[householdSlug]/dashboard", "page");
      revalidatePath("/h/[householdSlug]/plants/[id]", "page");

      return { success: true };
    }
    ```

    e. `loadMoreWateringHistory(data: unknown)` — signature flipped from positional `(plantId, skip)`:

    ```typescript
    export async function loadMoreWateringHistory(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };

      const parsed = loadMoreWateringHistorySchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      // Note: this is a READ delegation — no requireHouseholdAccess needed (the underlying
      // query function in Plan 04 filters by plant.householdId, which serves as the
      // authorization boundary for reads). If the caller passes a householdId they're
      // not a member of, getWateringHistory returns empty results. For consistency with
      // other reads in the system (getPlants, etc. — no guard inside queries), we match.
      return getWateringHistory(parsed.data.plantId, parsed.data.householdId, parsed.data.skip, 20);
    }
    ```

    Step 4 — Migrate `src/features/notes/actions.ts`:

    a. Update imports: add `requireHouseholdAccess`; remove the `import { z } from "zod/v4"` line if only used for the inlined `loadMoreTimelineSchema` (move to schemas.ts per Step 2); update the `./schemas` import to include `loadMoreTimelineSchema`.

    b. `createNote(data: unknown)`:

    ```typescript
    export async function createNote(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = createNoteSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const plant = await db.plant.findFirst({
        where: { id: parsed.data.plantId, householdId: parsed.data.householdId },
      });
      if (!plant) return { error: "Plant not found." };

      const note = await db.note.create({
        data: {
          plantId: plant.id,
          content: parsed.data.content,
          performedByUserId: session.user.id,  // AUDT-01
        },
      });

      revalidatePath("/h/[householdSlug]/plants/[id]", "page");

      return { success: true, note };
    }
    ```

    c. `updateNote(data: unknown)` — nested plant-relation ownership:

    ```typescript
    export async function updateNote(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = updateNoteSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const note = await db.note.findFirst({
        where: {
          id: parsed.data.noteId,
          plant: { householdId: parsed.data.householdId },
        },
        include: { plant: true },
      });
      if (!note) return { error: "Note not found." };

      const updated = await db.note.update({
        where: { id: parsed.data.noteId },
        data: { content: parsed.data.content },
      });

      revalidatePath("/h/[householdSlug]/plants/[id]", "page");

      return { success: true, note: updated };
    }
    ```

    d. `deleteNote(data: unknown)` — mirror of updateNote with `db.note.delete`.

    e. `loadMoreTimeline(data: unknown)` — signature unchanged (already blob), schema-path only change:

    ```typescript
    export async function loadMoreTimeline(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };

      const parsed = loadMoreTimelineSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      return getTimeline(parsed.data.plantId, parsed.data.householdId, parsed.data.skip, 20);
    }
    ```

    Remove the inlined `const loadMoreTimelineSchema = z.object(...)` at lines 88-91 of the current file (moved to schemas.ts).

    Step 5 — Update the 7 client components. For each, add `householdId: string` to the props interface and update the action call payload. Exact per-file diff:

    **log-watering-dialog.tsx:**
      - Add `householdId: string` to `LogWateringDialogProps`.
      - Line 89: `editWateringLog({ householdId, logId: editLog!.id, wateredAt: data.wateredAt, note: data.note || undefined })`
      - Line 102: `logWatering({ householdId, plantId, wateredAt: data.wateredAt, note: data.note || undefined })`

    **dashboard-client.tsx:**
      - Add `householdId: string` to `DashboardClientProps`.
      - Line 89: `logWatering({ householdId, plantId: plant.id })`

    **dashboard-plant-card.tsx:**
      - Add `householdId: string` to `DashboardPlantCardProps` AND to `InlineSnoozePills` helper component.
      - Pass through from the parent (dashboard-client) to `<InlineSnoozePills householdId={householdId} plantId={plant.id} isDemo={isDemo} />`.
      - Inside `InlineSnoozePills.handleSnooze`, change `snoozeReminder({ plantId, days })` → `snoozeReminder({ householdId, plantId, days })`.

    **watering-history.tsx:**
      - Add `householdId: string` to `WateringHistoryProps`.
      - Line 40: `loadMoreWateringHistory({ householdId, plantId, skip: logs.length })`.
      - Also pass `householdId` through to the `<WateringHistoryEntry>` render.

    **watering-history-entry.tsx:**
      - Add `householdId: string` to `WateringHistoryEntryProps`.
      - Line 58: `deleteWateringLog({ householdId, logId: log.id })`.
      - Also pass `householdId` through to `<LogWateringDialog>` it renders.

    **timeline.tsx:**
      - Add `householdId: string` to `TimelineProps`.
      - Line 44: `loadMoreTimeline({ householdId, plantId, skip: entries.length })`
      - Line 57: `loadMoreTimeline({ householdId, plantId, skip: 0 })`
      - Pass `householdId` through to `<TimelineEntry>` + `<NoteInput>`.

    **timeline-entry.tsx:**
      - Add `householdId: string` to `TimelineEntryProps`.
      - Line 71: `updateNote({ householdId, noteId: entry.id, content: trimmed })`
      - Line 93 (watering branch): `deleteWateringLog({ householdId, logId: entry.id })`
      - Line 93 (note branch): `deleteNote({ householdId, noteId: entry.id })`
      - Also thread `householdId` to `<LogWateringDialog>`.

    **note-input.tsx:**
      - Add `householdId: string` to the props interface (read the file to see exact prop shape).
      - Update the `createNote({ plantId, content })` call → `createNote({ householdId, plantId, content })`.

    Step 6 — Run `npx tsc --noEmit 2>&1 | grep -E "src[/\\\\]features[/\\\\](watering|notes)[/\\\\]|src[/\\\\]components[/\\\\](watering|timeline)[/\\\\]"`. Zero errors in the 11 files touched.

    Step 7 — Stage all 11 modified files. Do NOT run `git commit` — notify the developer (workspace memory rule).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - Grep `export async function deleteWateringLog\(data: unknown\)` in `src/features/watering/actions.ts` returns 1 match (signature flipped)
    - Grep `export async function loadMoreWateringHistory\(data: unknown\)` returns 1 match (signature flipped)
    - Grep `requireHouseholdAccess\(parsed\.data\.householdId\)` in watering/actions.ts returns ≥ 3 matches (logWatering + editWateringLog + deleteWateringLog)
    - Grep `requireHouseholdAccess\(parsed\.data\.householdId\)` in notes/actions.ts returns ≥ 3 matches (createNote + updateNote + deleteNote)
    - Grep `performedByUserId:\s*session\.user\.id` in watering/actions.ts returns ≥ 1 match (logWatering)
    - Grep `performedByUserId:\s*session\.user\.id` in notes/actions.ts returns ≥ 1 match (createNote)
    - Grep `plant:\s*\{\s*householdId` in watering/actions.ts returns ≥ 2 matches (editWateringLog + deleteWateringLog)
    - Grep `plant:\s*\{\s*householdId` in notes/actions.ts returns ≥ 2 matches (updateNote + deleteNote)
    - Grep `where:\s*\{[^}]*userId` in watering/actions.ts + notes/actions.ts returns 0 matches
    - Grep `revalidatePath\("/h/\[householdSlug\]` across both action files returns ≥ 6 matches
    - Grep `revalidatePath\("/dashboard"|revalidatePath\("/plants"` returns 0 matches
    - Grep `deleteWateringLogSchema` in watering/schemas.ts returns 1 match
    - Grep `loadMoreWateringHistorySchema` in watering/schemas.ts returns 1 match
    - Grep `loadMoreTimelineSchema` in notes/schemas.ts returns 1 match (moved in from actions.ts)
    - Grep `const loadMoreTimelineSchema` (inline) in notes/actions.ts returns 0 matches (moved out)
    - Every client component file: grep `householdId` returns ≥ 2 matches (prop + action call)
    - `npx tsc --noEmit` reports zero NEW errors in the 11 modified files
  </acceptance_criteria>
  <done>watering + notes actions migrated with nested-relation ownership + audit columns; 7 client components thread householdId.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Migrate reminders/actions.ts (3 plant-scoped actions, toggleGlobalReminders untouched) + fix demo bootstrap + wire reminders components</name>
  <files>src/features/reminders/actions.ts, src/features/reminders/schemas.ts, src/features/demo/actions.ts, src/components/reminders/snooze-pills.tsx, src/components/reminders/plant-reminder-toggle.tsx</files>
  <behavior>
    - `snoozeReminder(data)`, `snoozeCustomReminder(data)`, `togglePlantReminder(data)`: parse, guard, plant ownership check via `{ id, householdId }`, Reminder upsert with literal where-clause `{ plantId_userId: { plantId, userId: session.user.id } }` (D-13 preserved).
    - `toggleGlobalReminders(data)`: UNCHANGED — writes User.remindersEnabled per-user, no household scope.
    - `demo/actions.ts startDemoSession`: wraps bootstrap in `db.$transaction` creating User + Household + HouseholdMember(OWNER, isDefault: true); Plant + Room creates use `householdId + createdByUserId`; Reminder create keeps `userId: demoUser.id`.
    - `snooze-pills.tsx` and `plant-reminder-toggle.tsx` accept `householdId` prop and pass it in action payloads.
    - `dashboard-plant-card.tsx` inline snooze is updated in Task 1 (not re-touched here).
  </behavior>
  <read_first>
    - src/features/reminders/actions.ts (current — 4 exports; 3 plant-scoped + toggleGlobalReminders)
    - src/features/reminders/schemas.ts (current — Plan 04 added householdId to snoozeSchema + snoozeCustomSchema + toggleReminderSchema; confirm by grepping `householdId` before writing this task)
    - src/features/demo/actions.ts (current — broken at lines referencing Plant/Room.userId)
    - src/features/demo/seed-data.ts (contains demo seed constants)
    - src/features/auth/actions.ts lines 44-86 (canonical $transaction + slug loop — the model for demo bootstrap)
    - src/lib/slug.ts (generateHouseholdSlug)
    - src/components/reminders/snooze-pills.tsx (lines 13, 39 — snoozeReminder/snoozeCustomReminder call sites)
    - src/components/reminders/plant-reminder-toggle.tsx (line 34 — togglePlantReminder call site)
    - prisma/schema.prisma (confirm Reminder model has @@unique([plantId, userId]) — the basis for plantId_userId compound key)
  </read_first>
  <action>
    Step 1 — Verify `src/features/reminders/schemas.ts` already contains `householdId: z.cuid()` on snoozeSchema, snoozeCustomSchema, and toggleReminderSchema (Plan 04 added them). If a schema is missing householdId, add it in-place as the first field. `toggleGlobalRemindersSchema` MUST NOT have `householdId` — it's per-user.

    Step 2 — Migrate `src/features/reminders/actions.ts`. Add `requireHouseholdAccess` import. Rewrite each plant-scoped action:

    a. `snoozeReminder(data: unknown)`:

    ```typescript
    export async function snoozeReminder(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = snoozeSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const { plantId, days } = parsed.data;

      const plant = await db.plant.findFirst({
        where: { id: plantId, householdId: parsed.data.householdId },
      });
      if (!plant) return { error: "Plant not found." };

      const snoozedUntil = addDays(new Date(), days);

      await db.reminder.upsert({
        where: { plantId_userId: { plantId, userId: session.user.id } },
        update: { snoozedUntil },
        create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
      });

      revalidatePath("/h/[householdSlug]/plants/[id]", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true };
    }
    ```

    The `plantId_userId` compound-key where clause is preserved VERBATIM from the existing code (line 33 of current actions.ts). This is D-13 — Reminder is per-user-per-plant, never household-scoped.

    b. `snoozeCustomReminder(data: unknown)`:

    ```typescript
    export async function snoozeCustomReminder(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = snoozeCustomSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const { plantId, snoozedUntil } = parsed.data;

      const plant = await db.plant.findFirst({
        where: { id: plantId, householdId: parsed.data.householdId },
      });
      if (!plant) return { error: "Plant not found." };

      await db.reminder.upsert({
        where: { plantId_userId: { plantId, userId: session.user.id } },
        update: { snoozedUntil },
        create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
      });

      revalidatePath("/h/[householdSlug]/plants/[id]", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true };
    }
    ```

    c. `togglePlantReminder(data: unknown)`:

    ```typescript
    export async function togglePlantReminder(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = toggleReminderSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const { plantId, enabled } = parsed.data;

      const plant = await db.plant.findFirst({
        where: { id: plantId, householdId: parsed.data.householdId },
      });
      if (!plant) return { error: "Plant not found." };

      await db.reminder.upsert({
        where: { plantId_userId: { plantId, userId: session.user.id } },
        update: { enabled },
        create: { plantId, userId: session.user.id, enabled },
      });

      revalidatePath("/h/[householdSlug]/plants/[id]", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true };
    }
    ```

    d. `toggleGlobalReminders(data: unknown)` — DO NOT ADD `requireHouseholdAccess`. Leave the function body verbatim from v1 (it writes `User.remindersEnabled`, which is per-user). The only change allowed: update the `revalidatePath("/dashboard")` and `revalidatePath("/preferences")` calls — but `/preferences` is NOT a household-scoped route, so leave it as-is. The `/dashboard` path in Phase 2 is household-scoped; however, `toggleGlobalReminders` doesn't have a householdSlug in scope (per-user action). Best call: revalidate `/h/[householdSlug]/dashboard` AS A LITERAL PATTERN (Next.js invalidates all household dashboards — acceptable D-15-adjacent regression, ensures the user's current dashboard re-renders regardless of which household they're viewing):

    ```typescript
    revalidatePath("/h/[householdSlug]/dashboard", "page");
    revalidatePath("/preferences");
    ```

    Step 3 — Update `src/components/reminders/snooze-pills.tsx`:
      - Add `householdId: string` to `SnoozePillsProps`.
      - Line 39 (handleQuickSnooze): `snoozeReminder({ householdId, plantId, days })`.
      - In `handleCustomSnooze` (line 48+): `snoozeCustomReminder({ householdId, plantId, snoozedUntil: selectedDate })`.

    Step 4 — Update `src/components/reminders/plant-reminder-toggle.tsx`:
      - Add `householdId: string` to `PlantReminderToggleProps`.
      - Line 34: `togglePlantReminder({ householdId, plantId, enabled: checked })`.

    Step 5 — Fix `src/features/demo/actions.ts`. Read the current file first to understand exact structure. The broken parts are the Room + Plant creates that reference `userId` (columns dropped in Phase 1). Fix by wrapping the bootstrap in a `$transaction` that also creates Household + HouseholdMember:

    a. Add imports: `import { generateHouseholdSlug } from "@/lib/slug";`

    b. Inside the existing `if (!existing) { ... }` block (where the seed happens when no demo user exists), replace the sequential user-create + room-create + plant-create with:

    ```typescript
    const { demoUser, household } = await db.$transaction(async (tx) => {
      const demoUser = await tx.user.create({
        data: {
          email: DEMO_EMAIL,
          passwordHash,
          name: "Demo User",
          onboardingCompleted: true,
          remindersEnabled: true,
          // preserve any other fields the current v1 creates — read actions.ts for the full User.create shape
        },
      });

      let slug: string;
      let attempts = 0;
      do {
        slug = generateHouseholdSlug();
        const existing = await tx.household.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!existing) break;
        if (++attempts > 10) {
          throw new Error("Slug generation failed after 10 attempts");
        }
      } while (true);

      const household = await tx.household.create({
        data: {
          name: "Demo Plants",
          slug,
          timezone: "UTC",
          cycleDuration: 7,
          rotationStrategy: "sequential",
        },
      });

      await tx.householdMember.create({
        data: {
          userId: demoUser.id,
          householdId: household.id,
          role: "OWNER",
          rotationOrder: 0,
          isDefault: true,  // demo user's default is the demo household
        },
      });

      return { demoUser, household };
    });
    ```

    c. After the transaction, create the Room and Plant using `household.id` + audit column:

    ```typescript
    const room = await db.room.create({
      data: {
        name: "Living Room",  // or whatever the current v1 demo seed uses — read seed-data.ts
        householdId: household.id,
        createdByUserId: demoUser.id,
      },
    });

    const plant = await db.plant.create({
      data: {
        nickname: "Sample Plant",  // read seed-data.ts for demo specifics
        // preserve all other existing fields (wateringInterval, species, careProfileId, lastWateredAt, nextWateringAt)
        householdId: household.id,
        createdByUserId: demoUser.id,
        roomId: room.id,
        reminders: {
          create: { userId: demoUser.id, enabled: true },
        },
      },
    });
    ```

    d. If the v1 demo creates MULTIPLE plants or MULTIPLE watering logs, mirror the substitution pattern for each: substitute any `userId:` on Plant/Room create with `householdId + createdByUserId`. WateringLog creates add `performedByUserId: demoUser.id`. Reminder creates keep `userId: demoUser.id` (D-13).

    Step 6 — Run `npx tsc --noEmit 2>&1 | grep -E "src[/\\\\]features[/\\\\](reminders|demo)[/\\\\]actions\\.ts|src[/\\\\]components[/\\\\]reminders[/\\\\]"`. Zero errors in the 4 source files + 2 components.

    Step 7 — Stage all 5 modified files. Do NOT run `git commit` — notify the developer for approval (workspace memory rule).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - Grep `requireHouseholdAccess\(parsed\.data\.householdId\)` in `src/features/reminders/actions.ts` returns 3 matches (snoozeReminder + snoozeCustomReminder + togglePlantReminder)
    - Grep `plantId_userId:\s*\{\s*plantId` in `src/features/reminders/actions.ts` returns ≥ 3 matches (the D-13 compound-key preserved in all 3 upserts)
    - Grep `toggleGlobalReminders` in `src/features/reminders/actions.ts` returns 1 match AND grep `requireHouseholdAccess` within the toggleGlobalReminders function body returns 0 (per-user — NOT migrated)
    - Grep `where:\s*\{[^}]*userId` in `src/features/reminders/actions.ts` returns 0 matches (userId ownership filters on Plant lookups removed; note: the `userId` INSIDE the `plantId_userId` compound key is the Reminder row's userId, which is legitimate — the regex specifically rejects `where: { ..., userId }` at the top level, not nested compound keys)
    - Grep `revalidatePath\("/h/\[householdSlug\]` in `src/features/reminders/actions.ts` returns ≥ 6 matches
    - Grep `db\.\$transaction` in `src/features/demo/actions.ts` returns ≥ 1 match
    - Grep `householdId:\s*household\.id` in `src/features/demo/actions.ts` returns ≥ 2 matches (Room + Plant creates)
    - Grep `createdByUserId:\s*demoUser\.id` in `src/features/demo/actions.ts` returns ≥ 2 matches (AUDT-02 on Room + Plant)
    - Grep `isDefault:\s*true` in `src/features/demo/actions.ts` returns 1 match (demo householdMember)
    - Grep `generateHouseholdSlug` in `src/features/demo/actions.ts` returns ≥ 1 match
    - Grep `userId:\s*demoUser\.id` in `src/features/demo/actions.ts` (after migration) appears ONLY in reminders-create contexts; grep `userId: demoUser.id` on Plant/Room creates returns 0 matches
    - `src/components/reminders/snooze-pills.tsx`: grep `householdId` returns ≥ 3 matches (prop + 2 call sites)
    - `src/components/reminders/plant-reminder-toggle.tsx`: grep `householdId` returns ≥ 2 matches (prop + call site)
    - Grep `togglePlantReminder\(\{ householdId` in plant-reminder-toggle.tsx returns 1 match
    - `npx tsc --noEmit` reports zero NEW errors in the 5 modified files
    - `npm run build` exits 0 — full project build clean (combined 05a + 05b + Plan 04 + Plan 03 output)
  </acceptance_criteria>
  <done>reminders + demo migrations complete; D-13 Reminder per-user-per-plant compound-key preserved verbatim; demo bootstrap creates Household + HouseholdMember atomically; components thread householdId.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client form/bind payload → Zod parse | Untrusted client data containing `householdId` + entity id; Zod `safeParse` rejects malformed input before DB hit. |
| parsed.data.householdId → requireHouseholdAccess | Live DB check rejects non-members via ForbiddenError; same pattern as Plan 05a. |
| parsed.data.plantId → nested `plant: { householdId }` filter | WateringLog/Note deletion + edit paths verify the plant belongs to the asserted household via JOIN predicate. Prisma generates parameterized SQL; no injection risk. |
| Reminder.userId (compound key) | Reminder upsert keys on `{ plantId, userId: session.user.id }` — the userId is session-derived, never client-derived. Cannot write a Reminder attributed to another user. |
| demo user session | Demo user's `isDemo` flag short-circuits every mutating action; even if demo user held a valid Household membership, the isDemo gate rejects writes. The demo household exists only to let reads render. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05b-01 | E (Elevation of Privilege) | Nested-relation ownership bypass | mitigate | editWateringLog + deleteWateringLog + updateNote + deleteNote use `plant: { householdId: parsed.data.householdId }` nested filter. JOIN predicate ensures the log/note belongs to a plant within the authorized household. Combined with the upstream `requireHouseholdAccess` on that same householdId, double-scoped. |
| T-02-05b-02 | I (Information Disclosure) | loadMoreWateringHistory / loadMoreTimeline read without guard | accept | These are READ delegators; the underlying query functions (Plan 04 migrated) filter by `plant.householdId`, so a caller passing a foreign householdId gets empty results. No data leak. The guard is omitted intentionally to match the codebase's read-vs-mutate pattern (reads rely on query-layer filters; mutates require explicit guards). |
| T-02-05b-03 | R (Repudiation) | Audit column write path | mitigate | AUDT-01 (`WateringLog.performedByUserId`, `Note.performedByUserId`) populated from `session.user.id`. Non-repudiable record of who logged/created each row. Write-only column. |
| T-02-05b-04 | I | Reminder per-user preference leak | mitigate | `reminders: { create: { userId: session.user.id, enabled: true } }` in createPlant (Plan 05a) + the `plantId_userId` compound-key upsert in snooze/toggle (this plan) both use session-derived userId. Users cannot create or mutate Reminder rows attributed to other users. D-13 contract preserved. |
| T-02-05b-05 | D (Denial of Service) | Demo bootstrap transaction | accept | The demo `$transaction` contains a 10-attempt slug loop plus User/Household/HouseholdMember creates. Rollback on any failure. Demo flow is low-frequency (one-time per browser). No DoS concern. |
| T-02-05b-06 | S (Spoofing) | Demo user session scope | mitigate | Demo User holds ONE HouseholdMember row (the demo household). `requireHouseholdAccess` in Plan 05a + 05b actions still checks membership against live DB — even if demo user tries a non-demo householdId, the guard rejects. |
| T-02-05b-07 | T | toggleGlobalReminders cross-phase consistency | accept | `toggleGlobalReminders` is deliberately NOT migrated (per-user User.remindersEnabled). It does not gain a `householdId` field. Risk: an observer might expect every Phase 2 action to have the guard. Documentation (JSDoc + SUMMARY note) explicitly flags it as the single exemption. |
| T-02-05b-08 | E | loadMoreTimeline / loadMoreWateringHistory signature swap | mitigate | Changing signatures from positional to blob is a breaking change for callers. All call sites enumerated in this plan's `interfaces` block are updated in Task 1. Any missed call site fails at TypeScript compile — `npx tsc --noEmit` in acceptance criteria is the safety net. |
</threat_model>

<verification>
- `npx tsc --noEmit` — zero NEW errors in the 16 files touched by this plan
- `npm run build` — full Next.js build clean (combined 05a + 05b + Plan 04 + Plan 03 complete — build-broken compile errors from Phase 1 fully resolved)
- Grep coverage (quantitative):
  - `requireHouseholdAccess(parsed.data.householdId)` in watering + notes + reminders actions: ≥ 9 matches
  - `performedByUserId: session.user.id` across watering + notes: ≥ 2 matches
  - `plantId_userId` compound-key in reminders actions: ≥ 3 matches (D-13 preserved in all 3 upserts)
  - `db.$transaction` in demo/actions.ts: ≥ 1 match
  - `data: unknown` on deleteWateringLog + loadMoreWateringHistory: 2 matches (signature flips)
  - `where: { id, userId }` top-level ownership filters: 0 matches across all 4 action files
</verification>

<success_criteria>
- Pitfall 16 closed for watering + notes + reminders (the remaining mutating surface)
- AUDT-01 wired on WateringLog + Note writes
- D-13 preserved: Reminder rows remain per-user-per-plant; compound-key where clause specified verbatim across 3 upserts
- toggleGlobalReminders intentionally exempt from the migration (per-user) — documented
- deleteWateringLog + loadMoreWateringHistory signatures standardised to `data: unknown` — closes B-5 + B-6
- updateNote is in scope alongside createNote/deleteNote (closes B-5)
- Demo bootstrap no longer references dropped columns; creates Household + HouseholdMember atomically with isDefault: true
- 9 client components (timeline/watering/reminders surface) thread `householdId` through prop drilling from their parent Server Component; action payloads include householdId
- `npm run build` passes cleanly — Phase 2 code layer is build-green after this plan
</success_criteria>

<output>
After completion, create `.planning/workstreams/household/phases/02-query-action-layer-update/02-05b-SUMMARY.md` including:
- Per-action migration confirmation (function name, schema used, guard presence, signature shape)
- Reminder upsert where-clause verbatim text for each of the 3 plant-scoped actions (confirm D-13 compliance)
- Demo bootstrap before/after row-count sketch
- Client component table: file, current call payload, new call payload, prop-addition
- Confirmation that toggleGlobalReminders remains per-user (no household guard)
- `npm run build` exit code and duration
- Any deviations from the plan (e.g., component uses different prop shape than expected)
</output>
</content>
</invoke>