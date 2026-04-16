# Architecture Research

**Domain:** Personal care-tracking web app (indoor plant care)
**Researched:** 2026-04-13
**Confidence:** HIGH — based on Next.js official docs (v16.2.3, April 2026), Prisma official docs, and verified community patterns

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Dashboard   │  │  Plant Detail│  │  Watering Log Form   │  │
│  │  (RSC shell) │  │  (RSC page)  │  │  ('use client' UI)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          │ hydrate only     │ hydrate only         │ event handlers
          │ interactive      │ interactive          │ Server Actions
          ▼ islands          ▼ islands              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js App Server                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    proxy.ts (middleware)                    │ │
│  │            Session check → redirect /login                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Route Groups                            │   │
│  │  app/(public)/     app/(auth)/     app/(app)/            │   │
│  │  landing, demo     login, register  dashboard, plants    │   │
│  └──────────────┬─────────────────────────────────────┬────┘   │
│                 │ React Server Components              │        │
│                 │ async data fetching                  │        │
│  ┌──────────────▼─────────────────────────────────────▼────┐   │
│  │              Server Actions  (mutations)                 │   │
│  │   logWatering()  addPlant()  updateReminder()  etc.      │   │
│  └──────────────────────────────────┬───────────────────────┘   │
│                                     │                           │
│  ┌──────────────────────────────────▼───────────────────────┐   │
│  │                  Data Access Layer                        │   │
│  │            lib/db.ts  (Prisma singleton)                  │   │
│  │            lib/queries/  (typed query fns)                │   │
│  └──────────────────────────────────┬───────────────────────┘   │
└─────────────────────────────────────┼───────────────────────────┘
                                      │ TCP / connection pool
┌─────────────────────────────────────▼───────────────────────────┐
│                       PostgreSQL                                │
│  users  plants  rooms  watering_logs  health_logs               │
│  care_profiles  reminders  (seed: plant_catalog)                │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `proxy.ts` (middleware) | Session gate — redirect unauthenticated users before render | NextAuth `auth()` helper, matcher on `(app)/*` routes |
| Route group `(public)` | Marketing/landing page and demo mode — no auth required | Static RSC pages with seed data read-only access |
| Route group `(auth)` | Login, register, onboarding flows | NextAuth credential forms, Zod-validated Server Actions |
| Route group `(app)` | Authenticated app shell — dashboard, plants, catalog | RSC layout with shared nav; inner pages fetch per-user data |
| React Server Components | Fetch data from DB and render HTML on the server | `async` page/layout components calling `lib/queries/` |
| Client Components | Interactive UI — quick-log button, modals, forms | `'use client'` components receiving server-fetched props |
| Server Actions | All data mutations — watering logs, plant CRUD, reminders | `'use server'` functions calling Prisma, then `revalidatePath()` |
| Data Access Layer | Typed, centralized DB calls — no raw Prisma in page files | `lib/queries/plants.ts`, `lib/queries/watering.ts`, etc. |
| PostgreSQL + Prisma | Persistent storage, relational integrity, type-safe queries | Prisma schema with relations; singleton client in `lib/db.ts` |

## Recommended Project Structure

