"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS = [
  { value: "next-watering", label: "Next watering" },
  { value: "name", label: "Name (A-Z)" },
  { value: "recently-added", label: "Recently added" },
] as const;

export function SortDropdown({ activeSort }: { activeSort?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSort = activeSort ?? "next-watering";
  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? "Next watering";

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "next-watering") {
      params.delete("sort"); // default — no param needed
    } else {
      params.set("sort", value);
    }
    router.push(`/plants?${params.toString()}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            Sort: {currentLabel}
            <ArrowUpDown className="ml-1 h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSort(option.value)}
          >
            {currentSort === option.value ? (
              <Check className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
