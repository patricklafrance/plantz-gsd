"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  demoteToMember,
  promoteToOwner,
  removeMember,
  reorderRotation,
} from "@/features/household/actions";

/**
 * Row contract for the members list. Caller (Plan 07 settings page) pre-sorts
 * by rotationOrder ASC — this component trusts that order (ROTA-01 / D-11).
 */
export type MemberRow = {
  userId: string;
  userName: string | null;
  userEmail: string;
  role: "OWNER" | "MEMBER";
  rotationOrder: number;
};

interface MembersListProps {
  members: MemberRow[];
  viewerUserId: string;
  viewerRole: "OWNER" | "MEMBER";
  householdId: string;
  householdSlug: string;
  householdName: string;
  ownerCount: number;
}

/**
 * OWNER-only up/down reorder with optimistic local state; role-conditional
 * 3-dot menu exposing promote / demote / remove actions. The self-row 3-dot
 * menu deliberately does NOT surface a leave action — DangerZoneCard
 * (Plan 05a) owns self-departure exclusively (warning #7 split lock).
 */
export function MembersList({
  members,
  viewerUserId,
  viewerRole,
  householdId,
  householdSlug,
  householdName,
  ownerCount,
}: MembersListProps) {
  const [localMembers, setLocalMembers] = useState<MemberRow[]>(members);
  const [isPending, startTransition] = useTransition();

  // Local open state for each dialog variant. We render AlertDialogs OUTSIDE
  // the DropdownMenu (portalled from both) so the DropdownMenuItem's onClick
  // just flips a boolean — avoids any composition coupling between Base UI
  // DropdownMenu's close-on-item-click and AlertDialog's trigger wiring.
  //
  // `target` holds the row the dialog is acting on (displayName + userId).
  type DialogTarget = { userId: string; displayName: string };
  const [promoteTarget, setPromoteTarget] = useState<DialogTarget | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<DialogTarget | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DialogTarget | null>(null);

  function moveRow(index: number, direction: -1 | 1) {
    const swap = index + direction;
    if (swap < 0 || swap >= localMembers.length) return;
    const next = [...localMembers];
    [next[index], next[swap]] = [next[swap], next[index]];
    setLocalMembers(next);
    startTransition(async () => {
      const result = await reorderRotation({
        householdId,
        householdSlug,
        orderedMemberUserIds: next.map((m) => m.userId),
      });
      if ("error" in result) {
        // Revert to the server-authoritative order the caller handed us.
        setLocalMembers(members);
        toast.error(result.error);
      }
    });
  }

  async function handlePromoteConfirm(target: DialogTarget) {
    const result = await promoteToOwner({
      householdId,
      householdSlug,
      targetUserId: target.userId,
    });
    setPromoteTarget(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    // localMembers is seeded once from props (useState), so revalidatePath on
    // the server doesn't reach this client state. Mirror the role flip locally
    // so the row updates without a manual refresh.
    setLocalMembers((prev) =>
      prev.map((m) =>
        m.userId === target.userId ? { ...m, role: "OWNER" } : m,
      ),
    );
    toast.success(`${target.displayName} is now an owner.`);
  }

  async function handleDemoteConfirm(target: DialogTarget) {
    const result = await demoteToMember({
      householdId,
      householdSlug,
      targetUserId: target.userId,
    });
    setDemoteTarget(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setLocalMembers((prev) =>
      prev.map((m) =>
        m.userId === target.userId ? { ...m, role: "MEMBER" } : m,
      ),
    );
    toast.success(`${target.displayName} is no longer an owner.`);
  }

  async function handleRemoveConfirm(target: DialogTarget) {
    const result = await removeMember({
      householdId,
      householdSlug,
      targetUserId: target.userId,
    });
    setRemoveTarget(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setLocalMembers((prev) => prev.filter((m) => m.userId !== target.userId));
    toast.success(`${target.displayName} has been removed.`);
  }

  const total = localMembers.length;

  return (
    <TooltipProvider>
      <ul className="divide-y divide-border">
        {localMembers.map((member, index) => {
          const displayName = member.userName ?? member.userEmail;
          const isSelf = member.userId === viewerUserId;
          const viewerIsOwner = viewerRole === "OWNER";
          const targetIsOwner = member.role === "OWNER";

          // D-18 matrix: which menu items does this row expose?
          // Self row: NO self-departure action — DangerZoneCard owns that.
          // OWNER viewer on MEMBER row: Make owner + Remove from household.
          // OWNER viewer on co-OWNER row: Remove from owners + Remove from household.
          // MEMBER viewer on non-self row: NO menu at all.
          // MEMBER viewer on self row: NO menu (Leave lives in DangerZoneCard).
          const canShowMakeOwner = viewerIsOwner && !targetIsOwner;
          const canShowRemoveFromOwners =
            viewerIsOwner && targetIsOwner && !isSelf;
          const canShowRemoveFromHousehold = viewerIsOwner && !isSelf;
          const menuHasItems =
            canShowMakeOwner ||
            canShowRemoveFromOwners ||
            canShowRemoveFromHousehold;

          const roleLabel = targetIsOwner ? "OWNER" : "MEMBER";
          // UI-SPEC audited fallback pair (both use bg-muted; color contrast
          // upgrade to amber for OWNER deferred to Plan 07 UAT).
          const rolePillClass = targetIsOwner
            ? "bg-muted text-foreground text-xs px-1.5 py-0.5 rounded"
            : "bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded";

          return (
            <li
              key={member.userId}
              className="flex items-center gap-2 py-2"
              data-testid={`member-row-${member.userId}`}
            >
              {/* Rotation-order prefix — fixed 6-unit column. */}
              <span className="w-6 text-xs font-semibold text-muted-foreground">
                [{member.rotationOrder}]
              </span>

              <span className="flex-1 text-sm font-semibold text-foreground truncate">
                {displayName}
              </span>

              <span className={rolePillClass}>{roleLabel}</span>

              {viewerIsOwner && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${displayName} up`}
                    className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                    disabled={index === 0 || isPending}
                    onClick={() => moveRow(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${displayName} down`}
                    className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                    disabled={index === total - 1 || isPending}
                    onClick={() => moveRow(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {menuHasItems && (
                <DropdownMenu>
                  {/* Trigger uses Base UI project-standard render prop idiom (checker Blocker 1). */}
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${displayName}`} className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"><MoreHorizontal className="h-4 w-4" /></Button>} />
                  <DropdownMenuContent align="end">
                    {canShowMakeOwner && (
                      <DropdownMenuItem
                        onClick={() =>
                          setPromoteTarget({
                            userId: member.userId,
                            displayName,
                          })
                        }
                      >
                        Make owner
                      </DropdownMenuItem>
                    )}

                    {canShowRemoveFromOwners && (
                      <>
                        {ownerCount === 1 ? (
                          <Tooltip>
                            {/* Tooltip-on-disabled: span wrapper + Base UI render prop idiom (checker Blocker 1). */}
                            <TooltipTrigger render={<span><DropdownMenuItem disabled closeOnClick={false}>Demote to member</DropdownMenuItem></span>} />
                            <TooltipContent>
                              Need at least one owner
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              setDemoteTarget({
                                userId: member.userId,
                                displayName,
                              })
                            }
                          >
                            Demote to member
                          </DropdownMenuItem>
                        )}
                      </>
                    )}

                    {canShowRemoveFromHousehold && (
                      <DropdownMenuItem
                        onClick={() =>
                          setRemoveTarget({
                            userId: member.userId,
                            displayName,
                          })
                        }
                      >
                        Remove from household
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>

      {/* Promote AlertDialog — open/onOpenChange driven by local state. */}
      <AlertDialog
        open={promoteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPromoteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {promoteTarget?.displayName ?? "member"} an owner?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promoteTarget?.displayName ?? "This member"} will become an
              additional owner. To transfer solo ownership, demote yourself
              afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (promoteTarget) void handlePromoteConfirm(promoteTarget);
              }}
            >
              Make owner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote AlertDialog */}
      <AlertDialog
        open={demoteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDemoteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {demoteTarget?.displayName ?? "member"} from owners?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {demoteTarget?.displayName ?? "This member"} will become a
              regular member. They&apos;ll keep access to {householdName} and
              its plants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (demoteTarget) void handleDemoteConfirm(demoteTarget);
              }}
            >
              Demote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member AlertDialog (UI-SPEC §Section 2 verbatim copy). */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeTarget?.displayName ?? "member"} from{" "}
              {householdName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll lose access to the household and its plants. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep member</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removeTarget) void handleRemoveConfirm(removeTarget);
              }}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
