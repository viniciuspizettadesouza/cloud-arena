import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { generateArchitectureCandidates, type ArchitectureCandidate } from "@cloud-arena/catalog";
import { normalizedWorkloadSchema, type NormalizedWorkload } from "@cloud-arena/contracts";
import type {
  ActivePricingSnapshot,
  PersistedPricingRecord,
  PricingCategory,
} from "@cloud-arena/pricing";

import {
  BYTES_PER_GIB,
  DECIMAL_BYTES_PER_GB,
  estimateCandidateCost,
  estimateCandidateCosts,
  MONTHLY_HOURS,
} from "../src/index.js";

interface EgressPolicy {
  id: string;
  provider: "aws" | "azure" | "gcp";
  geographies: string[];
  providerUnit: "GB" | "GiB";
  allowance: number;
  tiers: Array<{ start: number; end: number | null; rate: number }>;
  boundaryCases?: number[];
  boundaryCasesProviderUnits?: number[];
}

const egressFixture = JSON.parse(
  readFileSync(
    new URL("../../../docs/research/fixtures/public-egress-boundaries.json", import.meta.url),
    "utf8",
  ),
) as { policies: EgressPolicy[] };

function workload(
  regionPreference = "europe",
  overrides: Partial<NormalizedWorkload> = {},
): NormalizedWorkload {
  return normalizedWorkloadSchema.parse({
    monthlyActiveUsers: 10_000,
    requestsPerMonth: 6_000_000,
    averageRequestsPerSecond: 2.314815,
    peakRequestsPerSecond: 6.944444,
    averageResponseKB: 50,
    monthlyEgressGB: 300,
    databaseStorageGB: 20,
    objectStorageGB: 100,
    availability: "standard",
    availabilityTarget: 0.99,
    regionPreference,
    provenance: [],
    assumptions: [],
    missingInformation: [],
    confidence: 0.61,
    confidenceLabel: "medium",
    confidenceFactors: [],
    assumptionsVersion: "workload-v1",
    ...overrides,
  });
}

function candidateFor(provider: "aws" | "azure" | "gcp", input: NormalizedWorkload) {
  return generateArchitectureCandidates(input).find(
    (candidate) => candidate.provider === provider,
  ) as ArchitectureCandidate | undefined;
}

let recordSequence = 0;

function record(
  candidate: ArchitectureCandidate,
  category: PricingCategory,
  unit: string,
  unitPrice: number,
  tierStart = 0,
  tierEnd?: number,
): PersistedPricingRecord {
  recordSequence += 1;
  return {
    id: `record-${recordSequence}`,
    snapshotId: `snapshot-${candidate.provider}`,
    rawPayloadId: `raw-payload-${recordSequence}`,
    provider: candidate.provider,
    serviceCategory: category,
    serviceName: `service-${category}`,
    skuId: `sku-${category}`,
    skuName: `sku-${category}`,
    region: candidate.region.code,
    pricingModel: "on-demand",
    unit,
    unitPrice: String(unitPrice),
    currency: "USD",
    retrievedAt: "2026-08-27T10:00:00Z",
    source: `fixture:${candidate.provider}`,
    sourcePriceId: `source-${recordSequence}`,
    sourceUnit: unit,
    sourceUnitPrice: String(unitPrice),
    unitConversionFactor: "1",
    tierStart: String(tierStart),
    ...(tierEnd === undefined ? {} : { tierEnd: String(tierEnd) }),
    sourceAttributes: {},
  };
}

