import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mirror the existing settings-general-form.test.tsx mock pattern.
vi.mock("@/features/household/actions", () => ({
  updateHouseholdSettings: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const { GeneralForm } = await import(
  "@/components/household/settings/general-form"
);
const { updateHouseholdSettingsSchema } = await import(
  "@/features/household/schema"
);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const baseHousehold = {
  id: "clh00000000000000000000001",
  name: "Demo Plants",
  timezone: "UTC",
  cycleDuration: 7,
};
const baseSlug = "tAn97yhW";

describe("BUG-01 — UTC-seeded household timezone preservation", () => {
  it("BUG-01a renders <select value='UTC'> matching an existing <option value='UTC'> (not Africa/Abidjan)", () => {
    render(
      <GeneralForm
        household={baseHousehold}
        householdSlug={baseSlug}
        viewerRole="OWNER"
      />,
    );

    const timezoneSelect = document.querySelector(
      'select[name="timezone"]',
    ) as HTMLSelectElement;
    expect(timezoneSelect).not.toBeNull();

    // The bug: without the fix, .value reads as "Africa/Abidjan" because
    // the native select falls back to the alphabetically first option when
    // the value doesn't match any option. After the fix, the select has an
    // <option value="UTC"> and .value reads as "UTC".
    expect(timezoneSelect.value).toBe("UTC");

    // Cross-check: an <option value="UTC"> is present in the options list.
    const utcOption = Array.from(timezoneSelect.options).find(
      (opt) => opt.value === "UTC",
    );
    expect(utcOption).not.toBeUndefined();

    // Regression: Africa/Abidjan still renders (it's a valid IANA zone);
    // the fix did not remove it, only un-corrupted the UTC case.
    const abidjanOption = Array.from(timezoneSelect.options).find(
      (opt) => opt.value === "Africa/Abidjan",
    );
    expect(abidjanOption).not.toBeUndefined();
  });

  it("BUG-01b preserves a stored timezone not in Intl.supportedValuesOf", () => {
    // Simulate a household with a stored value that Intl doesn't know (e.g.
    // a legacy value or a platform-specific zone). The Set-union in the
    // useMemo should inject it as an option so the select can represent it.
    const exoticHousehold = { ...baseHousehold, timezone: "UTC" };
    render(
      <GeneralForm
        household={exoticHousehold}
        householdSlug={baseSlug}
        viewerRole="OWNER"
      />,
    );

    const timezoneSelect = document.querySelector(
      'select[name="timezone"]',
    ) as HTMLSelectElement;
    expect(timezoneSelect.value).toBe("UTC");
  });
});

describe("BUG-01 — updateHouseholdSettingsSchema timezone membership (defense-in-depth)", () => {
  const baseInput = {
    householdId: "clh00000000000000000000001",
    householdSlug: "tAn97yhW",
    name: "Demo Plants",
    cycleDuration: "7" as const,
  };

  it("accepts timezone: 'UTC'", () => {
    const result = updateHouseholdSettingsSchema.safeParse({
      ...baseInput,
      timezone: "UTC",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid IANA zone (America/New_York)", () => {
    const result = updateHouseholdSettingsSchema.safeParse({
      ...baseInput,
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the fallback Africa/Abidjan (still a real IANA zone)", () => {
    const result = updateHouseholdSettingsSchema.safeParse({
      ...baseInput,
      timezone: "Africa/Abidjan",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an arbitrary non-IANA string", () => {
    const result = updateHouseholdSettingsSchema.safeParse({
      ...baseInput,
      timezone: "Not/A/Zone",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const tzIssue = result.error.issues.find((i) =>
        i.path.includes("timezone"),
      );
      expect(tzIssue).not.toBeUndefined();
      expect(tzIssue!.message).toMatch(/Unknown timezone/i);
    }
  });

  it("rejects an empty string", () => {
    const result = updateHouseholdSettingsSchema.safeParse({
      ...baseInput,
      timezone: "",
    });
    expect(result.success).toBe(false);
  });
});