```
src/
├── app/                         # Next.js App Router (routing only)
│   ├── (public)/                # Unauthenticated routes
│   │   ├── page.tsx             # Landing / marketing
│   │   └── demo/page.tsx        # Guest demo mode
│   ├── (auth)/                  # Auth flows
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (app)/                   # Authenticated app
│   │   ├── layout.tsx           # App shell — nav, sidebar
│   │   ├── dashboard/page.tsx   # Urgency-first plant overview
│   │   ├── plants/
│   │   │   ├── page.tsx         # Plant list / collection view
│   │   │   ├── new/page.tsx     # Add plant form
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Plant detail + history
│   │   │       └── edit/page.tsx
│   │   ├── rooms/page.tsx       # Room management
│   │   ├── catalog/
│   │   │   ├── page.tsx         # Browse care catalog
│   │   │   └── [slug]/page.tsx  # Catalog plant detail
│   │   ├── reminders/page.tsx   # In-app reminder center
│   │   └── settings/page.tsx
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts  # NextAuth handler
│   ├── layout.tsx               # Root layout (html, body, providers)
│   └── global-error.tsx
│
├── components/                  # Shared UI (no data fetching)
│   ├── ui/                      # shadcn/ui primitives (Button, Card, etc.)
│   ├── plants/                  # Plant-domain UI atoms
│   │   ├── PlantCard.tsx
│   │   ├── PlantIcon.tsx        # Placeholder icon system
│   │   └── UrgencyBadge.tsx
│   ├── dashboard/
│   │   ├── QuickLogButton.tsx   # 'use client' — one-tap watering log
│   │   └── DashboardFilters.tsx
│   └── layout/
│       ├── AppNav.tsx
│       └── MobileNav.tsx
│
├── features/                    # Feature-scoped logic + Server Actions
│   ├── auth/
│   │   └── actions.ts           # login, register, logout Server Actions
│   ├── plants/
│   │   └── actions.ts           # addPlant, editPlant, archivePlant, deletePlant
│   ├── watering/
│   │   ├── actions.ts           # logWatering, deleteLog, retroactiveLog
│   │   └── schedule.ts          # nextWateringDate(), isOverdue() pure fns
│   ├── rooms/
│   │   └── actions.ts
│   ├── reminders/
│   │   └── actions.ts
│   └── demo/
│       └── seed-session.ts      # Demo mode seed + ephemeral session
│
├── lib/
│   ├── db.ts                    # Prisma singleton (prevents hot-reload leak)
│   ├── auth.ts                  # NextAuth config export
│   ├── queries/                 # Typed read functions (used by RSC pages)
│   │   ├── plants.ts            # getPlantsByUser(), getPlantById()
│   │   ├── dashboard.ts         # getDashboardData() — due/overdue/upcoming
│   │   ├── watering.ts          # getWateringHistory()
│   │   └── catalog.ts           # getCatalogPlants(), getCatalogPlantBySlug()
│   └── validations/             # Zod schemas
│       ├── plant.schema.ts
│       └── watering.schema.ts
│
├── types/                       # Shared TypeScript types
│   └── index.ts
│
└── prisma/                      # (at project root, not in src)
    ├── schema.prisma
    └── seed.ts                  # 30-50 catalog plants + demo data
```

### Structure Rationale

- **`app/` (routing only):** Pages are thin shells — they import from `lib/queries/` and `components/`. No business logic lives in page files.
- **`(public)/(auth)/(app)` route groups:** Separate layout trees for unauthenticated, auth, and app experiences without polluting URLs.
- **`features/`:** Server Actions live next to the domain they mutate. `plants/actions.ts` and `watering/actions.ts` are imported directly into Client Components and page forms.
- **`lib/queries/`:** All database reads centralized here — RSC pages call these functions. Makes testing and caching easy.
- **`components/`:** Pure UI — no data fetching. Receives data as props from RSC parents.
- **`lib/db.ts` singleton:** Prevents Prisma connection pool exhaustion during hot-reload (critical for Next.js dev mode).

## Architectural Patterns

### Pattern 1: Server-First with Client Islands

**What:** Default to React Server Components (RSC). Only add `'use client'` when state, event handlers, or browser APIs are needed. Server components fetch data; client components handle interaction.

**When to use:** Always — this is the baseline for the entire app. The dashboard page is an RSC that fetches due/overdue/upcoming data server-side and passes it to a `QuickLogButton` client component for one-tap logging.

**Trade-offs:** RSC cannot use hooks or event handlers. Client components cannot directly access the database. The composition rule — server components can import client components but not vice versa — must be internalized early.

**Example:**
```typescript
// app/(app)/dashboard/page.tsx — Server Component
import { getDashboardData } from '@/lib/queries/dashboard'
import { QuickLogButton } from '@/components/dashboard/QuickLogButton'

export default async function DashboardPage() {
  const { duePlants, overduePlants } = await getDashboardData()
  return (
    <main>
      {overduePlants.map(plant => (
        <QuickLogButton key={plant.id} plantId={plant.id} plantName={plant.name} />
      ))}
    </main>
  )
}
```

### Pattern 2: Server Actions for Mutations

**What:** Data mutations (log watering, add plant, update reminder) are Server Actions — `'use server'` functions called directly from Client Components. No separate API routes needed for user-facing CRUD.

**When to use:** All form submissions and button actions that write to the database. Server Actions validate with Zod, call Prisma, then call `revalidatePath()` to invalidate the RSC cache.

**Trade-offs:** No explicit API contract — harder to test in isolation than REST endpoints. But for a single-app frontend (no mobile API consumers), this is simpler and type-safe end-to-end.

**Example:**
```typescript
// features/watering/actions.ts
'use server'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'

export async function logWatering(plantId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  await prisma.wateringLog.create({
    data: { plantId, userId: session.user.id, loggedAt: new Date() }
  })
  // Recalculate next watering date
  await recalculateNextWatering(plantId)
  revalidatePath('/dashboard')
  revalidatePath(`/plants/${plantId}`)
}
```

### Pattern 3: Watering Schedule as Pure Domain Logic

