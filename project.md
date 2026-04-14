Below is a project brief you can give to GSD to start the project with `/gsd-new-project`.

This fits the way GSD initializes a new project: it asks questions to understand the idea, constraints, tech choices, and edge cases, then it turns that into requirements and a roadmap. ([GitHub][1])

You can paste the **“Paste this into GSD”** section directly, then use the rest as supporting detail when it asks follow-up questions.

---

# App idea: smart plant watering companion

## Product vision

Build a consumer-friendly web app that helps people keep their houseplants alive by giving them a simple, personalized watering routine instead of vague reminders.

The app should feel calm, visual, and practical. It should help users answer questions like:

* Which plants do I own?
* When should I water each one?
* Which ones are overdue today?
* Which ones are at risk because I watered too early or too late?
* How is each plant doing over time?
* What care instructions matter for this specific plant?

The app should not be just a generic reminder list. It should behave like a lightweight plant care assistant that combines:

* plant profiles,
* watering history,
* personalized schedules,
* seasonal adjustments,
* care notes,
* health tracking,
* and friendly guidance.

The main outcome is that users stop guessing and start following a clear care routine.

---

# Product positioning

## Working title ideas

* Plant Minder
* WaterWise
* LeafLog
* Thirsty Plants
* Pot Buddy
* Bloomkeeper
* Root Reminder
* Plant Pulse

## Elevator pitch

A plant watering app that helps people track their indoor plants, know exactly when to water them, and build healthy plant care habits with simple reminders, history, and personalized recommendations.

---

# Target users

## Primary users

### 1. Beginner plant owners

People who own 1 to 10 houseplants and often forget:

* what plant they have,
* how often to water it,
* when they last watered it.

Needs:

* simplicity,
* low setup friction,
* clear reminders,
* care confidence.

### 2. Casual hobbyists

People with 10 to 30 plants who want:

* organization,
* filtering by room or plant type,
* care history,
* seasonal routines.

Needs:

* fast logging,
* dashboard views,
* flexible scheduling,
* health tracking.

### 3. Enthusiasts

People with large collections who want:

* groups,
* advanced plant metadata,
* notes,
* photos,
* recurring care tasks.

Needs:

* scale,
* better organization,
* advanced filtering,
* export/import,
* future automation potential.

---

# Core problem

Plant owners often fail because:

* they do not know the exact plant species,
* watering advice online is too generic,
* care depends on season, light, pot size, and humidity,
* they forget when they last watered,
* they overwater more often than they underwater,
* they cannot see patterns over time.

The app solves this by creating a structured care system centered around each plant as an individual object with its own care history and conditions.

---

# Goals

## Main goals for v1

* Let users create and manage a personal plant collection.
* Let users log watering events quickly.
* Show what needs attention today.
* Give suggested watering cadence per plant.
* Track watering history clearly.
* Offer basic plant care details and notes.
* Make the app delightful and easy to use on mobile and desktop.

## Secondary goals

* Help users learn better care habits.
* Reduce overwatering.
* Encourage daily or weekly check-ins.
* Build a flexible foundation for future care tasks like fertilizing, misting, pruning, and repotting.

---

# Non-goals for v1

Do not try to build a full social network or marketplace in the first version.

Keep out of v1:

* community feed,
* plant trading,
* in-app chat,
* image-based disease diagnosis,
* AI chatbot,
* advanced sensor integrations,
* full offline-first sync,
* marketplace for plants or supplies.

These can be future ideas.

---

# Platform and product scope

## Initial scope

Build a responsive web application first.

Reason:

* easiest to test the harness,
* quick to build,
* accessible on desktop and mobile,
* avoids app store friction,
* still supports notification and PWA options later.

## Future scope

Possible future expansion:

* mobile app,
* PWA install support,
* push notifications,
* smart sensor integration,
* camera/photo diagnosis,
* smart recommendations based on environment.

---

# UX direction

## Design principles

* calm and friendly
* clean and modern
* easy to scan
* low cognitive load
* nature-inspired without feeling childish
* excellent empty states
* very fast for common actions

## Visual style ideas

* soft neutrals with plant-inspired accent colors
* rounded cards
* plant thumbnails or icons
* room-based grouping
* subtle health status colors
* strong typography hierarchy
* dashboard-first layout

## Important UX values

* logging watering should take 1 to 2 taps
* dashboard should immediately answer “what needs care today?”
* app should avoid guilt-heavy language
* app should help users understand uncertainty, not fake precision

---

# Main feature set

## 1. User accounts and onboarding

### Features

