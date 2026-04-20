"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createInvitation,
  revokeInvitation,
} from "@/features/household/actions";

/**
 * Invitation row as surfaced by the settings page query. `token` is
 * intentionally absent — Phase 4 D-01 binding persists `tokenHash` only, so
 * the raw token is recoverable only at creation time (Phase B of the create
 * dialog) and NEVER for existing rows.
 */
export type InvitationRow = {
  id: string;
  createdAt: Date;
  creatorName: string | null;
};

interface InvitationsCardProps {
  invitations: InvitationRow[];
  householdId: string;
  householdSlug: string;
  householdName: string;
}

/**
 * Dialog phase state — Phase A (idle) → Phase B (success, token surfaced
 * once) → Phase C (error, Retry). Raw token lives in `phase` state only and
 * never leaves this component (no localStorage / URL / router.push).
 */
type DialogPhase =
  | { kind: "idle" }
  | { kind: "success"; token: string; invitationId: string }
  | { kind: "error"; message: string };

export function InvitationsCard({
  invitations,
  householdId,
  householdSlug,
  householdName,
}: InvitationsCardProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<DialogPhase>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    // Reset to idle when the dialog closes so a second open starts fresh
    // (prevents the raw token from leaking into a subsequent session).
    if (!next) setPhase({ kind: "idle" });
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createInvitation({ householdId, householdSlug });
      if ("error" in result) {
        setPhase({
          kind: "error",
          message:
            result.error ?? "Couldn't create an invite link. Try again.",
        });
        return;
      }
      setPhase({
        kind: "success",
        token: result.token,
        invitationId: result.invitationId,
      });
    });
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        "Link copied — share it with people you want to invite.",
      );
    } catch {
      toast.error(
        "Couldn't copy — try selecting and copying the link manually.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogTrigger render={<Button variant="default">Invite people</Button>} />
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Invite people to {householdName}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          {phase.kind === "idle" && (
            <>
              <ResponsiveDialogDescription>
                Anyone with the link can join this household. You can revoke
                it anytime.
              </ResponsiveDialogDescription>
              <ResponsiveDialogFooter>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending ? "Creating..." : "Create invite link"}
                </Button>
              </ResponsiveDialogFooter>
            </>
          )}

          {phase.kind === "success" && (
            <>
              <div className="space-y-2 px-4 sm:px-0">
                <label
                  htmlFor="invite-link-input"
                  className="text-xs text-muted-foreground"
                >
                  Invite link
                </label>
                <Input
                  id="invite-link-input"
                  readOnly
                  value={buildInviteUrl(phase.token)}
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(buildInviteUrl(phase.token))}
                >
                  Copy link
                </Button>
              </div>
              <ResponsiveDialogFooter>
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </ResponsiveDialogFooter>
            </>
          )}

          {phase.kind === "error" && (
            <>
              <p
                role="alert"
                className="text-sm text-destructive px-4 sm:px-0"
              >
                Couldn&apos;t create an invite link. Try again.
              </p>
              <ResponsiveDialogFooter>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending ? "Retrying..." : "Retry"}
                </Button>
              </ResponsiveDialogFooter>
            </>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active invitations yet.
        </p>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <ExistingInvitationRow
              key={invitation.id}
              invitation={invitation}
              householdId={householdId}
              householdSlug={householdSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Build the invite URL from the raw token. On the server (no `window`) we
 * fall back to a relative path — the component is "use client" so this only
 * trips during SSR hydration of the empty-state branch.
 */
function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/join/${token}`;
  return `${window.location.origin}/join/${token}`;
}

function ExistingInvitationRow({
  invitation,
  householdId,
  householdSlug,
}: {
  invitation: InvitationRow;
  householdId: string;
  householdSlug: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeInvitation({
        householdId,
        householdSlug,
        invitationId: invitation.id,
      });
      if ("error" in result) {
        toast.error(
          result.error ?? "Couldn't revoke this link. Try again.",
        );
        return;
      }
      toast.success("Invite link revoked.");
    });
  }

  const creator = invitation.creatorName ?? "A member";
  const relative = formatDistanceToNow(invitation.createdAt, {
    addSuffix: true,
  });

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">
        {creator} · {relative}
      </span>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isPending}>Revoke</Button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone with this link won&apos;t be able to join. You can
              create a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Keep link
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRevoke}
              disabled={isPending}
            >
              Revoke link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
