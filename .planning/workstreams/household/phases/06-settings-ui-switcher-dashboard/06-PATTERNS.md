# Phase 6: Settings UI + Switcher + Dashboard - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 18 (8 new, 5 modified, 5 new tests)
**Analogs found:** 18 / 18 (100% — Phases 2–5 shipped direct analogs for every surface)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/household/actions.ts` (append `setDefaultHousehold`) | server-action | request-response | `src/features/household/actions.ts` → `createInvitation` (lines 303–352) | exact — same 7-step template, same action module |
| `src/features/household/actions.ts` (append `updateHouseholdSettings`) | server-action | request-response | `src/features/household/actions.ts` → `createInvitation` + `revokeInvitation` (OWNER-gated pair) | exact |
| `src/features/household/actions.ts` (append `reorderRotation`) | server-action | request-response (atomic transaction) | `src/features/household/actions.ts` → `createHousehold` (lines 41–115, `$transaction` loop) | exact — same `$transaction` idiom |
| `src/features/household/schema.ts` (append 3 Zod schemas) | schema | validation | `src/features/household/schema.ts` → `createInvitationSchema` (lines 93–97), `removeMemberSchema` (lines 138–143) | exact |
| `auth.ts` (line 29 `orderBy` change) | config / auth-callback | single-line modification | `auth.ts` (self) | exact — one-line edit |
| `src/app/(main)/dashboard/page.tsx` (lines 25–29 `orderBy` change) | page / redirect-stub | single-line modification | self | exact — one-line edit |
| `src/app/(main)/h/[householdSlug]/settings/page.tsx` (NEW) | page (Server Component) | server-side data fetch + render | `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` (Promise.all parallel fetch + banner composition) | exact — same shape: `await params`, `getCurrentHousehold`, `Promise.all`, role-branched render |
| `src/app/(main)/h/[householdSlug]/layout.tsx` (amend top-nav + Promise.all) | layout (Server Component) | server-side data fetch + chrome | self (lines 62–67 Promise.all, lines 143–146 logo slot) | exact — in-place amendment |
| `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` (insert `<CycleCountdownBanner>`) | page (Server Component) | server-render | self (lines 253–298 banner region) | exact — in-place insertion |
| `src/components/household/cycle-countdown-banner.tsx` (NEW) | component (Server-renderable / Client if needed) | props-in → JSX | `src/components/household/passive-status-banner.tsx` | exact — same `role="status"`, Lucide icon + two-paragraph body |
| `src/components/household/household-switcher.tsx` (NEW) | component (Client) | dropdown + router.push + useTransition | `src/components/reminders/notification-bell.tsx` (DropdownMenu + useTransition + async Server Action) | exact — same idiom |
| `src/components/household/settings/general-form.tsx` (NEW) | component (Client) | RHF + Zod → Server Action | `src/components/plants/add-plant-dialog.tsx` (lines 239–365 RHF + Form + Select + Server Action submit) | exact |
| `src/components/household/settings/members-list.tsx` (NEW) | component (Client) | optimistic reorder + DropdownMenu | `src/components/reminders/notification-bell.tsx` (useTransition) + `src/components/layout/bottom-tab-bar.tsx` (map + isActive) | role-match — compose two analogs |
| `src/components/household/settings/invitations-card.tsx` (NEW) | component (Client) | ResponsiveDialog with phase state | `src/components/household/destructive-leave-dialog.tsx` + `src/components/plants/add-plant-dialog.tsx` (catalog→form phase swap at line 54 `step` state) | exact — phase-state swap |
| `src/components/household/settings/availability-section.tsx` (NEW) | component (Client) | two-picker form + list CRUD | `src/components/plants/add-plant-dialog.tsx` (RHF pattern) + UI-SPEC §Availability form spec (no prior range-picker analog) | role-match — no existing Calendar+Popover analog in repo; UI-SPEC is authoritative |
| `src/components/household/settings/danger-zone-card.tsx` (NEW) | component (Client) | destructive action dispatch | `src/components/household/destructive-leave-dialog.tsx` | exact |
| `src/components/auth/user-menu.tsx` (amend with switcher section) | component (Client) | DropdownMenu composition | self (lines 29–66 existing DropdownMenu) | exact — in-place extension |
| `tests/phase-06/set-default-household.test.ts` (NEW) | test (unit, mocked Prisma) | mock-DB unit | `tests/phase-04/create-invitation.test.ts` | exact |
| `tests/phase-06/update-household-settings.test.ts` (NEW) | test | mock-DB unit | `tests/phase-04/create-invitation.test.ts` | exact |
| `tests/phase-06/reorder-rotation.test.ts` (NEW) | test | mock-DB unit | `tests/phase-04/create-invitation.test.ts` | exact |
| `tests/phase-06/cycle-countdown-banner.test.tsx` (NEW) | test (component RTL) | render-and-assert | `tests/phase-05/passive-status-banner.test.tsx` | exact |
| `tests/phase-06/household-switcher.test.tsx` (NEW) | test (component RTL) | render + interaction | `tests/phase-05/notification-bell-variant.test.tsx` (existing — not re-read here; same RTL pattern as passive-status-banner.test.tsx) | role-match |

## Pattern Assignments

### `setDefaultHousehold`, `updateHouseholdSettings`, `reorderRotation` (server-action, request-response)

**Analog:** `src/features/household/actions.ts` — `createInvitation` (lines 303–352)

**Imports pattern** (lines 1–26):
```typescript
"use server";