* sign up
* log in
* log out
* password reset
* guest/demo mode optional
* onboarding questionnaire

### Onboarding questions

* How many plants do you have?
* Are you a beginner, intermediate, or enthusiast?
* Do you want reminders?
* Do you know your plant names already?
* Do you want to organize by room?
* What is your climate/region?
* Optional: home conditions like light and humidity

### Purpose

Use onboarding to personalize defaults and reduce setup friction.

---

## 2. Plant collection management

### Add a plant

Users can add a plant with:

* nickname, for example “Big Monstera”
* species/common name, for example “Monstera deliciosa”
* room/location, for example “Living room”
* acquisition date
* pot size
* light condition
* pet safety note
* optional photo
* optional notes
* optional ideal watering interval suggestion

### Edit a plant

Users can update all plant details later.

### Archive or delete a plant

* archive when plant is given away, dead, or no longer active
* delete only with confirmation

### Plant profile page

Each plant gets a detailed page with:

* plant image
* display name
* species
* current status
* next suggested watering date
* last watered date
* care overview
* notes
* history timeline
* health logs
* room assignment

---

## 3. Dashboard and today view

This is the heart of the product.

### Dashboard sections

* plants needing watering today
* overdue plants
* recently watered plants
* upcoming in next 3 to 7 days
* quick stats
* care streaks or consistency insights
* room summary

### Today view should answer

* What should I water today?
* What is overdue?
* What should I check but maybe not water yet?
* Which plants were watered recently and should be left alone?

### Suggested statuses

* needs watering
* check soil first
* recently watered
* overdue
* snoozed
* dormant/seasonal pause

---

## 4. Watering schedule and reminders

### Scheduling logic

Each plant should have:

* recommended interval in days
* last watered date
* next suggested watering date
* optional seasonal adjustment
* optional confidence level

### Important product behavior

The app should not pretend that every plant must be watered exactly every X days.
It should support “recommended cadence” plus “check before watering.”

### Reminder options

* daily summary reminder
* morning reminder
* evening reminder
* reminder only for overdue plants
* per-plant reminders
* digest format

### Reminder states

* upcoming
* due today
* overdue
* snoozed by 1 day / 2 days / custom

---

## 5. Watering history and logging

### Quick log action

User can mark a plant as watered from:

* dashboard
* plant card
* plant details page
* overdue list

### Fields when logging watering

* date and time
* amount of water optional
* method optional, top watering / bottom watering
* notes optional
* soil dryness optional
* confidence optional

### History timeline

For each plant, show:

* watering events
* health notes
* care notes
* repot events later
* fertilizing events later

### Useful derived insights

* average interval between watering
* frequently late or early watering
* longest dry period
* consistency trend

---

## 6. Plant care reference

Each plant should have a simple care profile.

### Care information fields

* common name
* scientific name
* description
* light needs
* watering guidance
* humidity preference
* toxicity to pets
* ideal temperature
* difficulty level
* common problems
* care tips

### Important constraint

For v1, this can be:

* seeded internal dataset,
* or manually entered by user,
* or a small curated plant catalog.

Do not depend on a huge external plant API for the first version unless it is easy and reliable.

---

## 7. Rooms, spaces, and grouping

Users should be able to organize plants by:

* room
* light condition
* watering frequency
* plant type
* status

### Example rooms

* living room
* bedroom
* kitchen
* bathroom
* office
* balcony

### Room pages

Show:

* all plants in the room
* room-level overdue count
* room humidity/light notes
* easy bulk review

---

## 8. Health tracking and notes

The app should support light health journaling.

### Health log examples

* leaf yellowing
* drooping
* new growth
* pests suspected
* leaf loss
* repotted
* fertilized
* pruned

### Journal entries

User can add a dated note with:

* text
* status tag
* optional image
* optional severity

### Why this matters

Watering is rarely isolated. A plant may look unhealthy for reasons unrelated to watering, so the app should let users record observations.

---

## 9. Search, filters, and sorting

### Search

Search plants by:

* nickname
* species
* room
* tag

### Filters

* needs watering today
* overdue
* room
* light condition
* pet-safe only
* recently watered
* archived

### Sorts

* next watering date
* name
* recently added
* room
* overdue most first

---

## 10. Notifications and habit support

### Reminder modes

* gentle summary
* action-oriented list
* per-plant reminders
* silent mode with in-app notification center

### Habit ideas

* weekly care summary
* “you cared for 6 plants this week”
* “3 plants may need attention tomorrow”
* “you tend to overwater this plant”

