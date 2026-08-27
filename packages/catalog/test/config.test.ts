import { describe, expect, it } from "vitest";

import { loadCatalog, parseCatalog } from "../src/index.js";

describe("semantic catalog", () => {
  it("loads the versioned YAML documents and complete provider matrix", () => {
    const catalog = loadCatalog();

    expect(catalog.version).toBe("catalog-v1");
    expect(catalog.capabilities.map(({ id }) => id)).toEqual([
      "compute.vm",
      "database.postgresql.managed",
      "storage.object",
      "network.load-balancer",
      "network.cdn",
    ]);
    expect(catalog.providers.map(({ id }) => id)).toEqual(["aws", "azure", "gcp"]);
    expect(catalog.providers.every(({ services }) => services.length === 5)).toBe(true);
    expect(catalog.regions).toHaveLength(9);
    expect(catalog.geographyDefaults).toHaveLength(9);
    expect(catalog.patterns.map(({ id }) => id)).toEqual(["vm-managed-postgres"]);
  });

  it("rejects duplicate IDs", () => {
    const catalog = loadCatalog();
    const invalid = structuredClone(catalog);
    invalid.capabilities.push(structuredClone(invalid.capabilities[0]!));

    expect(() => parseCatalog(invalid)).toThrow(/Duplicate capability ID compute\.vm/);
  });

  it("rejects invalid cross-document references", () => {
    const catalog = loadCatalog();
    const invalid = structuredClone(catalog);
    invalid.providers[0]!.services[0]!.regionSupport[0]!.regionId = "aws.unknown-1";

    expect(() => parseCatalog(invalid)).toThrow(/Unknown region reference aws\.unknown-1/);
  });

  it("rejects a default whose required service configuration lacks evidence", () => {
    const catalog = loadCatalog();
    const invalid = structuredClone(catalog);
    invalid.providers[0]!.services[0]!.regionSupport =
      invalid.providers[0]!.services[0]!.regionSupport.slice(1);

    expect(() => parseCatalog(invalid)).toThrow(/is not evidenced in aws\.eu-west-1/);
  });

  it("keeps provider billing SKU identifiers out of semantic configurations", () => {
    const catalog = loadCatalog();
    const invalid = structuredClone(catalog);
    invalid.providers[0]!.services[0]!.configuration.details.billingSkuId = "price-record-1";

    expect(() => parseCatalog(invalid)).toThrow(/billing SKU identifiers do not belong/);
  });
});
