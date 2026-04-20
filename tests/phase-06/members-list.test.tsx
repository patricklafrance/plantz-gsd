import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 3 (MembersList lands).

void render;
void screen;
void vi;

describe("MembersList (HSET-03 / D-17 / D-18)", () => {
  afterEach(() => { cleanup(); });
  it.todo("HSET-03 OWNER viewer: renders 3-dot menu with Make owner on MEMBER row");
  it.todo("HSET-03 OWNER viewer on co-OWNER row: shows Remove from owners (enabled when ownerCount>1)");
  it.todo("HSET-03 OWNER viewer on co-OWNER row: Remove from owners disabled when ownerCount===1");
  it.todo("HSET-03 MEMBER viewer: no 3-dot menu on other rows; self-row shows Leave household");
  it.todo("HSET-03 Self-row sole OWNER + other members: Leave household disabled with tooltip");
  it.todo("HSET-03 Self-row sole OWNER + sole member: Leave household opens DestructiveLeaveDialog");
  it.todo("HSET-03 rotation-order number prefix rendered as [N] text-xs font-semibold");
});
