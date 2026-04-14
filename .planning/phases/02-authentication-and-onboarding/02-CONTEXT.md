# Phase 2: Authentication and Onboarding - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create accounts with email and password, log in securely with persistent JWT sessions, log out from any page, and complete minimal onboarding via a dismissible dashboard banner. Unauthenticated users are redirected to the login page. This phase delivers the auth UI and onboarding flow on top of the NextAuth infrastructure already configured in Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Registration Form
- **D-01:** Registration collects email, password, and confirm password (3 fields). No name field — name can be added later in settings or profile.
- **D-02:** Client-side validation errors display inline under each field (red text below the specific field). Server errors (email already taken, network failure) display as toast notifications.
- **D-03:** After successful registration, user is auto-logged in and redirected straight to the dashboard — no separate login step, no onboarding gate.

### Login Form
- **D-04:** Login and register pages cross-link to each other: "Don't have an account? Sign up" on login, "Already have an account? Log in" on register.
- **D-05:** App root (`/`) redirects to `/dashboard` if logged in, `/login` if not. No public landing page for v1.

### Onboarding Flow
- **D-06:** Onboarding appears as a dismissible banner/card at the top of the dashboard on first visit — not a modal, not a separate page. Dashboard content is visible below it.
- **D-07:** Onboarding collects plant count only via quick-range buttons: "1-5 plants", "6-15 plants", "16-30 plants", "30+ plants". Used to tailor first-run tips, not to create plants.
- **D-08:** No reminder preference in onboarding. Reminders default to on; users configure in settings later (Phase 6).
- **D-09:** User can dismiss the onboarding banner at any time without completing it. A subtle "Complete setup" link in nav or settings lets them return to it later. No guilt, no blocking.
- **D-10:** After completing onboarding, the banner collapses (subtle animation). The empty dashboard with an "Add your first plant" prompt is already visible beneath.
- **D-11:** Onboarding banner uses a nature-themed accent style — soft green gradient or plant-inspired illustration, warm and welcoming, matching the calm UX direction. Built on the existing shadcn Card component with custom styling.

### Claude's Discretion
- Auth error handling details — generic vs specific messages for failed login, rate limiting approach
- Password requirements beyond the existing Zod min(6) validation
- Loading states and transitions during auth flows
- Logout button placement (nav dropdown, header, etc.)
- Session expiry behavior and re-authentication UX
- Exact onboarding banner animation and dismiss behavior
- Where the "Complete setup" return link lives (nav vs settings)
- Schema migration approach for adding onboarding fields to User model (e.g., `onboardingCompleted`, `plantCountRange`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Vision, constraints, UX direction ("calm, friendly, nature-inspired"), data model entities
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01 through AUTH-05 define the acceptance criteria for this phase
- `.planning/ROADMAP.md` §Phase 2 — Success criteria (5 items: register, session persistence, logout, onboarding, route protection)

### Tech stack (from CLAUDE.md)
- `CLAUDE.md` §Technology Stack — Pinned versions: NextAuth v5 beta, Zod v4, react-hook-form 7.72.x, @hookform/resolvers ^3.x
- `CLAUDE.md` §What NOT to Use — No NextAuth v4, no middleware.ts (use proxy.ts), no Zod v3

### Existing auth infrastructure (Phase 1)
- `auth.config.ts` — JWT strategy, signIn page → /login, authorized callback protecting /dashboard, /plants, /rooms
- `auth.ts` — Credentials provider with bcryptjs, Zod validation, db.user.findUnique
- `proxy.ts` — Route matcher excluding api, _next/static, login, register
- `src/app/api/auth/[...nextauth]/route.ts` — GET/POST handler
- `src/app/(auth)/layout.tsx` — Centered flex layout for auth pages
- `prisma/schema.prisma` — User model (id, email, passwordHash, name, createdAt, updatedAt)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn Button for form submit and actions
- `src/components/ui/card.tsx` — shadcn Card for onboarding banner and auth form containers
- `src/components/ui/input.tsx` — shadcn Input for email/password fields
- `src/components/ui/label.tsx` — shadcn Label for form field labels
- `src/components/ui/skeleton.tsx` — shadcn Skeleton for loading states
- `src/lib/db.ts` — Prisma singleton, used in auth.ts for user lookup
- `src/lib/utils.ts` — cn() utility for Tailwind class merging

### Established Patterns
- Split auth config: `auth.config.ts` (edge-safe, no db imports) + `auth.ts` (full config with Credentials provider and Prisma) — Phase 1 decision, must be maintained
- Route groups: `(auth)/` for public auth pages, `(main)/` for protected pages — each with its own layout
- Feature-based server code: `src/features/{domain}/actions.ts`, `queries.ts`, `schema.ts` — new auth actions/schemas should follow this pattern (e.g., `src/features/auth/actions.ts`)
- Zod v4 import path: `import { z } from "zod/v4"` — already used in auth.ts

### Integration Points
- User model needs new fields for onboarding state (e.g., `onboardingCompleted Boolean`, `plantCountRange String?`)
- Prisma schema migration required — `npx prisma migrate dev`
- `auth.ts` authorize function already handles login; registration needs a new Server Action to create users
- `auth.config.ts` authorized callback may need updates if onboarding route is added
- `proxy.ts` matcher may need adjustment depending on route structure

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-authentication-and-onboarding*
*Context gathered: 2026-04-14*
