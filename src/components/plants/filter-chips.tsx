"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const STATUSES = [
  { value: undefined, label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due-today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "archived", label: "Archived" },
] as const;

const SORT_OPTIONS = [
  { value: "next-watering", label: "Next watering" },
  { value: "name", label: "Name (A-Z)" },
  { value: "recently-added", label: "Recently added" },
] as const;

type Room = { id: string; name: string };

interface FilterChipsProps {
  rooms: Room[];
  activeRoomId?: string;
  activeStatus?: string;
  activeSort?: string;
}

function Chip({
  label,
  value,
  active,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              active
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="text-muted-foreground">{label}:</span>
            <span>{value}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        }
      />
      {children}
    </DropdownMenu>
  );
}

export function FilterChips({
  rooms,
  activeRoomId,
  activeStatus,
  activeSort,
}: FilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/plants?${params.toString()}`);
  }

  const currentStatusLabel =
    STATUSES.find((s) => s.value === activeStatus)?.label ?? "All";
  const currentRoomLabel = activeRoomId
    ? rooms.find((r) => r.id === activeRoomId)?.name ?? "All"
    : "All";
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === (activeSort ?? "next-watering"))
      ?.label ?? "Next watering";

  return (
    <div className="flex flex-wrap gap-2">
      {/* Status chip */}
      <Chip
        label="Status"
        value={currentStatusLabel}
        active={!!activeStatus}
      >
        <DropdownMenuContent align="start">
          {STATUSES.map((s) => (
            <DropdownMenuItem
              key={s.value ?? "all"}
              onClick={() => navigate("status", s.value)}
            >
              {(s.value ?? undefined) === activeStatus ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </Chip>

      {/* Room chip (only if rooms exist) */}
      {rooms.length > 0 && (
        <Chip
          label="Room"
          value={currentRoomLabel}
          active={!!activeRoomId}
        >
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => navigate("room", undefined)}>
              {!activeRoomId ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
              All
            </DropdownMenuItem>
            {rooms.map((room) => (
              <DropdownMenuItem
                key={room.id}
                onClick={() => navigate("room", room.id)}
              >
                {activeRoomId === room.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-3.5 w-3.5" />
                )}
                {room.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </Chip>
      )}

      {/* Sort chip */}
      <Chip
        label="Sort"
        value={currentSortLabel}
        active={!!activeSort && activeSort !== "next-watering"}
      >
        <DropdownMenuContent align="start">
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() =>
                navigate(
                  "sort",
                  option.value === "next-watering" ? undefined : option.value
                )
              }
            >
              {(activeSort ?? "next-watering") === option.value ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </Chip>
    </div>
  );
}
