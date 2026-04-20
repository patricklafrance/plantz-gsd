import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
// Wave 0 stub — component imports deferred until Wave 3 (SettingsGeneralForm lands).

void render;
void screen;
void vi;

describe("SettingsGeneralForm (HSET-03 / D-13 / D-16)", () => {
  afterEach(() => { cleanup(); });
  it.todo("HSET-03 renders prefilled with household.name / timezone / cycleDuration");
  it.todo("HSET-03 submit invokes updateHouseholdSettings with all fields");
  it.todo("HSET-03 pending-state disables submit button");
  it.todo("HSET-03 empty name shows Zod error message from react-hook-form");
  it.todo("HSET-03 cycleDuration Select renders 4 options (1/3/7/14 days)");
});
