# Plant Minder

## What This Is

A responsive web app that helps indoor plant owners track their houseplants, know exactly when to water them, and build healthy care routines. Users manage a personal plant collection, log watering events quickly, see which plants need attention today, and get gentle in-app reminders — all from a calm, visual dashboard that works on mobile and desktop.

## Core Value

Users can see at a glance which plants need watering today and log it in one action — eliminating guesswork and overwatering.

## Requirements

### Validated

- [x] Users can create an account and log in securely (NextAuth.js, email/password) — Validated in Phase 2: Authentication and Onboarding
- [x] Users can go through minimal onboarding (plant count) — Validated in Phase 2: Authentication and Onboarding (reminder preference deferred per D-08)
- [x] Users can add, edit, archive, and delete plants with confirmation — Validated in Phase 3: Plant Collection and Rooms
- [x] Users can organize plants by room (custom names + common presets) — Validated in Phase 3: Plant Collection and Rooms
- [x] Users can log watering in one quick action from the dashboard — Validated in Phase 4: Dashboard and Watering Core Loop
- [x] Users can see due today, overdue, upcoming, and recently watered plants (urgency-first dashboard) — Validated in Phase 4: Dashboard and Watering Core Loop
- [x] Users can view watering history for each plant — Validated in Phase 4: Dashboard and Watering Core Loop
- [x] Watering logic uses firm interval countdown with overdue alerts — Validated in Phase 4: Dashboard and Watering Core Loop
- [x] Next watering date recalculates automatically after logging — Validated in Phase 4: Dashboard and Watering Core Loop

### Active
- [ ] Users can view plant detail pages with care info, status, and history
- [ ] Users can add timestamped notes and basic health observations
- [ ] Users can configure in-app reminder preferences
- [ ] Users can browse a seeded plant care catalog (~30-50 common houseplants)
- [ ] Guest/demo mode lets visitors explore with pre-loaded sample plants
- [ ] App is responsive and polished on mobile and desktop
- [ ] App is accessible (keyboard nav, contrast, screen reader friendly)

### Out of Scope

- Social/community features — not core to the care routine problem
- Marketplace — different product entirely
- AI chatbot — adds complexity without clear v1 value
- Disease diagnosis from photos — requires ML infrastructure
- Smart sensor integrations — hardware dependency
- Native mobile app — web-first, PWA possible later
- Advanced external integrations — keep v1 self-contained
- Plant photo uploads — placeholder icons for v1, avoids file storage infra
- Email/push notifications — in-app only for v1, avoids external service dependency
- Confidence-based watering — interval countdown is simpler and sufficient for v1

## Context

**Target users:** Beginner and casual plant owners (1-30 plants) who forget watering schedules and follow vague advice. Should scale to enthusiasts with larger collections.

**Core problem:** People forget when they last watered, follow generic online advice, and overwater because they lack a reliable history or simple system. The app creates a structured care system centered around each plant as an individual with its own history and conditions.

**Technical environment:**
- Next.js (App Router) + TypeScript + React
- Tailwind CSS + shadcn/ui (Radix-based components)
- PostgreSQL + Prisma ORM
- NextAuth.js for authentication
- Zod for validation
- Vitest + Playwright for testing

**UX direction:** Calm, friendly, nature-inspired without being childish. Dashboard-first layout. Soft neutrals with plant-inspired accents. Low cognitive load. Logging watering should take 1-2 taps. Avoid guilt-heavy language.

**Data model entities:** User, Plant, Room, WateringLog, HealthLog, CareProfile, Reminder

**Seed data:** Ship with ~30-50 curated common houseplants (Monstera, Snake plant, Pothos, ZZ plant, Peace lily, Fiddle leaf fig, Spider plant, Philodendron, etc.) with care profiles. Demo mode uses these plus sample watering history.

**Edge cases identified:**
- Retroactive watering logs
- Multiple logs on same day
- Changing watering interval after history exists
- Users who don't know exact plant species (catalog search + "Unknown" option)
- Users with 100+ plants (pagination/virtualization)
- Archived plants removed from active reminders and dashboard
- Seasonal pause/snooze support
- Accidental duplicate watering logs (debounce/undo)
- Timezone-safe date handling

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
| NextAuth.js over Clerk/Supabase Auth | Self-hosted, free, full control, flexible for future OAuth | — Pending |
| In-app reminders only | Avoids transactional email/push infra complexity for v1 | — Pending |
| Seeded plant catalog (~30-50) | Good first-run UX without external API dependency | — Pending |
| Demo mode with seed data | Lets visitors explore before committing to sign up | — Pending |
| Placeholder icons, no photo upload | Avoids file storage infra; keeps v1 focused on core loop | — Pending |
| Interval-based watering (firm countdown) | Simpler than confidence-based; clear overdue alerts | — Pending |
| Urgency-first dashboard | Answers "what needs care now?" immediately | — Pending |
| shadcn/ui + Tailwind | Copy-paste components, full control, great DX with Tailwind | — Pending |
| Minimal onboarding | Low friction — plant count + reminder pref, then first plant | — Pending |
| Custom rooms + presets | Flexibility with common defaults (Living room, Kitchen, etc.) | — Pending |
| Prisma output in src/generated/ | Avoids shadowing src/app/ with root app/ dir | Validated in Phase 1 |
| Split auth config (auth.config.ts + auth.ts) | Edge-safe proxy.ts needs import-free config | Validated in Phase 1 |

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
*Last updated: 2026-04-14 after Phase 1 completion — scaffold and foundations built, auth configured, test harness operational*