Keep this light and useful, not gamified to the point of annoyance.

---

## 11. Optional analytics and insights

These can be in v1.1 or hidden behind a simple section in v1.

### Insight ideas

* number of active plants
* percentage watered on time
* most frequently overdue plants
* plants with longest stable care routine
* room requiring most care
* average days between watering by plant

### Smart insight examples

* “This plant is usually watered every 12 days, but the recommended interval is 18 days.”
* “You watered this plant 3 times earlier than usual this month.”
* “Your bathroom plants need care less often than your living room plants.”

---

# Detailed user flows

## Flow 1: first-time user

1. User signs up.
2. User goes through onboarding.
3. User adds first plant.
4. App suggests watering interval and care info.
5. Dashboard shows today’s state.
6. User receives reminder later.

## Flow 2: quick daily check

1. User opens app.
2. Sees “2 plants need attention today.”
3. Opens today view.
4. Marks one as watered.
5. Snoozes another for tomorrow.
6. Dashboard updates instantly.

## Flow 3: plant detail review

1. User opens a plant profile.
2. Reviews last watering date and notes.
3. Adds health observation.
4. Updates room and light condition.
5. Reviews timeline.

## Flow 4: overdue recovery

1. User sees several overdue plants.
2. App helps prioritize them.
3. User logs which plants were actually watered.
4. App recalculates future dates.
5. User adds notes for stressed plants.

---

# Data model ideas

## User

* id
* name
* email
* timezone
* reminder preferences
* onboarding answers
* createdAt
* updatedAt

## Plant

* id
* userId
* nickname
* speciesName
* commonName
* roomId nullable
* photoUrl nullable
* acquisitionDate nullable
* lightCondition nullable
* potSize nullable
* wateringIntervalDays nullable
* seasonalAdjustmentEnabled boolean
* petSafety nullable
* notes nullable
* status active/archived
* createdAt
* updatedAt

## Room

* id
* userId
* name
* notes nullable
* lightProfile nullable
* humidityProfile nullable

## WateringLog

* id
* plantId
* wateredAt
* amountMl nullable
* method nullable
* soilDryness nullable
* notes nullable
* createdAt

## HealthLog

* id
* plantId
* observedAt
* type
* severity nullable
* notes
* photoUrl nullable

## CareProfile

* id
* speciesName
* commonName
* lightNeeds
* wateringGuidance
* humidityNeeds
* petSafety
* difficulty
* temperatureRange
* notes

## Reminder

* id
* userId
* plantId nullable
* type
* enabled
* schedule
* lastSentAt nullable

---

# Functional requirements

## Authentication

* users can create account
* users can log in securely
* users can reset password
* protected routes for authenticated content

## Plant CRUD

* create plant
* update plant
* archive plant
* delete plant with confirmation
* upload/change plant photo

## Care scheduling

* calculate next watering date based on last watering plus interval
* support manual override
* support snooze
* support dormant mode or paused reminders

## Water logging

* quick log watering
* edit mistaken log entries
* display chronological history

## Dashboard

* show due today
* show overdue
* show upcoming
* show recently watered
* surface quick actions

## Search/filter

* full collection filtering
* fast response time
* persistent filter state optional

## Notes and health

* add time-stamped notes
* categorize health events
* show timeline

## Notifications

* allow enable/disable reminders
* allow reminder time settings
* optional email reminders in later version
* in-app notifications at minimum

---

# Non-functional requirements

## Performance

* dashboard should load fast
* common interactions should feel instant
* quick log action should update UI optimistically

## Accessibility

* keyboard accessible
* good color contrast
* form labels
* screen reader friendly structure
* status colors should not be the only signal

## Responsiveness

* mobile-first behavior
* desktop dashboard optimization
* touch-friendly buttons

## Reliability

* no duplicate logs from double click
* protect against invalid dates
* correct timezone handling

## Maintainability

* modular architecture
* typed API contracts
* reusable UI components
* clean state management

## Security

* authenticated user data isolation
* secure file upload if images are supported
* form validation client and server side

---

# Edge cases and tricky scenarios

These are important because GSD asks about edge cases during initialization. ([GitHub][1])

## Data and schedule edge cases

* user forgets to log watering for several days
* user logs watering retroactively
* user logs multiple watering events on same day
* user changes watering interval after history already exists
* plant is seasonal and needs less water in winter
* user travels and wants pause mode
* timezone changes due to travel
* same species but different care because of room/light
* plant is archived and should disappear from active reminders
* user deletes a plant with history

## UX edge cases

