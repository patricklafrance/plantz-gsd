"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WateringHistoryEntry } from "@/components/watering/watering-history-entry";
import { loadMoreWateringHistory } from "@/features/watering/actions";
import type { WateringLog } from "@/generated/prisma/client";

interface WateringHistoryProps {
  householdId: string;
  plantId: string;
  plantNickname: string;
  initialLogs: WateringLog[];
  totalCount: number;
  onMutated?: () => void;
}

export function WateringHistory({
  householdId,
  plantId,
  plantNickname,
  initialLogs,
  totalCount,
  onMutated,
}: WateringHistoryProps) {
  const [logs, setLogs] = useState<WateringLog[]>(initialLogs);
  const [total, setTotal] = useState(totalCount);
  const [isLoading, setIsLoading] = useState(false);

  // Sync with parent when initialLogs changes (after refetch)
  useEffect(() => {
    setLogs(initialLogs);
    setTotal(totalCount);
  }, [initialLogs, totalCount]);

  const hasMore = logs.length < total;

  async function handleLoadMore() {
    setIsLoading(true);
    const result = await loadMoreWateringHistory({ householdId, plantId, skip: logs.length });
    setIsLoading(false);

    if ("error" in result) {
      return;
    }

    setLogs((prev) => [...prev, ...result.logs]);
    setTotal(result.total);
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No waterings logged yet.</p>
    );
  }

  return (
    <div className="space-y-1">
      {logs.map((log) => (
        <WateringHistoryEntry
          key={log.id}
          householdId={householdId}
          log={log}
          plantId={plantId}
          plantNickname={plantNickname}
          onDeleted={() => {
            setLogs((prev) => prev.filter((l) => l.id !== log.id));
            setTotal((prev) => prev - 1);
            onMutated?.();
          }}
          onEdited={onMutated}
        />
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLoadMore}
          disabled={isLoading}
          className="w-full text-muted-foreground"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Load more
        </Button>
      )}
    </div>
  );
}
