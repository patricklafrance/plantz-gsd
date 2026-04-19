import { describe, it } from "vitest";

describe("CycleStartBanner (HNTF-02 / D-25)", () => {
  it.todo("HNTF-02 renders 'You're up this cycle.' subject");
  it.todo(
    "HNTF-02 renders '{N} plants due · Cycle ends {Tue Apr 23}' meta when dueCount > 0",
  );
  it.todo(
    "HNTF-02 renders 'No plants due right now · Cycle ends {Tue Apr 23}' meta when dueCount === 0",
  );
  it.todo("HNTF-02 formats cycleEndDate with date-fns format(date, 'EEE MMM d')");
  it.todo("HNTF-02 outer div has role='status' (not 'alert')");
  it.todo("HNTF-02 uses bg-accent/10 and border-accent/30 tokens");
  it.todo("HNTF-02 Sparkles icon has aria-hidden='true'");
});
