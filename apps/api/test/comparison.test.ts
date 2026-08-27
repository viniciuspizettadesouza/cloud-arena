import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { generateArchitectureCandidates } from "@cloud-arena/catalog";
import { normalizeWorkload } from "@cloud-arena/assumptions";
import type {
  ActivePricingSnapshot,
  ActivePricingSnapshotReader,
  PersistedPricingRecord,
  PricingCategory,
} from "@cloud-arena/pricing";
import { comparisonResultSchema } from "@cloud-arena/recommendation";

import { buildApp } from "../src/app.js";
import {
  capabilitiesResponseSchema,
  normalizeResponseSchema,
  providersResponseSchema,
  regionsResponseSchema,
  validationErrorResponseSchema,
} from "../src/schemas.js";

const referenceInput = {
  applicationType: "web-api",
  monthlyActiveUsers: 100_000,
  geography: { type: "continent", value: "Europe" },
  trafficProfile: "medium",
  availability: "production",
  priority: "balanced",
} as const;

let recordSequence = 0;

function record(
  provider: "aws" | "azure" | "gcp",
  region: string,
  snapshotId: string,
  category: PricingCategory,
  unit: string,
  price: number,
): PersistedPricingRecord {
  recordSequence += 1;
  return {
    id: `record-${recordSequence}`,
    snapshotId,
    rawPayloadId: `raw-${recordSequence}`,
    provider,
    serviceCategory: category,
    serviceName: `service-${category}`,
    skuId: `sku-${category}`,
    skuName: `sku-${category}`,
    region,
    pricingModel: "on-demand",
    unit,
    unitPrice: String(price),
    currency: "USD",
    retrievedAt: "2026-08-27T10:00:00Z",
    source: `fixture:${provider}`,
    sourcePriceId: `source-${recordSequence}`,
    sourceUnit: unit,
    sourceUnitPrice: String(price),
    unitConversionFactor: "1",
    tierStart: "0",
    sourceAttributes:
      provider === "aws" && (category === "database-compute" || category === "database-storage")
        ? { "Deployment Option": "Multi-AZ" }
        : {},
  };
}

function frozenSnapshots(): ActivePricingSnapshot[] {
  const normalized = normalizeWorkload(referenceInput);
  return generateArchitectureCandidates(normalized).map((candidate, providerIndex) => {
    const snapshotId = `snapshot-${candidate.provider}`;
    const storageUnit = candidate.provider === "gcp" ? "gib-month" : "gb-month";
    const capacityUnit =
      candidate.provider === "aws"
        ? "lcu-hour"
        : candidate.provider === "azure"
          ? "capacity-unit-hour"
          : "gib";
    const basePrice = [0.12, 0.1, 0.08][providerIndex] as number;
    return {
      id: snapshotId,
      provider: candidate.provider,
      retrievedAt: "2026-08-27T10:00:00Z",
      records: [
        record(candidate.provider, candidate.region.code, snapshotId, "compute", "hour", basePrice),
        record(
          candidate.provider,
          candidate.region.code,
          snapshotId,
          "database-compute",
          "hour",
          basePrice * 2,
        ),
        record(
          candidate.provider,
          candidate.region.code,
          snapshotId,
          "database-storage",
          storageUnit,
          basePrice,
        ),
        record(
          candidate.provider,
          candidate.region.code,
          snapshotId,
          "object-storage",
          storageUnit,
          basePrice / 5,
        ),
        record(
          candidate.provider,
          candidate.region.code,
          snapshotId,
          "load-balancer-hour",
          "hour",
          basePrice / 4,
        ),
        record(
          candidate.provider,
          candidate.region.code,
          snapshotId,
          "load-balancer-capacity",
          capacityUnit,
          basePrice / 10,
        ),
        record(
          candidate.provider,
          candidate.region.code,
          snapshotId,
          "public-egress",
          candidate.provider === "gcp" ? "gib" : "gb",
          basePrice,
        ),
      ],
    };
  });
}

function reader(snapshots: ActivePricingSnapshot[]): ActivePricingSnapshotReader {
  return {
    async getActiveSnapshot(provider) {
      return snapshots.find((snapshot) => snapshot.provider === provider);
    },
  };
}

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("reference-data routes", () => {
  it("returns providers, regions, and capabilities matching their public schemas", async () => {
    const app = buildApp();
    apps.push(app);
    const [providers, regions, capabilities] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/providers" }),
      app.inject({ method: "GET", url: "/v1/regions" }),
      app.inject({ method: "GET", url: "/v1/capabilities" }),
    ]);

    expect(providers.statusCode).toBe(200);
    expect(providersResponseSchema.parse(providers.json()).providers).toHaveLength(3);
    expect(regionsResponseSchema.parse(regions.json()).regions).toHaveLength(9);
    const parsedCapabilities = capabilitiesResponseSchema.parse(capabilities.json());
    expect(parsedCapabilities.capabilities).toHaveLength(5);
    expect(parsedCapabilities.capabilities.every(({ mappings }) => mappings.length === 3)).toBe(
      true,
    );
  });
});

