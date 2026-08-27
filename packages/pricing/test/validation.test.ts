import { describe, expect, it } from "vitest";

import {
  pricingFreshness,
  validateAdapterResult,
  type PricingAdapterResult,
} from "../src/index.js";

const result: PricingAdapterResult = {
  provider: "aws",
  retrievedAt: "2026-08-27T00:00:00Z",
  requestParameters: {},
  gaps: [],
  rawPayloads: [
    {
      source: "https://example.test",
      retrievedAt: "2026-08-27T00:00:00Z",
      pageNumber: 1,
      checksum: "abc",
      payload: {},
    },
  ],
  records: [
    {
      provider: "aws",
      serviceCategory: "compute",
      serviceName: "EC2",
      skuId: "sku",
      region: "eu-west-1",
      pricingModel: "on-demand",
      unit: "hour",
      unitPrice: "0",
      currency: "USD",
      retrievedAt: "2026-08-27T00:00:00Z",
      source: "https://example.test",
      sourcePriceId: "rate",
      sourceUnit: "Hrs",
      sourceUnitPrice: "0",
      unitConversionFactor: "1",
      tierStart: "0",
      rawPayloadIndex: 0,
      sourceAttributes: {},
    },
  ],
};

describe("pricing result validation", () => {
  it("retains valid zero-priced tiers", () => {
    expect(() => validateAdapterResult(result, ["eu-west-1"], ["compute"])).not.toThrow();
  });

  it("rejects missing required coverage", () => {
    expect(() => validateAdapterResult(result, ["eu-west-1"], ["public-egress"])).toThrow(
      /Missing required pricing coverage/,
    );
  });

  it("classifies freshness at the frozen policy boundaries", () => {
    const retrievedAt = new Date("2026-08-24T00:00:00Z");
    expect(pricingFreshness(retrievedAt, new Date("2026-08-26T00:00:00Z"))).toBe("fresh");
    expect(pricingFreshness(retrievedAt, new Date("2026-08-27T00:00:00Z"))).toBe("aging");
    expect(pricingFreshness(retrievedAt, new Date("2026-08-27T00:00:01Z"))).toBe("stale");
  });
});
