# Deferred Items — Phase 03

Out-of-scope issues discovered during Phase 03 execution. Not caused by Phase 03 changes; flagged here for later remediation.

## Pre-existing TypeScript errors in Phase 02 test files

Discovered during: Phase 03-01 Task 1 type-check.

Files affected (all pre-existing, not modified by Phase 03):
- `tests/plants.test.ts`
- `tests/notes.test.ts`
- `tests/reminders.test.ts`
- `tests/rooms.test.ts`
- `tests/watering.test.ts`

Error pattern (TS2352): `Conversion of type '{ user: { id: string; isDemo: boolean; }; }' to type 'NextMiddleware' may be a mistake because neither type sufficiently overlaps with the other.`

Root cause: Phase 02 test suite cast session mocks to `NextMiddleware` incorrectly; these tests likely still pass at runtime because vitest mocks short-circuit the type. Needs a session-mock typing fix, probably in a Phase 2 follow-up plan.

Scope: not touched by Phase 03 Wave 0. Phase 03 `tests/phase-03/` stubs compile cleanly on their own.
