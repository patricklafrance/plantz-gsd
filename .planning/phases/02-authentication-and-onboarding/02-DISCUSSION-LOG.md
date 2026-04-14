# Phase 2: Authentication and Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 02-authentication-and-onboarding
**Areas discussed:** Registration flow, Onboarding experience

---

## Registration Flow

### Registration Form Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password only | Minimal friction. Name collected during onboarding or later. | |
| Email + password + name | Collects display name upfront. Dashboard can greet by name from day one. | |
| Email + password + confirm password | Adds password confirmation for safety. No name — collected later. | ✓ |

**User's choice:** Email + password + confirm password
**Notes:** None

### Post-Registration Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-login → onboarding | User registers and is immediately logged in and taken to onboarding. Zero friction. | |
| Auto-login → dashboard | Skip onboarding on first visit, show as dismissible prompt on dashboard instead. | ✓ |
| Redirect to login page | After registration, user must log in manually. More traditional but unnecessary step. | |

**User's choice:** Auto-login → dashboard
**Notes:** Onboarding will appear as a dashboard element rather than a separate gate.

### Form Validation Style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline under each field | Red text below the specific field. Immediate feedback. Standard react-hook-form + Zod pattern. | |
| Summary at top of form | All errors in a banner above form. Fields highlighted but no individual messages. | |
| Inline + toast for server errors | Inline for client validation. Toast for server errors (email taken, network failure). | ✓ |

**User's choice:** Inline + toast for server errors
**Notes:** None

### Auth Page Cross-Links

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, link between both | "Don't have an account? Sign up" on login. "Already have an account? Log in" on register. | ✓ |
| Yes, plus a shared landing page | Public landing page at / with Login and Sign Up buttons. Auth pages still link. | |
| Just the cross-links, no landing page | Same as option 1 — root redirects to login or dashboard based on session. | |

**User's choice:** Yes, link between both
**Notes:** None

---

## Onboarding Experience

### Onboarding Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Dismissible banner/card at top | Prominent card at top of dashboard. Can be dismissed or completed. Dashboard visible below. | ✓ |
| Modal overlay on first visit | Centered modal on first dashboard visit. Dashboard loads behind it. | |
| Full-page onboarding before dashboard | Dedicated /onboarding route blocking dashboard access. Traditional wizard. | |

**User's choice:** Dismissible banner/card at top
**Notes:** None

### Plant Count Question

| Option | Description | Selected |
|--------|-------------|----------|
| Quick range buttons | Preset: "1-5", "6-15", "16-30", "30+". One tap. Used to tailor tips, not create plants. | ✓ |
| Free number input | Simple number field. More precise but higher friction. | |
| Skip this question entirely | Don't ask — not essential for app function. | |

**User's choice:** Quick range buttons
**Notes:** None

### Reminder Preference

| Option | Description | Selected |
|--------|-------------|----------|
| Simple on/off toggle | "Enable watering reminders?" with toggle. Defaults to on. Detailed config in Phase 6. | |
| Frequency picker | "How often?" with Daily summary, Per-plant alerts, Off. More granular. | |
| Skip reminders in onboarding | Don't ask. Default to on. Configure in settings later. | ✓ |

**User's choice:** Skip reminders in onboarding
**Notes:** Reminder configuration deferred to Phase 6.

### Skip/Dismiss Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, dismiss anytime | Close banner. Subtle "Complete setup" link in nav/settings. No guilt, no blocking. | ✓ |
| Yes, but remind once more | Show again on next visit if dismissed. Gone after second dismiss. | |
| No, must complete or skip | Banner stays until completed or explicit "Skip setup" clicked. | |

**User's choice:** Yes, dismiss anytime
**Notes:** None

### Post-Completion Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Banner disappears, dashboard stays | Banner collapses with subtle animation. Empty dashboard visible with "Add your first plant" prompt. | ✓ |
| Banner disappears + success toast | Same collapse plus brief toast: "Setup complete!" | |
| Redirect to add plant | Navigate to add-plant page automatically. | |

**User's choice:** Banner disappears, dashboard stays
**Notes:** None

### Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Nature-themed accent card | Soft green gradient or plant illustration. Warm, welcoming, calm UX. Uses shadcn Card with custom styling. | ✓ |
| Standard info card | Clean shadcn Card with blue info icon. Neutral, professional. | |
| You decide | Let Claude pick during implementation. | |

**User's choice:** Nature-themed accent card
**Notes:** None

---

## Claude's Discretion

- Auth error handling details (generic vs specific messages, rate limiting)
- Password requirements beyond min 6
- Loading states during auth transitions
- Logout button placement
- Session expiry behavior
- Onboarding banner animation and dismiss behavior specifics
- Schema migration approach for onboarding fields

## Deferred Ideas

None — discussion stayed within phase scope
