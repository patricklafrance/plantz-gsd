"use client";

import { useState, useEffect } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NoteInput } from "@/components/timeline/note-input";
import { TimelineEntry } from "@/components/timeline/timeline-entry";
import { loadMoreTimeline } from "@/features/notes/actions";
import type { TimelineEntry as TimelineEntryType } from "@/types/timeline";

interface TimelineProps {
  plantId: string;
  plantNickname: string;
  initialEntries: TimelineEntryType[];
  totalCount: number;
  onMutated?: () => void;
}

export function Timeline({
  plantId,
  plantNickname,
  initialEntries,
  totalCount,
  onMutated,
}: TimelineProps) {
  const [entries, setEntries] = useState<TimelineEntryType[]>(initialEntries);
  const [total, setTotal] = useState(totalCount);
  const [isLoading, setIsLoading] = useState(false);

  // Sync with parent when server re-renders (e.g. after revalidatePath)
  useEffect(() => {
    setEntries(initialEntries);
    setTotal(totalCount);
  }, [initialEntries, totalCount]);

  const hasMore = entries.length < total;

  async function handleLoadMore() {
    setIsLoading(true);
    const result = await loadMoreTimeline(plantId, entries.length);
    setIsLoading(false);

    if ("error" in result) {
      toast.error("Couldn't load more entries. Try again.");
      return;
    }

    setEntries((prev) => [...prev, ...result.entries]);
    setTotal(result.total);
  }

  async function handleRefetch() {
    const result = await loadMoreTimeline(plantId, 0);

    if ("error" in result) {
      return;
    }

    setEntries(result.entries);
    setTotal(result.total);
    onMutated?.();
  }

  return (
    <TooltipProvider>
      <NoteInput plantId={plantId} />
      <Separator className="my-sm" />

      {entries.length === 0 ? (
        <div className="flex flex-col items-center py-lg text-center">
          <div className="rounded-full bg-accent/10 p-md mb-sm">
            <Pencil className="h-6 w-6 text-accent" />
          </div>
          <p className="text-sm text-muted-foreground">
            No history yet. Add a note or log a watering to get started.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((entry) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              plantNickname={plantNickname}
              onMutated={handleRefetch}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-sm"
          onClick={handleLoadMore}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-sm" />}
          Load 20 more
        </Button>
      )}
    </TooltipProvider>
  );
}
