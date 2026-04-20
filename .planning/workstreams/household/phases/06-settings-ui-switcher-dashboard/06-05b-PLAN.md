---
phase: 06-settings-ui-switcher-dashboard
plan: 05b
type: execute
wave: 3
depends_on: ["06-02"]
files_modified:
  - src/components/household/settings/members-list.tsx
  - tests/phase-06/members-list.test.tsx
  - tests/phase-06/rotation-reorder.test.tsx
autonomous: true
requirements: [HSET-03, ROTA-01]
tags: [client-components, rotation-reorder, role-matrix, phase-06]

must_haves:
  truths:
    - "MembersList renders members ordered by rotationOrder, with per-row up/down arrows (OWNER only) and a 3-dot role-conditional DropdownMenu"
    - "Rotation reorder is optimistic: clicking up/down immediately updates local state; failed action reverts local state + shows toast.error"
    - "Top row's up-arrow and bottom row's down-arrow are disabled"
    - "All reorder arrows disable during isPending (transition in-flight)"
    - "Members-list self-row 3-dot menu does NOT offer 'Leave household' — Leave lives exclusively in DangerZoneCard (warning #7 lock)"
    - "OWNER/MEMBER role pill renders with the audited `bg-muted text-foreground` / `bg-muted text-muted-foreground` fallback pair (UI-SPEC amber pair requires Plan 07 UAT contrast check)"
    - "All Base UI trigger compositions use the project-standard `render={<Button … />}` idiom — NEVER `asChild`"
  artifacts:
    - path: "src/components/household/settings/members-list.tsx"
      provides: "Client component: rotation-ordered member list with up/down arrows (OWNER) and role-conditional 3-dot menu"
      exports: ["MembersList"]
  key_links:
    - from: "src/components/household/settings/members-list.tsx"
      to: "@/features/household/actions (reorderRotation, promoteToOwner, demoteToMember, removeMember)"
      via: "useTransition wrapper"
      pattern: "reorderRotation|promoteToOwner|demoteToMember|removeMember"
---

<objective>
Build the Members+Rotation list: rotation-ordered member rendering with OWNER-only up/down reorder arrows and a role-conditional 3-dot DropdownMenu exposing promote/demote/remove actions. Split from the original Plan 05 per checker warning #4 (MembersList's 3-dot matrix + reorder optimism is substantial enough to merit its own plan); Plans 05a (general + danger) and 06 (invitations + availability) run in the same Wave 3 with disjoint files.

Purpose: MembersList is the single highest-decision-density surface of the settings page (D-10 / D-11 / D-12 / D-17 / D-18 / D-19). Isolating it keeps 05b at 3 focused tasks and preserves executor context budget for the 3-dot matrix wiring.

Output: 1 new component file + 2 real test files (`members-list.test.tsx`, `rotation-reorder.test.tsx`). Disjoint from Plans 03 / 04 / 05a / 06; runs in Wave 3 parallel.
</objective>

<execution_context>
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/workflows/execute-plan.md
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-CONTEXT.md
@.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-RESEARCH.md
@.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-PATTERNS.md
@.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-UI-SPEC.md
@.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-02-SUMMARY.md

<interfaces>
<!-- Server Actions this component calls -->

From @/features/household/actions (Plan 02):
```typescript
export async function reorderRotation(
  data: unknown
): Promise<{ success: true } | { error: string }>;
```

From @/features/household/actions (Phase 4 — existing):
```typescript
export async function promoteToOwner(data: unknown): Promise<{ success: true } | { error: string }>;
export async function demoteToMember(data: unknown): Promise<{ success: true } | { error: string }>;
export async function removeMember(data: unknown): Promise<{ success: true } | { error: string }>;
```

**Base UI trigger idiom (project convention — mandatory):**
```tsx
// CORRECT
<AlertDialogTrigger render={<Button variant="ghost" size="sm">Remove from household</Button>} />
<TooltipTrigger render={<Button variant="ghost" size="sm" disabled>Remove from owners</Button>} />
<DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Row menu"><MoreHorizontal /></Button>} />

// WRONG — Base UI components do NOT accept `asChild`; the repo uses `render=`
```

