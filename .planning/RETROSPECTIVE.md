# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-16
**Phases:** 7 | **Plans:** 31 | **Commits:** 276

### What Was Built
- Complete plant care web app with urgency-first dashboard and one-tap watering
- 40-plant seeded catalog, room organization, timestamped notes, search/filter/sort
- In-app reminder notifications with snooze, per-plant preferences
- Demo mode for unauthenticated visitors with read-only sample data
- Mobile bottom-nav, responsive dialog-to-drawer sheets, WCAG AA accessibility
- Full auth flow with JWT sessions and onboarding

### What Worked
- 7-phase structure derived from requirement dependency graph produced clean dependency ordering — no phase needed to retrofit earlier work
- Server-side urgency classification avoided hydration mismatches and kept date arithmetic fast
- ResponsiveDialog pattern (Dialog on desktop, Drawer on mobile) was reused across all forms, paid for itself quickly
- Unified timeline (notes + watering history) was a better design than separate cards — discovered during Phase 5
- Milestone audit before completion caught 5 tech debt items that would have been invisible otherwise
- shadcn/ui copy-paste model gave full control for responsive adaptations without fighting a component library

### What Was Inefficient
- REQUIREMENTS.md traceability table was never updated during execution (all 42 non-UIAX rows stayed "Pending") — the audit had to cross-reference SUMMARY.md and VERIFICATION.md instead
- Phase 7 required 8 plans (most of any phase) because gap closure happened iteratively through UAT cycles — better upfront accessibility planning could reduce this
- Some phase SUMMARYs had inconsistent frontmatter (missing one_liner field) which made automated extraction unreliable

### Patterns Established
- Split auth config pattern: `auth.config.ts` (edge-safe) + `auth.ts` (full Prisma)
- `proxy.ts` for route protection (Next.js 16 replacement for middleware.ts)
- Server Actions with Zod validation for all mutations
- `cn()` utility with clsx + tailwind-merge for conditional classes
- Feature-based directory structure: `src/features/{domain}/` with actions, queries, schemas, components
- EmptyState component with icon + title + description + optional CTA

### Key Lessons
1. Run the milestone audit early — it found dead code (RoomFilter) and a potential crash (non-null assertion in logWatering) that accumulated across phases
2. Server-side date computation with timezone as a query parameter is the right pattern for Next.js App Router — avoids hydration mismatches entirely
3. Optimistic UI needs careful deduplication — the flicker fix in Phase 7 (checking alreadyInRecent before prepending) is a pattern to apply everywhere
4. Phase 7 "polish" phases balloon when accessibility isn't baked in from Phase 1 — next milestone should include a11y requirements in every phase's success criteria

### Cost Observations
- Model mix: balanced profile (mix of opus and sonnet for subagents)
- Timeline: 4 days from project init to shipped MVP
- Notable: 31 plans across 7 phases with 276 commits — high throughput enabled by yolo mode and parallel subagent execution

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 276 | 7 | Initial project — established all patterns |

### Cumulative Quality

| Milestone | LOC | Tech Debt Items | Requirements Satisfied |
|-----------|-----|-----------------|----------------------|
| v1.0 | 24,533 | 5 | 46/46 |

### Top Lessons (Verified Across Milestones)

1. Run milestone audit before completion — catches accumulated cross-phase debt
2. Server-side date computation with client timezone param avoids hydration mismatches
