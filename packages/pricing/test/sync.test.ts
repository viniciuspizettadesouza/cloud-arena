import { describe, expect, it } from "vitest";

import {
  PricingSyncError,
  synchronizePricing,
  type PricingAdapter,
  type PricingSnapshotRepository,
} from "../src/index.js";

class MemoryRepository implements PricingSnapshotRepository {
  active = "previous";
  status = "created";
  fail = false;

  async beginSnapshot() {
    return { acquired: true, snapshotId: "staging" };
  }
  async setStatus(_snapshotId: string, status: "fetching" | "validating") {
    this.status = status;
  }
  async saveReadySnapshot() {
    if (this.fail) throw new PricingSyncError("persistence", "write failed");
    this.status = "ready";
  }
  async activateSnapshot() {
    this.status = "active";
    this.active = "staging";
  }
  async failSnapshot() {
    this.status = "failed";
  }
  async releaseProviderLock() {}
}

const adapter: PricingAdapter = {
  provider: "aws",
  version: "test",
  async fetch() {
    return {
      provider: "aws",
      retrievedAt: "2026-08-27T00:00:00Z",
      requestParameters: {},
      gaps: [],
      rawPayloads: [
        {
          source: "test",
          retrievedAt: "2026-08-27T00:00:00Z",
          pageNumber: 1,
          checksum: "x",
          payload: {},
        },
      ],
      records: [
        {
          provider: "aws",
          serviceCategory: "compute",
          serviceName: "EC2",
          skuId: "sku",
          region: "eu-west-1",
          pricingModel: "on-demand",
          unit: "hour",
          unitPrice: "1",
          currency: "USD",
          retrievedAt: "2026-08-27T00:00:00Z",
          source: "test",
          sourcePriceId: "rate",
          sourceUnit: "Hrs",
          sourceUnitPrice: "1",
          unitConversionFactor: "1",
          tierStart: "0",
          rawPayloadIndex: 0,
          sourceAttributes: {},
        },
      ],
    };
  },
};

describe("atomic pricing synchronization", () => {
  it("activates only after staging records are ready", async () => {
    const repository = new MemoryRepository();
    await expect(
      synchronizePricing(repository, adapter, { regions: ["eu-west-1"], categories: ["compute"] }),
    ).resolves.toMatchObject({ status: "active", recordCount: 1 });
    expect(repository.active).toBe("staging");
  });

  it("preserves the previous active snapshot when staging fails", async () => {
    const repository = new MemoryRepository();
    repository.fail = true;
    await expect(
      synchronizePricing(repository, adapter, { regions: ["eu-west-1"], categories: ["compute"] }),
    ).rejects.toThrow("write failed");
    expect(repository.active).toBe("previous");
    expect(repository.status).toBe("failed");
  });
});
