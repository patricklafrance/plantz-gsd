# Milestones

## v1.0 MVP (Shipped: 2026-04-16)

**Phases completed:** 7 phases, 31 plans
**Commits:** 276 | **Lines of code:** 24,533 TypeScript
**Timeline:** 4 days (2026-04-13 to 2026-04-16)
**Git range:** `ce47695` to `2e415d4`

**Delivered:** A complete plant care web app where users can manage a collection, see which plants need watering at a glance, and log care in one tap.

**Key accomplishments:**

1. Next.js 16 + Prisma 7 + Tailwind v4 + shadcn/ui project with Vitest/Playwright test harness
2. User registration, login, logout, and onboarding flow with JWT sessions
3. Plant collection with 40-entry catalog, room organization, and detail pages
4. Urgency-first dashboard with one-tap watering, optimistic UI, and full watering history
5. Timestamped plant notes and collection search/filter/sort
6. In-app reminder notifications with snooze, preferences, and one-click demo mode
7. Mobile bottom-nav, responsive dialogs, WCAG AA accessibility, and edge-case hardening

**Tech debt carried forward:**
- RoomFilter component is dead code (superseded by FilterChips in Phase 5)
- completeOnboarding missing revalidatePath('/plants')
- NotificationBell hidden on mobile; BottomTabBar Alerts links to /dashboard
- Non-null assertion in logWatering (CR-01)
- dueToday boundary uses < instead of <= for todayEnd (WR-03)

**Archives:**
- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---
