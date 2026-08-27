import { describe, expect, it } from "vitest";

import { generateArchitectureCandidates } from "@cloud-arena/catalog";
import {
  normalizedWorkloadSchema,
  workloadInputSchema,
  type CostEstimate,
} from "@cloud-arena/contracts";

import { buildComparison } from "../src/index.js";

const input = workloadInputSchema.parse({
  applicationType: "web-api",
  monthlyActiveUsers: 100_000,
  geography: { type: "continent", value: "Europe" },
  trafficProfile: "medium",
  availability: "production",
  priority: "balanced",
  monthlyBudgetUSD: 225,
});

const normalized = normalizedWorkloadSchema.parse({
  monthlyActiveUsers: 100_000,
  requestsPerMonth: 60_000_000,
  averageRequestsPerSecond: 23.148148,
  peakRequestsPerSecond: 69.444444,
  averageResponseKB: 50,
  monthlyEgressGB: 3_000,
  databaseStorageGB: 100,
  objectStorageGB: 500,
  availability: "production",
  availabilityTarget: 0.999,
  regionPreference: "europe",
  provenance: [],
  assumptions: [],
  missingInformation: [],
  confidence: 0.61,
  confidenceLabel: "medium",
  confidenceFactors: [],
  assumptionsVersion: "workload-v1",
});

function available(monthlyCostUSD: number): CostEstimate {
  return {
    status: "available",
    currency: "USD",
    monthlyCostUSD,
    lineItems: [],
    includedItems: [],
    excludedItems: [],
    gaps: [],
    pricingSnapshotAt: "2026-08-27T10:00:00Z",
    confidence: 0.61,
    calculationVersion: "cost-v1",
  };
}

const unavailable: CostEstimate = {
  status: "unavailable",
  currency: "USD",
  lineItems: [],
  includedItems: [],
  excludedItems: [],
  gaps: [{ category: "compute", reason: "No active snapshot." }],
  confidence: 0,
  calculationVersion: "cost-v1",
};

describe("buildComparison", () => {
  it("ranks deterministically, evaluates constraints separately, and explains alternatives", () => {
    const candidates = generateArchitectureCandidates(normalized);
    const comparison = buildComparison(
      input,
      normalized,
      candidates.map((candidate, index) => ({
        candidate,
        costEstimate: available([300, 200, 250][index] as number),
      })),
      [],
    );

    expect(comparison.recommendation).toMatchObject({
      status: "available",
      provider: "azure",
      tie: false,
    });
    expect(comparison.candidates.map(({ constraints }) => constraints.status)).toEqual([
      "satisfied",
      "violated",
      "violated",
    ]);
    expect(comparison.candidates[0]?.score.dimensions).toHaveLength(4);
    expect(
      comparison.recommendation.status === "available"
        ? comparison.recommendation.runnerUpTradeOffs
        : [],
    ).toHaveLength(2);
  });

  it("changes the winner when objective inputs change", () => {
    const candidates = generateArchitectureCandidates(normalized);
    const withoutBudget = { ...input, monthlyBudgetUSD: undefined };
    const comparison = buildComparison(
      withoutBudget,
      normalized,
      candidates.map((candidate, index) => ({
        candidate,
        costEstimate: available([100, 200, 250][index] as number),
      })),
      [],
    );
    expect(comparison.recommendation).toMatchObject({ status: "available", provider: "aws" });
  });

  it("returns an explicit unavailable recommendation when every price is missing", () => {
    const comparison = buildComparison(
      input,
      normalized,
      generateArchitectureCandidates(normalized).map((candidate) => ({
        candidate,
        costEstimate: unavailable,
      })),
      [],
    );
    expect(comparison.recommendation).toMatchObject({ status: "unavailable" });
    expect(comparison.candidates.every(({ constraints }) => constraints.status === "pending")).toBe(
      true,
    );
  });

  it("discloses deterministic tie behavior", () => {
    const comparison = buildComparison(
      { ...input, monthlyBudgetUSD: undefined },
      normalized,
      generateArchitectureCandidates(normalized).map((candidate) => ({
        candidate,
        costEstimate: available(200),
      })),
      [],
    );
    expect(comparison.recommendation).toMatchObject({
      status: "available",
      provider: "aws",
      tie: true,
    });
  });
});