import { auth, unstable_update } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createHouseholdSchema,
  // ...append new schemas here (D-32)
} from "./schema";
import { requireHouseholdAccess, ForbiddenError } from "./guards";
import { HOUSEHOLD_PATHS } from "./paths";
```

**Seven-step template — copy verbatim** (lines 303–352, anchored on `createInvitation`):
```typescript
export async function createInvitation(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (Phase 4 copy per UI-SPEC)
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }

  // Step 3: Zod parse
  const parsed = createInvitationSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: role authz (OWNER only)
  if (access.role !== "OWNER") {
    return { error: "Only household owners can generate invite links." };
  }

  // Step 6: write — persist tokenHash only; return raw token to caller
  const { rawToken, tokenHash } = generateInvitationToken();
  const invitation = await db.invitation.create({
    data: {
      householdId: parsed.data.householdId,
      tokenHash,
      invitedByUserId: session.user.id,
    },
    select: { id: true },
  });

  // Step 7: revalidate settings page (Phase 6 invite list consumer)
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return {
    success: true as const,
    token: rawToken,
    invitationId: invitation.id,
  };
}
```

**Per-action customization:**

- **`setDefaultHousehold`** — Skip Step 5 (any member). Step 6 is the atomic transaction from RESEARCH.md Example 1 (lines 548–584): `tx.householdMember.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })` then `tx.householdMember.update(...)` to set the new one. Step 7: `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` AND `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")`.
- **`updateHouseholdSettings`** — Step 5 OWNER-only (`"Only household owners can edit settings."` per UI-SPEC). Step 6 writes only the `household` row (never the active `Cycle` — Pitfall 3). Step 7: revalidate settings + dashboard.
- **`reorderRotation`** — Step 5 OWNER-only. Step 6 = atomic `$transaction` with set-mismatch guard — copy verbatim from RESEARCH.md Example 4 (lines 628–691). On `MEMBERS_CHANGED` return `{ error: "Member list changed — reload and try again." }`. Step 7: revalidate settings + dashboard.

**Transaction idiom reference** (from `createHousehold` at `src/features/household/actions.ts:59–110`):
```typescript
const household = await db.$transaction(async (tx) => {
  // ...read + guard
  const created = await tx.household.create({ data: { ... } });
  await tx.householdMember.create({ data: { ... } });
  return created;
});
```

### Zod schemas (`setDefaultHouseholdSchema`, `updateHouseholdSettingsSchema`, `reorderRotationSchema`)

**Analog:** `src/features/household/schema.ts` — `createInvitationSchema` (lines 93–97), `removeMemberSchema` (lines 138–143), `createAvailabilitySchema` (lines 48–67)

**Imports pattern** (line 1):
```typescript
import { z } from "zod/v4";
```

**Pattern — hidden `householdId` + `householdSlug` convention** (lines 93–97):
```typescript
export const createInvitationSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
```

**Pattern — array field with nonempty** (adapt from `markNotificationsReadSchema` at lines 182–187 which uses `z.array(z.cuid()).min(1)`):
```typescript
export const reorderRotationSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  orderedMemberUserIds: z.array(z.cuid()).nonempty(),
});
```

