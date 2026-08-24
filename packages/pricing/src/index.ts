import type { CloudProvider } from "@cloud-arena/domain";

export interface PricingRecordIdentity {
  provider: CloudProvider;
  sourceId: string;
}

export const PRICING_PACKAGE = "@cloud-arena/pricing" as const;
