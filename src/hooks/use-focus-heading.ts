"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useFocusHeading() {
  const pathname = usePathname();
  useEffect(() => {
    // Small delay to let the page render before focusing
    const id = setTimeout(() => {
      const h1 = document.querySelector<HTMLElement>("h1[tabindex='-1']");
      if (h1) h1.focus({ preventScroll: false });
    }, 50);
    return () => clearTimeout(id);
  }, [pathname]);
}
