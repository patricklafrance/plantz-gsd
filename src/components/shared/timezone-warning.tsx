"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimezoneWarningProps {
  storedTimezone: string | null;
}

export function TimezoneWarning({ storedTimezone }: TimezoneWarningProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!storedTimezone) return; // No stored TZ yet — skip warning

    const dismissed = sessionStorage.getItem("tz-warning-dismissed");
    if (dismissed) return;

    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz !== storedTimezone) {
      setShow(true);
    }
  }, [storedTimezone]);

  if (!show) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="flex-1 text-muted-foreground">
        Your browser&apos;s timezone differs from our records. Watering dates may display differently.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 h-8 w-8 p-0"
        onClick={() => {
          setShow(false);
          sessionStorage.setItem("tz-warning-dismissed", "1");
        }}
        aria-label="Dismiss timezone warning"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
