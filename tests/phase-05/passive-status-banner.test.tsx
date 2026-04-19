import { describe, it } from "vitest";

describe("PassiveStatusBanner (HNTF-04 / D-25)", () => {
  it.todo("HNTF-04 renders '{Alice} is watering this cycle.' subject");
  it.todo("HNTF-04 renders '{Bob} is next up.' tail when nextAssigneeName provided");
  it.todo(
    "HNTF-04 renders '{Owner} covers if no one's available next.' when nextAssigneeName is fallback owner variant",
  );
  it.todo(
    "HNTF-04 hides 'is next up' tail when memberCount === 1 OR nextAssigneeName is undefined",
  );
  it.todo("HNTF-04 meta shows 'Cycle ends {Tue Apr 23}'");
  it.todo("HNTF-04 uses bg-muted/50 and border-border tokens");
  it.todo("HNTF-04 Users icon has aria-hidden='true'");
  it.todo("HNTF-04 assignee name rendered as font-semibold");
});