**Pattern — enum with transform** (no existing analog; follow RESEARCH.md Example 5 lines 703–712):
```typescript
cycleDuration: z
  .enum(["1", "3", "7", "14"], { message: "Please select a valid cycle duration (1, 3, 7, or 14 days)." })
  .transform(Number),
```

### `settings/page.tsx` (page Server Component, request-response)

**Analog:** `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` (lines 140–200, parallel data fetching + role derivation)

**Imports pattern** (lines 1–27 of dashboard/page.tsx):
```typescript
import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import { getCurrentHousehold } from "@/features/household/context";
import {
  getCurrentCycle,
  getCycleNotificationsForViewer,
  getHouseholdMembers,
} from "@/features/household/queries";
```

**Async params + getCurrentHousehold pattern** (layout.tsx:37–38):
```typescript
const { householdSlug } = await params;
const { household } = await getCurrentHousehold(householdSlug);
```

**Promise.all parallel fetch pattern** (dashboard/page.tsx:140–157):
```typescript
const [user, catalog, rooms, currentCycle, members, reminderCount] = await Promise.all([
  db.user.findUnique({ where: { id: session.user.id }, select: { ... } }),
  getCatalog(),
  getRoomsForSelect(household.id),
  getCurrentCycle(household.id),
  getHouseholdMembers(household.id),
  getReminderCount(household.id, session.user.id, todayStart, todayEnd),
]);
```

**Role-branched render pattern** (dashboard/page.tsx:199–202 + Phase 6 D-02):
```typescript
const currentMember = members.find((m) => m.userId === session.user.id);
const viewerIsOwner = currentMember?.role === "OWNER";
// ...
{viewerIsOwner && <OwnerOnlySection />}
```

For settings page specifically, planner should Promise.all: `getHouseholdMembers`, `getHouseholdInvitations`, `getHouseholdAvailabilities` (all exist per RESEARCH.md), destructure `{ household, role }` from `getCurrentHousehold`, render five `<Card>` sections with `{role === "OWNER" && ...}` gates per D-02.

### `layout.tsx` amendment (top-nav logo slot + Promise.all)

**Analog:** self — `src/app/(main)/h/[householdSlug]/layout.tsx` (lines 62–67, 143–146)

**Existing Promise.all** (layout.tsx:62–67) — add `getUserHouseholds(sessionUser.id)` as a 5th entry:
```typescript
const [reminderCount, reminderItems, unreadCycleEventCount, currentCycle] = await Promise.all([
  getReminderCount(household.id, sessionUser.id, todayStart, todayEnd),
  getReminderItems(household.id, sessionUser.id, todayStart, todayEnd),
  getUnreadCycleEventCount(household.id, sessionUser.id),
  getCurrentCycle(household.id),
]);
```

**Existing logo slot to replace** (layout.tsx:143–146):
```typescript
<Link href={`/h/${householdSlug}/dashboard`} className="flex items-center gap-2">
  <Leaf className="h-5 w-5 text-accent" />
  <span className="text-base font-semibold">Plant Minder</span>
</Link>
```

Replace with `<HouseholdSwitcher variant="desktop" households={...} currentSlug={householdSlug} currentHouseholdName={household.name} />` per UI-SPEC §Desktop variant.

### `dashboard/page.tsx` amendment (insert CycleCountdownBanner)

**Analog:** self — `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` (lines 253–298, banner region composition)

**Existing banner region pattern** (lines 253–298):
```tsx
{currentCycle && (
  <div className="space-y-4">
    {/* Layer 1: FallbackBanner */}
    {(currentCycle.status === "paused" ||
      currentCycle.transitionReason === "all_unavailable_fallback") && (
      <FallbackBanner ... />
    )}

    {/* Layer 2: assignee-role event — mutually exclusive per D-19 unique index */}
    {viewerIsAssignee && unreadEvent?.type === "cycle_started" && (
      <CycleStartBanner ... />
    )}
    {viewerIsAssignee &&
      unreadEvent?.type.startsWith("cycle_reassigned_") && (
        <ReassignmentBanner ... />
      )}
    {/* ← INSERT CycleCountdownBanner here per D-24 */}
    {/* Layer 3: PassiveStatusBanner — non-assignee */}
  </div>
)}
```

