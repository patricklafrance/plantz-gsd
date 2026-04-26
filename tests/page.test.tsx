import { expect, test, vi } from "vitest";

// Root page is a redirect-only Server Component — no UI to render.
// It redirects to /dashboard when authenticated, /login when not.
// This is tested via E2E (Playwright) rather than unit tests.

// Mock next/server before next-auth tries to import it at evaluation time
vi.mock("next/server", () => ({
  NextResponse: { redirect: vi.fn(), next: vi.fn() },
  NextRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock auth module (resolved path from project root)
vi.mock("../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// Page now resolves the active household before redirecting; mock the
// query module so importing the page doesn't reach into Prisma/db.
vi.mock("@/features/household/queries", () => ({
  resolveActiveHouseholdSlug: vi.fn().mockResolvedValue(null),
}));

test("home page module exports a default async function", async () => {
  const { default: HomePage } = await import("../src/app/page");
  expect(typeof HomePage).toBe("function");
  expect(HomePage.constructor.name).toBe("AsyncFunction");
});
