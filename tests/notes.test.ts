import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    note: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Schema validation tests ---

describe("createNoteSchema", () => {
  test("accepts valid input with plantId and content", async () => {
    const { createNoteSchema } = await import("@/features/notes/schemas");
    const result = createNoteSchema.safeParse({
      plantId: "plant-1",
      content: "Leaves looking healthy",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty content", async () => {
    const { createNoteSchema } = await import("@/features/notes/schemas");
    const result = createNoteSchema.safeParse({ plantId: "plant-1", content: "" });
    expect(result.success).toBe(false);
  });

  test("rejects missing plantId", async () => {
    const { createNoteSchema } = await import("@/features/notes/schemas");
    const result = createNoteSchema.safeParse({ content: "test" });
    expect(result.success).toBe(false);
  });

  test("accepts very long content without error (D-06)", async () => {
    const { createNoteSchema } = await import("@/features/notes/schemas");
    const result = createNoteSchema.safeParse({
      plantId: "plant-1",
      content: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateNoteSchema", () => {
  test("accepts valid input with noteId and content", async () => {
    const { updateNoteSchema } = await import("@/features/notes/schemas");
    const result = updateNoteSchema.safeParse({
      noteId: "note-1",
      content: "Updated observation",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty content", async () => {
    const { updateNoteSchema } = await import("@/features/notes/schemas");
    const result = updateNoteSchema.safeParse({ noteId: "note-1", content: "" });
    expect(result.success).toBe(false);
  });
});

// --- Action stubs (Task 2 will implement these) ---

describe("createNote action", () => {
  test.todo("returns error when not authenticated");
  test.todo("returns error when plant not found or not owned");
  test.todo("creates note and revalidates path on success");
});

describe("updateNote action", () => {
  test.todo("returns error when note not found or not owned");
  test.todo("updates note content on success");
});

describe("deleteNote action", () => {
  test.todo("returns error when note not found or not owned");
  test.todo("deletes note on success");
});
