---
phase: 02-query-action-layer-update
plan: 05a
type: execute
wave: 3
depends_on: ["02-01", "02-04"]
files_modified:
  - src/features/plants/actions.ts
  - src/features/plants/schemas.ts
  - src/features/rooms/actions.ts
  - src/features/rooms/schemas.ts
  - src/components/plants/add-plant-dialog.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/components/plants/plant-actions.tsx
  - src/components/rooms/create-room-dialog.tsx
  - src/components/rooms/quick-create-presets.tsx
  - src/components/rooms/room-card.tsx
autonomous: true
requirements: [HSLD-02, HSLD-03]
tags: [server-actions, d-04, d-12, pitfall-16, audit-columns, rhf, hidden-input, household-scope, plants, rooms]

must_haves:
  truths:
    - "Every mutating plants Server Action (createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant) follows the D-12 7-step shape"
    - "Every mutating rooms Server Action (createRoom, updateRoom, deleteRoom) follows the D-12 7-step shape"
    - "archivePlant, unarchivePlant, deletePlant, deleteRoom migrate from positional arg to `data: unknown` blob so Zod parse can verify householdId (per D-12 step 3)"
    - "Audit columns wired: Plant.createdByUserId + Room.createdByUserId populated from session.user.id at create sites"
    - "createPlant preserves `reminders: { create: { userId, enabled: true } }` (D-13 — per-user-per-plant preference, NOT household-scoped)"
    - "All dialog + action-button components that submit mutating plants/rooms actions receive and forward a `householdId` prop (RHF defaultValues OR action-arg payload)"
    - "Every revalidatePath call uses the literal route pattern `/h/[householdSlug]/...` AND the `'page'` type parameter (Pitfall 3)"
  artifacts:
    - path: "src/features/plants/actions.ts"
      provides: "createPlant, updatePlant, archivePlant, unarchivePlant, deletePlant — all migrated to D-12 shape with `data: unknown` signatures"
    - path: "src/features/rooms/actions.ts"
      provides: "createRoom, updateRoom, deleteRoom migrated with `data: unknown` signatures"
    - path: "src/components/plants/plant-actions.tsx"
      provides: "archive/unarchive/delete buttons forward { householdId, plantId } to migrated actions"
    - path: "src/components/rooms/room-card.tsx"
      provides: "delete button forwards { householdId, roomId } to deleteRoom"
  key_links:
    - from: "src/features/plants/actions.ts (createPlant)"
      to: "requireHouseholdAccess(parsed.data.householdId)"
      via: "live DB membership check after Zod parse"
      pattern: "requireHouseholdAccess\\(parsed\\.data\\.householdId\\)"
    - from: "src/components/plants/add-plant-dialog.tsx"
      to: "form hidden input or RHF defaultValues"
      via: "householdId prop threading"
      pattern: "householdId|name=\"householdId\""
    - from: "revalidatePath calls"
      to: "literal /h/[householdSlug]/ pattern with type param"
      via: "Pitfall 3 — dynamic segment requires type"
      pattern: "revalidatePath\\(\"/h/\\[householdSlug\\]"
---

<objective>
Migrate every mutating Server Action in `src/features/plants/actions.ts` and `src/features/rooms/actions.ts` from `userId`-based ownership checks to `householdId`-based ownership checks following the D-12 7-step canonical shape. Convert archive/unarchive/delete signatures from positional `plantId: string` / `roomId: string` to `data: unknown` blobs so Zod parse can validate both `householdId` and the entity id. Wire audit columns (AUDT-02 — `createdByUserId`) at every create site. Update `revalidatePath` calls to `/h/[householdSlug]/...` with `'page'` type. Thread `householdId` into the RHF + hidden-input form components and action-button components that call these migrated actions.

Purpose: Closes Pitfall 16 for the plants + rooms action surface. Completes the code-only half of the build-breakage repair for these two feature modules (Plan 04 fixed queries; this plan fixes actions). Delivers the full set of mutating paths that Plan 03 routes navigate to for plants/rooms — without this plan, buttons in the UI throw compile errors against the Plan 04 schema extensions.

Output: 2 migrated action files (8 mutating actions — 5 plants + 3 rooms) + 2 extended schema files (already extended by Plan 04 with `householdId`) + 6 updated client components (add-plant-dialog, edit-plant-dialog, plant-actions, create-room-dialog, quick-create-presets, room-card).
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
@.planning/workstreams/household/phases/02-query-action-layer-update/02-01-PLAN.md
@CLAUDE.md

