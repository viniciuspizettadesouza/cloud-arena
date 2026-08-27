import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { generateArchitectureCandidates } from "@cloud-arena/catalog";
import { normalizeWorkload } from "@cloud-arena/assumptions";
import { workloadInputSchema, type WorkloadInput } from "@cloud-arena/contracts";
import type {
  ActivePricingSnapshot,
  PersistedPricingRecord,
  PricingCategory,
} from "@cloud-arena/pricing";
import { comparisonResultSchema } from "@cloud-arena/recommendation";

import { buildApp } from "../src/app.js";

interface GoldenScenarios {
  version: string;
  datasetVersions: Record<string, string>;
  scenarios: Array<{ id: string; input: WorkloadInput; sha256: string }>;
}

interface GoldenPricing {
  version: string;
  retrievedAt: string;
  rates: Record<"aws" | "azure" | "gcp", Record<PricingCategory, number>>;
}

interface CalculatorReport {
  summary: { expectedComparisons: number; invalidComparison: number };
  comparisons: Array<{
    scenario: string;
    provider: "aws" | "azure" | "gcp";
    status: "invalid-comparison";
    blockers: string[];
  }>;
}

const scenarios = JSON.parse(
  readFileSync(
    new URL("../../../docs/validation/fixtures/golden-scenarios-v1.json", import.meta.url),
    "utf8",
  ),
) as GoldenScenarios;
const pricing = JSON.parse(
  readFileSync(
    new URL("../../../docs/validation/fixtures/pricing-snapshot-v1.json", import.meta.url),
    "utf8",
  ),
) as GoldenPricing;
const calculatorReport = JSON.parse(
  readFileSync(
    new URL("../../../docs/validation/fixtures/calculator-comparison-v1.json", import.meta.url),
    "utf8",
  ),
) as CalculatorReport;

const categories = [
  "compute",
  "database-compute",
  "database-storage",
  "object-storage",
  "load-balancer-hour",
  "load-balancer-capacity",
  "public-egress",
] as const;

function snapshotsFor(input: WorkloadInput, scenarioId: string): ActivePricingSnapshot[] {
  const candidates = generateArchitectureCandidates(normalizeWorkload(input));
  return candidates.map((candidate) => {
    const snapshotId = `${pricing.version}:${scenarioId}:${candidate.provider}`;
    const records = categories.map((category, index): PersistedPricingRecord => {
      const unit =
        category === "database-storage" || category === "object-storage"
          ? candidate.provider === "gcp"
            ? "gib-month"
            : "gb-month"
          : category === "load-balancer-capacity"
            ? candidate.provider === "aws"
              ? "lcu-hour"
              : candidate.provider === "azure"
                ? "capacity-unit-hour"
                : "gib"
            : category === "public-egress"
              ? candidate.provider === "gcp"
                ? "gib"
                : "gb"
              : "hour";
      return {
        id: `${snapshotId}:${category}`,
        snapshotId,
        rawPayloadId: `${snapshotId}:raw`,
        provider: candidate.provider,
        serviceCategory: category,
        serviceName: `Pinned ${category}`,
        skuId: `${pricing.version}-${category}`,
        skuName: `Pinned ${category}`,
        region: candidate.region.code,
        pricingModel: "on-demand",
        unit,
        unitPrice: String(pricing.rates[candidate.provider][category]),
        currency: "USD",
        retrievedAt: pricing.retrievedAt,
        source: `fixture:${pricing.version}`,
        sourcePriceId: `${scenarioId}-${candidate.provider}-${index}`,
        sourceUnit: unit,
        sourceUnitPrice: String(pricing.rates[candidate.provider][category]),
        unitConversionFactor: "1",
        tierStart: "0",
        sourceAttributes:
          candidate.provider === "aws" &&
          (category === "database-compute" || category === "database-storage")
            ? {
                "Deployment Option":
                  candidate.availability === "standard" ? "Single-AZ" : "Multi-AZ",
              }
            : {},
      };
    });
    return {
      id: snapshotId,
      provider: candidate.provider,
      retrievedAt: pricing.retrievedAt,
      records,
    };
  });
}

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map(async (app) => app.close())));

describe("Milestone 7 golden scenarios", () => {
  for (const scenario of scenarios.scenarios) {
    it(`reproduces ${scenario.id} from pinned datasets`, async () => {
      const input = workloadInputSchema.parse(scenario.input);
      const snapshots = snapshotsFor(input, scenario.id);
      const app = buildApp(
        {},
        {
          snapshotReader: {
            async getActiveSnapshot(provider) {
              return snapshots.find((snapshot) => snapshot.provider === provider);
            },
          },
        },
      );
      apps.push(app);
      const first = await app.inject({ method: "POST", url: "/v1/compare", payload: input });
      const second = await app.inject({ method: "POST", url: "/v1/compare", payload: input });
      expect(first.statusCode).toBe(200);
      expect(second.body).toBe(first.body);
      const result = comparisonResultSchema.parse(first.json());
      expect(result.candidates).toHaveLength(3);
      expect(
        result.candidates.every(({ costEstimate }) => costEstimate.status === "available"),
      ).toBe(true);
      expect(result.versions).toMatchObject({
        catalog: scenarios.datasetVersions.catalog,
        assumptions: scenarios.datasetVersions.assumptions,
        scoring: scenarios.datasetVersions.scoring,
        costCalculation: scenarios.datasetVersions.costCalculation,
      });
      expect(
        result.versions.pricingSnapshots.every(
          (snapshot) =>
            snapshot.status === "active" &&
            snapshot.snapshotId.startsWith(scenarios.datasetVersions.pricing ?? ""),
        ),
      ).toBe(true);
      expect(createHash("sha256").update(first.body).digest("hex")).toBe(scenario.sha256);
    });
  }

  it("keeps every missing calculator comparison explicitly invalid", () => {
    const identities = calculatorReport.comparisons.map(
      ({ scenario, provider }) => `${scenario}:${provider}`,
    );
    expect(new Set(identities).size).toBe(9);
    expect(calculatorReport.comparisons).toHaveLength(calculatorReport.summary.expectedComparisons);
    expect(
      calculatorReport.comparisons.every(({ status }) => status === "invalid-comparison"),
    ).toBe(true);
    expect(calculatorReport.summary.invalidComparison).toBe(9);
  });
});