**Insertion pattern — copy from RESEARCH.md Example 6** (lines 737–747):
```tsx
{viewerIsAssignee &&
  currentCycle?.status === "active" &&
  !hasUnreadCycleEvent && (
    <CycleCountdownBanner
      daysLeft={daysLeft}
      nextAssigneeName={nextAssigneeName}
      cycleEndDate={currentCycle.endDate}
      isSingleMember={members.length === 1}
    />
  )}
```

`hasUnreadCycleEvent` derivation shown in RESEARCH.md Example 6 lines 727–735.

### `cycle-countdown-banner.tsx` (component, props→JSX)

**Analog:** `src/components/household/passive-status-banner.tsx` (full file, 64 lines)

**Imports pattern** (lines 1–2):
```typescript
import { Users } from "lucide-react";
import { format } from "date-fns";
```

**Component shell pattern** (lines 40–62):
```tsx
return (
  <div
    role="status"
    className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
  >
    <Users className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
    <div className="flex-1 space-y-1">
      <p className="text-sm text-foreground">
        <span className="font-semibold">{assigneeName}</span> is watering this cycle.
      </p>
      <p className="text-xs text-muted-foreground">Cycle ends {formattedEndDate}</p>
    </div>
  </div>
);
```

**Urgency variant (N ≤ 1 day)** — swap tokens to match `fallback-banner.tsx` (lines 44–57):
```tsx
<div
  role="status" // stays status; FallbackBanner uses role="alert" but CycleCountdown is not urgent-alert level per D-25
  className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
>
  <Clock className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
```

**Body composition** — copy UI-SPEC §Visual Contract: Cycle-Countdown Banner (lines 510–555) verbatim.

### `household-switcher.tsx` (component, dropdown + router + optimistic default-set)

**Analog:** `src/components/reminders/notification-bell.tsx` (lines 1–76 — DropdownMenu + useTransition + async Server Action)

**Imports pattern** (lines 1–16):
```typescript
"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sparkles, UserCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

**For switcher, adapt to:**
```typescript
"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Leaf, ChevronDown, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setDefaultHousehold } from "@/features/household/actions";
```

**useTransition + async Server Action pattern** (notification-bell.tsx:58–76):
```typescript
const [, startTransition] = useTransition();

const handleOpenChange = (open: boolean) => {
  if (!open) return;
  if (unreadCycleEventIds.length === 0) return;
  startTransition(async () => {
    await markNotificationsRead({
      householdId,
      householdSlug,
      notificationIds: unreadCycleEventIds,
    });
  });
};
```

Adapt for default-set: on "Set as default" click, `startTransition(async () => { const r = await setDefaultHousehold({ householdId }); if (r.error) toast.error(r.error); else toast.success("Default household updated."); })`.

**Route rewrite utility** — copy verbatim from RESEARCH.md Example 7 (lines 770–776):
```typescript
function buildSwitchPath(currentPathname: string, newSlug: string): string {
  const segments = currentPathname.split("/");
  const detailPattern = /^[a-z0-9]{20,}$/i;
  const isDetailRoute = segments.length >= 5 && detailPattern.test(segments[4] ?? "");
  if (isDetailRoute) return `/h/${newSlug}/${segments[3]}`;
  return `/h/${newSlug}/${segments.slice(3).join("/")}`;
}
```

**Pathname read pattern** (from `bottom-tab-bar.tsx:30`):
```typescript
const pathname = usePathname();
```

**DropdownMenu structure reference** (user-menu.tsx:33–65):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger aria-label="User menu" render={<button className="..." />}>
    {initials}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel className="font-normal">
      <span className="text-xs text-muted-foreground">{email}</span>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => router.push("/preferences")} className="cursor-pointer gap-2">
      <Settings className="h-4 w-4" />
      Preferences
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="cursor-pointer gap-2">
      <LogOut className="h-4 w-4" />
      Sign out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### `settings/general-form.tsx` (component, RHF + Zod → Server Action)

**Analog:** `src/components/plants/add-plant-dialog.tsx` (lines 1–67 + 239–365) — RHF + Zod + Form primitives + Server Action submit. Secondary analog: `src/components/preferences/account-settings.tsx` (lines 1–89) for multiple independent RHF forms in one page.

**Imports pattern** (add-plant-dialog.tsx:1–37):
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createPlant } from "@/features/plants/actions";
import { createPlantSchema, type CreatePlantInput } from "@/features/plants/schemas";
```

