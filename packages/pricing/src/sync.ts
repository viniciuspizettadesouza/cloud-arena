import {
  PricingSyncError,
  asPricingSyncError,
  type PricingAdapter,
  type PricingSnapshotRepository,
  type PricingSyncRequest,
} from "./model.js";
import { validateAdapterResult } from "./validation.js";

export interface PricingSyncOutcome {
  provider: PricingAdapter["provider"];
  snapshotId: string;
  status: "active" | "already-running";
  recordCount: number;
  gapCount: number;
}

export async function synchronizePricing(
  repository: PricingSnapshotRepository,
  adapter: PricingAdapter,
  request: PricingSyncRequest,
): Promise<PricingSyncOutcome> {
  const started = await repository.beginSnapshot({
    provider: adapter.provider,
    adapterVersion: adapter.version,
    regions: request.regions,
    categories: request.categories,
    startedAt: new Date(),
  });
  if (!started.acquired)
    return {
      provider: adapter.provider,
      snapshotId: started.snapshotId,
      status: "already-running",
      recordCount: 0,
      gapCount: 0,
    };

  try {
    await repository.setStatus(started.snapshotId, "fetching");
    const result = await adapter.fetch(request);
    await repository.setStatus(started.snapshotId, "validating");
    validateAdapterResult(result, request.regions, request.categories);
    await repository.saveReadySnapshot(started.snapshotId, result);
    await repository.activateSnapshot(started.snapshotId);
    return {
      provider: adapter.provider,
      snapshotId: started.snapshotId,
      status: "active",
      recordCount: result.records.length,
      gapCount: result.gaps.length,
    };
  } catch (error) {
    const syncError = asPricingSyncError(error);
    try {
      await repository.failSnapshot(started.snapshotId, syncError);
    } catch (failureError) {
      throw new PricingSyncError(
        "persistence",
        "Pricing sync failed and its failure could not be recorded.",
        {
          syncError: syncError.message,
          persistenceError:
            failureError instanceof Error ? failureError.message : String(failureError),
        },
      );
    }
    throw syncError;
  } finally {
    await repository.releaseProviderLock(adapter.provider, started.snapshotId);
  }
}
