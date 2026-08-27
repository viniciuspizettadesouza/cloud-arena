import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseAzureFixture, type AzureFixture } from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/representative-prices.json", import.meta.url), "utf8"),
) as AzureFixture;

describe("Azure Retail Prices parser", () => {
  it("normalizes every frozen baseline category with source identity", () => {
    const result = parseAzureFixture(fixture);
    expect(result.records).toHaveLength(7);
    expect(result.records[0]).toMatchObject({
      provider: "azure",
      region: "westeurope",
      skuName: "Standard_D2as_v5",
      unit: "hour",
      unitPrice: "0.104",
      sourcePriceId: "c47ff26a-3d0d-5e1f-bcd2-a0ba8e9cc4e9:0:2021-11-01T00:00:00Z",
    });
    expect(
      result.records.find(({ serviceCategory }) => serviceCategory === "load-balancer-capacity"),
    ).toMatchObject({ unit: "capacity-unit-hour" });
  });
});
