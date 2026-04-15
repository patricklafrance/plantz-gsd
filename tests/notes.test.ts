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

  test("accepts content up to 5000 characters (D-06)", async () => {
    const { createNoteSchema } = await import("@/features/notes/schemas");
    const result = createNoteSchema.safeParse({
      plantId: "plant-1",
      content: "x".repeat(5000),
    });
    expect(result.success).toBe(true);
  });

  test("rejects content exceeding 5000 characters", async () => {
    const { createNoteSchema } = await import("@/features/notes/schemas");
    const result = createNoteSchema.safeParse({
      plantId: "plant-1",
      content: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
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

// --- Action tests ---

describe("createNote action", () => {
  test("returns error when not authenticated", async () => {
    const { auth } = await import("../auth");
    vi.mocked(auth).mockResolvedValueOnce(null);
    const { createNote } = await import("@/features/notes/actions");
    const result = await createNote({ plantId: "plant-1", content: "Test note" });
    expect(result).toEqual({ error: "Not authenticated." });
  });

  test("returns error when plant not found or not owned", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(db.plant.findFirst).mockResolvedValueOnce(null);
    const { createNote } = await import("@/features/notes/actions");
    const result = await createNote({ plantId: "plant-1", content: "Test note" });
    expect(result).toEqual({ error: "Plant not found." });
  });

  test("creates note and revalidates path on success", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    const { revalidatePath } = await import("next/cache");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(db.plant.findFirst).mockResolvedValueOnce({
      id: "plant-1",
      userId: "user-1",
    } as Awaited<ReturnType<typeof db.plant.findFirst>>);
    const createdNote = {
      id: "note-1",
      plantId: "plant-1",
      content: "Test note",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.note.create).mockResolvedValueOnce(
      createdNote as Awaited<ReturnType<typeof db.note.create>>
    );
    const { createNote } = await import("@/features/notes/actions");
    const result = await createNote({ plantId: "plant-1", content: "Test note" });
    expect(result).toEqual({ success: true, note: createdNote });
    expect(db.note.create).toHaveBeenCalledWith({
      data: { plantId: "plant-1", content: "Test note" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/plants/plant-1");
  });
});

describe("updateNote action", () => {
  test("returns error when note not found or not owned", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(db.note.findFirst).mockResolvedValueOnce(null);
    const { updateNote } = await import("@/features/notes/actions");
    const result = await updateNote({ noteId: "note-1", content: "Updated" });
    expect(result).toEqual({ error: "Note not found." });
  });

  test("updates note content on success", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth>>);
    const existingNote = {
      id: "note-1",
      plantId: "plant-1",
      content: "Old content",
      createdAt: new Date(),
      updatedAt: new Date(),
      plant: { id: "plant-1", userId: "user-1" },
    };
    vi.mocked(db.note.findFirst).mockResolvedValueOnce(
      existingNote as Awaited<ReturnType<typeof db.note.findFirst>>
    );
    const updatedNote = { ...existingNote, content: "Updated content" };
    vi.mocked(db.note.update).mockResolvedValueOnce(
      updatedNote as Awaited<ReturnType<typeof db.note.update>>
    );
    const { updateNote } = await import("@/features/notes/actions");
    const result = await updateNote({ noteId: "note-1", content: "Updated content" });
    expect(result).toEqual({ success: true, note: updatedNote });
  });
});

describe("deleteNote action", () => {
  test("returns error when note not found or not owned", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(db.note.findFirst).mockResolvedValueOnce(null);
    const { deleteNote } = await import("@/features/notes/actions");
    const result = await deleteNote("note-1");
    expect(result).toEqual({ error: "Note not found." });
  });

  test("deletes note on success", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");
    const { revalidatePath } = await import("next/cache");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth>>);
    const existingNote = {
      id: "note-1",
      plantId: "plant-1",
      content: "Some note",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.note.findFirst).mockResolvedValueOnce(
      existingNote as Awaited<ReturnType<typeof db.note.findFirst>>
    );
    vi.mocked(db.note.delete).mockResolvedValueOnce(
      existingNote as Awaited<ReturnType<typeof db.note.delete>>
    );
    const { deleteNote } = await import("@/features/notes/actions");
    const result = await deleteNote("note-1");
    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/plants/plant-1");
  });
});