# Source files the executor MUST read before editing
@src/features/plants/actions.ts
@src/features/rooms/actions.ts
@src/features/household/guards.ts
@src/features/plants/schemas.ts
@src/features/rooms/schemas.ts
@src/components/plants/add-plant-dialog.tsx
@src/components/plants/edit-plant-dialog.tsx
@src/components/plants/plant-actions.tsx
@src/components/rooms/create-room-dialog.tsx
@src/components/rooms/quick-create-presets.tsx
@src/components/rooms/room-card.tsx
@prisma/schema.prisma

<interfaces>
<!-- D-12 canonical 7-step Server Action template — applies to every migrated action in this plan -->

```typescript
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireHouseholdAccess } from "@/features/household/guards";
import { createXSchema } from "./schemas";

export async function createX(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (verbatim from v1)
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  // Step 3: Zod parse (schema now requires householdId from Plan 04)
  const parsed = createXSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: LIVE membership check — Pitfall 16 / D-04 — DO NOT wrap in try/catch
  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  // Step 5: for update/delete/archive — fetch ownership-verified entity
  const existing = await db.X.findFirst({
    where: { id: parsed.data.id, householdId: parsed.data.householdId },
  });
  if (!existing) return { error: "Not found." };

  // Step 6: write with audit column (AUDT-02)
  const created = await db.X.create({
    data: {
      /* existing fields */,
      householdId: household.id,
      createdByUserId: session.user.id,
    },
  });

  // Step 7: revalidatePath with type param — Pitfall 3
  revalidatePath("/h/[householdSlug]/<suffix>", "page");

  return { success: true, xId: created.id };
}
```

**Action signature changes (mandatory — D-12 step 3 requires Zod parse of householdId):**

| Action | BEFORE | AFTER |
|--------|--------|-------|
| `archivePlant(plantId: string)` | positional | `archivePlant(data: unknown)` where `data = { householdId, plantId }` |
| `unarchivePlant(plantId: string)` | positional | `unarchivePlant(data: unknown)` where `data = { householdId, plantId }` |
| `deletePlant(plantId: string)` | positional | `deletePlant(data: unknown)` where `data = { householdId, plantId }` |
| `deleteRoom(roomId: string)` | positional | `deleteRoom(data: unknown)` where `data = { householdId, roomId }` |
| `createPlant(data: unknown)` | already blob | same shape; schema now requires `householdId` |
| `updatePlant(data: unknown)` | already blob | same shape; schema now requires `householdId` |
| `createRoom(data: unknown)` | already blob | same shape; schema now requires `householdId` |
| `updateRoom(data: unknown)` | already blob | same shape; schema now requires `householdId` |

**New Zod schemas that Plan 05a adds to `plants/schemas.ts` and `rooms/schemas.ts`** (Plan 04 adds `householdId` to existing create/edit schemas; Plan 05a adds fresh schemas for the archive/unarchive/delete blob payloads):

```typescript
// plants/schemas.ts — append:
export const plantTargetSchema = z.object({
  householdId: z.cuid(),
  plantId: z.string().min(1),
});
export type PlantTargetInput = z.infer<typeof plantTargetSchema>;
// Used by archivePlant, unarchivePlant, deletePlant.

// rooms/schemas.ts — append:
export const roomTargetSchema = z.object({
  householdId: z.cuid(),
  roomId: z.string().min(1),
});
export type RoomTargetInput = z.infer<typeof roomTargetSchema>;
// Used by deleteRoom.
```

Form integration (D-04 hidden field — two flavors):

Plain server-component form (create/edit rooms):
```tsx
<form action={createRoom}>
  <input type="hidden" name="householdId" value={householdId} />
  <input name="name" required />
  <button type="submit">Save</button>
</form>
```

RHF dialog (Client Component; `useForm` with defaultValues + register):
```tsx
"use client";
const form = useForm<CreatePlantInput>({
  defaultValues: {
    householdId: householdId,  // NEW — passed as prop from parent Server Component
    nickname: "",
    wateringInterval: 7,
    /* ... */
  },
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <input type="hidden" {...form.register("householdId")} />
    {/* ... existing fields ... */}
  </form>
</Form>
```

Client components that call archive/unarchive/delete from button handlers — pass the object payload directly:

