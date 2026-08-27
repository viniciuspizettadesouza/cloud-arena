import { randomUUID } from "node:crypto";

import { and, eq, lt, ne } from "drizzle-orm";

import {
  PricingSyncError,
  type ActivePricingSnapshot,
  type ActivePricingSnapshotReader,
  type PersistedPricingRecord,
  type PricingAdapterResult,
  type PricingSnapshotRepository,
  type PricingSnapshotStart,
} from "@cloud-arena/pricing";

import type { Database } from "./client.js";
import {
  pricingRawPayloads,
  pricingRecords,
  pricingSnapshots,
  pricingSyncLocks,
} from "./schema.js";

function date(value: string | undefined): Date | null {
  return value === undefined ? null : new Date(value);
}

export interface PricingRetentionResult {
  rawPayloadsDeleted: number;
  snapshotsDeleted: number;
  rawPayloadCutoff: string;
  normalizedSnapshotCutoff: string;
}

export function pricingRetentionCutoffs(now: Date) {
  const rawPayloadCutoff = new Date(now);
  rawPayloadCutoff.setUTCDate(rawPayloadCutoff.getUTCDate() - 90);
  const targetMonth = now.getUTCMonth() - 13;
  const normalizedSnapshotCutoff = new Date(now);
  normalizedSnapshotCutoff.setUTCDate(1);
  normalizedSnapshotCutoff.setUTCMonth(targetMonth);
  const lastTargetDay = new Date(
    Date.UTC(
      normalizedSnapshotCutoff.getUTCFullYear(),
      normalizedSnapshotCutoff.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  normalizedSnapshotCutoff.setUTCDate(Math.min(now.getUTCDate(), lastTargetDay));
  return { rawPayloadCutoff, normalizedSnapshotCutoff };
}

export class PostgresPricingSnapshotRepository implements PricingSnapshotRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async beginSnapshot(input: PricingSnapshotStart) {
    const snapshotId = randomUUID();
    const staleBefore = new Date(input.startedAt.getTime() - 60 * 60 * 1_000);
    await this.#db.transaction(async (transaction) => {
      const [staleLock] = await transaction
        .select({ snapshotId: pricingSyncLocks.snapshotId })
        .from(pricingSyncLocks)
        .where(
          and(
            eq(pricingSyncLocks.provider, input.provider),
            lt(pricingSyncLocks.acquiredAt, staleBefore),
          ),
        )
        .for("update");
      if (staleLock === undefined) return;
      await transaction
        .update(pricingSnapshots)
        .set({
          status: "failed",
          isActive: false,
          failedAt: input.startedAt,
          errorCategory: "persistence",
          errorMessage: "Abandoned pricing sync lock was reaped after one hour.",
        })
        .where(
          and(eq(pricingSnapshots.id, staleLock.snapshotId), ne(pricingSnapshots.status, "active")),
        );
      await transaction
        .delete(pricingSyncLocks)
        .where(
          and(
            eq(pricingSyncLocks.provider, input.provider),
            eq(pricingSyncLocks.snapshotId, staleLock.snapshotId),
          ),
        );
    });
    const acquired = await this.#db
      .insert(pricingSyncLocks)
      .values({ provider: input.provider, snapshotId, acquiredAt: input.startedAt })
      .onConflictDoNothing()
      .returning({ snapshotId: pricingSyncLocks.snapshotId });
    if (acquired.length === 0) {
      const [lock] = await this.#db
        .select({ snapshotId: pricingSyncLocks.snapshotId })
        .from(pricingSyncLocks)
        .where(eq(pricingSyncLocks.provider, input.provider));
      if (lock === undefined)
        throw new PricingSyncError("persistence", "Pricing lock disappeared while being acquired.");
      return { acquired: false, snapshotId: lock.snapshotId };
    }
    try {
      await this.#db.insert(pricingSnapshots).values({
        id: snapshotId,
        provider: input.provider,
        status: "created",
        adapterVersion: input.adapterVersion,
        requestedRegions: input.regions,
        requestedCategories: input.categories,
        startedAt: input.startedAt,
      });
      return { acquired: true, snapshotId };
    } catch (error) {
      await this.releaseProviderLock(input.provider, snapshotId);
      throw error;
    }
  }

  async setStatus(snapshotId: string, status: "fetching" | "validating") {
    const expected = status === "fetching" ? "created" : "fetching";
    const updated = await this.#db
      .update(pricingSnapshots)
      .set({ status })
      .where(and(eq(pricingSnapshots.id, snapshotId), eq(pricingSnapshots.status, expected)))
      .returning({ id: pricingSnapshots.id });
    if (updated.length !== 1)
      throw new PricingSyncError("persistence", `Snapshot ${snapshotId} cannot enter ${status}.`);
  }

  async saveReadySnapshot(snapshotId: string, result: PricingAdapterResult) {
    await this.#db.transaction(async (transaction) => {
      const rawIds: string[] = [];
      for (const payload of result.rawPayloads) {
        const id = randomUUID();
        rawIds.push(id);
        await transaction.insert(pricingRawPayloads).values({
          id,
          snapshotId,
          source: payload.source,
          pageNumber: payload.pageNumber,
          checksum: payload.checksum,
          retrievedAt: new Date(payload.retrievedAt),
          payload: payload.payload,
        });
      }
      for (const record of result.records) {
        const rawPayloadId = rawIds[record.rawPayloadIndex];
        if (rawPayloadId === undefined)
          throw new PricingSyncError(
            "persistence",
            "Normalized record references an absent raw payload.",
          );
        await transaction.insert(pricingRecords).values({
          id: randomUUID(),
          snapshotId,
          rawPayloadId,
          provider: record.provider,
          serviceCategory: record.serviceCategory,
          serviceName: record.serviceName,
          skuId: record.skuId,
          skuName: record.skuName ?? null,
          region: record.region,
          pricingModel: record.pricingModel,
          unit: record.unit,
          unitPrice: record.unitPrice,
          currency: record.currency,
          effectiveAt: date(record.effectiveAt),
          retrievedAt: new Date(record.retrievedAt),
          source: record.source,
          sourcePriceId: record.sourcePriceId,
          sourceUnit: record.sourceUnit,
          sourceUnitPrice: record.sourceUnitPrice,
          unitConversionFactor: record.unitConversionFactor,
          tierStart: record.tierStart,
          tierEnd: record.tierEnd ?? null,
          catalogPublishedAt: date(record.catalogPublishedAt),
          sourceAttributes: record.sourceAttributes,
        });
      }
      const updated = await transaction
        .update(pricingSnapshots)
        .set({
          status: "ready",
          retrievedAt: new Date(result.retrievedAt),
          requestParameters: result.requestParameters,
          gaps: result.gaps,
          rawRecordCount: result.rawPayloads.length,
          normalizedRecordCount: result.records.length,
        })
        .where(and(eq(pricingSnapshots.id, snapshotId), eq(pricingSnapshots.status, "validating")))
        .returning({ id: pricingSnapshots.id });
      if (updated.length !== 1)
        throw new PricingSyncError("persistence", `Snapshot ${snapshotId} is not validating.`);
    });
  }

  async activateSnapshot(snapshotId: string) {
    await this.#db.transaction(async (transaction) => {
      const [snapshot] = await transaction
        .select({ provider: pricingSnapshots.provider })
        .from(pricingSnapshots)
        .where(and(eq(pricingSnapshots.id, snapshotId), eq(pricingSnapshots.status, "ready")))
        .for("update");
      if (snapshot === undefined)
        throw new PricingSyncError("persistence", `Snapshot ${snapshotId} is not ready.`);
      await transaction
        .update(pricingSnapshots)
        .set({ isActive: false })
        .where(
          and(
            eq(pricingSnapshots.provider, snapshot.provider),
            eq(pricingSnapshots.isActive, true),
            ne(pricingSnapshots.id, snapshotId),
          ),
        );
      const activated = await transaction
        .update(pricingSnapshots)
        .set({ status: "active", isActive: true, activatedAt: new Date() })
        .where(and(eq(pricingSnapshots.id, snapshotId), eq(pricingSnapshots.status, "ready")))
        .returning({ id: pricingSnapshots.id });
      if (activated.length !== 1)
        throw new PricingSyncError("persistence", `Snapshot ${snapshotId} activation raced.`);
    });
  }

  async failSnapshot(snapshotId: string, error: PricingSyncError) {
    await this.#db
      .update(pricingSnapshots)
      .set({
        status: "failed",
        isActive: false,
        failedAt: new Date(),
        errorCategory: error.category,
        errorMessage: error.message,
        errorDetails: error.details ?? null,
      })
      .where(and(eq(pricingSnapshots.id, snapshotId), ne(pricingSnapshots.status, "active")));
  }

  async releaseProviderLock(provider: PricingSnapshotStart["provider"], snapshotId: string) {
    await this.#db
      .delete(pricingSyncLocks)
      .where(
        and(eq(pricingSyncLocks.provider, provider), eq(pricingSyncLocks.snapshotId, snapshotId)),
      );
  }

  async enforceRetention(now = new Date()): Promise<PricingRetentionResult> {
    const { rawPayloadCutoff, normalizedSnapshotCutoff } = pricingRetentionCutoffs(now);
    return this.#db.transaction(async (transaction) => {
      const snapshots = await transaction
        .delete(pricingSnapshots)
        .where(
          and(
            eq(pricingSnapshots.isActive, false),
            lt(pricingSnapshots.startedAt, normalizedSnapshotCutoff),
          ),
        )
        .returning({ id: pricingSnapshots.id });
      const payloads = await transaction
        .delete(pricingRawPayloads)
        .where(lt(pricingRawPayloads.retrievedAt, rawPayloadCutoff))
        .returning({ id: pricingRawPayloads.id });
      return {
        rawPayloadsDeleted: payloads.length,
        snapshotsDeleted: snapshots.length,
        rawPayloadCutoff: rawPayloadCutoff.toISOString(),
        normalizedSnapshotCutoff: normalizedSnapshotCutoff.toISOString(),
      };
    });
  }
}

