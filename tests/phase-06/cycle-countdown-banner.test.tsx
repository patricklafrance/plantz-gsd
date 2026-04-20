import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 2 (CycleCountdownBanner lands).

void render;
void screen;
void vi;

describe("CycleCountdownBanner (D-23 / D-24 / D-25)", () => {
  afterEach(() => { cleanup(); });
  it.todo("D-23 renders for assignee with no unread cycle event (normal variant)");
  it.todo("D-25 does NOT render for non-assignee");
  it.todo("D-25 suppressed by unread cycle_started event (hasUnreadEvent=true)");
  it.todo("D-25 suppressed by unread cycle_reassigned_* event");
  it.todo("D-23 urgency variant when daysLeft <= 1: uses bg-destructive/10 border-destructive/30");
  it.todo("D-23 single-member copy variant: suppresses X is next line when isSingleMember=true");
  it.todo("D-23 displays nextAssigneeName and formatted cycle end date");
});
