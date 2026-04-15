"use client";

import { useEffect } from "react";

export function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `user_tz=${encodeURIComponent(tz)}; path=/; SameSite=Strict; max-age=31536000`;
  }, []);

  return null;
}