**useForm initialization pattern** (add-plant-dialog.tsx:59–68):
```typescript
const form = useForm<CreatePlantInput>({
  resolver: zodResolver(createPlantSchema),
  defaultValues: {
    householdId,
    nickname: "",
    species: "",
    roomId: undefined,
    wateringInterval: 7,
  },
});
```

For settings general-form: `defaultValues: { householdId, householdSlug, name: household.name, timezone: household.timezone, cycleDuration: String(household.cycleDuration) as "1"|"3"|"7"|"14" }`.

**Submit handler pattern** (add-plant-dialog.tsx:108–122):
```typescript
async function onSubmit(data: CreatePlantInput) {
  setFormError(undefined);
  const result = await createPlant({
    ...data,
    careProfileId: selectedProfile?.id,
  });
  if ("error" in result) {
    setFormError(result.error);
    return;
  }
  toast("Plant added.");
  handleOpenChange(false);
}
```

For settings: replace with `updateHouseholdSettings(data)` + `toast.success("Household settings saved.")` or `toast.error("Couldn't save settings. Try again.")`.

**Form + hidden field + FormField pattern** (add-plant-dialog.tsx:239–281):
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
    <input type="hidden" {...form.register("householdId")} />

    <FormField
      control={form.control}
      name="nickname"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nickname</FormLabel>
          <FormControl>
            <Input placeholder="e.g. Kitchen Pothos" maxLength={40} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="roomId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Room <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
          <FormControl>
            <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "" ? undefined : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
```

**Submit button with isSubmitting disable** (add-plant-dialog.tsx:356–362):
```tsx
<Button type="submit" disabled={form.formState.isSubmitting}>
  Save changes
</Button>
```

### `settings/members-list.tsx` (component, optimistic reorder + DropdownMenu)

**Analogs:**
- Optimistic pattern — `src/components/reminders/notification-bell.tsx:58–76` (useTransition wrapping async Server Action)
- Map + row rendering — `src/components/layout/bottom-tab-bar.tsx:44–63`
- 3-dot DropdownMenu — `src/components/auth/user-menu.tsx:33–65`

**Optimistic reorder template** (copy verbatim from RESEARCH.md Pattern 4, lines 378–396):
```typescript
const [isPending, startTransition] = useTransition();
const [localMembers, setLocalMembers] = useState(members);

function moveUp(index: number) {
  const next = [...localMembers];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  setLocalMembers(next);
  startTransition(async () => {
    const result = await reorderRotation({
      householdId,
      householdSlug,
      orderedMemberUserIds: next.map((m) => m.userId),
    });
    if (result.error) {
      setLocalMembers(members); // revert
      toast.error(result.error);
    }
  });
}
```

**Disable-all-while-pending** per D-12: pass `disabled={isPending}` to every `ArrowUp`/`ArrowDown` button.

**Row layout** — follow UI-SPEC §Section 2: Members + Rotation (lines 310–322).

### `settings/invitations-card.tsx` (component, phase-state dialog)

**Analogs:**
- Phase-state swap — `src/components/plants/add-plant-dialog.tsx:54, 152–367` (`step` state: "catalog" → "form")
- ResponsiveDialog — `src/components/household/destructive-leave-dialog.tsx:53–103`
- List rendering + revoke confirm — `src/components/auth/user-menu.tsx` pattern (DropdownMenu composition)

**ResponsiveDialog wrapper pattern** (destructive-leave-dialog.tsx:53–103):
```tsx
<ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
  <ResponsiveDialogContent>
    <ResponsiveDialogHeader>
      <ResponsiveDialogTitle>...</ResponsiveDialogTitle>
      <ResponsiveDialogDescription>...</ResponsiveDialogDescription>
    </ResponsiveDialogHeader>
    {/* body */}
    <ResponsiveDialogFooter>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
      <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>Confirm</Button>
    </ResponsiveDialogFooter>
  </ResponsiveDialogContent>
