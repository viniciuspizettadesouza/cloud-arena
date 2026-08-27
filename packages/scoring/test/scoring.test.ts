import { describe, expect, it } from "vitest";

import type { CostEstimate } from "@cloud-arena/contracts";

import { loadScoringConfig, parseScoringConfig, scoreCandidates } from "../src/index.js";

function estimate(monthlyCostUSD?: number): CostEstimate {
  return monthlyCostUSD === undefined
    ? {
        status: "unavailable",
        currency: "USD",
        lineItems: [],
        includedItems: [],
        excludedItems: [],
        gaps: [{ category: "compute", reason: "Missing compute pricing." }],
        confidence: 0,
        calculationVersion: "cost-v1",
      }
    : {
        status: "available",
        currency: "USD",
        monthlyCostUSD,
        lineItems: [],
        includedItems: [],
        excludedItems: [],
        gaps: [],
        pricingSnapshotAt: "2026-08-27T10:00:00Z",
        confidence: 0.8,
        calculationVersion: "cost-v1",
      };
}

function candidate(id: string) {
  return {
    id,
    availability: "production" as const,
    components: [
      { scope: "regional" as const, deploymentOption: null },
      { scope: "regional" as const, deploymentOption: { id: "high-availability" } },
    ],
    excludedCapabilities: [{}],
  };
}

describe("scoring configuration", () => {
  it("loads all profiles with weights summing to one and no performance dimension", () => {
    const configuration = loadScoringConfig();
    for (const weights of Object.values(configuration.profiles))
      expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(Object.keys(configuration.profiles.balanced)).toEqual([
      "cost",
      "reliability-fit",
      "operational-simplicity",
      "portability",
    ]);
  });

  it("rejects profiles whose weights do not sum to one", () => {
    const source = `
version: scoring-v1
profiles:
  balanced: &bad { cost: 1, reliability-fit: 1, operational-simplicity: 0, portability: 0 }
  cost: *bad
  reliability: *bad
  low-operations: *bad
heuristics:
  reliabilityFit: { standard: 80, production: 90, high: 60, mission-critical: 30, confidence: 0.8 }
  operationalSimplicity: { base: 100, componentPenalty: 4, highAvailabilityPenalty: 5, globalComponentPenalty: 2, confidence: 0.6 }
  portability: { base: 80, excludedCapabilityPenalty: 5, confidence: 0.6 }
classification: { strongMinimum: 80, moderateMinimum: 60 }
`;
    expect(() => parseScoringConfig(source)).toThrow(/weights must sum to 1/);
  });
});

describe("scoreCandidates", () => {
  it("uses objective relative cost without hardcoding a provider winner", () => {
    const scores = scoreCandidates(
      [
        { candidate: candidate("first"), costEstimate: estimate(200) },
        { candidate: candidate("second"), costEstimate: estimate(100) },
      ],
      "cost",
    );
    expect(scores[0]?.dimensions[0]).toMatchObject({
      id: "cost",
      rawScore: 50,
      sourceType: "objective",
    });
    expect(scores[1]?.dimensions[0]).toMatchObject({ id: "cost", rawScore: 100 });
    expect(scores[1]?.totalScore).toBeGreaterThan(scores[0]?.totalScore ?? 0);
  });

  it("labels architecture rules and heuristics and assigns no fake cost score", () => {
    const [score] = scoreCandidates(
      [{ candidate: candidate("missing"), costEstimate: estimate() }],
      "balanced",
    );
    expect(score?.dimensions.map(({ sourceType }) => sourceType)).toEqual([
      "objective",
      "architecture-rule",
      "heuristic",
      "heuristic",
    ]);
    expect(score?.dimensions[0]).toMatchObject({ rawScore: 0, confidence: 0 });
  });
});
