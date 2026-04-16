"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEADING_SELECTOR = "h1[tabindex='-1']";
const MAX_WAIT_MS = 3000;

export function useFocusHeading() {
  const pathname = usePathname();

  useEffect(() => {
    // Try immediately — heading may already be in DOM (non-streamed pages)
    const existing = document.querySelector<HTMLElement>(HEADING_SELECTOR);
    if (existing) {
      existing.focus({ preventScroll: false });
      return;
    }

    // Heading not yet in DOM (streaming/Suspense) — observe for it
    let settled = false;

    const observer = new MutationObserver(() => {
      const h1 = document.querySelector<HTMLElement>(HEADING_SELECTOR);
      if (h1 && !settled) {
        settled = true;
        observer.disconnect();
        h1.focus({ preventScroll: false });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Safety timeout — stop observing after MAX_WAIT_MS to prevent indefinite observation
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        observer.disconnect();
      }
    }, MAX_WAIT_MS);

    return () => {
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [pathname]);
}
