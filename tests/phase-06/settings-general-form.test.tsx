import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Mock the Server Action so submit paths are deterministic and assertable.
vi.mock("@/features/household/actions", () => ({
  updateHouseholdSettings: vi.fn(),
}));

// Mock sonner toast calls so we can assert on success/error surfacing.
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const actions = await import("@/features/household/actions");
const sonnerModule = await import("sonner");
const { GeneralForm } = await import(
  "@/components/household/settings/general-form"
);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const baseHousehold = {
  id: "clh00000000000000000000001",
  name: "Home",
  timezone: "America/New_York",
  cycleDuration: 7,
};
const baseSlug = "home-sweet-home";

describe("SettingsGeneralForm (HSET-03 / D-13 / D-16)", () => {
  it("HSET-03 renders prefilled with household.name / timezone / cycleDuration", () => {
    render(
      <GeneralForm
        household={baseHousehold}
        householdSlug={baseSlug}
        viewerRole="OWNER"
      />,
    );

    // shadcn's FormLabel htmlFor points at the FormControl div slot, not at
    // the input — so `getByLabelText` on the label string can't reach the
    // underlying input. Query directly by the RHF-registered field name.
    const nameInput = document.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    expect(nameInput.value).toBe("Home");

    // timezone native select prefilled
    const timezoneSelect = document.querySelector(
      'select[name="timezone"]',
    ) as HTMLSelectElement;
    expect(timezoneSelect).not.toBeNull();
    expect(timezoneSelect.value).toBe("America/New_York");

    // Hidden householdId + householdSlug present and prefilled
    const hiddenInputs = Array.from(
      document.querySelectorAll('input[type="hidden"]'),
    ) as HTMLInputElement[];
    const hiddenValues = hiddenInputs.map((el) => el.value);
    expect(hiddenValues).toContain(baseHousehold.id);
    expect(hiddenValues).toContain(baseSlug);

    // Label text also renders (verifies accessible label is rendered).
    expect(screen.getByText(/household name/i)).not.toBeNull();
    expect(screen.getByText(/^Timezone$/)).not.toBeNull();
    expect(screen.getByText(/cycle duration/i)).not.toBeNull();
  });

  it("HSET-03 submit invokes updateHouseholdSettings with all fields", async () => {
    vi.mocked(actions.updateHouseholdSettings).mockResolvedValueOnce({
      success: true as const,
    });

    render(
      <GeneralForm
        household={baseHousehold}
        householdSlug={baseSlug}
        viewerRole="OWNER"
      />,
    );

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    // Dispatch submit directly — form.handleSubmit resolves asynchronously.
    fireEvent.submit(form as HTMLFormElement);

    // Wait a microtask flush for RHF + async resolver + submit handler.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(vi.mocked(actions.updateHouseholdSettings)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(actions.updateHouseholdSettings).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call.householdId).toBe(baseHousehold.id);
    expect(call.householdSlug).toBe(baseSlug);
    expect(call.name).toBe("Home");
    expect(call.timezone).toBe("America/New_York");
    // cycleDuration is the pre-transform string on the wire — the server
    // schema's transform runs on parse (Plan 02 D-32).
    expect(call.cycleDuration).toBe("7");

    expect(vi.mocked(sonnerModule.toast.success)).toHaveBeenCalledWith(
      "Household settings saved.",
    );
  });

  it("HSET-03 pending-state disables submit button", () => {
    // Source-grep fallback: RHF's formState.isSubmitting is an internal
    // observable that flips only during in-flight handleSubmit promises;
    // asserting the DOM attribute at the transient moment is flaky in
    // jsdom. The plan's prescribed fallback (see <action> block) is a
    // source-grep on the component that the disabled wiring is present.
    const source = readFileSync(
      path.resolve(
        "src/components/household/settings/general-form.tsx",
      ),
      "utf8",
    );
    expect(source).toMatch(/disabled=\{form\.formState\.isSubmitting\}/);
  });

  it("HSET-03 empty name shows Zod error message from react-hook-form", async () => {
    render(
      <GeneralForm
        household={{ ...baseHousehold, name: "Home" }}
        householdSlug={baseSlug}
        viewerRole="OWNER"
      />,
    );

    const nameInput = document.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement;
    // Clear the field — RHF + Zod should surface the "Household name is
    // required." message from the schema.
    fireEvent.change(nameInput, { target: { value: "" } });

    const form = document.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    // RHF validation is async.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      screen.queryByText(/household name is required/i),
    ).not.toBeNull();

    // And the Server Action must not have been called on invalid submit.
    expect(vi.mocked(actions.updateHouseholdSettings)).not.toHaveBeenCalled();
  });

  it("HSET-03 cycleDuration Select renders 4 options (1/3/7/14 days)", () => {
    // The shadcn Select portal-renders its items, so a rendered-DOM query
    // for SelectItem nodes is unreliable in jsdom (Base UI needs
    // positioner + portal to mount). Source-grep on the component module
    // is the plan-prescribed fallback (matches the approach used across
    // tests/phase-06 for portal-surfaced options).
    const source = readFileSync(
      path.resolve(
        "src/components/household/settings/general-form.tsx",
      ),
      "utf8",
    );
    expect(source).toMatch(/value:\s*"1"/);
    expect(source).toMatch(/value:\s*"3"/);
    expect(source).toMatch(/value:\s*"7"/);
    expect(source).toMatch(/value:\s*"14"/);
    expect(source).toMatch(/1 day/);
    expect(source).toMatch(/3 days/);
    expect(source).toMatch(/7 days/);
    expect(source).toMatch(/14 days/);
  });
});
