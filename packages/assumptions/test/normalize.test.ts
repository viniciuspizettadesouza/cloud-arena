import { describe, expect, it } from "vitest";

import { workloadInputSchema } from "@cloud-arena/contracts";

import { normalizeWorkload } from "../src/index.js";
import reference from "./fixtures/reference-normalization.json" with { type: "json" };

const referenceInput = workloadInputSchema.parse(reference.input);

describe("normalizeWorkload", () => {
  it("matches the frozen reference normalization scenario", () => {
    const result = normalizeWorkload(referenceInput);
    const normalizedValues = Object.fromEntries(
      Object.keys(reference.normalizedValues).map((field) => [
        field,
        result[field as keyof typeof result],
      ]),
    );

    expect(normalizedValues).toEqual(reference.normalizedValues);
    expect(
      Object.fromEntries(result.provenance.map(({ field, source }) => [field, source])),
    ).toEqual(reference.provenanceSources);
    expect(result.assumptions.map(({ id }) => id)).toEqual(reference.assumptionIds);
    expect(result.confidence).toBe(reference.confidence);
    expect(result.confidenceLabel).toBe(reference.confidenceLabel);
    expect(result.confidenceFactors.map(({ source }) => source)).toEqual(
      reference.confidenceSources,
    );
    expect(result.missingInformation.map(({ field }) => field)).toEqual(
      reference.missingInformation,
    );
    expect(result.assumptionsVersion).toBe(reference.assumptionsVersion);
  });

  it("gives explicit user overrides precedence and raises confidence", () => {
    const result = normalizeWorkload({
      ...referenceInput,
      requestsPerMonth: 1_000_000,
      peakRequestsPerSecond: 100,
      averageResponseKB: 10,
      monthlyEgressGB: 25,
      databaseStorageGB: 5,
      objectStorageGB: 0,
    });

    expect(result).toMatchObject({
      requestsPerMonth: 1_000_000,
      peakRequestsPerSecond: 100,
      averageResponseKB: 10,
      monthlyEgressGB: 25,
      databaseStorageGB: 5,
      objectStorageGB: 0,
      confidence: 1,
      confidenceLabel: "high",
      assumptions: [],
      missingInformation: [],
    });
    expect(
      result.provenance
        .filter(({ field }) =>
          [
            "requestsPerMonth",
            "peakRequestsPerSecond",
            "averageResponseKB",
            "monthlyEgressGB",
            "databaseStorageGB",
            "objectStorageGB",
          ].includes(field),
        )
        .every(({ source }) => source === "user"),
    ).toBe(true);
  });

  it("uses an explicit requests-per-user override before deriving monthly volume", () => {
    const result = normalizeWorkload({
      ...referenceInput,
      averageRequestsPerUserPerDay: 10,
    });

    expect(result.requestsPerMonth).toBe(30_000_000);
    expect(result.assumptions.map(({ id }) => id)).not.toContain(
      "traffic.medium.requestsPerUserPerDay",
    );
  });

  it("is deterministic for identical inputs and configuration", () => {
    expect(normalizeWorkload(referenceInput)).toEqual(normalizeWorkload(referenceInput));
  });
});