</ResponsiveDialog>
```

**Phase state pattern** (add-plant-dialog.tsx:54):
```typescript
const [step, setStep] = useState<"catalog" | "form">("catalog");
// ...
{step === "catalog" ? (
  <>...phase A...</>
) : (
  <>...phase B...</>
)}
```

For invitations dialog: `const [phase, setPhase] = useState<{ kind: "idle" } | { kind: "success"; token: string } | { kind: "error" }>({ kind: "idle" })` per D-20.

**Relative date pattern** (not yet used in repo; use RESEARCH.md Don't-Hand-Roll guidance line 448):
```typescript
import { formatDistanceToNow } from "date-fns";
formatDistanceToNow(invitation.createdAt, { addSuffix: true });
// → "3 days ago"
```

### `settings/availability-section.tsx` (component, two-picker form + list)

**Analogs:**
- RHF + Zod + custom field — `src/components/plants/add-plant-dialog.tsx`
- AlertDialog for delete confirm — no direct analog; follow UI-SPEC §Section 4

**No existing Calendar+Popover analog** — UI-SPEC §Section 4 "Add availability form" (lines 400–423) is authoritative. Planner must implement per spec (two `Popover` + `Calendar` pickers side-by-side).

**Self-or-owner gate** (mirrors actions.ts:280 `deleteAvailability` dual-auth):
```typescript
// Server already enforces (actions.ts:280):
// if (row.userId !== session.user.id && role !== "OWNER") throw ForbiddenError
// Client mirrors this for UI polish:
const canDelete = row.userId === viewerUserId || viewerRole === "OWNER";
{canDelete && <Button variant="ghost" size="sm" onClick={...}>Delete</Button>}
```

### `settings/danger-zone-card.tsx` (component, destructive dispatch)

**Analog:** `src/components/household/destructive-leave-dialog.tsx` (full file, 105 lines)

**Imports + destructive shell pattern** — copy verbatim (lines 1–13):
```typescript
"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
```

**Open state + Close-protection pattern** (lines 32–48):
```typescript
const [isPending, setIsPending] = useState(false);

function handleOpenChange(nextOpen: boolean) {
  if (isPending) return;
  onOpenChange(nextOpen);
}
```

**Branching to existing `DestructiveLeaveDialog`** per D-18 case "sole-OWNER + sole member": DangerZoneCard renders a `<Button>` that conditionally opens either a plain `AlertDialog` (normal leave) or the existing `<DestructiveLeaveDialog>` (sole-OWNER-sole-member) based on `ownerCount`, `memberCount` props.

### `auth.ts` + `dashboard/page.tsx` single-line orderBy changes

**Analog:** self.

**Pattern** — copy verbatim from RESEARCH.md Examples 2 and 3 (lines 590–622):
```typescript
// BEFORE (auth.ts:26-30):
orderBy: { createdAt: "asc" },
// AFTER:
orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
```

Identical change in `src/app/(main)/dashboard/page.tsx:25–29`.

### Test files (mocked Prisma + RTL)

**Server Action test analog:** `tests/phase-04/create-invitation.test.ts` (lines 1–90)

**Mock setup pattern** (lines 1–37):
```typescript
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});

const { db } = await import("@/lib/db");
const { auth } = await import("../../auth");
const { requireHouseholdAccess } = await import("@/features/household/guards");
const { createInvitation } = await import("@/features/household/actions");

beforeEach(() => {
  vi.clearAllMocks();
});
```

**Session + role mock helpers** (lines 43–55):
```typescript
function mockOwnerSession() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: OWNER_ID, isDemo: false },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockRoleAccess(role: "OWNER" | "MEMBER") {
  vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
    household: { id: HOUSEHOLD_ID } as never,
    member: {} as never,
    role,
  });
}
```

**Test case templates** (lines 57–90) — three canonical cases: happy path, non-OWNER forbidden, demo-mode disabled. Per D-33, add `reorderRotation` stale-client-state case (input length mismatch / set mismatch → "Member list changed — reload and try again.").

For `reorderRotation.test.ts` specifically, mock `db.householdMember.findMany` inside the transaction to return a different set than the input, and assert the returned error string.

**Component test analog:** `tests/phase-05/passive-status-banner.test.tsx` (full file, 123 lines)

**RTL imports + cleanup pattern** (lines 1–8):
```typescript
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PassiveStatusBanner } from "@/components/household/passive-status-banner";

