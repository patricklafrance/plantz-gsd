---
phase: 02-query-action-layer-update
plan: 09
task: 1
type: diagnosis
status: complete
---

# Plan 02-09 Task 1 — Diagnosis

## Next.js reference reading

- `.claude/skills/nextjs/references/error-handling.md` lines 180-212 cover `not-found.tsx`:
  - Line 184: "Custom 404 page for a route segment"
  - Line 200: `import { notFound } from 'next/navigation'`
  - Line 207: `notFound()  // Renders closest not-found.tsx`
- Lines 214-227 cover the error hierarchy: "Errors bubble up to the nearest error boundary."
- The docs excerpt does NOT spell out the layout-throws-before-children case explicitly. The inferred behavior observed in this diagnosis is: when `notFound()` is thrown from `layout.tsx` during its own render (before children mount), the nearest NotFound boundary that can catch it is the PARENT segment, not the same segment, because the current segment's layout has not yet rendered its `not-found.tsx` sibling.

## Observations

**HTTP status:** 404 (per Chrome Network tab: `reqid=331 GET http://localhost:3000/h/this-household-does-not-exist/dashboard [404]`).

**Rendered DOM (browser a11y snapshot):**
```
RootWebArea "404: This page could not be found."
  main
    heading "404" level="1"
    heading "This page could not be found." level="2"
```

This is Next.js's built-in default 404 page — NOT the custom `HouseholdNotFound` component. No `Household not found` heading, no `SearchX` icon, no "Go to dashboard" button.

**UAT-9's "blank page" description was an approximation** — the actual output is Next.js's stock 404 (two headings, no app chrome). From a user-experience standpoint it looks like a crash / site-wide error rather than an in-app "you typed a bad slug" message.

**Console output:** No errors except the expected `Failed to load resource: 404` at `msgid=67`. No `NEXT_NOT_FOUND` surfaced to the client console (it's a server-side signal).

**Filesystem check:**
- `src/app/(main)/h/[householdSlug]/not-found.tsx` → EXISTS (renders "Household not found" — but was not invoked for this request).
- `src/app/(main)/h/[householdSlug]/error.tsx` → EXISTS (not invoked — `NEXT_NOT_FOUND` is not a regular error, goes through the not-found channel).
- `src/app/(main)/not-found.tsx` → **DOES NOT EXIST.** Ran `ls src/app/(main)/not-found.tsx` → "No such file or directory".
- `src/app/not-found.tsx` → Not tested explicitly, but the default Next.js 404 UI is rendering, which means nothing at `src/app/not-found.tsx` either (otherwise our custom not-found would render, because `app/not-found.tsx` is the global fallback).

**Throw site:** `src/features/household/context.ts` line 22: `if (!summary) notFound();`. This is called from `src/app/(main)/h/[householdSlug]/layout.tsx` line 32 while the layout is still awaiting data — before it renders children. The layout's `not-found.tsx` sibling therefore cannot catch the signal because the layout's render has not reached the point of mounting its child tree.

## Classification

- Cause A1

## Justification

- The `HouseholdNotFound` component was **not rendered** (no "Household not found" heading, no `SearchX` icon, no "Go to dashboard" button in the snapshot). If the household-scoped `not-found.tsx` had been invoked, its JSX would appear in the DOM.
- The server returned HTTP 404 (signal that `notFound()` IS being thrown, per spec) — so the throw is happening, but no same-or-deeper boundary is catching it.
- Filesystem: NO `src/app/(main)/not-found.tsx` exists. Next.js's "closest not-found" resolution escalates past the household segment (which cannot catch a layout-level throw in its own segment per the observed behavior) up toward `(main)/` — finds nothing — escalates further to `app/not-found.tsx` (also not present) — falls back to Next.js's built-in default 404 page.
- This precisely matches A1's signal: `HouseholdNotFound` never renders, AND the filesystem lacks the parent boundary that would catch the escalated signal.
- A0 ruled out: if A0 were correct, `HouseholdNotFound` would render and the HTML would contain "Household not found" — it does not.
- B ruled out for the same reason: we cannot be observing a runtime error in `HouseholdNotFound` because the component is never invoked.
- C ruled out: `proxy.ts` matcher regex `/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|demo).*)` has no `/h/*` short-circuit; the request reaches App Router. The 404 page shown is Next.js's App-Router-served default, not a proxy-short-circuit blank response.

## Fix steps for Task 2

Cause A1 is covered by the plan's `files_modified` (`src/app/(main)/not-found.tsx` — a NEW file — is explicitly listed). Proceed with Task 2. No scope expansion needed.

1. **Create `src/app/(main)/not-found.tsx`** with the same JSX content as the existing household-scoped `src/app/(main)/h/[householdSlug]/not-found.tsx`:
   - Heading: `Household not found`
   - Icon: `SearchX` from `lucide-react`
   - Body copy: "This household doesn't exist, or it may have been deleted. Go back to see the households you're part of."
   - CTA: `<Link href="/dashboard"><Button variant="outline" size="sm">Go to dashboard</Button></Link>`
   - Default export named `MainNotFound`.
2. **Do NOT modify** `src/app/(main)/h/[householdSlug]/not-found.tsx` — it remains the catcher for page-level `notFound()` throws INSIDE a valid household (e.g. `plants/[id]/page.tsx:33` calls `notFound()` when the plant id is unknown). Both boundaries coexist.
3. **Do NOT modify** `src/features/household/context.ts` — the `notFound()` throw at line 22 stays in place; the fix is adding a boundary that catches it, not moving the throw.
4. **Do NOT modify** `src/app/(main)/h/[householdSlug]/layout.tsx` — keep the chokepoint `getCurrentHousehold(householdSlug)` call on line 32 unchanged.

After the edit, the `(main)/not-found.tsx` boundary will catch any `notFound()` thrown from a child segment's layout (including the household layout's call into `getCurrentHousehold`). The chrome-less rendering is acceptable per the plan's `<how-to-verify>` step 4: "The chrome (top header, nav) MAY or MAY NOT be visible depending on which segment's not-found caught — either is acceptable as long as the not-found content renders visibly." The `(main)/not-found.tsx` will render inside the `(main)/layout.tsx` (which is the outer auth+chrome layout — it provides the outer session shell), and will NOT render the household-scoped chrome (header/BottomTabBar) because that chrome is defined in the household layout which never rendered. This is the correct, intended behavior.
