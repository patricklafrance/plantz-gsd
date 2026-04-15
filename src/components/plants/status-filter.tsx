"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const STATUSES = [
  { value: undefined, label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due-today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "archived", label: "Archived" },
] as const;

type StatusValue = (typeof STATUSES)[number]["value"];

export function StatusFilter({ activeStatus }: { activeStatus?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleFilter(status?: StatusValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.push(`/plants?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {STATUSES.map((s) => {
        const isActive =
          s.value === activeStatus || (!s.value && !activeStatus);

        // Clicking an already-active non-All pill deselects it (returns to All)
        const handleClick = () =>
          handleFilter(isActive && s.value ? undefined : s.value);

        if (isActive) {
          if (s.value === "overdue") {
            return (
              <Button
                key="overdue"
                variant="outline"
                size="sm"
                onClick={handleClick}
                className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15 hover:text-destructive"
              >
                {s.label}
              </Button>
            );
          }
          if (s.value === "due-today") {
            return (
              <Button
                key="due-today"
                variant="outline"
                size="sm"
                onClick={handleClick}
                className="bg-accent/15 text-accent border-accent/25 hover:bg-accent/20 hover:text-accent"
              >
                {s.label}
              </Button>
            );
          }
          if (s.value === "archived") {
            return (
              <Button
                key="archived"
                variant="secondary"
                size="sm"
                onClick={handleClick}
              >
                {s.label}
              </Button>
            );
          }
          // Active "All" and "Upcoming"
          return (
            <Button
              key={s.value ?? "all"}
              variant="default"
              size="sm"
              onClick={handleClick}
            >
              {s.label}
            </Button>
          );
        }

        // Inactive overdue — subtle red tint
        if (s.value === "overdue") {
          return (
            <Button
              key="overdue"
              variant="outline"
              size="sm"
              onClick={handleClick}
              className="text-destructive/80 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              {s.label}
            </Button>
          );
        }

        // Inactive default
        return (
          <Button
            key={s.value ?? "all"}
            variant="outline"
            size="sm"
            onClick={handleClick}
          >
            {s.label}
          </Button>
        );
      })}
    </div>
  );
}
