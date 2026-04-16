# Plant Minder

## What This Is

A responsive web app that helps indoor plant owners track their houseplants, know exactly when to water them, and build healthy care routines. Users manage a personal plant collection with a 40-plant catalog, log watering events in one tap from an urgency-first dashboard, organize by room, annotate plants with notes, search and filter their collection, get in-app reminder notifications, and explore via demo mode — all from a calm, visual interface that works on mobile and desktop.

## Core Value

Users can see at a glance which plants need watering today and log it in one action — eliminating guesswork and overwatering.

## Requirements

### Validated

- ✓ User can create an account with email and password — v1.0 (AUTH-01)
- ✓ User can log in and stay logged in across browser refresh (JWT session) — v1.0 (AUTH-02)
- ✓ User can log out from any page — v1.0 (AUTH-03)
- ✓ User goes through minimal onboarding after first login (plant count) — v1.0 (AUTH-04)
- ✓ Authenticated routes are protected — unauthenticated users redirected to login — v1.0 (AUTH-05)
- ✓ User can add a plant from catalog or custom entry with nickname, species, room, and interval — v1.0 (PLNT-01..08)
- ✓ User can edit, archive, and permanently delete plants — v1.0 (PLNT-02..04)
- ✓ User can view plant detail page with care info, status, history, and notes — v1.0 (PLNT-05)
- ✓ User can browse a seeded catalog of 40 common houseplants with care profiles — v1.0 (PLNT-06..07)
- ✓ User can create rooms (custom names + presets), assign plants, filter by room, view room pages — v1.0 (ROOM-01..05)
- ✓ Dashboard shows urgency-first sections: Overdue, Due Today, Upcoming, Recently Watered — v1.0 (DASH-01..05)
- ✓ User can mark a plant as watered in one tap with optimistic UI — v1.0 (DASH-02, UIAX-05)
- ✓ Next watering date recalculates automatically (last watered + interval) — v1.0 (WATR-01..02)
- ✓ User can log retroactive watering, view history, edit/delete logs, duplicates prevented — v1.0 (WATR-03..07)
- ✓ User can add timestamped notes visible in unified timeline alongside watering events — v1.0 (NOTE-01..03)
- ✓ User can search by nickname/species, filter by room/status/archived, sort collection — v1.0 (SRCH-01..03)
- ✓ In-app notification center with badge count, per-plant preferences, snooze — v1.0 (RMDR-01..05)
- ✓ Demo mode with pre-loaded sample plants, read-only mutations — v1.0 (DEMO-01..02)
- ✓ Onboarding starter plant seeding option — v1.0 (DEMO-03)
- ✓ App is responsive and touch-friendly on mobile and desktop — v1.0 (UIAX-01)
- ✓ WCAG AA contrast, keyboard navigation, screen reader friendly — v1.0 (UIAX-02..03)
- ✓ Empty states provide helpful guidance — v1.0 (UIAX-04)

### Active

(No active requirements — next milestone not yet planned)

### Out of Scope

- Social/community features — not core to the care routine problem
- Marketplace — different product entirely
- AI chatbot — adds complexity without clear v1 value
- Disease diagnosis from photos — requires ML infrastructure
- Smart sensor integrations — hardware dependency
- Native mobile app — web-first, PWA possible later
- Plant photo uploads — placeholder icons for v1, avoids file storage infra
- Email/push notifications — in-app only for v1, avoids external service dependency
- Confidence-based watering — interval countdown is simpler and sufficient for v1
- Weather-aware scheduling — complex infra not justified for v1

## Context

**Current state:** v1.0 MVP shipped 2026-04-16. 24,533 LOC TypeScript across 7 phases and 31 plans.

**Tech stack:**
- Next.js 16.2.2 (App Router) + React 19.2 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix-based components)
- PostgreSQL 17 + Prisma ORM 7.7.0
- NextAuth.js v5 (beta) for authentication (JWT sessions)
- Zod v4 for validation, react-hook-form for forms
- date-fns v4 for date arithmetic
- Vitest 4.x + Playwright for testing

**Target users:** Beginner and casual plant owners (1-30 plants) who forget watering schedules. Scales to enthusiasts with larger collections via pagination.

**UX direction:** Calm, friendly, nature-inspired without being childish. Dashboard-first layout. Soft neutrals with plant-inspired accents. Low cognitive load. Mobile bottom-nav with responsive dialog-to-drawer sheets.

**Data model entities:** User, Plant, Room, WateringLog, Note, CareProfile, Reminder

**Known tech debt (from v1.0 audit):**
- RoomFilter component is dead code (superseded by FilterChips)
- completeOnboarding missing revalidatePath('/plants')
- NotificationBell hidden on mobile; BottomTabBar Alerts links to /dashboard
- Non-null assertion in logWatering (CR-01)
- dueToday boundary uses < instead of <= for todayEnd (WR-03)

## Constraints

- **Tech stack**: Next.js + TypeScript + Prisma + PostgreSQL — decided, not negotiable
- **Auth**: NextAuth.js with email/password credentials — no OAuth for v1
- **Photos**: Placeholder icons only — no file upload infrastructure in v1
- **Reminders**: In-app notification center only — no email or push for v1
- **Scope**: Indoor plants only for v1
- **Watering model**: Firm interval-based countdown — not confidence-based
- **Platform**: Responsive web app — no native mobile

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NextAuth.js over Clerk/Supabase Auth | Self-hosted, free, full control, flexible for future OAuth | ✓ Good — works well with JWT sessions and App Router |
| In-app reminders only | Avoids transactional email/push infra complexity for v1 | ✓ Good — notification bell + snooze covers v1 needs |
| Seeded plant catalog (~40) | Good first-run UX without external API dependency | ✓ Good — 40-entry catalog with care profiles |
| Demo mode with seed data | Lets visitors explore before committing to sign up | ✓ Good — one-click demo with read-only guards |
| Placeholder icons, no photo upload | Avoids file storage infra; keeps v1 focused on core loop | ✓ Good — Lucide icons sufficient for v1 |
| Interval-based watering (firm countdown) | Simpler than confidence-based; clear overdue alerts | ✓ Good — users understand the model immediately |
| Urgency-first dashboard | Answers "what needs care now?" immediately | ✓ Good — validated as core product value |
| shadcn/ui + Tailwind v4 | Copy-paste components, full control, great DX | ✓ Good — responsive dialog/drawer pattern works well |
| Minimal onboarding (plant count only) | Low friction — plant count then first plant | ✓ Good — reminder preference deferred per D-08 |
| Custom rooms + presets | Flexibility with common defaults | ✓ Good — 6 presets + custom names |
| Prisma output in src/generated/ | Avoids shadowing src/app/ with root app/ dir | ✓ Good — clean separation |
| Split auth config (auth.config.ts + auth.ts) | Edge-safe proxy.ts needs import-free config | ✓ Good — proxy.ts works at edge |
| Server-side urgency classification | Date arithmetic in Prisma is faster than client-side, avoids hydration mismatches | ✓ Good — timezone passed as query param |
| Unified timeline (notes + watering) | Single chronological view per plant | ✓ Good — replaced separate history/notes cards |
| ResponsiveDialog pattern | Dialog on desktop, Drawer sheet on mobile | ✓ Good — reused across all forms |
| Server-side pagination | Scales to 100+ plant collections | ✓ Good — cursor-based with EmptyState fallback |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after v1.0 milestone completion*
