This is a strong feature idea. It adds real differentiation and introduces collaboration without going full “multi-tenant complexity.”

Below is a **complete, structured feature spec** you can plug into your project. It covers:

* household model
* rotation / cycle system
* availability / skipping
* responsibilities
* email + notification behavior (detailed)
* edge cases
* data model
* UX flows

---

# Household and shared plant care feature

## Overview

The app should support multiple people collaborating on the same set of plants without sharing a single account.

Instead of introducing full multi-household complexity, the system should support:

* one user belongs to one household (v1 constraint)
* multiple users can belong to the same household
* all household members share the same plant collection
* responsibility for plant care rotates between members using a **cycle system**

The goal is to make shared plant care:

* clear (who is responsible right now)
* flexible (people can skip or pause)
* predictable (rotation logic is simple)
* low friction (no manual reassignment every day)

---

# Core concepts

## Household

A household is a shared space where:

* members collaborate on the same plants
* plant data is shared
* notifications are coordinated
* responsibility is assigned via cycles

### Constraints for v1

* one user can belong to only one household
* one household contains multiple users
* all plants belong to a household (not individual users)

---

## Member

A member is a user inside a household.

Each member has:

* identity (user account)
* role (optional in v1)
* availability status
* notification preferences
* participation in rotation

---

## Cycle

A cycle represents a **period of responsibility**.

During a cycle:

* one member is responsible for plant care
* they receive reminders and notifications
* others receive minimal or no reminders

At the end of the cycle:

* responsibility moves to the next member

---

## Rotation

Rotation defines:

* the order of members
* how cycles move from one member to another

Example:
Member A → Member B → Member C → Member A → ...

---

# Household feature scope

## 1. Household creation

### Flow

* user creates a household during onboarding or later
* user becomes the first member
* user becomes “owner” (optional role)

### Fields

* household name (optional)
* timezone (default from creator)
* default cycle duration
* rotation strategy

---

## 2. Inviting members

### Flow

* user invites another person via email
* invited user receives invitation email
* invited user accepts and joins household

### States

* pending invitation
* accepted
* expired
* revoked

### Requirements

* invitation links are secure and time-limited
* resend invitation possible
* user cannot join multiple households (v1)

---

## 3. Shared plant ownership

All plants belong to the household.

### Behavior

* all members can view all plants
* all members can log watering
* history shows which member performed actions

### Audit field

* `lastActionByUserId`
* `createdByUserId`

---

# Cycle and rotation system

## 4. Cycle configuration

### Household-level settings

#### Cycle duration

Defines how long one member is responsible.

Examples:

* 1 day
* 3 days
* 7 days (recommended default)

#### Rotation mode

* sequential (default)
* optional future: manual assignment

#### Start date

Defines when the first cycle begins.

---

## 5. Rotation order

Members are ordered in a list.

Example:

1. Alice
2. Bob
3. Charlie

Rotation cycles:

* Cycle 1 → Alice
* Cycle 2 → Bob
* Cycle 3 → Charlie
* Cycle 4 → Alice

### Requirements

* reorder members
* add/remove members safely
* handle member removal (recalculate rotation)

---

## 6. Active cycle

At any given time:

* exactly one member is responsible
* this is the “active assignee”

### Responsibilities of active member

* receives all plant reminders
* is expected to check due plants
* gets overdue alerts
* appears as “responsible” in UI

---

## 7. Cycle transition

At the end of a cycle:

* next member becomes active
* previous member is no longer responsible

### Transition triggers

* automatic (based on time)
* manual override (optional)

---

# Availability and skipping

## 8. Manual cycle skip

A member can skip their turn.

### Flow

* member clicks “skip my cycle”
* system assigns cycle to next available member
* skipped member moves to end of rotation (or stays depending on design choice)

### Notification behavior

* next member gets notified immediately
* previous assignee stops receiving reminders

---

## 9. Availability scheduling

Members can declare unavailability.

### Feature

Users can define:

* start date
* end date

Example:
“I am away from June 10 to June 17”

### Behavior

* system skips that member during those dates
* cycle is reassigned automatically
* member re-enters rotation after availability period

---

## 10. Smart availability handling

If a member becomes unavailable during their cycle:

* cycle should immediately reassign to next available member

