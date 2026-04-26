"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Phase 8.4 — wraps next-themes with our defaults: class-based attribute
 * (matches `@custom-variant dark (&:is(.dark *))` in globals.css), system
 * preference as default, and disabled flash during SSR hydration.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
