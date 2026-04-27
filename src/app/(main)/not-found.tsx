import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MainNotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <SearchX className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        We couldn&apos;t find what you&apos;re looking for. Head back to your dashboard.
      </p>
      <Link href="/dashboard">
        <Button variant="outline" size="sm">Go to dashboard</Button>
      </Link>
    </div>
  );
}
