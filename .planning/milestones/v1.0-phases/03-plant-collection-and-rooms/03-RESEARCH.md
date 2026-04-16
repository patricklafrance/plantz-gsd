# Phase 3: Plant Collection and Rooms - Research

**Researched:** 2026-04-14
**Domain:** Next.js 16 App Router — Plant CRUD, Room management, Catalog seeding, shadcn Dialog/Select/Tabs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Add Plant Flow**
- D-01: Catalog-first approach. User browses/searches the catalog first, selects a plant which auto-fills species and suggested watering interval, then customizes. "Custom plant" option at bottom for unlisted plants.
- D-02: Minimal form fields: nickname (required), species (auto-filled from catalog), room (dropdown), watering interval (auto-filled, editable). Additional fields available on the detail page after creation.
- D-03: "Add plant" button lives on the dashboard header and the plant collection page. No floating action button.
- D-04: Adding a plant opens a modal dialog. Catalog browsing happens inside the modal with a search + category grid view, then transitions to the form fields.

**Plant Detail and Editing**
- D-05: Edit via modal dialog. Edit button on the plant detail page opens a modal with pre-filled form fields. Consistent with the add-plant modal pattern.
- D-06: Both archive and delete actions available from the plant detail page. Delete always shows a confirmation dialog. Archive is instant with an undo toast notification.
- D-07: Detail page organized in card sections: Status card (next watering, days until due), Care info card (species, interval, light requirement), History card (recent waterings — empty for now, populated in Phase 4), Notes section.

**Room Organization**
- D-08: Dedicated room management page (/rooms) to create, rename, reorder, and delete rooms. Room presets (Living Room, Bedroom, Kitchen, Bathroom, Office, Balcony) shown as quick-create suggestions.
- D-09: Room page shows a header (room name, plant count, watering status summary) with a grid of plant cards showing each plant's name, species, and watering status.
- D-10: Collection filtering via horizontal tab/pill bar above the plant grid: "All" | room names. Active pill highlighted.

**Care Catalog**
- D-11: Catalog seeded via Prisma seed script. JSON/TS data file with ~30-50 common houseplants, loaded via `prisma db seed`. Version-controlled, runs on setup.
- D-12: Catalog browsing in the add-plant modal uses search bar + category grid (Succulents, Tropicals, Low-light, etc.). Selecting a card fills the form fields.
- D-13: Core care data per catalog entry: species name, common name, suggested watering interval (days), light requirement (low/medium/bright), brief care note. Maps to existing CareProfile model.

### Claude's Discretion
- Plant card design (icon/emoji, info density, hover states)
- Exact catalog categories and which plants go where
- Empty state for collection page (no plants yet)
- Room deletion behavior when room has plants (reassign vs unassign)
- Form validation error messages and field constraints
- Mobile responsive layout for grids and modals
- Loading states and skeleton patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLNT-01 | User can add a plant with nickname, species (from catalog or custom), room, and watering interval | Catalog-first modal (D-01/D-04), Server Action + Zod schema, Dialog component from shadcn |
| PLNT-02 | User can edit all plant details after creation | Edit modal (D-05), same action/schema pattern as add, `updatePlant` Server Action |
| PLNT-03 | User can archive a plant (soft-delete) | `archivedAt` field already in schema; `archivePlant` Server Action + undo toast pattern |
| PLNT-04 | User can permanently delete a plant with confirmation dialog | AlertDialog shadcn component, `deletePlant` Server Action |
| PLNT-05 | User can view plant detail page with care info, status, next watering, history, notes | `/plants/[id]` route, Server Component with Prisma query, card section layout (D-07) |
| PLNT-06 | User can browse/select from seeded catalog of 30-50 houseplants | Prisma seed script (D-11), catalog data file, modal catalog step (D-12) |
| PLNT-07 | Selecting a catalog plant auto-fills species, care info, suggested interval | Modal state transition from catalog → form, `careProfile` relation in schema |
| PLNT-08 | User can add a plant not in the catalog (custom details) | "Custom plant" option in modal bypasses catalog selection |
| ROOM-01 | User can create rooms with custom names | `createRoom` Server Action, `/rooms` management page (D-08) |
| ROOM-02 | User sees common room presets | Preset buttons on room creation UI (D-08) |
| ROOM-03 | User can assign plant to a room during creation or editing | Room dropdown in add/edit plant form (D-02), `roomId` foreign key in Plant model |
| ROOM-04 | User can filter plant collection by room | Horizontal tab/pill bar on collection page (D-10), URL search param or client state |
| ROOM-05 | User can view a room page with all plants and status summary | `/rooms/[id]` route, Server Component query filtered by `roomId` and `userId` |
</phase_requirements>

