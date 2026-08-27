import type { CloudProvider } from "@cloud-arena/domain";

export interface PricingRecordIdentity {
  provider: CloudProvider;
  sourceId: string;
}

export const PRICING_CATEGORIES = [
  "compute",
  "database-compute",
  "database-storage",
  "object-storage",
  "load-balancer-hour",
  "load-balancer-capacity",
  "public-egress",
] as const;

export type PricingCategory = (typeof PRICING_CATEGORIES)[number];
export type PricingSnapshotStatus =
  "created" | "fetching" | "validating" | "ready" | "active" | "failed";
export type PricingErrorCategory =
  | "configuration"
  | "authentication"
  | "transient-provider"
  | "source-schema"
  | "normalization"
  | "coverage"
  | "persistence";

export interface PricingRecord {
  provider: CloudProvider;
  serviceCategory: PricingCategory;
  serviceName: string;
  skuId: string;
  skuName?: string;
  region: string;
  pricingModel: "on-demand";
  unit: string;
  unitPrice: string;
  currency: "USD";
  effectiveAt?: string;
  retrievedAt: string;
  source: string;
  sourcePriceId: string;
  sourceUnit: string;
  sourceUnitPrice: string;
  unitConversionFactor: string;
  tierStart: string;
  tierEnd?: string;
  catalogPublishedAt?: string;
  rawPayloadIndex: number;
  sourceAttributes: Record<string, string | number | boolean | null>;
}

export interface RawPricingPayload {
  source: string;
  retrievedAt: string;
  pageNumber: number;
  checksum: string;
  payload: unknown;
}

export interface PricingGap {
  provider: CloudProvider;
  region: string;
  category: PricingCategory;
  reason: string;
}

export interface PricingAdapterResult {
  provider: CloudProvider;
  retrievedAt: string;
  rawPayloads: RawPricingPayload[];
  records: PricingRecord[];
  gaps: PricingGap[];
  requestParameters: Record<string, unknown>;
}

export interface PricingAdapter {
  readonly provider: CloudProvider;
  readonly version: string;
  fetch(request: PricingSyncRequest): Promise<PricingAdapterResult>;
}

export interface PricingSyncRequest {
  regions: string[];
  categories: PricingCategory[];
  deadlineAt?: Date;
}

export interface PricingSnapshotStart {
  provider: CloudProvider;
  adapterVersion: string;
  regions: string[];
  categories: PricingCategory[];
  startedAt: Date;
}

export interface PricingSnapshotRepository {
  beginSnapshot(input: PricingSnapshotStart): Promise<{ acquired: boolean; snapshotId: string }>;
  setStatus(snapshotId: string, status: "fetching" | "validating"): Promise<void>;
  saveReadySnapshot(snapshotId: string, result: PricingAdapterResult): Promise<void>;
  activateSnapshot(snapshotId: string): Promise<void>;
  failSnapshot(snapshotId: string, error: PricingSyncError): Promise<void>;
  releaseProviderLock(provider: CloudProvider, snapshotId: string): Promise<void>;
}

export class PricingSyncError extends Error {
  readonly category: PricingErrorCategory;
  readonly details?: Record<string, unknown>;

  constructor(category: PricingErrorCategory, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PricingSyncError";
    this.category = category;
    if (details !== undefined) this.details = details;
  }
}

export function asPricingSyncError(error: unknown): PricingSyncError {
  if (error instanceof PricingSyncError) return error;
  return new PricingSyncError(
    "persistence",
    error instanceof Error ? error.message : "Unknown pricing synchronization failure.",
  );
}
