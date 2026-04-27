import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit local concurrency to avoid saturating Next.js dev's jest-worker pool;
  // 12 parallel workers against a single `next dev` instance reliably
  // triggered "Jest worker encountered N child process exceptions" crashes
  // on Windows. CI keeps Playwright's default since CI runs against a
  // dedicated server.
  workers: process.env.CI ? undefined : 4,
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
