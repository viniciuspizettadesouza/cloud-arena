import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseAwsFixture, type AwsFixture } from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/representative-prices.json", import.meta.url), "utf8"),
) as AwsFixture;

describe("AWS Price List parser", () => {
  it("normalizes every frozen baseline category with traceability", () => {
    const result = parseAwsFixture(fixture);
    expect(result.records).toHaveLength(7);
    expect(new Set(result.records.map(({ serviceCategory }) => serviceCategory))).toEqual(
      new Set([
        "compute",
        "database-compute",
        "database-storage",
        "object-storage",
        "load-balancer-hour",
        "load-balancer-capacity",
        "public-egress",
      ]),
    );
    expect(result.records[0]).toMatchObject({
      provider: "aws",
      region: "eu-west-1",
      unit: "hour",
      unitPrice: "0.1123500000",
      sourcePriceId: "VM6M2Z5EVA6UVM4F.JRTCKXETXF.6YS6EN2CT7",
      rawPayloadIndex: 0,
    });
  });

  it("preserves finite and infinite tier boundaries", () => {
    const result = parseAwsFixture(fixture);
    expect(
      result.records.find(({ serviceCategory }) => serviceCategory === "object-storage"),
    ).toMatchObject({
      tierStart: "0",
      tierEnd: "51200",
    });
    expect(
      result.records.find(({ serviceCategory }) => serviceCategory === "compute"),
    ).not.toHaveProperty("tierEnd");
  });
});