function baseSnapshot(
  candidate: ArchitectureCandidate,
  overrides: Partial<Record<PricingCategory, PersistedPricingRecord[]>> = {},
): ActivePricingSnapshot {
  const storageUnit = candidate.provider === "gcp" ? "gib-month" : "gb-month";
  const capacityUnit =
    candidate.provider === "aws"
      ? "lcu-hour"
      : candidate.provider === "azure"
        ? "capacity-unit-hour"
        : "gib";
  const defaults: Record<PricingCategory, PersistedPricingRecord[]> = {
    compute: [record(candidate, "compute", "hour", 0.1)],
    "database-compute": [record(candidate, "database-compute", "hour", 0.2)],
    "database-storage": [record(candidate, "database-storage", storageUnit, 0.1)],
    "object-storage": [record(candidate, "object-storage", storageUnit, 0.02)],
    "load-balancer-hour": [record(candidate, "load-balancer-hour", "hour", 0.025)],
    "load-balancer-capacity": [record(candidate, "load-balancer-capacity", capacityUnit, 0.008)],
    "public-egress": [
      record(candidate, "public-egress", candidate.provider === "gcp" ? "gib" : "gb", 0.09),
    ],
  };
  return {
    id: `snapshot-${candidate.provider}`,
    provider: candidate.provider,
    retrievedAt: "2026-08-27T10:00:00Z",
    records: Object.values({ ...defaults, ...overrides }).flat(),
  };
}

function referenceCost(quantity: number, policy: EgressPolicy): number {
  const providerQuantity =
    policy.providerUnit === "GiB" ? (quantity * DECIMAL_BYTES_PER_GB) / BYTES_PER_GIB : quantity;
  const billable = Math.max(0, providerQuantity - policy.allowance);
  return policy.tiers.reduce((total, tier) => {
    const end = tier.end ?? billable;
    return total + Math.max(0, Math.min(billable, end) - tier.start) * tier.rate;
  }, 0);
}

