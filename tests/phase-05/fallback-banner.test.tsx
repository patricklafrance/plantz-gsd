import { describe, it } from "vitest";

describe("FallbackBanner (D-12.4 / D-25)", () => {
  it.todo(
    "viewerIsOwner && isPaused=false → 'Nobody's available — you're covering this cycle.' subject",
  );
  it.todo(
    "!viewerIsOwner && isPaused=false → 'Nobody's available — {Owner} is covering this cycle.' subject",
  );
  it.todo("isPaused=true → 'This week's rotation is paused.' subject");
  it.todo("outer div has role='alert' (not 'status')");
  it.todo("uses bg-destructive/10 and border-destructive/30 tokens");
  it.todo("AlertTriangle icon has aria-hidden='true'");
  it.todo(
    "viewerIsOwner meta: 'Check back when members update their availability.'",
  );
  it.todo(
    "!viewerIsOwner meta: 'You can update your availability in settings.'",
  );
});