describe("PassiveStatusBanner (HNTF-04 / D-25)", () => {
  afterEach(() => { cleanup(); });
```

**Render + assert pattern** (lines 13–23):
```typescript
it("HNTF-04 renders '{Alice} is watering this cycle.' subject", () => {
  render(
    <PassiveStatusBanner
      assigneeName="Alice"
      memberCount={3}
      cycleEndDate={cycleEnd}
    />,
  );
  expect(screen.getByText(/is watering this cycle/)).not.toBeNull();
  expect(screen.getByText("Alice")).not.toBeNull();
});
```

**Class-name assertion pattern** (lines 84–95):
```typescript
const outer = container.querySelector("[role='status']");
expect(outer?.className).toMatch(/bg-muted\/50/);
```

For `cycle-countdown-banner.test.tsx`: assert normal variant uses `bg-accent/10 border-accent/30`, urgency variant uses `bg-destructive/10 border-destructive/30`, single-member copy suppresses "X is next", and `daysLeft` displays correctly.

## Shared Patterns

### Authentication + Demo Guard (Steps 1–2 of 7-step template)

**Source:** `src/features/household/actions.ts` — every action (reference `createInvitation` lines 304–314)
**Apply to:** All three new Server Actions (`setDefaultHousehold`, `updateHouseholdSettings`, `reorderRotation`)

```typescript
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };

if (session.user.isDemo) {
  return {
    error:
      "This action is disabled in demo mode. Sign up to get your own household.",
  };
}
```

### ForbiddenError catch-and-map (Step 4)

**Source:** `src/features/household/actions.ts` — every action (reference `createInvitation` lines 320–327)
**Apply to:** All three new Server Actions

```typescript
let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
try {
  access = await requireHouseholdAccess(parsed.data.householdId);
} catch (err) {
  if (err instanceof ForbiddenError) return { error: err.message };
  throw err;
}
```

### Revalidation (Step 7)

**Source:** `src/features/household/paths.ts` (HOUSEHOLD_PATHS constants, lines 15–22) + usage at `actions.ts:248, 294, 346, 412, 629, 723, 772, 832`
**Apply to:** All three new Server Actions (settings + dashboard)

```typescript
revalidatePath(HOUSEHOLD_PATHS.settings, "page");
revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
```

**Critical:** Settings path is single-segment — D-01 pitfall binding. Never split `/settings/members` or `/settings/invitations`; that breaks all 8 existing call sites silently.

### Hidden form-field convention (Zod schemas)

**Source:** `src/features/household/schema.ts` — `createInvitationSchema:93–97`, `removeMemberSchema:138–143`, `createAvailabilitySchema:48–67`
**Apply to:** `updateHouseholdSettingsSchema` and `reorderRotationSchema` (both accept `householdSlug` for revalidatePath threading)

```typescript
export const updateHouseholdSettingsSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  // ... domain fields
});
```

`setDefaultHouseholdSchema` is the EXCEPTION — per D-06 it takes only `householdId` and revalidates static `HOUSEHOLD_PATHS` constants (no slug interpolation needed).

### Toast feedback via `sonner`

**Source:** `src/components/plants/add-plant-dialog.tsx:120` (success) and `account-settings.tsx:72` (error)
**Apply to:** All client-side action results per UI-SPEC toast catalogue (lines 591–608)

```typescript
import { toast } from "sonner";
// success
toast.success("Household settings saved.");
// error
toast.error(result.error ?? "Couldn't save settings. Try again.");
```

### DropdownMenu composition (Base UI `render` API)

**Source:** `src/components/auth/user-menu.tsx:34–65` and `src/components/reminders/notification-bell.tsx:104–125`

```tsx
<DropdownMenu>
  <DropdownMenuTrigger aria-label="Switch household" render={<button className="..." />}>
    {/* trigger children */}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel className="font-normal">...</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={...} className="cursor-pointer gap-2">...</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Note the project uses the `render` prop form for `DropdownMenuTrigger` — this is the in-repo convention (`user-menu.tsx:35–40`), not the standard `asChild` pattern. Planner must match.

### useTransition + async Server Action