Verified: `src/components/ui/alert-dialog.tsx:13`, `src/components/ui/tooltip.tsx:16`, `src/components/auth/user-menu.tsx:35-40` (DropdownMenuTrigger with `render=`). Canonical analog: `src/components/watering/log-watering-dialog.tsx:149-164`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create `settings/members-list.tsx` — rotation-ordered list with reorder + 3-dot menu (Base UI `render=` idiom)</name>
  <files>src/components/household/settings/members-list.tsx</files>
  <behavior>
    - Props: `{ members: Array<MemberRow>; viewerUserId: string; viewerRole: "OWNER" | "MEMBER"; householdId: string; householdSlug: string; householdName: string; ownerCount: number }`
      where `MemberRow = { userId, userName, userEmail, role, rotationOrder }`
    - Members pre-sorted by rotationOrder ASC (trusts caller; `getHouseholdMembers` returns this order)
    - Each row: rotation-order prefix `[N]` (w-6 fixed column) + display name (fallback to email) + role pill + OWNER-only up/down arrows + 3-dot DropdownMenu
    - Top row's ArrowUp disabled; last row's ArrowDown disabled
    - Optimistic reorder: local state immediately updates; `reorderRotation` fires via useTransition; on error revert + toast
    - All arrows disabled while isPending
    - 3-dot menu is role-conditional per D-18:
      - OWNER viewer on MEMBER row: "Make owner" (→ AlertDialog → promoteToOwner) + "Remove from household" (→ AlertDialog → removeMember)
      - OWNER viewer on co-OWNER row: "Remove from owners" (disabled if ownerCount===1 with Tooltip "Need at least one owner") + "Remove from household"
      - **Self row: NO "Leave household" item — DangerZoneCard owns Leave exclusively (warning #7 lock)**
      - If self row has NO other available actions (MEMBER viewing own row), the 3-dot menu is not rendered at all
    - 3-dot menu NOT rendered for MEMBER viewer on non-self rows
    - Role pill: OWNER → `bg-muted text-foreground text-xs px-1.5 py-0.5 rounded`; MEMBER → `bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded` (UI-SPEC fallback pair; Plan 07 UAT may upgrade OWNER to amber if contrast passes)
    - **All `<XTrigger>` compositions use `render={<Button … />}` prop — ZERO `asChild` in the file (checker Blocker 1)**
  </behavior>
  <read_first>
    - src/components/reminders/notification-bell.tsx (useTransition + DropdownMenu analog)
    - src/components/auth/user-menu.tsx (DropdownMenu composition + `<DropdownMenuTrigger render={<button … />}>` idiom — PATTERNS.md lines 843–858)
    - src/components/watering/log-watering-dialog.tsx (lines 149–164 — canonical `<PopoverTrigger render={<Button … />}>` usage)
    - src/components/layout/bottom-tab-bar.tsx (map + pathname pattern)
    - src/components/ui/alert-dialog.tsx (lines 13 — confirm AlertDialogTrigger wraps Base UI Primitive.Trigger.Props; AlertDialogAction is not a Trigger so it continues to accept the existing usage shape)
    - src/components/ui/tooltip.tsx (lines 16 — confirm TooltipTrigger wraps Base UI Primitive.Trigger.Props)
    - .planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-UI-SPEC.md §"Section 2: Members + Rotation" (lines 304–346 — authoritative row layout + 3-dot menu matrix + AlertDialog copy)
    - .planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-PATTERNS.md §"settings/members-list.tsx" (lines 530–563) AND §"Base UI render prop idiom" (line 858, 939)
    - .planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-RESEARCH.md §Pattern 4 (lines 378–396 — optimistic reorder code)
  </read_first>
  <action>
Create `src/components/household/settings/members-list.tsx`.

HEADER:
```tsx
"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  reorderRotation,
  promoteToOwner,
  demoteToMember,
  removeMember,
} from "@/features/household/actions";
import { cn } from "@/lib/utils";

export type MemberRow = {
  userId: string;
  userName: string | null;
  userEmail: string;
  role: "OWNER" | "MEMBER";
  rotationOrder: number;
};

type MembersListProps = {
  members: MemberRow[];
  viewerUserId: string;
  viewerRole: "OWNER" | "MEMBER";
  householdId: string;
  householdSlug: string;
  householdName: string;
  ownerCount: number;
};
```

OPTIMISTIC REORDER skeleton (unchanged from the pre-split plan):
```tsx
function moveRow(index: number, direction: -1 | 1) {
  const next = [...localMembers];
  const swap = index + direction;
  [next[index], next[swap]] = [next[swap], next[index]];
  setLocalMembers(next);
  startTransition(async () => {
    const result = await reorderRotation({
      householdId: props.householdId,
      householdSlug: props.householdSlug,
      orderedMemberUserIds: next.map((m) => m.userId),
    });
    if ("error" in result) {
      setLocalMembers(props.members); // revert
      toast.error(result.error);
    }
  });
}
```

ROW MENU TRIGGER (MANDATORY `render={…}` idiom):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger
    render={
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Actions for ${displayName}`}
        className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    }
  />
  <DropdownMenuContent align="end">
    {/* Role-conditional items — see D-18 matrix */}
  </DropdownMenuContent>
</DropdownMenu>
```

PROMOTE/REMOVE AlertDialog wiring (MANDATORY `render={…}` idiom on every `<AlertDialogTrigger>`):

```tsx
{/* OWNER viewer on MEMBER row — "Make owner" */}
<AlertDialog>
  <AlertDialogTrigger render={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Make owner</DropdownMenuItem>} />
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Make {displayName} an owner?</AlertDialogTitle>
      <AlertDialogDescription>
        {displayName} will become an additional owner. To transfer solo ownership, demote yourself afterwards.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => handlePromote()}>Make owner</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Open question for the executor:** whether `AlertDialogTrigger` wrapping a `DropdownMenuItem` via `render=` works as-is (the Base UI AlertDialog trigger forwards its props into the rendered element). If composition conflicts surface at `npx tsc --noEmit`, an acceptable alternative is:
1. Place the `<AlertDialog>` OUTSIDE the `<DropdownMenuContent>` (portal)
2. Use a local boolean state (`const [showPromoteDialog, setShowPromoteDialog] = useState(false)`) that the DropdownMenuItem's `onSelect` flips
3. Omit `<AlertDialogTrigger>` and use `<AlertDialog open={…} onOpenChange={…}>` directly

Either shape is acceptable **as long as `asChild` does not appear in this file.** Document the chosen composition in SUMMARY.

DEMOTE co-OWNER (TooltipTrigger with disabled button — needs `<span>` wrapper inside `render=`):
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger
      render={
        <span>
          <DropdownMenuItem
            disabled={ownerCount === 1}
            onSelect={(e) => { e.preventDefault(); setShowDemoteDialog(true); }}
          >
            Remove from owners
          </DropdownMenuItem>
        </span>
      }
    />
    {ownerCount === 1 && <TooltipContent>Need at least one owner</TooltipContent>}
  </Tooltip>
</TooltipProvider>
```

AlertDialog copy (UI-SPEC §Section 2 lines 334–344 — verbatim):
- Remove member: Title "Remove {name} from {householdName}?"; Body "They'll lose access to the household and its plants. This can't be undone."; Cancel "Keep member"; Confirm "Remove member" (destructive)
- Make owner: Title "Make {name} an owner?"; Body per D-19; Cancel "Cancel"; Confirm "Make owner"
- Remove from owners: Title "Remove {name} from owners?"; appropriate body; Cancel "Cancel"; Confirm "Demote"

CRITICAL:
- All reorder arrows disable during isPending — not just the clicked one (D-12 explicit).
- `TooltipProvider` wraps the whole list so tooltip children work without per-row providers.
- `size="icon"` on arrow buttons; `min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0` enforces WCAG 2.2 tap target on mobile.
- **Self-row 3-dot menu MUST NOT include a "Leave household" item** (warning #7 lock — Leave lives solely in DangerZoneCard). If the self row has no other actions, omit the 3-dot button entirely.
- NO DnD library import (ROTA-01 pitfall).
- Prop contract: members pre-sorted by rotationOrder; component trusts the order.
- **Zero `asChild` identifiers anywhere in this file** (checker Blocker 1). Use `render={<Button … />}` / `render={<DropdownMenuItem … />}` / `render={<span><… /></span>}` on every `<XTrigger>` that needs a custom child.
  </action>
  <verify>
    <automated>test -f src/components/household/settings/members-list.tsx && grep -c "export function MembersList\|export const MembersList" src/components/household/settings/members-list.tsx</automated>
    <automated>grep -c "asChild" src/components/household/settings/members-list.tsx</automated>
    <automated>grep -cE "DnD|dnd-kit|react-beautiful" src/components/household/settings/members-list.tsx</automated>
    <automated>grep -ci "Leave household" src/components/household/settings/members-list.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/household/settings/members-list.tsx` exits 0
    - `grep -c "^\"use client\";" src/components/household/settings/members-list.tsx` returns `1`
    - `grep -c "useTransition" src/components/household/settings/members-list.tsx` returns `1`
    - `grep -c "reorderRotation" src/components/household/settings/members-list.tsx` returns ≥1
    - `grep -c "promoteToOwner\|demoteToMember\|removeMember" src/components/household/settings/members-list.tsx` returns ≥3
    - `grep -cE "dnd-kit|react-beautiful|HTML5Backend" src/components/household/settings/members-list.tsx` returns `0`
    - `grep -c "ArrowUp\|ArrowDown" src/components/household/settings/members-list.tsx` returns ≥2
    - `grep -c "MoreHorizontal" src/components/household/settings/members-list.tsx` returns ≥1
    - `grep -c 'disabled={index === 0\|disabled={.*=== 0' src/components/household/settings/members-list.tsx` returns ≥1
    - `grep -c 'disabled=.*total.*-.*1\|disabled={index === total - 1' src/components/household/settings/members-list.tsx` returns ≥1
    - `grep -c "Keep member\|Remove member" src/components/household/settings/members-list.tsx` returns ≥2
    - `grep -c "Need at least one owner" src/components/household/settings/members-list.tsx` returns ≥1
    - **`grep -c "asChild" src/components/household/settings/members-list.tsx` returns `0` (Base UI Trigger idiom lock — checker Blocker 1)**
    - **`grep -ci "Leave household" src/components/household/settings/members-list.tsx` returns `0` (warning #7 lock: Leave lives in DangerZoneCard, not here)**
    - **`grep -cE "render=\{<(Button|DropdownMenuItem|span)" src/components/household/settings/members-list.tsx` returns ≥2 (trigger render-prop idiom)**
    - `npx tsc --noEmit` produces no new errors for this file
  </acceptance_criteria>
  <done>Members list renders with rotation-order prefix, role pills, up/down arrows (OWNER), 3-dot role-conditional menu, optimistic reorder, zero `asChild`, zero "Leave household" identifier, tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill in `tests/phase-06/members-list.test.tsx` (7 real tests — 3-dot matrix + rotation prefix)</name>
  <files>tests/phase-06/members-list.test.tsx</files>
  <behavior>
    - All 7 `it.todo` stubs from Plan 01 become real `it(...)` tests
    - `npx vitest run tests/phase-06/members-list.test.tsx` passes with 0 failures, 0 todos
    - Tests cover the 7 D-18 matrix cells plus the rotation-order prefix rendering
    - Every test description begins with `HSET-03` or `ROTA-01`
    - Includes an explicit assertion that self-row does NOT contain "Leave household" text (warning #7 lock)
  </behavior>
  <read_first>
    - Task 1 output (members-list.tsx) — for exact DOM strings and aria-labels to assert
    - tests/phase-05/notification-bell-variant.test.tsx (mock pattern for useTransition + Server Action + DropdownMenu)
    - Plan 01 stub file to preserve the it.todo description keys
  </read_first>
  <action>
Replace `it.todo` stubs with real `it(...)` tests. Use portal-rendered menu assertions with `fireEvent.click(trigger)` then `screen.getByText(...)`; fall back to `require("node:fs").readFileSync` source-grep for branches that are hard to force open in RTL.

COMMON MOCK HEADER:
```typescript
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/features/household/actions", () => ({
  reorderRotation: vi.fn(),
  promoteToOwner: vi.fn(),
  demoteToMember: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { MembersList } = await import("@/components/household/settings/members-list");

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });
```

SEVEN TESTS (matching Plan 01 stubs):
1. `HSET-03 renders rotation-order prefix [N] for each row`
2. `HSET-03 OWNER viewer sees up/down arrows on all rows` (source-grep is acceptable if portal-based DropdownMenu interferes)
3. `HSET-03 MEMBER viewer sees no up/down arrows`
4. `HSET-03 OWNER viewer: 3-dot menu on MEMBER row offers "Make owner" + "Remove from household"` (source-grep assertion acceptable)
5. `HSET-03 OWNER viewer: 3-dot menu on co-OWNER row offers "Remove from owners" (disabled when ownerCount===1)`
6. `HSET-03 OWNER role pill renders with "bg-muted text-foreground"` (className grep on rendered DOM)
7. `HSET-03 self-row 3-dot menu does NOT contain "Leave household" text (warning #7 lock)`:
   ```typescript
   it("HSET-03 self-row 3-dot menu does NOT contain 'Leave household' text (warning #7 lock)", () => {
     const fs = await import("node:fs");
     const src = fs.readFileSync(
       "src/components/household/settings/members-list.tsx",
       "utf8"
     );
     expect(src.toLowerCase()).not.toContain("leave household");
   });
   ```

CRITICAL:
- `require("node:fs").readFileSync` source-grep is the robust fallback for DropdownMenu portal rendering.
- Every test description starts with `HSET-03` or `ROTA-01`.
- The warning #7 test locks the split — if a future refactor accidentally re-adds Leave to members-list, this test flags it immediately.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-06/members-list.test.tsx 2>&1 | tail -20</automated>
    <automated>grep -c "it.todo\|test.todo" tests/phase-06/members-list.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/phase-06/members-list.test.tsx` passes with 0 failures, 0 todos
    - `grep -c "it.todo\|test.todo" tests/phase-06/members-list.test.tsx` returns `0`
    - At least ONE test asserts members-list source does NOT contain "Leave household" (warning #7 lock)
    - Every test description begins with `HSET-03` or `ROTA-01`
  </acceptance_criteria>
  <done>Test file is todo-free and green; warning #7 split lock has regression coverage.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fill in `tests/phase-06/rotation-reorder.test.tsx` (6 real tests)</name>
  <files>tests/phase-06/rotation-reorder.test.tsx</files>
  <behavior>
    - All 6 `it.todo` stubs from Plan 01 become real `it(...)` tests
    - `npx vitest run tests/phase-06/rotation-reorder.test.tsx` passes with 0 failures, 0 todos
    - Tests cover: moveUp invokes reorderRotation, top-row up disabled, bottom-row down disabled, optimistic update, revert on error, all arrows disable while isPending
    - Every test description begins with `ROTA-01`
  </behavior>
  <read_first>
    - Task 1 output (members-list.tsx) — for exact aria-labels (`Move {displayName} up`)
    - Plan 01 stub file to preserve the it.todo description keys
  </read_first>
  <action>
Replace `it.todo` stubs. Use the Plan 01 stub description keys verbatim. The test bodies follow the pattern from the original Plan 05 Task 4 FILE 3 (unchanged by the split):

COMMON MOCK HEADER:
```typescript
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/features/household/actions", () => ({
  reorderRotation: vi.fn(),
  promoteToOwner: vi.fn(),
  demoteToMember: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const actions = await import("@/features/household/actions");
const { MembersList } = await import("@/components/household/settings/members-list");

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });
```

SIX TESTS (full bodies preserved from pre-split plan — not duplicated here to save context):
1. `ROTA-01 moveUp invokes reorderRotation with new order`
2. `ROTA-01 top-row up-arrow is disabled`
3. `ROTA-01 bottom-row down-arrow is disabled`
4. `ROTA-01 optimistic: local order updates immediately on click`
5. `ROTA-01 on error: reverts local state AND shows toast.error`
6. `ROTA-01 all arrows disabled while isPending` (source-grep fallback for RHF-internal pending state)

CRITICAL:
- Use `require("node:fs").readFileSync` for hard-to-assert pending-state disable (the Phase 5 tests do this; it's an accepted pattern per PATTERNS.md line 762).
- Every test description starts with `ROTA-01`.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-06/rotation-reorder.test.tsx 2>&1 | tail -20</automated>
    <automated>grep -c "it.todo\|test.todo" tests/phase-06/rotation-reorder.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/phase-06/rotation-reorder.test.tsx` passes with 0 failures, 0 todos
    - `grep -c "it.todo\|test.todo" tests/phase-06/rotation-reorder.test.tsx` returns `0`
    - Every test description begins with `ROTA-01`
  </acceptance_criteria>
  <done>Test file is todo-free and green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Optimistic client state → server-authoritative refresh | Rotation reorder shows local state first; Server Action + `revalidatePath` confirms (or overrides). Stale client state is caught by the set-mismatch guard (Plan 02). |
