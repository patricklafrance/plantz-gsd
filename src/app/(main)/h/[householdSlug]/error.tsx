"use client";

import Link from "next/link";
import { ShieldAlert, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HouseholdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.name === "ForbiddenError") {
    return (
      <div role="alert" aria-live="polite" className="space-y-4 py-12 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">You don&apos;t have access to this household</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your membership may have been removed or you may have followed an outdated link.
          Go back to your dashboard to see the households you belong to.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">Go to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div role="alert" aria-live="polite" className="space-y-4 py-12 text-center">
      <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t load this household. Try again, or go back to your dashboard.
      </p>
      <Button onClick={reset} variant="outline" size="sm">Try again</Button>
    </div>
  );
}
