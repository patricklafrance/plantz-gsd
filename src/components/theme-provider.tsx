"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Phase 8.4 — hand-rolled theme provider. We avoided next-themes because its
 * SSR-noflash inline script trips Next 16's React 19 rule
 * ("Encountered a script tag while rendering React component"). The no-flash
 * script lives in app/layout.tsx as a server-injected snippet (see
 * ThemeNoFlashScript) so the html class is correct before first paint.
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "plantz-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage may be unavailable (private mode, sandbox).
  }
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyHtmlClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);

  // Initial read on mount — runs after the no-flash script has already
  // applied the correct class, so we don't flicker.
  useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemDark(systemPrefersDark());
  }, []);

  // Track OS-level scheme changes when the user has picked "system".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === "system") return systemDark ? "dark" : "light";
    return theme;
  }, [theme, systemDark]);

  // Sync html class whenever resolved theme changes.
  useEffect(() => {
    applyHtmlClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // SSR / outside-provider safe fallback. Returning a no-op keeps
    // consumers tolerant during Suspense boundaries.
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}

/**
 * Phase 8.4 note: a server-emitted no-flash inline script (the standard
 * next-themes pattern) is incompatible with Next 16 — React 19's "no script
 * tags in render" rule fires even for `dangerouslySetInnerHTML` on `<script>`.
 * We accept a 1-frame light-mode flash on first paint when the user has
 * dark mode picked; the ThemeProvider effect applies the class right after
 * hydration. If the flash becomes user-visible enough to fix, the next
 * place to look is rendering the script via Next.js's external `<script>`
 * placement (root <head>) outside the React render tree.
 */
