import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 3 (AvailabilitySection lands).

void render;
void screen;
void vi;

describe("AvailabilitySection (AVLB-01 / AVLB-02 / D-28 / D-29)", () => {
  afterEach(() => { cleanup(); });
  it.todo("AVLB-01 Two Popover+Calendar pickers render (start + end)");
  it.todo("AVLB-01 endDate < startDate shows inline error End date must be on or after start date");
  it.todo("AVLB-01 startDate < today shows inline error Start date must be today or in the future");
  it.todo("AVLB-02 List row: You rendered for viewers own row");
  it.todo("AVLB-02 List row: Delete button visible on self-row");
  it.todo("AVLB-02 List row: Delete button visible on other-row when viewerRole=OWNER");
  it.todo("AVLB-02 List row: Delete button HIDDEN on other-row when viewerRole=MEMBER");
  it.todo("AVLB-02 Past availabilities (endDate<today) filtered out of the list");
});
