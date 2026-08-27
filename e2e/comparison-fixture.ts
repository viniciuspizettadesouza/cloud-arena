const referenceInput = {
  applicationType: "web-api",
  monthlyActiveUsers: 100_000,
  geography: { type: "continent", value: "Europe" },
  trafficProfile: "medium",
  availability: "production",
  priority: "balanced",
};

function candidate(provider: "aws" | "azure" | "gcp", rank: number, region: string, code: string) {
  const service = { aws: "Amazon EC2", azure: "Azure Virtual Machines", gcp: "Compute Engine" }[
    provider
  ];
  return {
    rank,
    candidate: {
      id: `${provider}:vm-managed-postgres:${code}`,
      catalogVersion: "catalog-v1",
      provider,
      patternId: "vm-managed-postgres",
      availability: "production",
      region: {
        id: `${provider}-${code}`,
        provider,
        code,
        name: region,
        geography: "europe",
        country: "EU",
      },
      regionSelection: {
        rationale: "Selected by the versioned Europe geography default.",
        latencyClaim: false,
      },
      components: [
        {
          id: "compute",
          name: "Compute",
          capabilityId: "compute-vm",
          serviceId: "compute",
          serviceName: service,
          configurationId: "baseline",
          configurationName: "Baseline VM",
          configurationDetails: {},
          scope: "regional",
          quantity: 2,
          deploymentOption: null,
          caveats: [],
        },
      ],
      graph: {
        externalNodes: [{ id: "internet", name: "Internet" }],
        edges: [{ from: "internet", to: "compute", relationship: "request-flow" }],
      },
      excludedCapabilities: [],
      caveats: [],
    },
    costEstimate: {
      status: "unavailable",
      currency: "USD",
      lineItems: [],
      includedItems: ["Compute"],
      excludedItems: ["Taxes and support"],
      gaps: [{ category: "compute", reason: "No active pricing snapshot." }],
      confidence: 0,
      calculationVersion: "cost-v1",
    },
    constraints: {
      constraint: "monthly-budget",
      status: "pending",
      satisfied: null,
      violations: [],
    },
    score: {
      totalScore: 52,
      classification: "moderate",
      scoringVersion: "scoring-v1",
      profile: "balanced",
      dimensions: [
        {
          id: "cost",
          rawScore: 0,
          weight: 0.35,
          weightedContribution: 0,
          sourceType: "objective",
          confidence: 0,
          reasons: ["Pricing unavailable."],
        },
        {
          id: "reliability-fit",
          rawScore: 80,
          weight: 0.3,
          weightedContribution: 24,
          sourceType: "architecture-rule",
          confidence: 0.8,
          reasons: ["Versioned production availability rule."],
        },
        {
          id: "operational-simplicity",
          rawScore: 80,
          weight: 0.2,
          weightedContribution: 16,
          sourceType: "heuristic",
          confidence: 0.6,
          reasons: ["Versioned component-count heuristic."],
        },
        {
          id: "portability",
          rawScore: 80,
          weight: 0.15,
          weightedContribution: 12,
          sourceType: "heuristic",
          confidence: 0.6,
          reasons: ["Provider-neutral pattern heuristic."],
        },
      ],
    },
  };
}

const assumption = {
  id: "response-size",
  field: "averageResponseKB",
  value: 50,
  description: "Default response size for medium traffic.",
  overridable: true,
};
const missing = {
  field: "peakRequestsPerSecond",
  impact: "high",
  reason: "Peak rate was derived from the traffic profile.",
};

export const comparisonFixture = {
  input: referenceInput,
  normalizedWorkload: {
    monthlyActiveUsers: 100_000,
    requestsPerMonth: 60_000_000,
    averageRequestsPerSecond: 23.14,
    peakRequestsPerSecond: 69.44,
    averageResponseKB: 50,
    monthlyEgressGB: 3000,
    databaseStorageGB: 100,
    objectStorageGB: 500,
    availability: "production",
    availabilityTarget: 0.999,
    regionPreference: "europe",
    assumptionsVersion: "workload-v1",
    confidence: 0.61,
    confidenceLabel: "medium",
    provenance: [
      { field: "monthlyActiveUsers", source: "user", description: "Provided by the user." },
    ],
    assumptions: [assumption],
    missingInformation: [missing],
    confidenceFactors: [],
  },
  candidates: [
    candidate("aws", 1, "EU (Ireland)", "eu-west-1"),
    candidate("azure", 2, "West Europe", "westeurope"),
    candidate("gcp", 3, "Belgium", "europe-west1"),
  ],
  recommendation: {
    status: "unavailable",
    reason:
      "No candidate has complete required public pricing; a recommendation would be misleading.",
  },
  assumptions: [assumption],
  missingInformation: [missing],
  confidence: 0.61,
  confidenceLabel: "medium",
  pricingNotices: [
    ["aws", "AWS", "https://aws.amazon.com/pricing/", "https://calculator.aws/"],
    [
      "azure",
      "Microsoft Azure",
      "https://azure.microsoft.com/pricing/",
      "https://azure.microsoft.com/pricing/calculator/",
    ],
    [
      "gcp",
      "Google Cloud",
      "https://cloud.google.com/pricing/",
      "https://cloud.google.com/products/calculator",
    ],
  ].map(([provider, providerName, pricingPageUrl, calculatorUrl]) => ({
    provider,
    providerName,
    pricingPageUrl,
    calculatorUrl,
    disclaimer: `Estimated from ${providerName} public list prices. Actual charges may differ. Taxes, discounts, commitments, credits, and unmodeled usage are excluded. Verify with the official calculator and pricing page. Cloud Arena is not affiliated with or endorsed by ${providerName}.`,
  })),
  versions: {
    catalog: "catalog-v1",
    assumptions: "workload-v1",
    scoring: "scoring-v1",
    costCalculation: "cost-v1",
    pricingSnapshots: [
      { provider: "aws", status: "missing" },
      { provider: "azure", status: "missing" },
      { provider: "gcp", status: "missing" },
    ],
  },
};