describe("cost engine", () => {
  it("calculates a complete AWS baseline with test-visible formulas and traceability", () => {
    const input = workload();
    const candidate = candidateFor("aws", input);
    expect(candidate).toBeDefined();
    const estimate = estimateCandidateCost(
      input,
      candidate as ArchitectureCandidate,
      baseSnapshot(candidate as ArchitectureCandidate),
    );

    expect(estimate.status).toBe("available");
    if (estimate.status !== "available") throw new Error("Expected an available estimate.");
    expect(estimate.monthlyCostUSD).toBeCloseTo(261.698, 9);
    expect(estimate.lineItems.map(({ id }) => id)).toEqual([
      "compute",
      "database-compute",
      "database-storage",
      "object-storage",
      "load-balancer",
      "public-egress",
    ]);
    expect(estimate.lineItems.find(({ id }) => id === "compute")).toMatchObject({
      quantity: MONTHLY_HOURS,
      unitPriceUSD: 0.1,
      monthlyCostUSD: 73,
    });
    expect(estimate.lineItems.find(({ id }) => id === "public-egress")).toMatchObject({
      quantity: 200,
      monthlyCostUSD: 18,
    });
    expect(estimate.lineItems.every(({ pricing }) => pricing.length > 0)).toBe(true);
    expect(estimate.pricingSnapshotAt).toBe("2026-08-27T10:00:00Z");
    expect(estimate.confidence).toBe(0.61);
  });

  it("applies the Azure high-availability database factor", () => {
    const input = workload("europe", { availability: "production" });
    const candidate = candidateFor("azure", input) as ArchitectureCandidate;
    const estimate = estimateCandidateCost(input, candidate, baseSnapshot(candidate));

    expect(estimate.lineItems.find(({ id }) => id === "database-compute")).toMatchObject({
      quantity: 2 * MONTHLY_HOURS,
      monthlyCostUSD: 292,
    });
  });

  it("propagates a missing required price without a fake total", () => {
    const input = workload();
    const candidate = candidateFor("aws", input) as ArchitectureCandidate;
    const snapshot = baseSnapshot(candidate);
    snapshot.records = snapshot.records.filter(
      ({ serviceCategory }) => serviceCategory !== "database-storage",
    );
    const estimate = estimateCandidateCost(input, candidate, snapshot);

    expect(estimate.status).toBe("unavailable");
    expect(estimate).not.toHaveProperty("monthlyCostUSD");
    expect(estimate.gaps).toContainEqual(expect.objectContaining({ category: "database-storage" }));
    expect(estimate.lineItems.length).toBeGreaterThan(0);
    expect(estimate.confidence).toBe(0);
  });

  it("prices tiered storage and converts decimal GB to GiB exactly once", () => {
    const input = workload("europe", {
      databaseStorageGB: 107.3741824,
      objectStorageGB: 107.3741824,
    });
    const candidate = candidateFor("gcp", input) as ArchitectureCandidate;
    const objectPrices = [
      record(candidate, "object-storage", "gib-month", 0.02, 0, 50),
      record(candidate, "object-storage", "gib-month", 0.01, 50),
    ];
    const estimate = estimateCandidateCost(
      input,
      candidate,
      baseSnapshot(candidate, { "object-storage": objectPrices }),
    );

    expect(estimate.lineItems.find(({ id }) => id === "database-storage")).toMatchObject({
      quantity: 100,
      monthlyCostUSD: 10,
    });
    expect(estimate.lineItems.find(({ id }) => id === "object-storage")).toMatchObject({
      quantity: 100,
      unitPriceUSD: null,
      monthlyCostUSD: 1.5,
    });
  });

  it("assembles one estimate per candidate and preserves provider-specific gaps", () => {
    const input = workload();
    const candidates = generateArchitectureCandidates(input);
    const aws = candidates.find(({ provider }) => provider === "aws") as ArchitectureCandidate;
    const estimates = estimateCandidateCosts(input, candidates, [baseSnapshot(aws)]);

    expect(estimates.map(({ costEstimate }) => costEstimate.status)).toEqual([
      "available",
      "unavailable",
      "unavailable",
    ]);
    expect(estimates.map(({ candidate }) => candidate.provider)).toEqual(["aws", "azure", "gcp"]);
  });

  it("returns all explicit gaps when no active snapshot exists", () => {
    const input = workload();
    const candidate = candidateFor("gcp", input) as ArchitectureCandidate;
    const estimate = estimateCandidateCost(input, candidate, undefined);

    expect(estimate.status).toBe("unavailable");
    expect(estimate.gaps.map(({ category }) => category)).toEqual([
      "compute",
      "database-compute",
      "database-storage",
      "object-storage",
      "load-balancer-hour",
      "load-balancer-capacity",
      "public-egress",
    ]);
  });

  for (const policy of egressFixture.policies) {
    it(`honors every ${policy.id} egress tier boundary`, () => {
      const geography = policy.geographies[0] as string;
      const input = workload(geography);
      const candidate = candidateFor(policy.provider, input) as ArchitectureCandidate;
      const unit = policy.providerUnit === "GiB" ? "gib" : "gb";
      const prices = policy.tiers.map((tier) =>
        record(candidate, "public-egress", unit, tier.rate, tier.start, tier.end ?? undefined),
      );
      const boundaries = policy.boundaryCases ?? policy.boundaryCasesProviderUnits ?? [];
      for (const boundary of boundaries) {
        for (const delta of [-0.001, 0, 0.001]) {
          const providerQuantity = boundary + delta;
          const decimalGB =
            policy.providerUnit === "GiB"
              ? (providerQuantity * BYTES_PER_GIB) / DECIMAL_BYTES_PER_GB
              : providerQuantity;
          const workloadQuantity = decimalGB + policy.allowance;
          const caseInput = workload(geography, { monthlyEgressGB: workloadQuantity });
          const caseCandidate = candidateFor(policy.provider, caseInput) as ArchitectureCandidate;
          const estimate = estimateCandidateCost(
            caseInput,
            caseCandidate,
            baseSnapshot(caseCandidate, { "public-egress": prices }),
          );
          const line = estimate.lineItems.find(({ id }) => id === "public-egress");
          expect(line?.monthlyCostUSD).toBeCloseTo(referenceCost(workloadQuantity, policy), 8);
        }
      }
    });
  }
});