* user does not know exact species
* user has no plant photos
* user has only one plant
* user has 100+ plants
* user ignores reminders for weeks
* user wants to bulk update room names
* user makes accidental watering logs

## Reminder edge cases

* reminder sent but user already watered offline
* overdue count becomes noisy if schedules are too rigid
* duplicate reminders
* notifications disabled by browser/device

---

# Suggested v1 scope

To keep this realistic and good for testing the harness, v1 should focus on the core loop:

## v1 must-have

* auth
* onboarding
* add/edit/archive plants
* plant list and plant detail page
* dashboard with due today / overdue / upcoming
* watering log history
* reminder preferences
* rooms/grouping
* simple care reference
* notes and basic health logs
* responsive UI

## v1 nice-to-have

* plant photos
* simple analytics
* snooze reminders
* seasonal adjustment toggle
* demo data

## v1 out of scope

* AI diagnosis
* external sensor integrations
* social features
* marketplace
* advanced botanical recommendation engine

---

# Suggested v2 ideas

These are good for roadmap expansion after the initial milestone.

## v2 feature ideas

* fertilizing schedule
* pruning reminders
* repotting reminders
* plant wish list
* multi-user household access
* PWA install support
* push notifications
* recurring seasonal adjustments
* bulk actions
* export/import CSV or JSON
* richer analytics
* disease/pest identification from photos
* camera scan to identify plant
* calendar view
* drag-and-drop room layout
* smart watering suggestions based on weather or season
* integration with Apple/Google calendar
* care streaks and habit nudges
* barcode/QR labels for physical plant pots

---

# Stretch ideas

If you want the concept to feel more original, here are stronger differentiators:

## 1. Confidence-based watering guidance

Instead of saying “water every 7 days,” the app says:

* likely ready
* check soil
* probably too early
* overdue

That is more realistic and less harmful.

## 2. Environmental context

Let users record:

* room brightness,
* humidity,
* near heater/window,
* drafty location.

Then care guidance becomes more personalized.

## 3. Plant personality cards

Each plant page feels alive with:

* nickname,
* growth milestones,
* timeline photos,
* health pattern notes.

## 4. Recovery mode

Special workflow for struggling plants:

* increased check frequency,
* health note prompts,
* temporary watchlist.

## 5. Collection health overview

A visual matrix:

* thriving,
* stable,
* watch closely,
* overdue,
* recently stressed.

---

# Suggested technical preferences

Since you are testing a harness and likely want a modern frontend-heavy stack, this is a good spec direction:

## Recommended stack

* Next.js
* TypeScript
* React
* Tailwind CSS
* shadcn/ui or a similar headless component library
* Prisma ORM
* PostgreSQL
* NextAuth or Clerk or Supabase Auth
* Zod for validation
* React Query or server actions depending on architecture choice
* Vitest and Playwright
* Vercel-friendly deployment

## Why this stack

* excellent for frontend-heavy product work
* fast iteration
* typed end to end
* good developer experience
* easy to create polished responsive UI
* easy to test

## Alternative simpler option

* Supabase for auth, database, storage
* Next.js frontend
* Prisma optional depending on chosen backend approach

That may be better for speed.

---

# Suggested architecture preferences

* app router
* server/client boundary kept clean
* feature-based folders
* reusable domain models
* typed API layer
* optimistic UI for watering logs
* image upload abstraction for future portability
* seed data for a starter plant catalog

---

# Testing expectations

## Unit tests

* date calculation logic
* reminder state logic
* form validation
* filter/sort utilities

## Integration tests

* add plant flow
* edit plant flow
* log watering flow
* archive plant flow
* authentication-protected pages

## End-to-end tests

* sign up and onboarding
* create first plant
* dashboard shows due plant
* mark plant as watered
* next watering date updates
* room filtering works

---

# Example acceptance criteria

## Add plant

* user can create a plant with minimum required fields
* created plant appears on dashboard and collection page
* plant detail page shows care information and empty history state

## Log watering

* user can mark a plant as watered in one quick action
* last watered date updates immediately
* next suggested watering date recalculates
* history timeline records the event

## Dashboard

* user can see due today, overdue, and upcoming plants
* counts are accurate
* plants are sorted by urgency by default

## Rooms

* user can assign plants to rooms
* room filter updates collection correctly
* room summary displays counts

---

# Seed data idea

To make first-run experience good, include demo plants:

* Monstera deliciosa
* Snake plant
* Pothos
* ZZ plant
* Peace lily
* Fiddle leaf fig
* Spider plant
* Philodendron

