"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WateringHistoryEntry } from "@/components/watering/watering-history-entry";
import { loadMoreWateringHistory } from "@/features/watering/actions";
import type { WateringLog } from "@/generated/prisma/client";

interface WateringHistoryProps {
  plantId: string;
  plantNickname: string;
  initialLogs: WateringLog[];
  totalCount: number;
}

export function WateringHistory({
  plantId,
  plantNickname,
  initialLogs,
  totalCount,
}: WateringHistoryProps) {
  const [logs, setLogs] = useState<WateringLog[]>(initialLogs);
  const [total, setTotal] = useState(totalCount);
  const [isLoading, setIsLoading] = useState(false);

  const hasMore = logs.length < total;

  async function handleLoadMore() {
    setIsLoading(true);
    const result = await loadMoreWateringHistory(plantId, logs.length);
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
    <div className="space-y-xs">
      {logs.map((log) => (
        <WateringHistoryEntry
          key={log.id}
          log={log}
          plantId={plantId}
          plantNickname={plantNickname}
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
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-sm" />}
          Load more
        </Button>
      )}
    </div>
  );
}