---

## Summary

Phase 3 builds on a fully established foundation from Phases 1 and 2. The data models (Plant, Room, CareProfile) are already defined in `prisma/schema.prisma`. The feature-based architecture (`src/features/{domain}/actions.ts`, `schemas.ts`) is proven by the auth feature. All UI primitives needed (Form, Card, Input, Button, Sonner) are already installed. The three new shadcn components required — Dialog, AlertDialog, and Select — are all available via the CLI and backed by `@base-ui/react` which is already installed as `@base-ui/react@1.4.0`.

The most complex part of this phase is the two-step add-plant modal: first the catalog browser (search + category grid), then the form pre-filled with catalog data. This requires client-side modal state management to track which step is active and pass catalog selection into form defaults. Everything else is straightforward CRUD: Server Actions for mutations, Server Components with direct Prisma queries for reads, and `revalidatePath` for cache invalidation.

The Prisma seed script is a first-time concern for this project. Prisma 7 requires the seed command to be defined in `prisma.config.ts` under `migrations.seed`, and triggered explicitly via `npx prisma db seed`. Node 24 supports TypeScript via `--experimental-strip-types`, so `node --experimental-strip-types prisma/seed.ts` is a viable zero-install seed runner.

**Primary recommendation:** Use the established feature-based pattern (`src/features/plants/` and `src/features/rooms/`). Install Dialog, AlertDialog, and Select via `npx shadcn@latest add`. Add `migrations.seed` to `prisma.config.ts`. Implement the two-step modal as a client component with a step enum state.

---

## Standard Stack

### Core (all already installed)

| Library | Installed Version | Purpose | Notes |
|---------|------------------|---------|-------|
| Next.js | 16.2.2 | App Router, Server Components, Server Actions | [VERIFIED: package.json] |
| Prisma | 7.7.0 | ORM — Plant, Room, CareProfile CRUD | [VERIFIED: package.json] |
| `@prisma/adapter-pg` | 7.7.0 | PostgreSQL driver adapter (required in Prisma 7) | [VERIFIED: package.json] |
| react-hook-form | 7.72.1 | Form state for add/edit plant forms | [VERIFIED: package.json] |
| `@hookform/resolvers` | 5.2.2 | Zod resolver for RHF; `import from "@hookform/resolvers/zod"` | [VERIFIED: package.json + source] |
| zod | 4.3.6 | Schema validation; `import { z } from "zod/v4"` | [VERIFIED: package.json] |
| sonner | 2.0.7 | Toast notifications — archive undo pattern | [VERIFIED: package.json] |
| date-fns | 4.1.0 | Date arithmetic for watering countdown | [VERIFIED: package.json] |
| `@base-ui/react` | 1.4.0 | Base primitives for Dialog, Select, AlertDialog, Tabs | [VERIFIED: package.json + ls node_modules] |
| lucide-react | 1.8.0 | Icons for plant types, watering status | [VERIFIED: package.json] |
| tailwind-merge + clsx | installed | `cn()` utility already in `src/lib/utils.ts` | [VERIFIED: codebase] |

### New shadcn Components to Install

| Component | Install Command | Backed By | Purpose |
|-----------|----------------|-----------|---------|
| dialog | `npx shadcn@latest add dialog` | `@base-ui/react/dialog` | Add plant modal, edit plant modal |
| alert-dialog | `npx shadcn@latest add alert-dialog` | `@base-ui/react/alert-dialog` | Delete confirmation |
| select | `npx shadcn@latest add select` | `@base-ui/react/select` | Room dropdown in forms |
| tabs | `npx shadcn@latest add tabs` | `@base-ui/react/tabs` | Room filter pill bar (optional — pills may be plain Buttons) |

[VERIFIED: `npx shadcn@latest add {component} --dry-run` confirmed all four install cleanly with zero new package dependencies]

### Installation

```bash
# New shadcn UI components (all backed by @base-ui/react already installed)
npx shadcn@latest add dialog
npx shadcn@latest add alert-dialog
npx shadcn@latest add select

# Tabs component (needed for room filter if using shadcn Tabs; plain Button pills are an alternative)
npx shadcn@latest add tabs
```