This helps showcase UI and scheduling without requiring full manual setup.

---

# Risks and product decisions to make early

## Important product choices

* Are reminders in-app only for v1, or email too?
* Will plant care reference be curated manually or sourced externally?
* How opinionated should watering recommendations be?
* Will the app support only indoor plants in v1?
* Should users be able to create fully custom care schedules?
* Should guest/demo mode be included?

## Recommended answers

* in-app reminders first
* curated care reference first
* indoor plants only for v1
* custom schedules allowed
* guest/demo mode optional but useful

---

# Suggested roadmap phases

## Phase 1

Foundation

* project setup
* auth
* database schema
* app shell
* basic UI system

## Phase 2

Plant collection

* create/edit/archive plants
* list and detail pages
* rooms
* plant images optional

## Phase 3

Dashboard and watering logic

* due today
* overdue
* upcoming
* next watering calculations
* quick log watering

## Phase 4

History and notes

* watering timeline
* health logs
* plant notes
* edit/delete logs

## Phase 5

Reminders and polish

* reminder preferences
* in-app notification center
* onboarding
* demo data
* empty states
* responsive polish
* test coverage

## Phase 6

Insights and v1 completion

* basic analytics
* dashboard insights
* bug fixes
* accessibility pass
* final QA

---

# Paste this into GSD

I want to build a responsive web app called “Plant Minder” for indoor plant owners. The app helps users keep their houseplants healthy by tracking each plant individually, showing which plants need attention today, and making watering routines easy to manage.

The app should not be a generic reminder app. It should feel like a lightweight plant care assistant. Users should be able to add plants, organize them by room, log watering events quickly, view watering history, read basic care guidance, and get personalized reminders and suggestions.

Target users are beginner and casual plant owners, but the app should scale to enthusiasts with larger collections. The main problem is that people forget when they last watered a plant, follow vague advice, and often overwater because they do not have a reliable history or a simple system.

Primary goals:

* users can create an account and manage a personal plant collection
* users can add, edit, archive, and view plants
* users can organize plants by room
* users can log watering quickly
* users can see due today, overdue, recently watered, and upcoming plants
* users can view watering history for each plant
* users can add notes and simple health observations
* users can configure reminders
* the app should work well on mobile and desktop

Suggested entities:

* User
* Plant
* Room
* WateringLog
* HealthLog
* CareProfile
* Reminder

Plant fields may include:

* nickname
* species/common name
* room
* photo
* light condition
* pot size
* acquisition date
* watering interval days
* pet safety
* notes
* status active/archived

Important product behaviors:

* watering guidance should be recommendation-based, not rigid
* the app should support statuses like needs watering, check soil first, recently watered, overdue, snoozed
* users should be able to log watering from the dashboard in one quick action
* next watering date should update automatically after a log is created
* reminders should be gentle and configurable
* v1 should focus on indoor plants only

Core v1 features:

* authentication
* onboarding
* plant CRUD
* dashboard with due today / overdue / upcoming
* plant detail page
* watering history
* notes and basic health logs
* room grouping
* reminder preferences
* responsive polished UI

Nice-to-have v1 features:

* plant photos
* simple analytics and insights
* snooze reminders
* demo/seed data

Out of scope for v1:

* social/community features
* marketplace
* AI chatbot
* disease diagnosis from photos
* smart sensors
* native mobile app
* advanced external integrations

Technical preferences:

* Next.js
* TypeScript
* React
* Tailwind CSS
* PostgreSQL
* Prisma
* Zod
* modern component library
* strong type safety
* clean modular architecture
* good test coverage with unit, integration, and end-to-end tests

Non-functional requirements:

* mobile-friendly and responsive
* accessible
* fast dashboard load
* optimistic UI for quick logging
* secure auth
* timezone-safe date handling
* maintainable architecture

Important edge cases:

* retroactive watering logs
* multiple logs on same day
* changing watering interval after history exists
* users who do not know exact plant species
* users with many plants
* archived plants removed from reminders
* seasonal behavior and pause/snooze support
* accidental duplicate watering logs

I want the project to be broken into clear phases, likely:

1. foundation and auth
2. plant collection management
3. dashboard and watering logic
4. history, notes, and health tracking
5. reminders and polish
6. insights and final QA

Please ask me detailed questions about:

* exact auth solution
* reminder delivery method
* whether plant care data is seeded or externally sourced
* whether guest/demo mode should exist
* whether plant photos are part of v1
* exact watering logic and how opinionated it should be
* how rooms, filters, and dashboard prioritization should work
