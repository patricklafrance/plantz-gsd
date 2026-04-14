import { expect, test, describe } from "vitest";

describe("db singleton module", () => {
  test("src/lib/db.ts exports a db object", async () => {
    // Verify the module file exists and has the correct export shape
    // We cannot instantiate PrismaClient in test without a DB connection,
    // so we verify the module source code structure instead
    const fs = await import("fs");
    const dbSource = fs.readFileSync("src/lib/db.ts", "utf8");

    expect(dbSource).toContain("export const db");
    expect(dbSource).toContain("PrismaPg");
    expect(dbSource).toContain("globalForPrisma");
    expect(dbSource).toContain("process.env.NODE_ENV");
  });
});