**What:** The interval countdown logic (`nextWateringDate`, `isOverdue`, `daysUntilDue`) lives in `features/watering/schedule.ts` as pure functions with no DB or framework dependencies.

**When to use:** Any place that needs to compute urgency — dashboard query, plant detail page, reminder check. Pure functions are trivially testable with Vitest.

**Trade-offs:** Adds a thin domain layer. Worth it because this logic is the core value proposition of the app and must be consistently correct across contexts.

```typescript
// features/watering/schedule.ts
export function nextWateringDate(lastWateredAt: Date, intervalDays: number): Date { ... }
export function isOverdue(nextDate: Date): boolean { ... }
export function urgencyCategory(nextDate: Date): 'overdue' | 'due-today' | 'upcoming' | 'ok' { ... }
```

### Pattern 4: Middleware Auth Gate

**What:** `proxy.ts` (Next.js 16+ name for `middleware.ts`) intercepts all requests to `(app)/*` routes and redirects unauthenticated users to `/login` before any React renders.

**When to use:** Single middleware file at project root. Matcher targets only authenticated app routes.

**Trade-offs:** Middleware runs on the edge (lightweight). Server components should still verify session for defense-in-depth — middleware is the first line, not the only line.

## Data Flow

### Request Flow — Dashboard Load

```
User visits /dashboard
    ↓
proxy.ts → check session → authenticated? continue : redirect /login
    ↓
app/(app)/dashboard/page.tsx (RSC, async)
    ↓
lib/queries/dashboard.ts → getDashboardData(userId)
    ↓
Prisma findMany → PostgreSQL → watering_logs + plants JOIN
    ↓
schedule.ts → urgencyCategory() applied to each plant
    ↓
RSC renders HTML with urgency groups → streamed to client
    ↓
Client hydrates only QuickLogButton (interactive island)
```

### Mutation Flow — Log Watering

```
User taps QuickLogButton (client component)
    ↓
calls logWatering(plantId) — Server Action
    ↓
Server: auth() → verify session
    ↓
Zod validate plantId
    ↓
prisma.wateringLog.create() → PostgreSQL INSERT
    ↓
recalculateNextWatering() → prisma.plant.update()
    ↓
revalidatePath('/dashboard') → RSC cache busted
    ↓
Next.js re-renders dashboard → client sees updated state
```

### Key Data Flows

1. **Demo mode:** Seed data read from catalog + synthetic watering history. No user session required. Demo plants are scoped to an ephemeral session (cookie), never written to user tables.
2. **Reminder check:** In-app notification center reads plants where `nextWateringDate <= now` for the current user. Runs as RSC query — no polling, refreshes on page visit or after log action.
3. **Catalog → plant copy:** When a user adds a plant from catalog, the `CareProfile` defaults are copied to the new `Plant` record. Users can then override interval independently.
4. **Retroactive log:** If a user logs with a past date, `loggedAt` is set explicitly. `nextWateringDate` recalculates from the most recent log, not from today.
5. **Archive flow:** Archived plants: excluded from dashboard queries via `WHERE archived = false`, excluded from reminder queries, accessible via a separate "Archived" view.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Monolith is correct. Single Postgres instance. No caching layer needed. Prisma connection pool default settings. |
| 1k-10k users | Add connection pooling (PgBouncer or Prisma Accelerate). Enable ISR on catalog pages (rarely changes). Add DB indexes on `userId`, `nextWateringDate`, `archived`. |
| 10k-100k users | Consider read replica for dashboard queries. Move reminder computation to a background job (cron). Cache catalog with Redis or Next.js `revalidate`. |
| 100k+ users | Evaluate splitting catalog service. Notification queue for reminders. This is unlikely for v1 scope. |

### Scaling Priorities

1. **First bottleneck:** Database connections — serverless functions open a new connection per invocation. Fix with PgBouncer or Prisma Accelerate before anything else.
2. **Second bottleneck:** Dashboard query performance — `getDashboardData` JOINs plants + watering_logs + care_profiles. Add composite index on `(userId, archived, nextWateringDate)` once data grows.

## Anti-Patterns

### Anti-Pattern 1: Prisma in Client Components

**What people do:** Import Prisma and call `prisma.plant.findMany()` inside a Client Component or a custom hook.

**Why it's wrong:** Client Components run in the browser. Prisma is a Node.js-only library. The database credentials would be exposed to the client bundle. Next.js will error on build or silently fail.

**Do this instead:** Always call Prisma inside Server Components, Server Actions, or Route Handlers. Pass data down as props.

### Anti-Pattern 2: Multiple Prisma Client Instances

