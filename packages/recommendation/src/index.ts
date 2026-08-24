import type { CloudProvider } from "@cloud-arena/domain";
import type { PricingRecordIdentity } from "@cloud-arena/pricing";

export interface RecommendationEvidence {
  pricing: PricingRecordIdentity[];
  provider: CloudProvider;
}

export const RECOMMENDATION_PACKAGE = "@cloud-arena/recommendation" as const;
