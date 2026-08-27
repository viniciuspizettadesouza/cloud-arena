import { describe, expect, it } from "vitest";

import { normalizedWorkloadSchema, type Availability } from "@cloud-arena/contracts";

import { generateArchitectureCandidates, loadCatalog } from "../src/index.js";

function workload(availability: Availability = "production") {
  return normalizedWorkloadSchema.parse({
    monthlyActiveUsers: 100_000,
    requestsPerMonth: 60_000_000,
    averageRequestsPerSecond: 23.148148,
    peakRequestsPerSecond: 69.444444,
    averageResponseKB: 50,
    monthlyEgressGB: 3_000,
    databaseStorageGB: 100,
    objectStorageGB: 500,
    availability,
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
}

describe("generateArchitectureCandidates", () => {
  it("generates exactly one deterministic baseline candidate per provider", () => {
    const candidates = generateArchitectureCandidates(workload());

    expect(candidates.map(({ provider }) => provider)).toEqual(["aws", "azure", "gcp"]);
    expect(candidates.map(({ region }) => region.code)).toEqual([
      "eu-west-1",
      "westeurope",
      "europe-west1",
    ]);
    for (const candidate of candidates) {
      expect(candidate.catalogVersion).toBe("catalog-v1");
      expect(candidate.patternId).toBe("vm-managed-postgres");
      expect(candidate.regionSelection.latencyClaim).toBe(false);
      expect(candidate.components.map(({ capabilityId }) => capabilityId)).toEqual([
        "network.load-balancer",
        "compute.vm",
        "database.postgresql.managed",
        "storage.object",
      ]);
      expect(candidate.components.find(({ id }) => id === "compute")?.quantity).toBe(2);
      expect(candidate.components.find(({ id }) => id === "postgresql")?.deploymentOption?.id).toBe(
        "high-availability",
      );
      expect(candidate.excludedCapabilities).toMatchObject([
        { capabilityId: "network.cdn", reasonCode: "insufficient-cacheability-input" },
      ]);
      expect(candidate.graph.edges).toContainEqual({
        from: "internet",
        to: "load-balancer",
        relationship: "request-flow",
      });
    }
    expect(generateArchitectureCandidates(workload())).toEqual(candidates);
  });

  it("applies availability rules without silently changing service families", () => {
    const catalog = loadCatalog();
    const standard = generateArchitectureCandidates(workload("standard"), catalog);
    const critical = generateArchitectureCandidates(workload("mission-critical"), catalog);

    expect(
      standard.every(
        ({ components }) => components.find(({ id }) => id === "compute")?.quantity === 1,
      ),
    ).toBe(true);
    expect(
      standard.every(
        ({ components }) =>
          components.find(({ id }) => id === "postgresql")?.deploymentOption?.id === "single-zone",
      ),
    ).toBe(true);
    expect(
      critical.every(({ caveats }) =>
        caveats.some((item) => item.includes("single-region baseline")),
      ),
    ).toBe(true);
    expect(
      critical.map(({ components }) => components.map(({ configurationId }) => configurationId)),
    ).toEqual(
      standard.map(({ components }) => components.map(({ configurationId }) => configurationId)),
    );
  });
});