**What people do:** Call `new PrismaClient()` at the top of each file that needs DB access.

**Why it's wrong:** In Next.js dev mode with hot reload, each file re-evaluation creates a new pool of DB connections. The pool exhausts quickly and queries start failing.

**Do this instead:** Export a single instance from `lib/db.ts` using the global singleton pattern (`global.__prisma = global.__prisma || new PrismaClient()`).

### Anti-Pattern 3: Collocating Watering Logic in DB Queries

**What people do:** Compute `nextWateringDate` and urgency inside the Prisma query using raw SQL or computed fields mixed with fetch logic.

**Why it's wrong:** The watering schedule algorithm is the core business rule of the app. Buried in a query, it can't be unit tested, re-used on the client for optimistic updates, or audited easily.

**Do this instead:** Keep `features/watering/schedule.ts` as pure TypeScript. Queries fetch raw data; the calling code applies schedule functions.

### Anti-Pattern 4: API Routes for Internal CRUD

**What people do:** Create `/api/plants`, `/api/watering-logs` route handlers and `fetch()` them from client components.

**Why it's wrong:** For a single Next.js app with no external consumers, API routes add a network hop, remove type safety, and duplicate validation. Server Actions give equivalent functionality with better DX.

**Do this instead:** Use Server Actions for all mutations from the authenticated app. Reserve Route Handlers for the NextAuth callback and any future webhook endpoints.

### Anti-Pattern 5: Urgency Logic in the View Layer

**What people do:** Compute "overdue" status in JSX using inline date arithmetic.

**Why it's wrong:** The same logic is needed in multiple places — dashboard, plant detail, reminder badge, catalog preview. Divergence causes bugs.

**Do this instead:** All urgency categorization goes through `features/watering/schedule.ts` functions. Views receive pre-computed `urgencyCategory` values.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL | Prisma ORM via TCP connection pool | Singleton client in `lib/db.ts`. Use `DATABASE_URL` env var. |
| NextAuth.js | `app/api/auth/[...nextauth]/route.ts` + `proxy.ts` session check | JWT strategy for v1. Credentials provider only. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| RSC pages ↔ Data Access Layer | Direct function call (same process) | `lib/queries/` functions are typed, no HTTP |
| Client Components ↔ Server Actions | Next.js Server Action RPC (over HTTP internally) | Type-safe — same TypeScript types cross the boundary |
| Server Actions ↔ Data Access Layer | Direct function call | Actions call queries and mutations |
| Watering schedule ↔ everything | Pure function imports | No coupling — can be tested standalone |
| Demo mode ↔ Auth layer | Separate session cookie; reads only from seed data | Demo session never touches user tables |

## Build Order Implications

The dependency graph points to this construction order:

1. **Database schema + Prisma setup** — everything else depends on types generated from the schema. Build schema first, run `prisma generate`, get the TypeScript types.
2. **`lib/db.ts` singleton + `lib/auth.ts`** — foundational infrastructure. Auth and data access need these before any page works.
3. **`proxy.ts` middleware + auth routes** — before building authenticated pages, the gate must work.
4. **`lib/queries/` read layer + `features/watering/schedule.ts`** — core domain logic. Build and unit-test independently.
5. **Dashboard RSC + QuickLogButton** — first authenticated surface. Validates the full RSC → Server Action → DB → revalidate loop.
6. **Plant CRUD** — add/edit/archive/delete plants. Depends on rooms existing first (plant belongs to room).
7. **Watering history + health logs** — requires plants to exist.
8. **Catalog** — static read-only, can be built in parallel with any of the above once the DB has seed data.
9. **Demo mode** — requires catalog seed data and a working dashboard to clone.
10. **Reminders center** — depends on watering schedule logic and notification reads.

## Sources

- Next.js official project structure docs (v16.2.3, April 2026): https://nextjs.org/docs/app/getting-started/project-structure
- Prisma with Next.js App Router guide: https://www.prisma.io/docs/guides/frameworks/nextjs
- Next.js App Router patterns 2026: https://dev.to/teguh_coding/nextjs-app-router-the-patterns-that-actually-matter-in-2026-146
- Next.js server and client components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- NextAuth middleware / protecting routes: https://authjs.dev/getting-started/session-management/protecting
- Prisma production guide for Next.js: https://www.digitalapplied.com/blog/prisma-orm-production-guide-nextjs
- Battle-tested Next.js project structure 2025: https://medium.com/@burpdeepak96/the-battle-tested-nextjs-project-structure-i-use-in-2025-f84c4eb5f426

---
*Architecture research for: plant care tracking web app (Plant Minder)*
*Researched: 2026-04-13*
