"use client";

import { useEffect, useState } from "react";
import { startDemoSession } from "@/features/demo/actions";

export default function DemoPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startDemoSession().then((result) => {
      // If we get here without a redirect, something went wrong
      if (result?.error) {
        setError(result.error);
      }
    });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <a href="/login" className="text-xs text-accent hover:underline">
            Return to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">Starting demo...</p>
      </div>
    </div>
  );
}
