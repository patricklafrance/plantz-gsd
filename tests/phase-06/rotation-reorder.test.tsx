import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 3 (rotation reorder UI lands).

void render;
void screen;
void vi;

describe("Rotation reorder optimistic UI (ROTA-01 / D-10 / D-12)", () => {
  afterEach(() => { cleanup(); });
  it.todo("ROTA-01 moveUp invokes reorderRotation with new order");
  it.todo("ROTA-01 top-row up-arrow is disabled");
  it.todo("ROTA-01 bottom-row down-arrow is disabled");
  it.todo("ROTA-01 optimistic: local order updates immediately on click");
  it.todo("ROTA-01 on error: reverts local state AND shows toast.error");
  it.todo("ROTA-01 all arrows disabled while isPending");
});
