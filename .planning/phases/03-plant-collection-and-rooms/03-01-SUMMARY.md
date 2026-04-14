---
phase: 03-plant-collection-and-rooms
plan: "01"
subsystem: database
tags: [prisma, seed, catalog, schema]
dependency_graph:
  requires: ["03-00"]
  provides: ["care-catalog-data", "plant-room-ondelete-setnull"]
  affects: ["03-02", "03-03"]
tech_stack:
  added: []
  patterns:
    - "Prisma upsert for idempotent seeding"
    - "tsx runner for TypeScript seed scripts"
    - "CareProfile catalog as seeded reference data"
key_files:
  created:
    - prisma/data/catalog.ts
    - prisma/seed.ts
  modified:
    - prisma/schema.prisma
    - prisma.config.ts
decisions:
  - "Use tsx (npx tsx) instead of node --experimental-strip-types for seed script runner — Prisma v7 generated client uses bare relative imports without extensions which ESM resolver cannot handle; tsx resolves TypeScript-aware"
  - "Use PrismaPg({ connectionString }) object API (not new pg.Pool()) to match existing db.ts pattern in project"
  - "CatalogEntry.category field is not stored in DB — UI-only grouping for catalog browser modal"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_modified: 4
---

# Phase 3 Plan 01: Plant Care Catalog Data and Schema Update Summary

**One-liner:** 40-entry plant care catalog seeded into CareProfile table with upsert idempotency; Plant.room FK updated to onDelete: SetNull for graceful room deletion.

## What Was Built

Created the foundational catalog data that powers the catalog-first add-plant flow. Users will browse these 40 common houseplants (grouped into 5 categories) when adding a plant to their collection. The seed is idempotent and can be re-run safely.

Also updated the Plant.room schema relation to use `onDelete: SetNull` so deleting a Room gracefully unassigns its plants rather than throwing a FK constraint error.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create catalog data file and seed script | 4fcd617 | prisma/data/catalog.ts, prisma/seed.ts, prisma.config.ts |
| 2 | Update schema onDelete, push database, run seed | 28505c3 | prisma/schema.prisma, prisma/seed.ts, prisma.config.ts |

## Catalog Data Summary

40 houseplants across 5 categories:

| Category | Count | Examples |
|----------|-------|---------|
| Succulents & Cacti | 8 | Aloe Vera, Snake Plant, Jade Plant, Echeveria |
| Tropical | 10 | Pothos, Monstera, Fiddle Leaf Fig, Philodendron |
| Low Light | 8 | ZZ Plant, Peace Lily, Cast Iron Plant, Parlor Palm |
| Herbs & Edibles | 7 | Basil, Mint, Rosemary, Cilantro |
| Flowering | 7 | Orchid, African Violet, Anthurium, Begonia |

Watering intervals range from 3 days (Basil, Mint, Cilantro) to 21 days (Aloe Vera, ZZ Plant).

## Decisions Made

1. **tsx runner for seed script**: The plan specified `node --experimental-strip-types` but Prisma v7 generates TypeScript files with bare relative imports (no `.ts` extensions). ESM module resolution in Node 24 cannot resolve these bare imports. Used `npx tsx` instead, which handles TypeScript-aware module resolution. This is Rule 1 (bug fix) — the original approach would not work at all.

2. **PrismaPg API alignment**: Updated seed to use `new PrismaPg({ connectionString })` (object form) matching the existing `src/lib/db.ts` pattern rather than `new pg.Pool(...)`. Removed the direct `pg` import since it's not needed with the newer adapter API.

3. **category field not in DB**: The `CatalogEntry.category` field is intentionally excluded from the CareProfile model. It exists only for UI grouping in the catalog browser modal (D-12).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed seed script runner incompatibility with Prisma v7 generated client**
- **Found during:** Task 2 (npx prisma db seed)
- **Issue:** `node --experimental-strip-types` runs the seed as ESM, but Prisma v7 generates TypeScript files with bare relative imports (e.g., `import * as $Enums from './enums'` without `.ts` extension). ESM resolver throws `ERR_MODULE_NOT_FOUND` for these bare imports.
- **Fix:** Changed `prisma.config.ts` seed command from `node --experimental-strip-types prisma/seed.ts` to `npx tsx prisma/seed.ts`. Updated seed import from `pg.Pool` pattern to `PrismaPg({ connectionString })` to match project's existing db.ts pattern.
- **Files modified:** prisma/seed.ts, prisma.config.ts
- **Commit:** 28505c3

## Verification Results

- `prisma/data/catalog.ts` exports `catalogData` (40 entries), `CatalogEntry` type, `CATALOG_CATEGORIES` array
- `prisma/seed.ts` uses `db.careProfile.upsert` and imports `catalogData` from `./data/catalog`
- `prisma.config.ts` contains `seed: "npx tsx prisma/seed.ts"`
- `prisma/schema.prisma` Plant.room relation has `onDelete: SetNull`
- `npx prisma validate` passes
- `npx prisma db push` completed (database in sync with schema)
- `npx prisma db seed` output: "Seeded 40 catalog entries."

## Known Stubs

None — catalog data is fully wired to the database.

## Threat Flags

No new security-relevant surface introduced. Seed script is CLI-only, reads DATABASE_URL from env, and never logs connection strings (threat T-03-01-02 mitigated as designed).

## Self-Check: PASSED
