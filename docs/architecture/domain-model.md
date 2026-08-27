# Domain Model

Runtime contracts will be authored with Zod and TypeScript types inferred where practical. Interfaces below describe intent; implementation may use schemas with equivalent inferred types.

## Workload input

```ts
interface WorkloadInput {
  applicationType: "web-api";
  monthlyActiveUsers: number;
  geography: {
    type: "continent" | "country" | "provider-region";
    value: string;
  };
  trafficProfile: "low" | "medium" | "high" | "spiky";
  availability: "standard" | "production" | "high" | "mission-critical";
  priority: "cost" | "balanced" | "reliability" | "low-operations";
  requestsPerMonth?: number;
  averageRequestsPerUserPerDay?: number;
  peakRequestsPerSecond?: number;
  averageResponseKB?: number;
  databaseStorageGB?: number;
  databaseReadWriteProfile?: string;
  objectStorageGB?: number;
  monthlyEgressGB?: number;
  monthlyBudgetUSD?: number;
  managedServicesPreference?: "low" | "medium" | "high";
  vendorLockInTolerance?: "low" | "medium" | "high";
}
```

`WorkloadInput` records exactly what the user supplied. Quick and Advanced Mode both produce this contract.

## Normalized workload, provenance, and confidence

```ts
type ValueSource = "user" | "derived" | "default";

interface FieldProvenance {
  field: string;
  source: ValueSource;
  description?: string;
}

interface NormalizedWorkload {
  monthlyActiveUsers: number;
  requestsPerMonth: number;
  averageRequestsPerSecond: number;
  peakRequestsPerSecond: number;
  averageResponseKB: number;
  monthlyEgressGB: number;
  databaseStorageGB: number;
  objectStorageGB: number;
  availability: "standard" | "production" | "high" | "mission-critical";
  availabilityTarget: number;
  regionPreference: string;
  provenance: FieldProvenance[];
  assumptions: Assumption[];
  missingInformation: MissingInformation[];
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  confidenceFactors: ConfidenceFactor[];
  assumptionsVersion: string;
}
```

Assumptions are versioned, visible, and overridable. Missing information carries impact so consumers can identify the inputs most likely to improve the result.

## Capabilities, regions, and candidates

```ts
type CloudProvider = "aws" | "azure" | "gcp";

interface CloudRegion {
  provider: CloudProvider;
  id: string;
  name: string;
  country?: string;
  continent: string;
  latitude?: number;
  longitude?: number;
}

interface ArchitectureCandidate {
  id: string;
  provider: CloudProvider;
  patternId: string;
  region: CloudRegion;
  components: ArchitectureComponent[];
  costEstimate: CostEstimate;
  constraints: ConstraintResult;
  scores: ScoreBreakdown;
  totalScore: number;
}
```

Components implement provider-neutral capabilities through curated service mappings. Geographic distance must not be represented as measured latency.

## Pricing and cost

```ts
interface PricingRecord {
  provider: CloudProvider;
  serviceCategory: string;
  serviceName: string;
  skuId: string;
  skuName?: string;
  region: string;
  pricingModel: "on-demand" | "reserved" | "spot" | "commitment";
  unit: string;
  unitPrice: number;
  currency: "USD";
  effectiveAt?: string;
  retrievedAt: string;
  source: string;
}

interface CostLineItem {
  capability: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  monthlyCostUSD: number;
  pricingRecordId: string;
  formula: string;
}

interface CostEstimate {
  status: "available" | "unavailable";
  monthlyCostUSD?: number;
  lineItems: CostLineItem[];
  includedItems: string[];
  excludedItems: string[];
  pricingSnapshotAt?: string;
  confidence: number;
}
```

Initial line items cover compute, database compute and storage, object storage, network egress, and load balancing. A missing required price makes the affected estimate unavailable.

## Constraints and scoring

```ts
interface ConstraintViolation {
  constraint: string;
  expected: string;
  actual: number | string;
}

interface ConstraintResult {
  status: "not-applicable" | "pending" | "satisfied" | "violated";
  satisfied: boolean | null;
  violations: ConstraintViolation[];
}

type ScoreDimension =
  | "cost"
  | "reliabilityFit"
  | "operationalSimplicity"
  | "portability";

interface ScoreComponent {
  dimension: ScoreDimension;
  score: number;
  weight: number;
  source: "provider-pricing" | "architecture-rule" | "cloud-arena-heuristic";
  confidence: "low" | "medium" | "high";
  reasons: string[];
}

interface ScoreBreakdown {
  components: ScoreComponent[];
  scoringVersion: string;
}
```

The initial hard constraint is monthly budget. `not-applicable` represents an absent budget and `pending` represents a configured budget before an estimate is available. Constraint satisfaction is reported independently of rank.

## Comparison result

```ts
interface ComparisonResult {
  input: WorkloadInput;
  normalizedWorkload: NormalizedWorkload;
  candidates: ArchitectureCandidate[];
  recommendation: {
    candidateId: string;
    score: number;
    reasons: string[];
    caveats: string[];
  };
  assumptions: Assumption[];
  missingInformation: MissingInformation[];
  confidence: number;
  metadata: {
    pricingSnapshotAt: string;
    catalogVersion: string;
    assumptionsVersion: string;
    scoringVersion: string;
  };
}
```

The exact `Assumption`, `MissingInformation`, and component schemas will be finalized with normalization, while preserving provenance, impact, versioning, and structured machine consumption.