No new npm packages required — `@base-ui/react@1.4.0` is already installed and contains all primitives.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/
│   ├── plants/
│   │   ├── actions.ts          # Server Actions: createPlant, updatePlant, archivePlant, deletePlant
│   │   ├── queries.ts          # Prisma queries: getPlants, getPlant, getCatalog
│   │   └── schemas.ts          # Zod schemas: plantSchema, editPlantSchema
│   └── rooms/
│       ├── actions.ts          # Server Actions: createRoom, updateRoom, deleteRoom
│       ├── queries.ts          # Prisma queries: getRooms, getRoom
│       └── schemas.ts          # Zod schemas: roomSchema
├── components/
│   ├── plants/
│   │   ├── add-plant-dialog.tsx    # Two-step modal (catalog → form)
│   │   ├── plant-card.tsx          # Plant card for grids
│   │   ├── plant-grid.tsx          # Grid layout with room filter
│   │   ├── plant-detail.tsx        # Detail page card sections
│   │   └── edit-plant-dialog.tsx   # Edit modal (pre-filled)
│   └── rooms/
│       ├── room-card.tsx           # Room card for management page
│       └── create-room-dialog.tsx  # Create/edit room modal
└── app/(main)/
    ├── plants/
    │   ├── page.tsx                # Collection page — Server Component
    │   └── [id]/
    │       └── page.tsx            # Plant detail — Server Component
    └── rooms/
        ├── page.tsx                # Room management page — Server Component
        └── [id]/
            └── page.tsx            # Room detail page — Server Component
```

```
prisma/
├── schema.prisma                   # No changes needed — models already complete
├── seed.ts                         # NEW: catalog seed script
└── data/
    └── catalog.ts                  # NEW: ~40 houseplant records as TypeScript array
```

### Pattern 1: Server Action with Zod validation (established pattern)

```typescript
// src/features/plants/actions.ts
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createPlantSchema } from "./schemas";

export async function createPlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = createPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const plant = await db.plant.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  revalidatePath("/plants");
  revalidatePath("/dashboard");
  return { success: true, plantId: plant.id };
}
```

[CITED: established pattern from `src/features/auth/actions.ts`]

### Pattern 2: Two-step add-plant modal (new pattern for this phase)

The modal has two steps managed by client state:

```typescript
// src/components/plants/add-plant-dialog.tsx
"use client";

type ModalStep = "catalog" | "form";

