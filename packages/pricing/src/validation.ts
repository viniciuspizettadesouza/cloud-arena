import {
  PRICING_CATEGORIES,
  PricingSyncError,
  type PricingAdapterResult,
  type PricingCategory,
  type PricingRecord,
} from "./model.js";

function decimal(value: string, field: string): number {
  if (value.trim() === "" || !Number.isFinite(Number(value)))
    throw new PricingSyncError("normalization", `Invalid ${field}: ${value}.`);
  return Number(value);
}

function validateRecord(record: PricingRecord, rawPayloadCount: number): void {
  if (!PRICING_CATEGORIES.includes(record.serviceCategory))
    throw new PricingSyncError(
      "normalization",
      `Unsupported pricing category: ${record.serviceCategory}.`,
    );
  if (record.currency !== "USD" || record.pricingModel !== "on-demand")
    throw new PricingSyncError("normalization", "Only USD on-demand prices may activate.");
  if (decimal(record.unitPrice, "unit price") < 0)
    throw new PricingSyncError("normalization", "Unit prices cannot be negative.");
  if (decimal(record.sourceUnitPrice, "source unit price") < 0)
    throw new PricingSyncError("normalization", "Source unit prices cannot be negative.");
  if (decimal(record.unitConversionFactor, "unit conversion factor") <= 0)
    throw new PricingSyncError("normalization", "Unit conversion factors must be positive.");
  const start = decimal(record.tierStart, "tier start");
  if (start < 0) throw new PricingSyncError("normalization", "Tier starts cannot be negative.");
  if (record.tierEnd !== undefined && decimal(record.tierEnd, "tier end") <= start)
    throw new PricingSyncError("normalization", "Tier end must be greater than tier start.");
  if (record.rawPayloadIndex < 0 || record.rawPayloadIndex >= rawPayloadCount)
    throw new PricingSyncError("normalization", "Pricing record has no raw payload reference.");
}

function recordKey(record: PricingRecord): string {
  return [record.provider, record.sourcePriceId, record.effectiveAt ?? "", record.region].join("|");
}

export function validateAdapterResult(
  result: PricingAdapterResult,
  expectedRegions: readonly string[],
  expectedCategories: readonly PricingCategory[],
): void {
  if (result.rawPayloads.length === 0)
    throw new PricingSyncError("source-schema", "Provider returned no raw payloads.");
  if (result.records.length === 0)
    throw new PricingSyncError("coverage", "Provider returned no normalized pricing records.");

  const identities = new Set<string>();
  for (const record of result.records) {
    if (record.provider !== result.provider)
      throw new PricingSyncError("normalization", "Record provider does not match its adapter.");
    validateRecord(record, result.rawPayloads.length);
    const key = recordKey(record);
    if (identities.has(key))
      throw new PricingSyncError("normalization", `Duplicate source price identity: ${key}.`);
    identities.add(key);
  }

  const missing: string[] = [];
  for (const region of expectedRegions) {
    for (const category of expectedCategories) {
      if (
        !result.records.some(
          (record) => record.region === region && record.serviceCategory === category,
        )
      )
        missing.push(`${region}/${category}`);
    }
  }
  if (missing.length > 0)
    throw new PricingSyncError(
      "coverage",
      `Missing required pricing coverage: ${missing.join(", ")}.`,
      {
        missing,
      },
    );
}

export const PRICING_FRESHNESS_POLICY = {
  version: "pricing-freshness-v1",
  freshThroughHours: 48,
  agingThroughHours: 72,
} as const;

export type PricingFreshness = "fresh" | "aging" | "stale";

export function pricingFreshness(retrievedAt: Date, now: Date = new Date()): PricingFreshness {
  const ageHours = (now.getTime() - retrievedAt.getTime()) / 3_600_000;
  if (ageHours <= PRICING_FRESHNESS_POLICY.freshThroughHours) return "fresh";
  if (ageHours <= PRICING_FRESHNESS_POLICY.agingThroughHours) return "aging";
  return "stale";
}
