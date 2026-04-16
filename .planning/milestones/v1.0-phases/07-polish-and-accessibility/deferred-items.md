# Deferred Items - Phase 07

## Pre-existing Test Failures

- **tests/plants-search.test.ts:202** — Test expects `orderBy: { nextWateringAt: "asc" }` but implementation uses `orderBy: { nickname: "asc" }`. This is a pre-existing mismatch between the test expectation and the actual query behavior. Not caused by Phase 07 changes.
