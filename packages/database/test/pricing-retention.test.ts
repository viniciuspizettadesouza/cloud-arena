import { describe, expect, it } from "vitest";

import { pricingRetentionCutoffs } from "../src/pricing-repository.js";

describe("pricing retention", () => {
  it("freezes the 90-day raw and 13-month normalized retention boundaries", () => {
    const cutoffs = pricingRetentionCutoffs(new Date("2026-08-27T12:00:00Z"));
    expect(cutoffs.rawPayloadCutoff.toISOString()).toBe("2026-05-29T12:00:00.000Z");
    expect(cutoffs.normalizedSnapshotCutoff.toISOString()).toBe("2025-07-27T12:00:00.000Z");
  });

  it("clamps a calendar-month cutoff to the last valid target day", () => {
    const cutoffs = pricingRetentionCutoffs(new Date("2026-03-31T12:00:00Z"));
    expect(cutoffs.normalizedSnapshotCutoff.toISOString()).toBe("2025-02-28T12:00:00.000Z");
  });
});
