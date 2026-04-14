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
    expect(proxySource).not.toContain("middleware");
  });
});
