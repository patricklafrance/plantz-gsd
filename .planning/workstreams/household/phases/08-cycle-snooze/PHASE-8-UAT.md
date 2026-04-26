# Phase 8 — UAT (Plant Minder)

**Branch:** `feat/household` (5 atomic commits — `f86ed29` … `9de59d9`)
**DB:** Reset + reseeded autonomously during the build run. Demo user + 8 plants + 3 members ready.
**Dev server:** `npm run dev` → `http://localhost:3000` (was already running on PID 23688 during the autonomous run)

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

## UAT 8.1 — Cycle Snooze

**Goal:** Active assignee can defer their cycle without reassigning.

1. Visit `http://localhost:3000/login` → click **Explore without signing up**.
2. On `/h/<slug>/dashboard` look below the green countdown banner (right-aligned).
3. **Expected:** Two buttons — `Snooze` (with dropdown) and `Skip`.
4. Click **Snooze** → pick **3 days**.
5. **Expected:** Countdown banner adds 3 days (e.g. "7 days left" → "10 days left", end-date shifts), toast says "Snoozed — cycle ends 3 days later."
6. Click **Skip**.
7. **Expected:** Confirm dialog "Skip your turn?". Confirm → toast "Skipped — passed to the next member.", banner now shows "Alice (alice@demo.plantminder.app) is watering this cycle." (you become a non-assignee viewer; the demo user stays the demo viewer though — actually demo blocks; see step 8).
8. **Demo-mode block:** since this is a demo session, both Snooze and Skip should toast "Demo mode — sign up to save your changes." If this fires, that's the read-only guard working — the action did NOT write to the DB. (To exercise the real write path, register a new account and rerun on `/h/<your-slug>/dashboard`.)

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

1. From any logged-in session, open avatar menu → **Account preferences**.
2. **Expected:** New "Appearance" card with three radio buttons — Light / Dark / System.
3. Click **Dark**.
4. **Expected:** Whole app flips to dark mode immediately. Header, dashboard banner, member rows, sidebar, dialog backgrounds — all dark surfaces. The accent green stays visible (banner border, "Watering now" pill, focus ring).
5. Refresh the page.
6. **Expected:** Dark mode is preserved (next-themes localStorage).
7. Click **Light** → verify everything goes back to the light palette.
8. Click **System** → matches your OS appearance setting.
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
