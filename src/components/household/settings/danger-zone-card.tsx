"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/shared/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DestructiveLeaveDialog } from "@/components/household/destructive-leave-dialog";
import {
  leaveHousehold,
  createHousehold,
} from "@/features/household/actions";

interface DangerZoneCardProps {
  viewerRole: "OWNER" | "MEMBER";
  viewerUserId: string;
  householdId: string;
  householdSlug: string;
  householdName: string;
  plantCount: number;
  roomCount: number;
  ownerCount: number;
  memberCount: number;
}

export function DangerZoneCard({
  viewerRole,
  householdId,
  householdSlug,
  householdName,
  plantCount,
  roomCount,
  ownerCount,
  memberCount,
}: DangerZoneCardProps) {
  const [isLeaving, startLeaveTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();

  // Sole-OWNER: viewer is OWNER and exactly one OWNER total in the household.
  const isSoleOwner = viewerRole === "OWNER" && ownerCount === 1;
  const isSoleMember = memberCount === 1;

  // DestructiveLeaveDialog is opened by DangerZoneCard for the sole-OWNER +
  // sole-member branch — it's the same Phase 4 dialog, mounted with open state
  // and onConfirm wired to leaveHousehold.
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  async function handleDestructiveConfirm() {
    const result = await leaveHousehold({ householdId, householdSlug });
    if ("error" in result) {
      toast.error(result.error ?? "Couldn't leave the household. Try again.");
      return;
    }
    // Server redirect / revalidate flow handles navigation; close locally.
    setDestructiveOpen(false);
  }

  function handleNormalLeave() {
    startLeaveTransition(async () => {
      const result = await leaveHousehold({ householdId, householdSlug });
      if ("error" in result) {
        toast.error(result.error ?? "Couldn't leave the household. Try again.");
      }
    });
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (trimmed.length === 0) return;
    startCreateTransition(async () => {
      const result = await createHousehold({ name: trimmed });
      if ("error" in result) {
        toast.error(result.error ?? "Couldn't create household. Try again.");
        return;
      }
      toast.success("Household created.");
      setCreateOpen(false);
      setNewName("");
    });
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-destructive">
          Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leave household row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Leave {householdName}
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll lose access to this household.
            </p>
          </div>
          <div className="shrink-0">
            {isSoleOwner && isSoleMember ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDestructiveOpen(true)}
                >
                  Leave household
                </Button>
                <DestructiveLeaveDialog
                  open={destructiveOpen}
                  onOpenChange={setDestructiveOpen}
                  householdName={householdName}
                  plantCount={plantCount}
                  roomCount={roomCount}
                  onConfirm={handleDestructiveConfirm}
                />
              </>
            ) : isSoleOwner ? (
              <TooltipProvider>
                <Tooltip>
                  {/* Tooltip-on-disabled-button: the span wrapper lets mouse
                      events fire, because disabled buttons do not. Base UI
                      Trigger components accept a `render=` prop (verified
                      against src/components/ui/tooltip.tsx wrapping
                      Primitive.Trigger.Props). */}
                  <TooltipTrigger render={<span><Button variant="destructive" size="sm" disabled>Leave household</Button></span>} />
                  <TooltipContent>Transfer ownership first</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="destructive" size="sm">Leave household</Button>} />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Leave {householdName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      You&apos;ll lose access to this household and its
                      plants. You can rejoin using an invite link if the
                      owner sends one.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLeaving}>
                      Stay
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleNormalLeave}
                      disabled={isLeaving}
                    >
                      Leave household
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Create new household row */}
        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Create a new household
            </p>
            <p className="text-xs text-muted-foreground">
              Start a new household and become its owner.
            </p>
          </div>
          <div className="shrink-0">
            <ResponsiveDialog
              open={createOpen}
              onOpenChange={(next) => {
                if (isCreating) return;
                setCreateOpen(next);
                if (!next) setNewName("");
              }}
            >
              <ResponsiveDialogTrigger render={<Button variant="outline" size="sm">Create household</Button>} />
              <ResponsiveDialogContent>
                <ResponsiveDialogHeader>
                  <ResponsiveDialogTitle>
                    Create a new household
                  </ResponsiveDialogTitle>
                  <ResponsiveDialogDescription>
                    Start a new household and become its owner.
                  </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <form
                  onSubmit={handleCreateSubmit}
                  className="space-y-4 px-4 sm:px-0"
                >
                  <div className="space-y-2">
                    <Label htmlFor="new-household-name">Household name</Label>
                    <Input
                      id="new-household-name"
                      maxLength={80}
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="e.g. Home, Office, Studio"
                      autoFocus
                    />
                  </div>
                  <ResponsiveDialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (isCreating) return;
                        setCreateOpen(false);
                        setNewName("");
                      }}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreating || newName.trim().length === 0}
                    >
                      {isCreating ? "Creating..." : "Create household"}
                    </Button>
                  </ResponsiveDialogFooter>
                </form>
              </ResponsiveDialogContent>
            </ResponsiveDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
