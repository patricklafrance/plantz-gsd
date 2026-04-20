import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 3 (InvitationsCard lands).

void render;
void screen;
void vi;

describe("InvitationsCard (HSET-03 / D-20 / D-21)", () => {
  afterEach(() => { cleanup(); });
  it.todo("HSET-03 Phase A: Invite people button opens dialog with Create invite link");
  it.todo("HSET-03 Phase B: success returns token then dialog shows Input readOnly + Copy link");
  it.todo("HSET-03 Phase C: error returns then inline Couldnt create + Retry button");
  it.todo("HSET-03 Existing invitation row: Revoke button opens AlertDialog confirm");
  it.todo("HSET-03 Existing invitation row: NO Copy link button (tokenHash-only per Phase 4 D-01)");
  it.todo("HSET-03 Empty state: No active invitations yet.");
});
