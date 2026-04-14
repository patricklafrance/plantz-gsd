# Requirements: Plant Minder

**Defined:** 2026-04-13
**Core Value:** Users can see at a glance which plants need watering today and log it in one action

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can create an account with email and password
- [ ] **AUTH-02**: User can log in and stay logged in across browser refresh (JWT session)
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User goes through minimal onboarding after first login (plant count, reminder preference)
- [ ] **AUTH-05**: Authenticated routes are protected — unauthenticated users redirected to login

### Plant Collection

- [ ] **PLNT-01**: User can add a plant with nickname, species (from catalog or custom), room, and watering interval
- [ ] **PLNT-02**: User can edit all plant details after creation
- [ ] **PLNT-03**: User can archive a plant (soft-delete, removed from dashboard and reminders)
- [ ] **PLNT-04**: User can permanently delete a plant with confirmation dialog
- [ ] **PLNT-05**: User can view a plant detail page showing care info, status, next watering, history, and notes
- [ ] **PLNT-06**: User can browse and select from a seeded catalog of ~30-50 common houseplants with care profiles
- [ ] **PLNT-07**: Selecting a catalog plant auto-fills species, care info, and suggested watering interval
- [ ] **PLNT-08**: User can add a plant not in the catalog by entering custom details

### Room Organization

- [ ] **ROOM-01**: User can create rooms with custom names
- [ ] **ROOM-02**: User sees common room presets (Living room, Bedroom, Kitchen, Bathroom, Office, Balcony)
- [ ] **ROOM-03**: User can assign a plant to a room during creation or editing
- [ ] **ROOM-04**: User can filter plant collection by room
- [ ] **ROOM-05**: User can view a room page showing all plants in that room with status summary

### Dashboard

- [ ] **DASH-01**: User sees urgency-first sections: Overdue, Due Today, Upcoming (next 7 days), Recently Watered
- [ ] **DASH-02**: User can mark a plant as watered in one tap from the dashboard
- [ ] **DASH-03**: After logging watering, next watering date recalculates automatically and UI updates immediately
- [ ] **DASH-04**: Dashboard loads fast with accurate counts sorted by urgency
- [ ] **DASH-05**: Dashboard works well on both mobile and desktop layouts

### Watering

- [ ] **WATR-01**: Each plant has a watering interval in days and a calculated next watering date
- [ ] **WATR-02**: Next watering date = last watered date + interval days
- [ ] **WATR-03**: User can log watering with optional date (supports retroactive logging)
- [ ] **WATR-04**: User can view chronological watering history for each plant
- [ ] **WATR-05**: User can edit or delete a mistaken watering log entry
- [ ] **WATR-06**: Duplicate watering logs within a short window are prevented (debounce)
- [ ] **WATR-07**: All dates stored as TIMESTAMPTZ; "due today" computed from user's local timezone

### Notes

- [ ] **NOTE-01**: User can add a timestamped text note to any plant
- [ ] **NOTE-02**: User can view notes in the plant detail history timeline alongside watering events
- [ ] **NOTE-03**: User can edit or delete their own notes

### Reminders

- [ ] **RMDR-01**: User sees an in-app notification center showing plants needing attention
- [ ] **RMDR-02**: Notification center displays a badge count on the nav
- [ ] **RMDR-03**: User can enable or disable reminders globally
- [ ] **RMDR-04**: User can configure reminder preferences (which plants, frequency)
- [ ] **RMDR-05**: User can snooze a reminder by 1 day, 2 days, or custom duration

### Demo Mode

- [ ] **DEMO-01**: Visitor can explore the app with pre-loaded sample plants without signing up
- [ ] **DEMO-02**: Demo mode is read-only — mutations are blocked for unauthenticated sessions
- [ ] **DEMO-03**: New users can optionally seed their collection with common starter plants during onboarding

### Search and Filters

- [ ] **SRCH-01**: User can search plants by nickname or species name
- [ ] **SRCH-02**: User can filter plants by room, watering status (overdue, due today, upcoming), and archived
- [ ] **SRCH-03**: User can sort plants by next watering date, name, or recently added

### UI and Accessibility

