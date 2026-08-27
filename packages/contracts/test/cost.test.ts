import { describe, expect, it } from "vitest";

import { costEstimateSchema, costLineItemSchema } from "../src/index.js";

describe("cost contracts", () => {
  it("does not permit an unavailable estimate to carry an invalid fabricated total", () => {
    expect(() =>
      costEstimateSchema.parse({
        status: "unavailable",
        currency: "USD",
        monthlyCostUSD: 1,
        lineItems: [],
        includedItems: [],
        excludedItems: [],
        gaps: [{ category: "compute", reason: "Missing price." }],
        confidence: 0,
        calculationVersion: "cost-v1",
      }),
    ).toThrow();
  });

  it("requires every line item to retain pricing traceability", () => {
    expect(() =>
      costLineItemSchema.parse({
        id: "compute",
        capabilityId: "compute.vm",
        description: "Compute",
        quantity: 730,
        unit: "instance-hour",
        unitPriceUSD: 0.1,
        monthlyCostUSD: 73,
        formula: "730 × 0.1",
        pricing: [],
      }),
    ).toThrow();
  });
});