If all members are unavailable:

* fallback to last known available member
* or pause notifications (configurable)

---

# Notification system for households

This is where the feature becomes powerful.

---

# 11. Responsibility-based notifications

## Key principle

Only the **current assignee** should receive full reminder emails.

Other members should:

* receive minimal notifications
* or only important alerts

---

# 12. Email types (household-aware)

## A. Cycle assignment email

### Trigger

When a new cycle starts and a member becomes responsible.

### Content

* “You are responsible for plant care this week”
* cycle duration
* number of plants
* link to dashboard

### Optional additions

* current due plants
* upcoming plants

---

## B. Daily due reminder (assignee only)

Same as existing feature, but scoped to:

* only the current assignee

---

## C. Overdue reminder (assignee only)

Same logic as before, but:

* only current assignee receives it

---

## D. Reassignment notification

### Trigger

When responsibility changes unexpectedly:

* skip
* availability conflict

### Sent to:

* new assignee

### Content

* “You are now responsible for plant care”
* reason (optional)
* current due plants

---

## E. Skip confirmation email

### Sent to:

* user who skipped

### Content

* confirmation
* who is now responsible

---

## F. Availability-based reassignment email

### Trigger

When system auto-skips due to unavailability

### Sent to:

* new assignee
* optionally skipped user

---

## G. Optional household summary email

Sent to all members:

* weekly summary
* who handled last cycle
* upcoming rotation

---

# 13. Notification rules

## Assignee receives:

* daily due emails
* overdue emails
* cycle start email
* reassignment emails

## Non-assignees receive:

* minimal or no daily reminders
* optional:

  * cycle changes
  * summary emails

---

# 14. Notification preferences (household-aware)

Each user should be able to configure:

### Participation level

* full participant
* silent participant (no reminders, still visible)
* observer (future idea)

### Email preferences

* receive emails when I am assigned
* receive notifications when assignment changes
* receive summary emails
* receive alerts even when not assigned (optional)

---

# 15. In-app notification behavior

## Assignee sees:

* “You are responsible this cycle”
* due today
* overdue
* quick actions

## Others see:

* “Alice is responsible this week”
* upcoming rotation

---

# 16. UI considerations

## Household dashboard additions

* current assignee banner
* cycle countdown
* next assignee preview

## Plant list

* optional: show who last watered

## Settings

* household tab
* rotation config
* member list
* availability calendar

---

# 17. Data model additions

## Household

* id
* name
* timezone
* cycleDurationDays
* rotationStrategy
* createdAt

## HouseholdMember

* id
* householdId
* userId
* role
* rotationOrder
* participationStatus
* createdAt

## Cycle

* id
* householdId
* assignedUserId
* startDate
* endDate
* status active/completed/skipped
* createdAt

## Availability

* id
* userId
* startDate
* endDate
* reason optional

## Invitation

* id
* householdId
* email
* token
* expiresAt
* acceptedAt nullable

---

# 18. Edge cases

## Rotation

* member removed mid-cycle
* member added mid-cycle
* only one member in household

## Availability

* overlapping unavailable periods
* all members unavailable
* user becomes unavailable during active cycle

## Notifications

* reassignment happens close to reminder time
* duplicate emails avoided
* correct assignee receives notifications after change

## Data consistency

* multiple users logging watering at same time
* audit trail accuracy

---

# 19. Functional requirements

## Household

* create household
* invite members
* accept invitation
* leave household (optional v1)
* list members

## Rotation

* define cycle duration
* define rotation order
* auto-assign cycles
* skip cycle manually
* auto-skip based on availability

## Availability

* set unavailable period
* edit/remove availability

## Notifications

* assign notifications to current assignee
* send reassignment notifications
* send cycle start notifications
* prevent duplicate notifications

---

# 20. Suggested v1 scope for this feature

## Must-have

* single household per user
* invite members
* shared plants
* cycle rotation
* cycle assignment
* skip cycle
* availability periods
* assignee-based email reminders
* reassignment emails

## Nice-to-have

* reorder rotation
* weekly summary email
* UI for next cycle preview
* per-user notification preferences

## Later

* multiple households per user
* per-room assignment
* per-plant assignment
* advanced scheduling rules
* fairness balancing
* mobile push notifications