- [ ] **UIAX-01**: App is responsive and touch-friendly on mobile, optimized on desktop
- [ ] **UIAX-02**: App meets WCAG AA contrast and keyboard navigation requirements
- [ ] **UIAX-03**: Forms have proper labels; status uses more than just color
- [ ] **UIAX-04**: Empty states provide helpful guidance (no plants, no history, no rooms)
- [ ] **UIAX-05**: Watering log uses optimistic UI for instant feedback

## v2 Requirements

### Authentication Enhancements

- **AUTH-V2-01**: User can reset password via email link
- **AUTH-V2-02**: OAuth login (Google, GitHub)

### Health Tracking

- **HLTH-V2-01**: User can log categorized health observations (yellowing, drooping, new growth, pests)
- **HLTH-V2-02**: Health observations appear in the plant timeline with severity indicators
- **HLTH-V2-03**: Plant detail page shows health trend summary

### Advanced Features

- **ADVN-V2-01**: Sign up to save conversion prompt for demo users
- **ADVN-V2-02**: Plant photo upload and display
- **ADVN-V2-03**: Simple analytics (watering consistency, most overdue plants, room comparisons)
- **ADVN-V2-04**: Seasonal watering adjustment toggle
- **ADVN-V2-05**: Bulk actions (water multiple plants, move to room)
- **ADVN-V2-06**: Export/import plant collection (CSV or JSON)
- **ADVN-V2-07**: Push notifications via PWA service worker
- **ADVN-V2-08**: Email reminders via transactional email service

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI chatbot | Adds complexity without clear v1 value |
| Disease diagnosis from photos | Requires ML infrastructure |
| Smart sensor integrations | Hardware dependency |
| Native mobile app | Web-first; PWA possible in v2 |
| Social/community features | Competitor users explicitly complained about these |
| Marketplace | Different product entirely |
| Weather-aware scheduling | Complex infra not justified for v1 |
| Real-time chat | Not relevant to plant care routine |
| Advanced botanical recommendation engine | Firm interval model is sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| PLNT-01 | Phase 3 | Pending |
| PLNT-02 | Phase 3 | Pending |
| PLNT-03 | Phase 3 | Pending |
| PLNT-04 | Phase 3 | Pending |
| PLNT-05 | Phase 3 | Pending |
| PLNT-06 | Phase 3 | Pending |
| PLNT-07 | Phase 3 | Pending |
| PLNT-08 | Phase 3 | Pending |
| ROOM-01 | Phase 3 | Pending |
| ROOM-02 | Phase 3 | Pending |
| ROOM-03 | Phase 3 | Pending |
| ROOM-04 | Phase 3 | Pending |
| ROOM-05 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| DASH-05 | Phase 4 | Pending |
| WATR-01 | Phase 4 | Pending |
| WATR-02 | Phase 4 | Pending |
| WATR-03 | Phase 4 | Pending |
| WATR-04 | Phase 4 | Pending |
| WATR-05 | Phase 4 | Pending |
| WATR-06 | Phase 4 | Pending |
| WATR-07 | Phase 4 | Pending |
| UIAX-05 | Phase 4 | Pending |
| NOTE-01 | Phase 5 | Pending |
| NOTE-02 | Phase 5 | Pending |
| NOTE-03 | Phase 5 | Pending |
| SRCH-01 | Phase 5 | Pending |
| SRCH-02 | Phase 5 | Pending |
| SRCH-03 | Phase 5 | Pending |
| RMDR-01 | Phase 6 | Pending |
| RMDR-02 | Phase 6 | Pending |
| RMDR-03 | Phase 6 | Pending |
| RMDR-04 | Phase 6 | Pending |
| RMDR-05 | Phase 6 | Pending |
| DEMO-01 | Phase 6 | Pending |
| DEMO-02 | Phase 6 | Pending |
| DEMO-03 | Phase 6 | Pending |
| UIAX-01 | Phase 7 | Pending |
| UIAX-02 | Phase 7 | Pending |
| UIAX-03 | Phase 7 | Pending |
| UIAX-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46 (Phases 2-7; Phase 1 is infrastructure with no user-facing requirements)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after roadmap creation (phase numbers updated to 7-phase structure)*
