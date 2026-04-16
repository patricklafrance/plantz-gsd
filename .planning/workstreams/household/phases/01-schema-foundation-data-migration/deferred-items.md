# Deferred Items — Phase 01 (Schema Foundation + Data Migration)

## Discovered during Plan 01-03 execution

### Pre-existing TypeScript errors in consumer code (out-of-scope for Plan 01-03)

After Plan 02 reparented `Plant`/`Room` from `userId` to `householdId`, the following files still reference the old `userId` column and will not type-check until Plan 04 (or later plans) refactor the consumers to use `householdId` + the new guard pattern:

- `src/app/(main)/dashboard/page.tsx` — `PlantWhereInput { userId }`
- `src/app/(main)/plants/[id]/page.tsx` — PlantWithRelations missing `room`, `careProfile` (include-shape drift)
- `src/app/(main)/plants/page.tsx` — PlantWhereInput `userId`
- `src/app/(main)/rooms/[id]/page.tsx` — Room type missing `plants`, `userId` → `householdId`
- `src/app/(main)/rooms/page.tsx` — RoomWithPlantCount missing `_count`
- `src/features/demo/actions.ts` — Plant/Room `.create({ data: { userId }})` shape
- `src/features/notes/actions.ts` — PlantWhereInput `{ userId }`
- `src/features/notes/queries.ts` — PlantWhereInput `{ userId }`
- `src/features/plants/actions.ts` — Plant `.create({ data: { userId }})` + PlantWhereInput `userId`
- `src/features/watering/actions.ts` + `queries.ts` — similar userId/ownership references
- `prisma/seed.ts` — seed data Plant/Room shape
- `src/components/watering/*.tsx` — watering history include shape
- `src/features/plants/queries.ts` — include shape
- `tests/notes.test.ts` — NextMiddleware type mismatch (unrelated — pre-existing)

**Why deferred:** Plan 01-03 scope is auth/JWT/signup. These are pre-existing cascade effects of Plan 01-02's schema rewrite. Plan 01-04 introduces `requireHouseholdAccess` guard — subsequent milestone phases (2-7 per ROADMAP) will migrate each feature's actions/queries to the new ownership model.

**Status:** Not blocking Plan 01-03 verification (unit test suite uses mocked DB; no production runtime path touches these consumers during JWT/signup flow).