describe("workload routes", () => {
  it("normalizes the canonical workload through the API", async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/workloads/normalize",
      payload: referenceInput,
    });

    expect(response.statusCode).toBe(200);
    const result = normalizeResponseSchema.parse(response.json());
    expect(result.normalizedWorkload).toMatchObject({
      requestsPerMonth: 60_000_000,
      monthlyEgressGB: 3_000,
      assumptionsVersion: "workload-v1",
    });
    expect(result.normalizedWorkload.assumptions.length).toBeGreaterThan(0);
  });

  it("returns a complete deterministic comparison and golden response", async () => {
    const snapshots = frozenSnapshots();
    const app = buildApp({}, { snapshotReader: reader(snapshots) });
    apps.push(app);
    const request = { method: "POST" as const, url: "/v1/compare", payload: referenceInput };
    const first = await app.inject(request);
    const second = await app.inject(request);

    expect(first.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
    const comparison = comparisonResultSchema.parse(first.json());
    expect(comparison.candidates).toHaveLength(3);
    expect(
      comparison.candidates.every(({ costEstimate }) => costEstimate.status === "available"),
    ).toBe(true);
    expect(comparison.recommendation.status).toBe("available");
    expect(comparison.versions).toMatchObject({
      catalog: "catalog-v1",
      assumptions: "workload-v1",
      scoring: "scoring-v1",
      costCalculation: "cost-v1",
    });
    const goldenHash = createHash("sha256").update(first.body).digest("hex");
    expect(goldenHash).toBe("4cb88468d38f8b19837b74663bb556f54579431b25fa7cf43f3bb41dead32121");
  });

  it("distinguishes invalid input from unavailable pricing", async () => {
    const app = buildApp();
    apps.push(app);
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/compare",
      payload: { ...referenceInput, monthlyActiveUsers: 0 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(validationErrorResponseSchema.parse(invalid.json()).error.code).toBe("VALIDATION_ERROR");

    const unavailable = await app.inject({
      method: "POST",
      url: "/v1/compare",
      payload: referenceInput,
    });
    expect(unavailable.statusCode).toBe(200);
    const comparison = comparisonResultSchema.parse(unavailable.json());
    expect(comparison.recommendation.status).toBe("unavailable");
    expect(
      comparison.candidates.every(({ costEstimate }) => costEstimate.status === "unavailable"),
    ).toBe(true);
  });

  it("keeps provider-specific gaps and budget violations visible", async () => {
    const snapshots = frozenSnapshots().filter(({ provider }) => provider !== "gcp");
    const app = buildApp({}, { snapshotReader: reader(snapshots) });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/compare",
      payload: { ...referenceInput, monthlyBudgetUSD: 1 },
    });
    expect(response.statusCode).toBe(200);
    const comparison = comparisonResultSchema.parse(response.json());
    const byProvider = Object.fromEntries(
      comparison.candidates.map((item) => [item.candidate.provider, item]),
    );
    expect(byProvider.aws?.constraints.status).toBe("violated");
    expect(byProvider.azure?.constraints.status).toBe("violated");
    expect(byProvider.gcp?.costEstimate.status).toBe("unavailable");
    expect(byProvider.gcp?.constraints.status).toBe("pending");
  });

  it("returns a distinct internal error when snapshot persistence fails", async () => {
    const app = buildApp(
      { logger: false },
      {
        snapshotReader: {
          async getActiveSnapshot() {
            throw new Error("database unavailable");
          },
        },
      },
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/compare",
      payload: referenceInput,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "The comparison could not be completed." },
    });
  });
});

describe("OpenAPI", () => {
  it("generates documentation for every implemented route", async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(response.statusCode).toBe(200);
    const document = response.json() as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths).sort()).toEqual(
      [
        "/health",
        "/openapi.json",
        "/v1/capabilities",
        "/v1/compare",
        "/v1/providers",
        "/v1/regions",
        "/v1/workloads/normalize",
      ].sort(),
    );
  });
});
