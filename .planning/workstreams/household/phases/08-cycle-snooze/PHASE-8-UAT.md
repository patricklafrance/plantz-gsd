# Phase 8 — UAT (Plant Minder)

**Branch:** `feat/household` (through `f67e1e5`)
**DB:** Reset + reseeded autonomously during the build run. Demo user + 8 plants + 3 members ready.
**Dev server:** `npm run dev` → `http://localhost:3000`

> **Reality check before reading:** Snooze was removed in `49d716e` — there is no Snooze button anywhere. Skip my turn now reassigns the *current* cycle in place rather than ending it and starting a new one (`f67e1e5`). The seed feature was split out of onboarding into a dedicated Demo tools page in the ribbon (`4692c64`). UATs below reflect the current code, not the original autonomous-run plan.

---

## Setup (one-time)

```bash
# If the dev server is not running:
npm run dev

# If you want a fresh DB:
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="You can wipe the database, no worries...." npx prisma migrate reset --force
npx prisma db seed
```

---

## UAT 8.1 — Skip my turn (reassign current cycle in place)

**Goal:** Active assignee hands the *rest of the current cycle* to the next available member. Same cycle number, same end date — only `assignedUserId` changes. Solo households can't skip (no one to hand off to).

**Prereq:** demo session has 3 members (Demo User + Alice + Bob). Use it for the multi-member path.

1. Visit `http://localhost:3000/login` → click **Explore without signing up**.
2. On `/h/<demo-slug>/dashboard` find the green countdown banner. The Skip control lives **inside the banner's action slot**, not below it.
3. **Expected (banner copy):** *"You're up this week — N days left. **Alice** (alice@demo.plantminder.app) is next."* with a **Skip my turn** button to the right.
4. **Demo-mode block:** click **Skip my turn** → confirm the dialog → toast should say *"Demo mode — sign up to save your changes."* Banner does not change. Confirms the read-only guard.
5. To exercise the real write path: sign out → register a fresh account `Pat`. New solo household — **the Skip button should NOT render** (only one member, no one to reassign to). Verify it's absent.
6. Open a second browser/profile, register `Sam`. From Pat's account, send Sam an invite (Household settings → Invitations → copy link), accept it as Sam. Both should now belong to Pat's household.
7. Back on Pat's dashboard, the Skip button is now visible inside the banner. Click it → confirm.
8. **Expected:** Banner now shows Sam as the active assignee (*"Sam (sam-uat@…) is on rotation — N days left in this cycle"*) with the **same end date** as before. Cycle number unchanged in the database. Toast: success.
9. Switch to Sam's session → bell badge has 1 unread; the dropdown shows a *"Pat (pat-uat@…) skipped — you're now watering"* notification.
10. **Edge case:** as Sam, click **Skip my turn** again → it hands back to Pat with another notification. (No "skip cap" — deliberate simplification.)

---

## UAT 8.2 — Real-name on signup + derived household name

**Goal:** Registration captures a name; the auto-created household name is derived from it.

1. Visit `http://localhost:3000/register`.
2. **Expected:** First field is **"Your name"** (placeholder "Pat") — required.
3. Try to submit with name empty (just fill the rest) — submit is blocked / inline error.
4. Register with name `Pat`, email `pat-uat@example.com`, password `password123`.
5. **Expected:** Lands on `/h/<slug>/dashboard`. Click the avatar in the top right (User menu).
6. **Expected:** First menu item shows **"Pat's plants"** with a "Current household" caption.
7. Sign out + register a second account with name `Chris`, email `chris-uat@example.com`.
8. **Expected:** User menu shows **"Chris' plants"** (apostrophe-only — name ends in `s`).
9. Edge case: register a third with name `Mary Smith`.
10. **Expected:** **"Mary's plants"** (first token only — last name dropped).

---

## UAT 8.3 — Real-name display in rotation copy

**Goal:** Anywhere the app names a member, render `[bold name] (muted email)`; never `null (email)` or `() (email)`.

Use the demo session for this UAT (3 members already seeded).

1. Login as demo (Explore without signing up).
2. On `/h/<demo-slug>/dashboard`:
   - **Expected (countdown banner):** *"You're up this week — N days left. **Alice** (alice@demo.plantminder.app) is next."*
3. Visit `/h/<demo-slug>/household-settings` → Members section:
   - **Expected:** Three rows, each rendering `[bold name] (muted-small email)`:
     - 1. **Demo User** (demo@plantminder.app) — Watering now — OWNER
     - 2. **Alice** (alice@demo.plantminder.app) — Up next — MEMBER
     - 3. **Bob** (bob@demo.plantminder.app) — MEMBER
4. **Negative check:** there should be no row showing `null (email)` or stray `()` parens anywhere.

---

## UAT 8.4 — Light + Dark Theme

**Goal:** Theme switcher persists, system preference is the default, both modes are usable.

**Note:** since `7f65293`, the theme controls are **inline at the top of the user menu** (three radios — Light / Dark / Sys), not on the Account preferences page.

