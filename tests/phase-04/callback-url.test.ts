import { describe, expect, test } from "vitest";
import { validateCallbackUrl } from "@/features/auth/callback-url";

describe("validateCallbackUrl (Phase 4 GAP-04-01 open-redirect guard)", () => {
  describe("accepts same-origin relative paths", () => {
    test.each([
      "/dashboard",
      "/h/abc123/dashboard",
      "/join/0fa6c466ea9ef0115342ef0a8f3112051dc418227dff5d7967a2ada18f1ab923",
      "/login?next=/foo",
      "/path/with/segments?q=1&r=2",
      "/with#fragment",
    ])("%s -> returns the value", (input) => {
      expect(validateCallbackUrl(input)).toBe(input);
    });
  });

  describe("rejects non-string values", () => {
    test.each([null, undefined, 0, 1, false, true, {}, [], NaN])(
      "%j -> null",
      (input) => {
        expect(validateCallbackUrl(input)).toBeNull();
      },
    );
  });

  describe("rejects empty string", () => {
    test("'' -> null", () => {
      expect(validateCallbackUrl("")).toBeNull();
    });
  });

  describe("rejects absolute URLs (any scheme)", () => {
    test.each([
      "http://evil.com/path",
      "https://evil.com/path",
      "javascript:alert(1)/x",
      "data:text/html,<script>",
      "ftp://example.com/path",
      "ws://example.com/path",
      "file:///etc/passwd",
    ])("%s -> null", (input) => {
      // Schemes with `://` are unconditionally rejected; others (javascript:, data:)
      // also fail the leading-`/` check below.
      expect(validateCallbackUrl(input)).toBeNull();
    });
  });

  describe("rejects protocol-relative URLs", () => {
    test.each(["//evil.com", "//evil.com/path", "//user:pass@evil.com"])(
      "%s -> null",
      (input) => {
        expect(validateCallbackUrl(input)).toBeNull();
      },
    );
  });

  describe("rejects backslash-prefixed paths (browser normalization quirk)", () => {
    test("/\\evil.com -> null", () => {
      expect(validateCallbackUrl("/\\evil.com")).toBeNull();
    });
  });

  describe("rejects values not starting with /", () => {
    test.each([
      "dashboard",
      "../../../etc/passwd",
      "evil.com",
      "?query=only",
      "#fragment-only",
    ])("%s -> null", (input) => {
      expect(validateCallbackUrl(input)).toBeNull();
    });
  });
});
