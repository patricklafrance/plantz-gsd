import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Leaf,
  XCircle,
  ShieldOff,
  CheckCircle2,
  Home,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveInvitationByToken } from "@/features/household/queries";
import { AcceptForm } from "./accept-form";

// D-21 / UI-SPEC §Accessibility: prevent search engines from indexing tokens.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <h1 className="sr-only">Plant Minder invitation</h1>
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground"
        >
          <Leaf className="h-5 w-5 text-accent" aria-hidden />
          <span className="text-base font-semibold">Plant Minder</span>
        </Link>
        {children}
      </div>
    </main>
  );
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const resolved = await resolveInvitationByToken(token);

  // Branch 1: unknown token
  if (!resolved) {
    return (
      <Shell>
        <EmptyState
          icon={XCircle}
          iconVariant="muted"
          heading="This invite link isn't valid"
          body="The link may be mistyped, or the owner may have regenerated it. Ask the person who invited you for a fresh link."
          action={
            <Link href="/">
              <Button variant="outline" className="min-h-[44px]">
                Go to Plant Minder
              </Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  // Branch 2: revoked
  if (resolved.invitation.revokedAt !== null) {
    return (
      <Shell>
        <EmptyState
          icon={ShieldOff}
          iconVariant="muted"
          heading="This invite has been revoked"
          body="The household owner revoked this invitation link. Ask them to send you a new one."
          action={
            <Link href="/">
              <Button variant="outline" className="min-h-[44px]">
                Go to Plant Minder
              </Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  // Branch 3: already used
  if (resolved.invitation.acceptedAt !== null) {
    return (
      <Shell>
        <EmptyState
          icon={CheckCircle2}
          iconVariant="muted"
          heading="This invite has already been used"
          body="One-use protection: each invite link stops working after someone accepts it. Ask the household owner for a new link if you still need access."
          action={
            <Link href="/">
              <Button variant="outline" className="min-h-[44px]">
                Go to Plant Minder
              </Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  // Branch 4: caller is already a member (logged-in only — the check requires a user id)
  if (session?.user?.id) {
    const existingMembership = await db.householdMember.findFirst({
      where: {
        householdId: resolved.household.id,
        userId: session.user.id,
      },
      select: { createdAt: true },
    });
    if (existingMembership) {
      const joinedAt = existingMembership.createdAt;
      const joinedAtFormatted = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(joinedAt);
      return (
        <Shell>
          <EmptyState
            icon={Home}
            iconVariant="muted"
            heading={`You're already in ${resolved.household.name}`}
            body={`You joined this household on ${joinedAtFormatted}. Go to the dashboard to see today's plants.`}
            action={
              <Link href={`/h/${resolved.household.slug}/dashboard`}>
                <Button variant="default" className="min-h-[44px]">
                  Go to {resolved.household.name}
                </Button>
              </Link>
            }
          />
        </Shell>
      );
    }
  }

  // Branches 5a / 5b: shared card header
  const { ownerName, memberCount } = resolved;
  const memberWord = memberCount === 1 ? "member" : "members";
  const isLoggedIn = !!session?.user?.id;

  if (!isLoggedIn) {
    // Branch 5a: logged-out preview
    return (
      <Shell>
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <UserPlus
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-xl font-semibold">
                  Join {resolved.household.name}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {ownerName} invited you
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {resolved.household.name} has {memberCount} {memberWord}{" "}
              caring for their plants together. Sign in to accept, or
              create a free account.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/join/${token}`)}`}
              className="w-full"
            >
              <Button
                variant="default"
                className="min-h-[44px] w-full"
              >
                Sign in
              </Button>
            </Link>
            <Link
              href={`/register?callbackUrl=${encodeURIComponent(`/join/${token}`)}`}
              className="w-full"
            >
              <Button
                variant="outline"
                className="min-h-[44px] w-full"
              >
                Create account
              </Button>
            </Link>
            <p className="text-center text-sm text-muted-foreground">
              You&apos;ll return to this invite after signing in.
            </p>
          </CardFooter>
        </Card>
      </Shell>
    );
  }

  // Branch 5b: logged-in confirm
  return (
    <Shell>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              <UserPlus
                className="h-6 w-6 text-muted-foreground"
                aria-hidden
              />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-xl font-semibold">
                Join {resolved.household.name}?
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {ownerName} invited you
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {resolved.household.name} has {memberCount} {memberWord}. Once
            you accept, you&apos;ll be added to the rotation and the household
            will appear in your switcher.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <AcceptForm token={token} />
          <Link
            href="/"
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Not now
          </Link>
        </CardFooter>
      </Card>
    </Shell>
  );
}
