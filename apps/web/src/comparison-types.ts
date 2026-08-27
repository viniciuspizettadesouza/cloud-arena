export type ProviderId = "aws" | "azure" | "gcp";

interface PricingTrace {
  pricingRecordId: string;
  serviceName: string;
  skuId: string;
  skuName?: string;
  region: string;
  unit: string;
  unitPriceUSD: string;
  sourcePriceId: string;
  retrievedAt: string;
}

interface CostEstimateFields {
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    monthlyCostUSD: number;
    formula: string;
    pricing: PricingTrace[];
  }>;
  includedItems: string[];
  excludedItems: string[];
  gaps: Array<{ category: string; reason: string }>;
}

type CostEstimate =
  | (CostEstimateFields & { status: "available"; monthlyCostUSD: number })
  | (CostEstimateFields & { status: "unavailable" });

export interface RankedCandidate {
  rank: number;
  candidate: {
    id: string;
    provider: ProviderId;
    patternId: string;
    region: { code: string; name: string };
    regionSelection: { rationale: string };
    components: Array<{
      id: string;
      name: string;
      serviceName: string;
      configurationName: string;
      quantity: number;
    }>;
    graph: {
      externalNodes: Array<{ id: string; name: string }>;
      edges: Array<{ from: string; to: string; relationship: string }>;
    };
  };
  costEstimate: CostEstimate;
  constraints: {
    status: string;
    violations: Array<{ constraint: string; expected: string; actual: string | number }>;
  };
  score: {
    totalScore: number;
    classification: string;
    dimensions: Array<{
      id: string;
      rawScore: number;
      weight: number;
      sourceType: string;
      confidence: number;
      reasons: string[];
    }>;
  };
}

export interface ComparisonResult {
  normalizedWorkload: {
    provenance: Array<{ field: string; source: string; description: string }>;
  };
  candidates: RankedCandidate[];
  recommendation:
    | {
        status: "available";
        candidateId: string;
        provider: ProviderId;
        tie: boolean;
        reasons: string[];
        caveats: string[];
        runnerUpTradeOffs: Array<{
          candidateId: string;
          provider: ProviderId;
          reasons: string[];
        }>;
      }
    | { status: "unavailable"; reason: string };
  assumptions: Array<{
    id: string;
    field: string;
    value: string | number | boolean;
    description: string;
  }>;
  missingInformation: Array<{ field: string; impact: string; reason: string }>;
  confidence: number;
  confidenceLabel: string;
  versions: {
    catalog: string;
    assumptions: string;
    scoring: string;
    costCalculation: string;
    pricingSnapshots: Array<
      | { provider: ProviderId; status: "missing" }
      | { provider: ProviderId; status: "active"; retrievedAt: string }
    >;
  };
}
