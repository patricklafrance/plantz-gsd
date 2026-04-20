import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 2 (HouseholdSwitcher lands).

void render;
void screen;
void vi;

describe("HouseholdSwitcher (HSET-01 / D-03, D-05, D-09, D-34)", () => {
  afterEach(() => { cleanup(); });
  it.todo("HSET-01 renders all households from props with role pill + default star");
  it.todo("HSET-01 active household row is disabled (non-navigable)");
  it.todo("HSET-01 list-route preservation: /h/old/plants -> /h/new/plants");
  it.todo("HSET-01 detail-route fallback: /h/old/plants/abc-cuid -> /h/new/plants");
  it.todo("HSET-02 Set as default click invokes setDefaultHousehold action");
  it.todo("HSET-01 buildSwitchPath handles /h/slug/settings verbatim");
  it.todo("HSET-01 buildSwitchPath handles /h/slug/dashboard verbatim");
});
