"use client";

import { useEffect } from "react";
import { updateTimezone } from "@/features/auth/actions";

export function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Always set cookie for server-side date math
    document.cookie = `user_tz=${encodeURIComponent(tz)}; path=/; SameSite=Strict; max-age=31536000`;

    // Check if we've already persisted TZ to the database in this browser
    const alreadyStored = document.cookie
      .split("; ")
      .some((c) => c.startsWith("tz_stored=1"));

    if (!alreadyStored) {
      // Persist to DB — fire-and-forget (only writes if not already stored in DB)
      updateTimezone(tz)
        .then(() => {
          document.cookie = `tz_stored=1; path=/; SameSite=Strict; max-age=31536000`;
        })
        .catch(() => {
          // Silently fail — will retry on next visit
        });
    }
  }, []);

  return null;
}