export class PostgresActivePricingSnapshotReader implements ActivePricingSnapshotReader {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async getActiveSnapshot(
    provider: ActivePricingSnapshot["provider"],
  ): Promise<ActivePricingSnapshot | undefined> {
    const [snapshot] = await this.#db
      .select({ id: pricingSnapshots.id, retrievedAt: pricingSnapshots.retrievedAt })
      .from(pricingSnapshots)
      .where(
        and(
          eq(pricingSnapshots.provider, provider),
          eq(pricingSnapshots.status, "active"),
          eq(pricingSnapshots.isActive, true),
        ),
      );
    if (snapshot === undefined || snapshot.retrievedAt === null) return undefined;
    const records = await this.#db
      .select()
      .from(pricingRecords)
      .where(eq(pricingRecords.snapshotId, snapshot.id));
    return {
      id: snapshot.id,
      provider,
      retrievedAt: snapshot.retrievedAt.toISOString(),
      records: records.map((record) => ({
        id: record.id,
        snapshotId: record.snapshotId,
        rawPayloadId: record.rawPayloadId ?? `retained-metadata:${record.id}`,
        provider,
        serviceCategory:
          record.serviceCategory as ActivePricingSnapshot["records"][number]["serviceCategory"],
        serviceName: record.serviceName,
        skuId: record.skuId,
        ...(record.skuName === null ? {} : { skuName: record.skuName }),
        region: record.region,
        pricingModel: "on-demand",
        unit: record.unit,
        unitPrice: record.unitPrice,
        currency: "USD",
        ...(record.effectiveAt === null ? {} : { effectiveAt: record.effectiveAt.toISOString() }),
        retrievedAt: record.retrievedAt.toISOString(),
        source: record.source,
        sourcePriceId: record.sourcePriceId,
        sourceUnit: record.sourceUnit,
        sourceUnitPrice: record.sourceUnitPrice,
        unitConversionFactor: record.unitConversionFactor,
        tierStart: record.tierStart,
        ...(record.tierEnd === null ? {} : { tierEnd: record.tierEnd }),
        ...(record.catalogPublishedAt === null
          ? {}
          : { catalogPublishedAt: record.catalogPublishedAt.toISOString() }),
        sourceAttributes: record.sourceAttributes as PersistedPricingRecord["sourceAttributes"],
      })),
    };
  }
}