```tsx
// BEFORE: archivePlant(plant.id)
// AFTER:
const result = await archivePlant({ householdId, plantId: plant.id });

// BEFORE: deletePlant(plant.id)
// AFTER:
const result = await deletePlant({ householdId, plantId: plant.id });

// BEFORE: deleteRoom(room.id)
// AFTER:
const result = await deleteRoom({ householdId, roomId: room.id });
```

**Reality check — call sites grep'd before writing this plan:**
- `src/components/plants/plant-actions.tsx` lines 36, 49, 62 — archive/unarchive/delete bindings (need new `householdId` prop + payload)
- `src/components/rooms/room-card.tsx` line 37 — deleteRoom binding (needs new `householdId` prop + payload)
- `src/components/rooms/quick-create-presets.tsx` line 23 — createRoom({ name }) call (needs `householdId` added to payload)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate plants/actions.ts (5 actions) + update plants/schemas.ts + wire plants client components</name>
  <files>src/features/plants/actions.ts, src/features/plants/schemas.ts, src/components/plants/add-plant-dialog.tsx, src/components/plants/edit-plant-dialog.tsx, src/components/plants/plant-actions.tsx</files>
  <behavior>
    - `createPlant(data)`: parses with `createPlantSchema` (Plan 04 added `householdId: z.cuid()`), calls `requireHouseholdAccess(parsed.data.householdId)`, creates Plant with `householdId + createdByUserId + nested reminders.create({userId, enabled: true})`, revalidates `/h/[householdSlug]/plants` and `/h/[householdSlug]/dashboard`.
    - `updatePlant(data)`: parses, guards, findFirst by `{ id, householdId }`, update if found, revalidate.
    - `archivePlant(data)`, `unarchivePlant(data)`, `deletePlant(data)`: signature changes from `plantId: string` to `data: unknown`. Zod schema is the new `plantTargetSchema` (below). findFirst scoped by `{ id: parsed.data.plantId, householdId: parsed.data.householdId }`.
    - `plants/schemas.ts` gains `plantTargetSchema` (householdId + plantId).
    - add-plant-dialog.tsx accepts `householdId` prop + RHF defaultValues + hidden input.
    - edit-plant-dialog.tsx accepts `householdId` prop + RHF defaultValues + hidden input.
    - plant-actions.tsx accepts `householdId` prop; its archive/unarchive/delete handlers pass `{ householdId, plantId: plant.id }` payloads.
  </behavior>
  <read_first>
    - src/features/plants/actions.ts (current — all 5 exports)
    - src/features/plants/schemas.ts (current — createPlantSchema + editPlantSchema; Plan 04 added householdId to both)
    - src/features/household/guards.ts (requireHouseholdAccess signature)
    - prisma/schema.prisma (confirm Plant.householdId + Plant.createdByUserId columns exist — Phase 1 D-05)
    - src/components/plants/add-plant-dialog.tsx (current RHF integration — confirm useForm + defaultValues pattern)
    - src/components/plants/edit-plant-dialog.tsx (current)
    - src/components/plants/plant-actions.tsx (current — uses positional arg for archivePlant/unarchivePlant/deletePlant; must switch to object payload)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md §src/features/plants/actions.ts
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-RESEARCH.md §Pattern 3
  </read_first>
  <action>
    Step 1 — Extend `src/features/plants/schemas.ts`. Keep all existing exports (createPlantSchema, editPlantSchema + their types — Plan 04 added `householdId: z.cuid()` to both). Append:

    ```typescript
    export const plantTargetSchema = z.object({
      householdId: z.cuid(),
      plantId: z.string().min(1, "Plant ID is required."),
    });
    export type PlantTargetInput = z.infer<typeof plantTargetSchema>;
    ```

    This schema powers archivePlant, unarchivePlant, and deletePlant per D-12 step 3.

    Step 2 — Migrate `src/features/plants/actions.ts`. Rewrite EVERY exported mutating action.

    a. Add import at top: `import { requireHouseholdAccess } from "@/features/household/guards";` and `import { plantTargetSchema } from "./schemas";` (alongside the existing `createPlantSchema, editPlantSchema` import — update that import line to include `plantTargetSchema`).

    b. `createPlant(data: unknown)` — replace the current body with:

    ```typescript
    export async function createPlant(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = createPlantSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const now = new Date();
      const nextWateringAt = addDays(now, parsed.data.wateringInterval);

      const plant = await db.plant.create({
        data: {
          nickname: parsed.data.nickname,
          species: parsed.data.species ?? null,
          roomId: parsed.data.roomId ?? null,
          wateringInterval: parsed.data.wateringInterval,
          careProfileId: parsed.data.careProfileId ?? null,
          householdId: household.id,
          createdByUserId: session.user.id,  // AUDT-02
          lastWateredAt: now,
          nextWateringAt,
          reminders: {
            create: { userId: session.user.id, enabled: true },  // D-13 — per-user-per-plant preference
          },
        },
      });

      revalidatePath("/h/[householdSlug]/plants", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true, plantId: plant.id };
    }
    ```

    c. `updatePlant(data: unknown)` — preserve current logic for nextWateringAt recalculation; substitute the ownership filter:

    ```typescript
    export async function updatePlant(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = editPlantSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const existing = await db.plant.findFirst({
        where: { id: parsed.data.id, householdId: parsed.data.householdId },
      });
      if (!existing) return { error: "Plant not found." };

      // Preserve existing nextWateringAt recalculation logic verbatim
      let nextWateringAt = existing.nextWateringAt;
      if (
        parsed.data.wateringInterval !== existing.wateringInterval &&
        existing.lastWateredAt
      ) {
        nextWateringAt = addDays(existing.lastWateredAt, parsed.data.wateringInterval);
      }

      await db.plant.update({
        where: { id: parsed.data.id },
        data: {
          nickname: parsed.data.nickname,
          species: parsed.data.species ?? null,
          roomId:
            parsed.data.roomId === undefined
              ? undefined
              : (parsed.data.roomId ?? null),
          wateringInterval: parsed.data.wateringInterval,
          nextWateringAt,
        },
      });

      revalidatePath("/h/[householdSlug]/plants", "page");
      revalidatePath("/h/[householdSlug]/plants/[id]", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true };
    }
    ```

    d. `archivePlant(data: unknown)` — signature change from positional `plantId: string`:

    ```typescript
    export async function archivePlant(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = plantTargetSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const plant = await db.plant.findFirst({
        where: { id: parsed.data.plantId, householdId: parsed.data.householdId },
      });
      if (!plant) return { error: "Plant not found." };

      await db.plant.update({
        where: { id: plant.id },
        data: { archivedAt: new Date() },
      });

      revalidatePath("/h/[householdSlug]/plants", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true };
    }
    ```

    e. `unarchivePlant(data: unknown)` — mirror of archivePlant but sets `archivedAt: null`. Uses `plantTargetSchema`.

    f. `deletePlant(data: unknown)` — same shape with `db.plant.delete({ where: { id: plant.id } })`. Uses `plantTargetSchema`.

    Step 3 — Update `src/components/plants/plant-actions.tsx` (currently uses positional args — see lines 36, 49, 62):

    a. Add prop: `interface PlantActionsProps { plant: PlantWithRelations; householdId: string; }` — destructure `householdId` in the component signature.

    b. Rewrite the 3 call sites:
    ```tsx
    // Line 36 BEFORE:
    const result = await archivePlant(plant.id);
    // AFTER:
    const result = await archivePlant({ householdId, plantId: plant.id });

    // Line 49 BEFORE:
    const undoResult = await unarchivePlant(plant.id);
    // AFTER:
    const undoResult = await unarchivePlant({ householdId, plantId: plant.id });

    // Line 62 BEFORE:
    const result = await deletePlant(plant.id);
    // AFTER:
    const result = await deletePlant({ householdId, plantId: plant.id });
    ```

    c. The `router.push("/plants")` calls (lines 44, 72) are page navigation, not server actions — leave them as-is. Plan 03b updates those paths to `/h/[householdSlug]/plants` as part of the legacy-route cleanup.

    Step 4 — Update `src/components/plants/add-plant-dialog.tsx`:
      - Add `householdId: string` to the component's props interface.
      - Update the `useForm` call: add `householdId` to `defaultValues`.
      - Inside `<form>`, add `<input type="hidden" {...form.register("householdId")} />` so the submitted payload includes the household id.
      - The component is rendered by `src/app/(main)/h/[householdSlug]/plants/page.tsx` (Plan 03a) which has `household.id` from `getCurrentHousehold` — it passes `householdId={household.id}` as a prop to this dialog.

    Step 5 — Update `src/components/plants/edit-plant-dialog.tsx`:
      - Same pattern. Add `householdId: string` prop, thread into RHF `defaultValues` + hidden input.

    Step 6 — Run `npx tsc --noEmit 2>&1 | grep -E "src[/\\\\]features[/\\\\]plants[/\\\\]actions\\.ts|src[/\\\\]features[/\\\\]plants[/\\\\]schemas\\.ts|src[/\\\\]components[/\\\\]plants[/\\\\](add-plant-dialog|edit-plant-dialog|plant-actions)\\.tsx"`. Should return zero matching errors for these 5 files.

    Step 7 — Stage all 5 modified files. Do NOT run `git commit` — notify the developer to review the diff; the gsd-executor coordinates commits with user approval per the workspace memory rule.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -cE "src[/\\\\]features[/\\\\]plants[/\\\\]actions\\.ts|src[/\\\\]features[/\\\\]plants[/\\\\]schemas\\.ts|src[/\\\\]components[/\\\\]plants[/\\\\]plant-actions\\.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - Grep `export async function archivePlant\(data: unknown\)` in `src/features/plants/actions.ts` returns 1 match (signature changed)
    - Grep `export async function unarchivePlant\(data: unknown\)` returns 1 match
    - Grep `export async function deletePlant\(data: unknown\)` returns 1 match
    - Grep `plantTargetSchema` in `src/features/plants/actions.ts` returns ≥ 3 matches (imported + used 3x for archive/unarchive/delete)
    - Grep `requireHouseholdAccess\(parsed\.data\.householdId\)` in `src/features/plants/actions.ts` returns ≥ 5 matches (one per mutating action)
    - Grep `createdByUserId:\s*session\.user\.id` in `src/features/plants/actions.ts` returns 1 match (createPlant)
    - Grep `where:\s*\{[^}]*userId` in `src/features/plants/actions.ts` returns 0 matches (all userId ownership filters purged)
    - Grep `revalidatePath\("/h/\[householdSlug\]` in `src/features/plants/actions.ts` returns ≥ 5 matches
    - Grep `revalidatePath\("/dashboard"|revalidatePath\("/plants"` returns 0 matches (legacy revalidation purged)
    - Grep `reminders:\s*\{\s*create:` in `src/features/plants/actions.ts` returns 1 match (createPlant preserves D-13 per-user reminder)
    - Grep `export const plantTargetSchema` in `src/features/plants/schemas.ts` returns 1 match
    - Grep `householdId` in `src/components/plants/plant-actions.tsx` returns ≥ 4 matches (prop + 3 call sites)
    - Grep `archivePlant\(\{ householdId` in `src/components/plants/plant-actions.tsx` returns 1 match
    - Grep `unarchivePlant\(\{ householdId` in `src/components/plants/plant-actions.tsx` returns 1 match
    - Grep `deletePlant\(\{ householdId` in `src/components/plants/plant-actions.tsx` returns 1 match
    - Grep `householdId` in `src/components/plants/add-plant-dialog.tsx` returns ≥ 2 matches (prop + RHF)
    - Grep `householdId` in `src/components/plants/edit-plant-dialog.tsx` returns ≥ 2 matches (prop + RHF)
    - `npx tsc --noEmit` reports zero NEW errors in the 5 modified files (pre-existing cascade errors in OTHER files — e.g. pages, other action files — are not this task's concern; Plan 05b + Plan 03 clean those)
  </acceptance_criteria>
  <done>plants action + component migration complete following D-12 7-step template; archive/unarchive/delete signatures flipped to data-blob; audit column wired; revalidatePath household-scoped; components thread householdId.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Migrate rooms/actions.ts (3 actions) + update rooms/schemas.ts + wire rooms client components</name>
  <files>src/features/rooms/actions.ts, src/features/rooms/schemas.ts, src/components/rooms/create-room-dialog.tsx, src/components/rooms/quick-create-presets.tsx, src/components/rooms/room-card.tsx</files>
  <behavior>
    - `createRoom(data)`: parses with `createRoomSchema` (Plan 04 added `householdId: z.cuid()`), guards, creates with `householdId + createdByUserId`, revalidates `/h/[householdSlug]/rooms` + `/h/[householdSlug]/plants`.
    - `updateRoom(data)`: parses with `editRoomSchema`, guards, findFirst by `{ id, householdId }`, updates, revalidates.
    - `deleteRoom(data)`: signature changes from positional `roomId: string` to `data: unknown`. Uses new `roomTargetSchema` (householdId + roomId). Returns `{ success, hadPlants }` shape preserved.
    - `rooms/schemas.ts` gains `roomTargetSchema`.
    - create-room-dialog.tsx accepts `householdId` prop + RHF defaultValues + hidden input (creates AND edits a room — already receives optional `room` prop for edit mode).
    - quick-create-presets.tsx accepts `householdId` prop and passes it to `createRoom({ name, householdId })`.
    - room-card.tsx accepts `householdId` prop and calls `deleteRoom({ householdId, roomId: room.id })`.
  </behavior>
  <read_first>
    - src/features/rooms/actions.ts (current — 3 exports)
    - src/features/rooms/schemas.ts (current — createRoomSchema + editRoomSchema; Plan 04 added householdId to both)
    - src/components/rooms/create-room-dialog.tsx (current — check if it uses RHF or a plain server-action form)
    - src/components/rooms/quick-create-presets.tsx (current — it calls `createRoom({ name })` on line 23)
    - src/components/rooms/room-card.tsx (current — calls `deleteRoom(room.id)` on line 37)
    - prisma/schema.prisma (confirm Room.householdId + Room.createdByUserId columns)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md §src/features/rooms/actions.ts
  </read_first>
  <action>
    Step 1 — Extend `src/features/rooms/schemas.ts`. Keep `createRoomSchema` + `editRoomSchema` (both already have `householdId` via Plan 04). Append:

    ```typescript
    export const roomTargetSchema = z.object({
      householdId: z.cuid(),
      roomId: z.string().min(1, "Room ID is required."),
    });
    export type RoomTargetInput = z.infer<typeof roomTargetSchema>;
    ```

    Step 2 — Migrate `src/features/rooms/actions.ts`:

    a. Update imports: add `import { requireHouseholdAccess } from "@/features/household/guards";` and include `roomTargetSchema` in the `./schemas` import.

    b. `createRoom(data: unknown)`:

    ```typescript
    export async function createRoom(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = createRoomSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const room = await db.room.create({
        data: {
          name: parsed.data.name,
          householdId: household.id,
          createdByUserId: session.user.id,  // AUDT-02
        },
      });

      revalidatePath("/h/[householdSlug]/rooms", "page");
      revalidatePath("/h/[householdSlug]/plants", "page");

      return { success: true, roomId: room.id };
    }
    ```

    c. `updateRoom(data: unknown)`:

    ```typescript
    export async function updateRoom(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = editRoomSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const existing = await db.room.findFirst({
        where: { id: parsed.data.id, householdId: parsed.data.householdId },
      });
      if (!existing) return { error: "Room not found." };

      await db.room.update({
        where: { id: parsed.data.id },
        data: { name: parsed.data.name },
      });

      revalidatePath("/h/[householdSlug]/rooms", "page");
      revalidatePath("/h/[householdSlug]/rooms/[id]", "page");
      revalidatePath("/h/[householdSlug]/plants", "page");

      return { success: true };
    }
    ```

    d. `deleteRoom(data: unknown)` — signature changes from positional `roomId: string`:

    ```typescript
    export async function deleteRoom(data: unknown) {
      const session = await auth();
      if (!session?.user?.id) return { error: "Not authenticated." };
      if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

      const parsed = roomTargetSchema.safeParse(data);
      if (!parsed.success) return { error: "Invalid input." };

      const { household } = await requireHouseholdAccess(parsed.data.householdId);

      const room = await db.room.findFirst({
        where: { id: parsed.data.roomId, householdId: parsed.data.householdId },
        include: { _count: { select: { plants: true } } },
      });
      if (!room) return { error: "Room not found." };

      // Prisma onDelete: SetNull on Plant.roomId handles plant detach automatically
      await db.room.delete({
        where: { id: room.id },
      });

      revalidatePath("/h/[householdSlug]/rooms", "page");
      revalidatePath("/h/[householdSlug]/plants", "page");
      revalidatePath("/h/[householdSlug]/dashboard", "page");

      return { success: true, hadPlants: room._count.plants > 0 };
    }
    ```

    Step 3 — Update `src/components/rooms/create-room-dialog.tsx`:
      - Add `householdId: string` to the component's props interface.
      - If the component uses RHF: add `householdId` to `defaultValues` and hidden `<input {...form.register("householdId")} />`.
      - If the component uses a plain `<form action={createRoom}>`: add `<input type="hidden" name="householdId" value={householdId} />`.
      - Read the file first to determine which pattern applies — do NOT guess.

    Step 4 — Update `src/components/rooms/quick-create-presets.tsx` (line 23):
      - Add `householdId: string` to `QuickCreatePresetsProps`.
      - Change line 23:
      ```tsx
      // BEFORE:
      const result = await createRoom({ name });
      // AFTER:
      const result = await createRoom({ householdId, name });
      ```

    Step 5 — Update `src/components/rooms/room-card.tsx` (line 37):
      - Add `householdId: string` to `RoomCardProps`.
      - Change line 37:
      ```tsx
      // BEFORE:
      const result = await deleteRoom(room.id);
      // AFTER:
      const result = await deleteRoom({ householdId, roomId: room.id });
      ```
      - Also update the `<Link href={\`/rooms/${room.id}\`}>` (line 63) — that's a page navigation, leave path rewire to Plan 03a/03b (the link target still functions in the route tree after Plan 03a moves pages under `/h/[householdSlug]/`).

    Step 6 — Run `npx tsc --noEmit 2>&1 | grep -E "src[/\\\\]features[/\\\\]rooms[/\\\\](actions|schemas)\\.ts|src[/\\\\]components[/\\\\]rooms[/\\\\]"`. Should return zero errors in these 5 files.

    Step 7 — Stage all 5 modified files. Do NOT run `git commit` — notify the developer to review (workspace memory rule).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -cE "src[/\\\\]features[/\\\\]rooms[/\\\\]actions\\.ts|src[/\\\\]components[/\\\\]rooms[/\\\\]room-card\\.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - Grep `export async function deleteRoom\(data: unknown\)` in `src/features/rooms/actions.ts` returns 1 match (signature flipped)
    - Grep `roomTargetSchema` in `src/features/rooms/actions.ts` returns ≥ 2 matches (imported + used in deleteRoom)
    - Grep `requireHouseholdAccess\(parsed\.data\.householdId\)` in `src/features/rooms/actions.ts` returns 3 matches (one per mutating action)
    - Grep `createdByUserId:\s*session\.user\.id` in `src/features/rooms/actions.ts` returns 1 match (createRoom)
    - Grep `where:\s*\{[^}]*userId` in `src/features/rooms/actions.ts` returns 0 matches
    - Grep `revalidatePath\("/h/\[householdSlug\]` in `src/features/rooms/actions.ts` returns ≥ 6 matches
    - Grep `revalidatePath\("/rooms"|revalidatePath\("/plants"|revalidatePath\("/dashboard"` returns 0 matches
    - Grep `export const roomTargetSchema` in `src/features/rooms/schemas.ts` returns 1 match
    - Grep `householdId` in `src/components/rooms/create-room-dialog.tsx` returns ≥ 2 matches
    - Grep `householdId` in `src/components/rooms/quick-create-presets.tsx` returns ≥ 2 matches
    - Grep `createRoom\(\{ householdId` in `src/components/rooms/quick-create-presets.tsx` returns 1 match
    - Grep `householdId` in `src/components/rooms/room-card.tsx` returns ≥ 2 matches
    - Grep `deleteRoom\(\{ householdId` in `src/components/rooms/room-card.tsx` returns 1 match
    - `npx tsc --noEmit` reports zero NEW errors in the 5 modified files
  </acceptance_criteria>
  <done>rooms action + component migration complete; deleteRoom signature flipped to data-blob; components thread householdId; audit column wired.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client form/bind payload → Zod parse | Untrusted client input containing `householdId` hidden field + entity id; `createXSchema.safeParse(data)` validates both via `z.cuid()` on householdId and `z.string().min(1)` on id. Extra unknown fields stripped. |
| parsed.data.householdId → requireHouseholdAccess | Post-Zod the string is still untrusted at authorization; `requireHouseholdAccess` performs LIVE `db.householdMember.findFirst({ householdId, userId: session.user.id })` — rejects non-members via ForbiddenError. |
| parsed.data.plantId/roomId → findFirst with householdId scope | Entity ownership check combines `id + householdId` in the `where` — defence-in-depth against a crafted payload that pairs a legit household with an entity belonging to a different household. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05a-01 | E (Elevation of Privilege) | Server Action stale-JWT bypass | mitigate | Every mutating action calls `await requireHouseholdAccess(parsed.data.householdId)` as its first post-parse step — live DB check (not JWT-cached, not React-cached across Action↔Component). A user removed mid-session cannot mutate that household's data on next request. Plan 06 ForbiddenError tests exercise every action. |
| T-02-05a-02 | T (Tampering) | hidden-field householdId swap | mitigate | Client tampering with the hidden `householdId` is rejected by `requireHouseholdAccess` (non-member → ForbiddenError). Zod shape validation alone is NOT the authz defense — the live DB check is. |
| T-02-05a-03 | E | Entity-level ownership escape | mitigate | Update/delete/archive actions perform a SECONDARY `db.plant.findFirst({ where: { id, householdId } })` (or equivalent for Room) AFTER the guard. This rejects a scenario where an authorized member of household A passes a plantId belonging to household B — the double-scoped filter returns null and the action returns `{ error: "Not found." }`. |
| T-02-05a-04 | R (Repudiation) | Audit column write path | mitigate | AUDT-02 (`Plant.createdByUserId`, `Room.createdByUserId`) populated from `session.user.id` at write sites. Non-repudiable record of who created each entity. Audit columns are write-only (D-11) — never consulted in filter clauses. |
| T-02-05a-05 | T | Mass assignment on entity creates | mitigate | Each `db.X.create({ data: { ... } })` explicitly lists fields — no `...parsed.data` spreading. Client cannot inject `archivedAt`, `createdAt`, or privileged columns. Zod strips unknown fields pre-write. |
| T-02-05a-06 | I (Information Disclosure) | Reminder per-user leak (createPlant nested create) | mitigate | `reminders: { create: { userId: session.user.id, enabled: true } }` uses session-derived userId verbatim — a user cannot create a Reminder attributed to another user. D-13 per-user-per-plant preference contract preserved. |
| T-02-05a-07 | D (Denial of Service) | revalidatePath dynamic pattern | accept | `revalidatePath("/h/[householdSlug]/dashboard", "page")` with literal token invalidates ALL households' cached dashboards. At v1 concurrent load, re-render cost is negligible. Out of scope. |
| T-02-05a-08 | E | CSRF on Server Actions | accept | Next.js Server Actions have built-in same-origin protection via the action ID system. Not a Phase 2 concern. |
</threat_model>

<verification>
- `npx tsc --noEmit` — zero NEW errors in the 10 files touched by this plan
- Grep coverage (quantitative):
  - `requireHouseholdAccess(parsed.data.householdId)` in plants/rooms actions: ≥ 8 matches
  - `createdByUserId: session.user.id` in plants + rooms actions: ≥ 2 matches
  - `revalidatePath("/h/[householdSlug]` across plants + rooms actions: ≥ 10 matches
  - `where: { id, userId }` in plants + rooms actions: 0 matches
  - `data: unknown` in `archivePlant|unarchivePlant|deletePlant|deleteRoom`: 4 matches total (signature flip confirmed)
- All client component call sites consume the new object-payload signatures; hidden householdId wiring present in dialogs
</verification>

<success_criteria>
- Pitfall 16 closed for plants + rooms: every mutating Server Action in these modules hits `requireHouseholdAccess` live
- archive/unarchive/delete-plant + delete-room signatures standardised to `data: unknown` per D-12 — closes the checker B-6 gap
- AUDT-02 wired: `createdByUserId` populated at create sites
- D-12 canonical template applied uniformly across 8 actions
- D-13 honored: Reminder.userId preserved as per-user-per-plant preference in createPlant
- Dialog components + room-card + plant-actions + quick-create-presets all pass `householdId` into the action payload; no hardcoded call sites remain
- Plan 05b unblocked (it assumes this plan's signature changes landed)
</success_criteria>

<output>
After completion, create `.planning/workstreams/household/phases/02-query-action-layer-update/02-05a-SUMMARY.md` including:
- Per-action migration confirmation (function name + guard call presence + signature shape)
- Client component call-site updates — list every file and the exact line change
- Schema additions (plantTargetSchema, roomTargetSchema) with exports
- revalidatePath count per file (should be `/h/[householdSlug]/*` exclusively)
- Any deviations from the plan (e.g., component uses different form pattern than expected)
</output>
</content>
</invoke>