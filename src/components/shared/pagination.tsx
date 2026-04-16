import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Base URL path, e.g., "/plants" */
  basePath: string;
  /** Current search params to preserve (excluding "page") */
  searchParams: Record<string, string | undefined>;
}

export function Pagination({ currentPage, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  function buildUrl(page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") {
        params.set(key, value);
      }
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between pt-4">
      <div>
        {hasPrevious ? (
          <Link href={buildUrl(currentPage - 1)}>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              Previous
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled className="min-h-[44px]">
            Previous
          </Button>
        )}
      </div>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <div>
        {hasNext ? (
          <Link href={buildUrl(currentPage + 1)}>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              Next
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled className="min-h-[44px]">
            Next
          </Button>
        )}
      </div>
    </nav>
  );
}