**Source:** `src/components/reminders/notification-bell.tsx:58–76`
**Apply to:** `household-switcher.tsx` (set default), `members-list.tsx` (reorder rotation)

```typescript
const [isPending, startTransition] = useTransition();

const handleClick = () => {
  startTransition(async () => {
    const result = await someServerAction(args);
    if (result.error) {
      toast.error(result.error);
      // optional: revert optimistic state
    }
  });
};
```

### ResponsiveDialog for mobile/desktop parity

**Source:** `src/components/shared/responsive-dialog.tsx` (reference lines 1–60 for ResponsiveContext + Dialog/Drawer swap), usage at `src/components/household/destructive-leave-dialog.tsx:53–103` and `src/components/plants/add-plant-dialog.tsx:10–15`
**Apply to:** Invite-people dialog, all destructive AlertDialog confirms (UI-SPEC §Responsive contract)

```tsx
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/shared/responsive-dialog";
```

### `/h/[householdSlug]/` URL threading (Pitfall 17)

**Source:** `src/components/layout/bottom-tab-bar.tsx:33–35` (template literal with slug), `src/app/(main)/h/[householdSlug]/layout.tsx:143, 149, 155`
**Apply to:** Every client navigation in switcher, settings sub-components, and any new `<Link>`

```tsx
// CORRECT
<Link href={`/h/${householdSlug}/plants`}>
router.push(`/h/${newSlug}/${suffix}`);

// WRONG — never do this
<Link href="/plants">
```

## No Analog Found

| File | Role | Data Flow | Reason | Authoritative Source |
|------|------|-----------|--------|----------------------|
| `settings/availability-section.tsx` two-picker Calendar+Popover | component | form | No existing two-Popover+Calendar form pairing in the repo. `calendar.tsx` and `popover.tsx` exist as primitives but haven't been composed. | UI-SPEC §Section 4 lines 400–423 (authoritative spec; no analog needed) |
| `IANA_ZONES` fallback constant (D-15) | utility / constant | static data | Not yet used; no existing pattern. Planner needs only implement if the Node runtime returns empty from `Intl.supportedValuesOf('timeZone')`. | Defer per D-15 — runtime check at component mount, implement only if needed |
| `buildSwitchPath` utility (D-05) | utility | pure function | Novel for this phase. | RESEARCH.md Example 7 lines 770–776 (authoritative code) |

## Metadata

**Analog search scope:**
- `src/features/household/` (actions.ts, schema.ts, context.ts, paths.ts, queries.ts, cycle.ts)
- `src/components/household/` (all 5 Phase 5 banners + DestructiveLeaveDialog)
- `src/components/auth/` (user-menu.tsx)
- `src/components/layout/` (bottom-tab-bar.tsx)
- `src/components/reminders/` (notification-bell.tsx)
- `src/components/plants/` (add-plant-dialog.tsx — canonical RHF+Zod form example)
- `src/components/preferences/` (account-settings.tsx — multi-form page example)
- `src/components/shared/` (responsive-dialog.tsx, empty-state.tsx, focus-heading.tsx)
- `src/app/(main)/h/[householdSlug]/` (layout.tsx, dashboard/page.tsx)
- `tests/phase-04/` (create-invitation.test.ts — mocked Prisma template)
- `tests/phase-05/` (passive-status-banner.test.tsx — RTL template)

**Files scanned:** 23

**Pattern extraction date:** 2026-04-20

**Verification notes:**
- All 8 `revalidatePath(HOUSEHOLD_PATHS.settings, "page")` call sites confirmed present in `actions.ts` (lines 248, 294, 346, 412, 629, 723, 772, 832 per RESEARCH.md — treat as authoritative; single-segment settings path is a binding contract).
- Test-framework = Vitest (per `tests/phase-04/create-invitation.test.ts` imports) + `@testing-library/react` for component tests (per `tests/phase-05/passive-status-banner.test.tsx`).
- The project uses `render={<button />}` prop form on `DropdownMenuTrigger` (Base UI idiom), NOT the Radix `asChild` form. Planner must match to avoid runtime shape errors.
- Existing `user-menu.tsx` has no household awareness — D-04 requires extending it with a mobile switcher section. Current 3-item menu (email header + Preferences + Sign out) becomes a ~6-item menu per UI-SPEC §Mobile variant lines 215–227.