1. From any logged-in session, click the avatar in the top-right.
2. **Expected:** First row of the dropdown contains three radios labelled `Light` / `Dark` / `Sys` (in that order, above the household section).
3. Click **Dark**.
4. **Expected:** Whole app flips to dark mode immediately. Header, dashboard banner, member rows, sidebar, dialog backgrounds — all dark surfaces. The accent green stays visible (banner border, "Watering now" pill, focus ring).
5. Refresh the page.
6. **Expected:** Dark mode is preserved (next-themes localStorage).
7. Reopen the menu → click **Light** → verify everything goes back to the light palette.
8. Click **Sys** → matches your OS appearance setting.
9. Open dev tools → no React hydration warnings ("Text content does not match…") in console.

---

## UAT 8.5 — Critical-path E2E suite

**Goal:** Playwright suite covers the golden flows; failures block merge.

```bash
# Make sure the dev server is running on :3000 first.
# (The Playwright config will reuse the existing server.)
npx playwright test
```

**Expected:**
- All 4 spec files (`auth.spec.ts`, `watering.spec.ts`, `household.spec.ts`, `invite.spec.ts`) run.
- Most cases pass on a freshly-seeded DB.
- Caveats (acceptable):
  - `watering.spec.ts` is a smoke (selectors are tolerant) — if shadcn `AddPlantDialog` field labels differ from the regexes, expect a flake.
  - `invite.spec.ts` opens two browser contexts in parallel; the invite-link locator depends on the InvitationsCard rendering the URL as visible text — flake if a copy-only-button design lands.
  - First-run cost: dev server boot for `webServer` config.

---

## UAT 8.6 — Onboarding no longer seeds plants

**Goal:** Picking a plant-count range during onboarding only personalizes — it does NOT auto-create plants.

1. Sign out → register a fresh account (e.g. `pat-onboarding-uat@example.com`).
2. **Expected:** Lands on dashboard with the *"Welcome to Plant Minder — How many plants are you tracking?"* banner. Below it: *"No plants yet — Add your first plant to start tracking watering."*
3. Click **1-5 plants**.
4. **Expected:** Banner collapses to *"Got it — your tips are personalized."* Dashboard still shows **"No plants yet"** — no auto-seeded sample plants.
5. **Negative check:** No "Setting up your starter plants…" loading copy, no toast about seeded plants.

---

## UAT 8.7 — Demo tools page (ribbon)

**Goal:** Seed feature lives on a dedicated, clearly-labelled page reachable from the user menu — hidden for the demo session, visible for real users, idempotent for repeated test runs.

1. **Hidden for demo:** while in the Explore-without-signing-up demo session, open the user menu → confirm there is **no "Demo tools"** entry.
2. Try to navigate directly to `http://localhost:3000/h/<demo-slug>/demo-tools` → server should redirect you back to `/h/<demo-slug>/dashboard`.
3. **Visible for real users:** sign out → log in (or register) as a real account → open the user menu.
4. **Expected:** A **Demo tools** entry appears (FlaskConical icon, between Account and Sign out).
5. Click it → lands on `/h/<slug>/demo-tools`.
6. **Expected:** Heading "Demo & testing tools", a yellow *"Heads up"* card calling out "for testing and demo purposes only", and a "Seed starter plants" card with a 4-button range selector (1-5 / 6-15 / 16-30 / 30+) and a primary **Seed starter plants** button.
7. Click **Seed starter plants** with the default 1-5 selection → confirm dialog → accept.
8. **Expected:** Toast *"Seeded 5 plants."* Visit `/h/<slug>/dashboard` → "Recently Watered (5)" group lists the 5 starter plants.
9. **Idempotency:** click Seed again with the same range → toast says *"Seeded 5 plants."* again, dashboard now shows 10 plants (no de-duplication — duplicates stack, as documented).

---

## Manual operations I cannot do for you

1. **`git push`** — local commits only per your standing rule. Push when ready.
2. **Production deploy / DB migration** — none required. Phase 8 is schema-clean (uses existing nullable `User.name`).
3. **Legacy data flush** — you said wipe is OK, so I reset + reseeded the dev DB. If you ever migrate prod, you'll want a one-shot script to map existing solo-household names from "My Plants" to `deriveHouseholdName(user.name)`. Trivial — call `db.household.update` for every household whose member list size === 1 and whose owner has `User.name`.
4. **Lighthouse / formal contrast pass on dark mode** — I lifted the dark `--accent` from flat gray to brand green for visibility, but I did not run a tooling-based AA contrast audit. Worth a Lighthouse run if you care.
5. **Production cron URL update** — unaffected by Phase 8.

---

## Heads-up issues

- **TypeScript noise in `tests/`** — pre-existing (predates Phase 8). The `tests/household-create.test.ts`, `tests/notes.test.ts`, etc. have `NextMiddleware`-cast errors that look gnarly but are mock-side type drift. They do not affect runtime, do not affect Vitest pass/fail, and were already there before this run.
- **`getInitials` in `UserMenu`** still falls back to `email[0]` when `name` is null. With the new required-name signup that should no longer trigger, but the path remains for the seeded demo user (which always has a name anyway).
- **The legacy `(main)/dashboard/page.tsx` redirect** — untouched. Still bounces to `/h/<default>/dashboard`.