| Role-conditional UI visibility | Client-side role check (`viewerRole === "OWNER"`) is UX polish; server-side `role === "OWNER"` check in Plan 02 actions is the authority. |
| 3-dot menu action invocations | MEMBER viewer could craft POSTs to promote/demote/remove actions; Phase 4 server-side role + ownership checks are authoritative. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-05b-01 | Tampering | Rotation reorder with removed member in the array | mitigate | Plan 02 set-mismatch guard inside `$transaction`; optimistic UI reverts on returned error |
| T-06-05b-02 | IDOR | cross-household `removeMember({ householdId: otherHousehold })` | mitigate | Phase 4 `requireHouseholdAccess` + OWNER check server-side; UI only exposes actions for the currently-viewed household |
| T-06-05b-03 | Authorization | last-OWNER demotes self via demoteToMember | mitigate | Phase 4 server-side last-OWNER guard + client-side `disabled={ownerCount === 1}` + tooltip "Need at least one owner" |
| T-06-05b-04 | CSRF | 3-dot menu action invocations | mitigate | Next.js Server Actions built-in CSRF |
| T-06-05b-05 | XSS | Member display name rendered in roster | mitigate | React JSX auto-escapes; no `dangerouslySetInnerHTML` |
| T-06-05b-06 | Session integrity | Stale viewerRole prop after role change mid-session | accept | Server action re-checks role on every call; stale hiding is cosmetic |
</threat_model>

