import { expect, test, vi } from "vitest";

// Root page is a redirect-only Server Component — no UI to render.
// It redirects to /dashboard when authenticated, /login when not.
// This is tested via E2E (Playwright) rather than unit tests.

test("home page module exports a default async function", async () => {
  // Mock next/navigation redirect so the import does not throw
  vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
  }));

  // Mock auth to return null (unauthenticated) so the component body runs
  vi.mock("../../auth", () => ({
    auth: vi.fn().mockResolvedValue(null),
  }));

  const { default: HomePage } = await import("../src/app/page");
  expect(typeof HomePage).toBe("function");
  // The component is async and returns void (via redirect)
  expect(HomePage.constructor.name).toBe("AsyncFunction");
});