export function AddPlantDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("catalog");
  const [selectedProfile, setSelectedProfile] = useState<CareProfile | null>(null);

  function handleCatalogSelect(profile: CareProfile) {
    setSelectedProfile(profile);
    setStep("form");
  }

  function handleCustomPlant() {
    setSelectedProfile(null);
    setStep("form");
  }

  // Reset state when dialog closes
  function handleOpenChange(open: boolean) {
    setOpen(open);
    if (!open) {
      setStep("catalog");
      setSelectedProfile(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild render={<Button>Add plant</Button>} />
      <DialogContent>
        {step === "catalog" ? (
          <CatalogBrowser onSelect={handleCatalogSelect} onCustom={handleCustomPlant} />
        ) : (
          <PlantForm profile={selectedProfile} onSuccess={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

[ASSUMED: Dialog API above uses `onOpenChange` — verify exact prop name from generated dialog.tsx]

### Pattern 3: Server Component for read — queries filtered by userId

```typescript
// src/app/(main)/plants/page.tsx
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function PlantsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [plants, rooms] = await Promise.all([
    db.plant.findMany({
      where: { userId: session.user.id, archivedAt: null },
      include: { room: true, careProfile: true },
      orderBy: { createdAt: "desc" },
    }),
    db.room.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return <PlantGrid plants={plants} rooms={rooms} />;
}
```

[CITED: established pattern from `src/app/(main)/dashboard/page.tsx`]

### Pattern 4: Archive with undo toast

```typescript
// Client component using Server Action + Sonner
async function handleArchive(plantId: string) {
  const result = await archivePlant(plantId);
  if (result.success) {
    toast("Plant archived", {
      action: {
        label: "Undo",
        onClick: () => unarchivePlant(plantId),
      },
    });
  }
}
```

[CITED: sonner docs pattern — `toast()` with `action` prop for undo]

### Pattern 5: Prisma 7 seed configuration

```typescript
// prisma.config.ts (updated — add migrations.seed)
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

Node 24.13.0 is installed (verified) and supports `--experimental-strip-types` for TypeScript without `tsx`. [VERIFIED: `node --version` = v24.13.0; Node 22+ supports `--experimental-strip-types`]

```typescript
// prisma/seed.ts — minimal pattern
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma";  // or @prisma/client depending on build
import { Pool } from "pg";
import { catalogData } from "./data/catalog";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  for (const entry of catalogData) {
    await db.careProfile.upsert({
      where: { name: entry.name },
      update: {},
      create: entry,
    });
  }
  console.log(`Seeded ${catalogData.length} catalog entries`);
}

main().finally(() => db.$disconnect());
```

[CITED: https://www.prisma.io/docs/orm/reference/prisma-config-reference — migrations.seed config]

### Anti-Patterns to Avoid

- **Importing generated Prisma client from wrong path:** The project uses `src/generated/prisma` (not `@prisma/client`). The seed script must use the correct import path or the standard `@prisma/client` alias — check which resolves correctly from `prisma/seed.ts`.
- **Querying plants without userId filter:** Every plant/room query must include `where: { userId: session.user.id }` to prevent cross-user data leakage.
- **Calling revalidatePath for only one path:** When a plant is created/edited/archived, both `/plants` AND `/dashboard` must be revalidated (dashboard shows plant count and urgency status).
- **Not handling archivedAt in queries:** The active collection query must include `archivedAt: null`. The archive/delete pages need the opposite filter.
- **Using Server Action directly in Dialog trigger:** The Dialog `onOpenChange` callback cannot be a Server Action — keep it in the client component; only the form submission calls the Server Action.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom overlay + focus-trap | `npx shadcn@latest add dialog` | Focus management, keyboard dismiss, scroll lock — all handled by `@base-ui/react/dialog` |
| Delete confirmation | Custom confirm UI | `npx shadcn@latest add alert-dialog` | Accessible, keyboard-navigable, consistent with design system |
| Room dropdown | Custom `<select>` | `npx shadcn@latest add select` | Consistent styling, accessible, supports placeholder + disabled states |
| Archive undo | Custom undo queue | `sonner` toast with `action` prop | Already installed; built-in undo toast pattern with auto-dismiss |
| Input validation | Custom error display | shadcn Form + react-hook-form + Zod | Established pattern from Phase 2 — all field-level errors handled automatically |
| Catalog data | DB-fetched admin UI | TypeScript array in `prisma/data/catalog.ts` + `prisma db seed` | D-11 locks this; version-controlled data is simpler and sufficient |

---

## Common Pitfalls

### Pitfall 1: Two-step modal state reset on close

**What goes wrong:** User opens the add-plant modal, navigates to the form step, then closes without submitting. On next open, they see the form step pre-filled with the previous catalog selection.
**Why it happens:** Client component state persists across opens unless explicitly reset.
**How to avoid:** Reset `step` to `"catalog"` and `selectedProfile` to `null` in the `onOpenChange(false)` handler.
**Warning signs:** Modal opens directly to the form without showing catalog.

### Pitfall 2: Prisma generated client path in seed script

**What goes wrong:** `prisma/seed.ts` imports from `@prisma/client` but the project generates to `src/generated/prisma`. TypeScript resolution from the `prisma/` folder may differ from `src/`.
**Why it happens:** The `generator client { output = "../src/generated/prisma" }` directive redirects the generated client away from the standard location.
**How to avoid:** Use a relative import `../src/generated/prisma` in the seed script, or check if `@prisma/client` still resolves (it sometimes re-exports). Test with `node --experimental-strip-types prisma/seed.ts` before adding the seed config.
**Warning signs:** `Cannot find module '@prisma/client'` during seed run.

### Pitfall 3: `revalidatePath` scope too narrow

**What goes wrong:** After creating/archiving a plant, the plants page updates but the dashboard still shows stale empty state or wrong count.
**Why it happens:** `revalidatePath("/plants")` only invalidates the plants page cache. Dashboard is a separate cache entry.
**How to avoid:** Always call `revalidatePath("/plants")` and `revalidatePath("/dashboard")` in every plant mutation Server Action.
**Warning signs:** Dashboard shows "No plants yet" after adding the first plant.

### Pitfall 4: Room deletion with assigned plants

**What goes wrong:** Deleting a room that has plants leaves those plants with a dangling `roomId` if not handled, or throws a FK constraint error.
**Why it happens:** Room has `plants: Plant[]` relation; Plant has `roomId String?` (nullable). Prisma's default on delete for optional FK relations is not CASCADE — it will block deletion if plants exist.
**How to avoid:** Before deleting a room, either (a) set all plants' `roomId` to `null` (unassign), or (b) add `onDelete: SetNull` to the `Plant.room` relation in the schema. Option (b) is cleaner. This is a Claude's Discretion item — recommend SetNull.
**Warning signs:** `P2003: Foreign key constraint failed` on room delete.

### Pitfall 5: Catalog search in modal — client vs. server filtering

**What goes wrong:** Catalog has 30-50 entries. Developer fetches them on every keystroke via a Server Action, causing unnecessary round trips.
**Why it happens:** Treating catalog search like a live search against a large dataset.
**How to avoid:** Fetch all catalog entries once when the modal opens (pass as props from Server Component or fetch in useEffect on open), then filter client-side. 30-50 records easily fit in memory.
**Warning signs:** Noticeable lag on every keystroke in catalog search.

### Pitfall 6: `@hookform/resolvers/zod` v5 with Zod v4 schemas

**What goes wrong:** Developer reads old docs and imports from `@hookform/resolvers/zod/v4` (non-existent path) or uses `zodResolver` with a Zod v3 schema.
**Why it happens:** `@hookform/resolvers` v5 uses runtime detection to distinguish Zod v3 (`_def.typeName`) from Zod v4 (`_zod` property). The import path remains `@hookform/resolvers/zod`.
**How to avoid:** Always `import { zodResolver } from "@hookform/resolvers/zod"` and always define schemas with `import { z } from "zod/v4"`.
**Warning signs:** Type errors in form generics or resolver failing to validate.

---

## Code Examples

### Select component usage (from generated component)

```typescript
// Source: npx shadcn@latest add select --view (verified against base-nova style)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Inside a react-hook-form FormField:
<FormField
  control={form.control}
  name="roomId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Room</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="No room" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {rooms.map((room) => (
            <SelectItem key={room.id} value={room.id}>
              {room.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

[VERIFIED: Select component generated by `npx shadcn@latest add select --dry-run --view`; uses `@base-ui/react/select`]

### Dialog component usage (base-nova style)

```typescript
// Source: npx shadcn@latest add dialog --view (verified)
// Note: base-nova Dialog uses @base-ui/react/dialog, NOT @radix-ui
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger render={<Button>Add plant</Button>} />
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add a plant</DialogTitle>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

[VERIFIED: Dialog component from `npx shadcn@latest add dialog --view`; uses `render` prop (Base UI pattern) not `asChild` (Radix UI pattern)]

### AlertDialog for delete confirmation

```typescript
// Pattern from established shadcn alert-dialog component (base-nova style)
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger render={<Button variant="destructive">Delete plant</Button>} />
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this plant?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. The plant and all its watering history will be permanently removed.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

[VERIFIED: AlertDialog component from `npx shadcn@latest add alert-dialog --view`; same `render` prop pattern]

### Archive with sonner undo toast

```typescript
// Pattern using existing sonner@2.0.7 installation
import { toast } from "sonner";
import { archivePlant, unarchivePlant } from "@/features/plants/actions";

async function handleArchive(plantId: string, plantName: string) {
  const result = await archivePlant(plantId);
  if (result.success) {
    toast(`"${plantName}" archived`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await unarchivePlant(plantId);
        },
      },
    });
  }
}
```

[CITED: sonner@2 toast API with action — https://sonner.emilkowal.ski/]

### Catalog data structure

```typescript
// prisma/data/catalog.ts
export type CatalogEntry = {
  name: string;         // unique — maps to CareProfile.name
  species: string;      // maps to CareProfile.species
  wateringInterval: number;  // days
  lightRequirement: "low" | "medium" | "bright";
  notes: string;
};

export const catalogData: CatalogEntry[] = [
  {
    name: "Pothos",
    species: "Epipremnum aureum",
    wateringInterval: 10,
    lightRequirement: "low",
    notes: "Very forgiving. Tolerates low light and irregular watering.",
  },
  // ... ~39 more entries across Succulents, Tropicals, Low-light, Herbs categories
];
```

[ASSUMED: Exact catalog content and categories are Claude's Discretion — 30-50 entries covering common houseplants]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@radix-ui/react-dialog` in shadcn components | `@base-ui/react/dialog` | shadcn base-nova style (Jan 2026) | Use `render` prop instead of `asChild`; import from `@base-ui/react/dialog` |
| `asChild` prop on Dialog triggers | `render` prop | Base UI v1.0 (Dec 2025) | `<DialogTrigger render={<Button>...</Button>} />` not `<DialogTrigger asChild><Button>` |
| `prisma` key in `package.json` for seed config | `migrations.seed` in `prisma.config.ts` | Prisma 7.0 | D-11 seed script needs to be configured in `prisma.config.ts` not `package.json` |
| Auto-seed on `prisma migrate dev` | Explicit `npx prisma db seed` only | Prisma 7.0 | Seed no longer runs automatically during migrations |
| `tsx` or `ts-node` to run seed | `node --experimental-strip-types` | Node 22+ | Node 24 is installed; no `tsx` dependency needed |

**Deprecated/outdated:**
- `asChild` prop: Not used in base-nova style components. All shadcn trigger components use the `render` prop.
- `middleware.ts`: Renamed to `proxy.ts` in Next.js 16 — already handled in Phase 1.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dialog uses `onOpenChange` prop for open/close control | Architecture Patterns — Pattern 2 | If prop name differs, modal won't close after submission. Verify from generated `dialog.tsx` before implementing. |
| A2 | Catalog data content (30-50 plants, 4 categories) | Code Examples — Catalog structure | No user impact; categories are Claude's Discretion. Adjust freely. |
| A3 | `node --experimental-strip-types prisma/seed.ts` works with prisma/seed.ts import paths | Architecture Patterns — Pattern 5 | Seed script may fail if generated client path doesn't resolve from `prisma/` directory. Test before committing config. |
| A4 | `Select` component's `value`/`onValueChange` props integrate with react-hook-form via field spread | Code Examples — Select usage | If Base UI Select uses different controlled prop names, RHF integration pattern must change. Verify from generated `select.tsx`. |

---

## Open Questions (RESOLVED)

1. **CareProfile `name` field uniqueness and seed upsert key** — RESOLVED (Plan 03-01)
   - What we know: `CareProfile` has `name String @unique` in the schema.
   - What's unclear: Whether "name" should be the common name ("Pothos") or scientific name ("Epipremnum aureum"), affecting how duplicates are handled on re-seed.
   - Resolution: Use common name as the unique key for readability; store scientific name in `species`. The `upsert({ where: { name } })` pattern handles re-runs safely. Implemented in Plan 03-01 catalog seed script.

2. **Room deletion behavior when plants are assigned (Claude's Discretion)** — RESOLVED (Plan 03-01)
   - What we know: `Plant.roomId` is nullable (`String?`). No cascade or setNull rule exists in the current schema.
   - What's unclear: Whether to block deletion if plants exist, or auto-unassign.
   - Resolution: Add `onDelete: SetNull` to `Plant.room` relation in schema. This unassigns plants automatically when their room is deleted — most user-friendly behavior for a personal app. Implemented in Plan 03-01 schema fix task.

3. **Room filter implementation: Tabs vs. URL params** — RESOLVED (Plan 03-05)
   - What we know: D-10 specifies a horizontal pill bar. The implementation could be client-side state (faster), URL search params (shareable/bookmarkable), or shadcn Tabs component.
   - What's unclear: Whether room filter state should survive page refresh.
   - Resolution: URL search param (`?room=roomId`) — simplest approach that works with Server Components (read `searchParams` in page.tsx), makes filtered views bookmarkable, and doesn't require a separate client wrapper. No Tabs component needed; plain Button pills with `aria-selected` are sufficient. Implemented in Plan 03-05 room filter task.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Seed script (TS runner) | ✓ | v24.13.0 | — |
| PostgreSQL | Prisma data layer | Assumed ✓ | (from Phase 1 setup) | — |
| `@base-ui/react` | Dialog, Select, AlertDialog | ✓ | 1.4.0 | — |
| `tsx` | Seed script runner | ✗ | not installed | `node --experimental-strip-types` (Node 24 built-in) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `tsx` — not installed, but `node --experimental-strip-types` works on Node 24 for TypeScript without type-only features like decorators. Seed script is simple enough that this is fully viable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` (includes `["tests/**/*.{test,spec}.{ts,tsx}"]`) |
| Quick run command | `npx vitest run tests/plants.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLNT-01 | `createPlant` action creates plant for authenticated user | unit | `npx vitest run tests/plants.test.ts` | ❌ Wave 0 |
| PLNT-01 | `createPlant` returns error if not authenticated | unit | `npx vitest run tests/plants.test.ts` | ❌ Wave 0 |
| PLNT-02 | `updatePlant` updates plant fields and revalidates paths | unit | `npx vitest run tests/plants.test.ts` | ❌ Wave 0 |
| PLNT-03 | `archivePlant` sets `archivedAt` timestamp | unit | `npx vitest run tests/plants.test.ts` | ❌ Wave 0 |
| PLNT-04 | `deletePlant` removes plant and revalidates | unit | `npx vitest run tests/plants.test.ts` | ❌ Wave 0 |
| PLNT-06 | Zod schema validates required fields (nickname, wateringInterval) | unit | `npx vitest run tests/plants.test.ts` | ❌ Wave 0 |
| ROOM-01 | `createRoom` action creates room for authenticated user | unit | `npx vitest run tests/rooms.test.ts` | ❌ Wave 0 |
| ROOM-05 | Room page shows plants filtered by roomId | E2E | `npx playwright test e2e/plants.spec.ts` | ❌ Wave 0 |
| PLNT-01 (E2E) | Add plant flow — catalog → form → submit appears in collection | E2E | `npx playwright test e2e/plants.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/plants.test.ts` — unit tests for plant Server Actions and Zod schemas
- [ ] `tests/rooms.test.ts` — unit tests for room Server Actions and Zod schemas
- [ ] `e2e/plants.spec.ts` — E2E: add plant flow, collection filtering
- [ ] `tests/catalog.test.ts` — unit test: catalog data validates against CareProfile shape (optional but useful)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Session already handled by Phase 2 |
| V3 Session Management | no | JWT sessions from Phase 2 |
| V4 Access Control | yes | Every Prisma query MUST include `userId: session.user.id`; plant/room ownership enforced at action level |
| V5 Input Validation | yes | Zod v4 schemas on all Server Actions (`createPlantSchema`, `editPlantSchema`, `roomSchema`) |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — plant/room accessed by another user's ID | Elevation of Privilege | Always include `userId: session.user.id` in `where` clause; never query by `id` alone |
| Mass assignment — extra fields in plant creation | Tampering | Zod `safeParse` + explicit Prisma `data` object (never spread raw input into Prisma) |
| Catalog poisoning — unauthenticated seed of CareProfile | Tampering | Seed is CLI-only (`npx prisma db seed`); no API route exposes CareProfile write |

---

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` — Plant, Room, CareProfile, WateringLog models verified in current codebase [VERIFIED: direct file read]
- `package.json` — all installed versions verified [VERIFIED: direct file read]
- `npx shadcn@latest add {dialog,alert-dialog,select,tabs} --dry-run --view` — component contents and @base-ui/react usage confirmed [VERIFIED: CLI output]
- `node_modules/@base-ui/react/` directory listing — all required primitives (dialog, select, tabs, alert-dialog) confirmed present [VERIFIED: ls]
- `node_modules/@hookform/resolvers/zod/dist/zod.js` — v5 runtime detection of Zod v4 schemas confirmed [VERIFIED: source code read]
- `node --version` output — v24.13.0 confirms `--experimental-strip-types` available [VERIFIED: Bash]
- Prisma config reference — https://www.prisma.io/docs/orm/reference/prisma-config-reference [CITED: WebFetch]
- Prisma seeding docs — https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding [CITED: WebFetch]

### Secondary (MEDIUM confidence)

- shadcn/ui Base UI January 2026 docs — confirms base-nova uses @base-ui/react and `render` prop pattern [CITED: ui.shadcn.com/docs/changelog/2026-01-base-ui]

### Tertiary (LOW confidence)

None — all critical claims verified directly from codebase or official documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json and node_modules
- Architecture: HIGH — follows established patterns verified from Phase 2 codebase
- Component API (Dialog/Select): HIGH — component code verified from shadcn CLI dry-run output
- Prisma seed config: HIGH — verified from official Prisma docs (WebFetch)
- Pitfalls: HIGH — derived from schema inspection and verified code patterns

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack — shadcn components are copy-paste and don't change once installed)
