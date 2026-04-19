import { expect, test, describe } from "vitest";

describe("auth configuration", () => {
  test("auth.config.ts is edge-safe (no Node.js API imports)", async () => {
    const fs = await import("fs");
    const configSource = fs.readFileSync("auth.config.ts", "utf8");

    // Must NOT contain database or Node.js-only imports
    expect(configSource).not.toContain('from "@/lib/db"');
    expect(configSource).not.toContain('from "bcryptjs"');
    expect(configSource).not.toContain("@prisma");

    // Must contain the authorized callback and JWT strategy
    expect(configSource).toContain("authorized");
    expect(configSource).toContain('strategy: "jwt"');
    expect(configSource).toContain('signIn: "/login"');
  });

  test("auth.ts has Credentials provider with Zod validation", async () => {
    const fs = await import("fs");
    const authSource = fs.readFileSync("auth.ts", "utf8");

    expect(authSource).toContain("Credentials");
    expect(authSource).toContain("bcryptjs");
    expect(authSource).toContain('from "zod/v4"');
    expect(authSource).toContain("db.user.findUnique");
  });

  test("proxy.ts exports auth as proxy", async () => {
    const fs = await import("fs");
    const proxySource = fs.readFileSync("proxy.ts", "utf8");

    expect(proxySource).toContain("auth as proxy");
    expect(proxySource).toContain("matcher");
    expect(proxySource).not.toContain("auth as middleware");
  });
});

// --- Phase 2 behavior stubs (Wave 0) ---
// These tests verify behaviors added by Plan 02-01.
// They will fail until implementation is complete.

describe("auth session callbacks (Phase 2)", () => {
  test.todo("jwt callback stores user.id in token when user object is present");
  test.todo("session callback copies token.id to session.user.id");
});

describe("registration action (Phase 2)", () => {
  test.todo("registerUser creates a user with bcrypt-hashed password");
  test.todo("registerUser returns error for duplicate email");
  test.todo("registerUser returns error for invalid input (Zod validation)");
  test.todo("registerUser calls signIn after successful creation");
});

describe("onboarding action (Phase 2)", () => {
  test.todo("completeOnboarding updates user onboardingCompleted to true");
  test.todo("completeOnboarding validates plantCountRange against enum");
  test.todo("completeOnboarding returns error for invalid range");
});

describe("zod schemas (Phase 2)", () => {
  test.todo("loginSchema accepts valid email and password");
  test.todo("loginSchema rejects invalid email");
  test.todo("registerSchema rejects password shorter than 6 characters");
  test.todo("registerSchema rejects mismatched passwords");
  test.todo("onboardingSchema accepts valid plant count range");
  test.todo("onboardingSchema rejects invalid plant count range");
});