<verification>
- `npx tsc --noEmit` passes
- `npx vitest run tests/phase-06/members-list.test.tsx tests/phase-06/rotation-reorder.test.tsx` passes
- `grep -c "asChild" src/components/household/settings/members-list.tsx` returns `0` (checker Blocker 1)
- `grep -ci "Leave household" src/components/household/settings/members-list.tsx` returns `0` (warning #7 lock)
- No DnD library imports
- No absolute `/plants`, `/rooms`, `/dashboard`, `/settings` Link targets (Pitfall 17)
</verification>

<success_criteria>
- MembersList exports correctly and is consumable from the settings page (Plan 07)
- MembersList optimistically reorders, reverts on error, and exposes the role-conditional 3-dot menu
- Self-row 3-dot menu does NOT offer "Leave household" (warning #7 lock)
- Zero `asChild` identifiers (checker Blocker 1)
- `tests/phase-06/members-list.test.tsx` and `tests/phase-06/rotation-reorder.test.tsx` both green, 0 todos
</success_criteria>

<output>
After completion, create `.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/06-05b-SUMMARY.md` documenting:
- The final AlertDialog / DropdownMenu composition shape chosen (Trigger wrapping DropdownMenuItem via render= vs open/onOpenChange + external AlertDialog + local boolean state)
- Confirm OWNER pill uses the audited fallback palette (Plan 07 UAT may upgrade)
- **Confirm zero `asChild` identifiers in the produced file (checker Blocker 1)**
- **Confirm self-row has no "Leave household" action (warning #7 lock)**
- Unblocks: Plan 07 (settings page composition)
</output>
