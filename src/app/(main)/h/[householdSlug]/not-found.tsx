import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HouseholdNotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <SearchX className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Household not found</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        This household doesn&apos;t exist, or it may have been deleted.
        Go back to see the households you&apos;re part of.
      </p>
      <Link href="/dashboard">
        <Button variant="outline" size="sm">Go to dashboard</Button>
      </Link>
    </div>
  );
}
