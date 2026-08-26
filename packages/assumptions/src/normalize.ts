import {
  normalizedWorkloadSchema,
  workloadInputSchema,
  type Assumption,
  type ConfidenceFactor,
  type ConfidenceLabel,
  type FieldProvenance,
  type Impact,
  type MissingInformation,
  type NormalizedWorkload,
  type ValueSource,
  type WorkloadInput,
} from "@cloud-arena/contracts";

import { loadWorkloadAssumptions, type WorkloadAssumptions } from "./config.js";

const ROUNDING_PRECISION = 6;

function round(value: number): number {
  return Number(value.toFixed(ROUNDING_PRECISION));
}

function provenance(field: string, source: ValueSource, description: string): FieldProvenance {
  return { field, source, description };
}

function appliedAssumption(
  id: string,
  field: string,
  value: string | number | boolean,
  description: string,
): Assumption {
  return { id, field, value, description, overridable: true };
}

function getRegionPreference(
  geography: WorkloadInput["geography"],
  configuration: WorkloadAssumptions,
): string {
  if (geography.type === "continent") {
    return configuration.geographyPreferences[geography.value];
  }

  return geography.value;
}

interface ConfidenceSourceMap {
  availability: ValueSource;
  databaseStorage: ValueSource;
  egress: ValueSource;
  geography: ValueSource;
  objectStorage: ValueSource;
  peakRps: ValueSource;
  requestVolume: ValueSource;
  responseSize: ValueSource;
}

function calculateConfidence(
  input: WorkloadInput,
  sources: ConfidenceSourceMap,
  configuration: WorkloadAssumptions,
): {
  confidence: number;
  confidenceFactors: ConfidenceFactor[];
  confidenceLabel: ConfidenceLabel;
  missingInformation: MissingInformation[];
} {
  const confidenceFactors = Object.entries(configuration.confidence.factors).map(([id, factor]) => {
    const source = sources[id as keyof ConfidenceSourceMap];
    const sourceContribution = configuration.confidence.sourceContributions[source];

    return {
      id,
      field: factor.field,
      source,
      weight: factor.weight,
      contribution: round(factor.weight * sourceContribution),
    };
  });
  const confidence = round(
    confidenceFactors.reduce((total, factor) => total + factor.contribution, 0),
  );
  const { high, medium } = configuration.confidence.thresholds;
  const confidenceLabel: ConfidenceLabel =
    confidence >= high ? "high" : confidence >= medium ? "medium" : "low";

  const impactOrder: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
  const missingInformation = Object.entries(configuration.confidence.factors)
    .filter(([, factor]) => input[factor.missingField as keyof WorkloadInput] === undefined)
    .sort(
      ([leftId, left], [rightId, right]) =>
        impactOrder[right.impact] - impactOrder[left.impact] ||
        right.weight - left.weight ||
        leftId.localeCompare(rightId),
    )
    .map(([, factor]) => ({
      field: factor.missingField,
      impact: factor.impact,
      reason: factor.description,
    }));

  return { confidence, confidenceFactors, confidenceLabel, missingInformation };
}

export function normalizeWorkload(
  uncheckedInput: WorkloadInput,
  configuration: WorkloadAssumptions = loadWorkloadAssumptions(),
): NormalizedWorkload {
  const input = workloadInputSchema.parse(uncheckedInput);
  const traffic = configuration.trafficProfiles[input.trafficProfile];
  const assumptions: Assumption[] = [];
  const fieldProvenance: FieldProvenance[] = [
    provenance("monthlyActiveUsers", "user", "Monthly active users were supplied by the user."),
  ];

  const requestsPerUserPerDay = input.averageRequestsPerUserPerDay ?? traffic.requestsPerUserPerDay;
  if (input.requestsPerMonth === undefined && input.averageRequestsPerUserPerDay === undefined) {
    assumptions.push(
      appliedAssumption(
        `traffic.${input.trafficProfile}.requestsPerUserPerDay`,
        "averageRequestsPerUserPerDay",
        requestsPerUserPerDay,
        `The ${input.trafficProfile} traffic profile assumes ${requestsPerUserPerDay} requests per user per day.`,
      ),
    );
  }

  const requestsPerMonth =
    input.requestsPerMonth ??
    round(input.monthlyActiveUsers * requestsPerUserPerDay * configuration.calendar.daysPerMonth);
  fieldProvenance.push(
    provenance(
      "requestsPerMonth",
      input.requestsPerMonth === undefined ? "derived" : "user",
      input.requestsPerMonth === undefined
        ? "Derived from monthly users, requests per user per day, and configured days per month."
        : "Monthly request volume was supplied by the user.",
    ),
  );

  const secondsPerMonth =
    configuration.calendar.daysPerMonth * configuration.calendar.secondsPerDay;
  const averageRequestsPerSecond = round(requestsPerMonth / secondsPerMonth);
  fieldProvenance.push(
    provenance(
      "averageRequestsPerSecond",
      "derived",
      "Derived from monthly request volume and configured calendar duration.",
    ),
  );

  let peakRequestsPerSecond = input.peakRequestsPerSecond;
  if (peakRequestsPerSecond === undefined) {
    peakRequestsPerSecond = round(averageRequestsPerSecond * traffic.peakMultiplier);
    assumptions.push(
      appliedAssumption(
        `traffic.${input.trafficProfile}.peakMultiplier`,
        "peakRequestsPerSecond",
        traffic.peakMultiplier,
        `The ${input.trafficProfile} traffic profile applies a ${traffic.peakMultiplier}x peak multiplier.`,
      ),
    );
  }
  fieldProvenance.push(
    provenance(
      "peakRequestsPerSecond",
      input.peakRequestsPerSecond === undefined ? "derived" : "user",
      input.peakRequestsPerSecond === undefined
        ? "Derived from average requests per second and the traffic-profile peak multiplier."
        : "Peak requests per second were supplied by the user.",
    ),
  );

  const averageResponseKB = input.averageResponseKB ?? configuration.defaults.averageResponseKB;
  if (input.averageResponseKB === undefined) {
    assumptions.push(
      appliedAssumption(
        "defaults.averageResponseKB",
        "averageResponseKB",
        averageResponseKB,
        `Average HTTP response size defaults to ${averageResponseKB} KB.`,
      ),
    );
  }
  fieldProvenance.push(
    provenance(
      "averageResponseKB",
      input.averageResponseKB === undefined ? "default" : "user",
      input.averageResponseKB === undefined
        ? "Applied the versioned average response-size default."
        : "Average response size was supplied by the user.",
    ),
  );

  const monthlyEgressGB =
    input.monthlyEgressGB ??
    round((requestsPerMonth * averageResponseKB) / configuration.calendar.kilobytesPerGigabyte);
  fieldProvenance.push(
    provenance(
      "monthlyEgressGB",
      input.monthlyEgressGB === undefined ? "derived" : "user",
      input.monthlyEgressGB === undefined
        ? "Derived from monthly requests and average response size; this models public response payload only."
        : "Monthly public egress was supplied by the user.",
    ),
  );

  const usersInThousands = input.monthlyActiveUsers / 1_000;
  const databaseStorageGB =
    input.databaseStorageGB ??
    round(
      Math.max(
        configuration.defaults.databaseStorage.minimumGB,
        usersInThousands * configuration.defaults.databaseStorage.gbPerThousandUsers,
      ),
    );
  if (input.databaseStorageGB === undefined) {
    assumptions.push(
      appliedAssumption(
        "defaults.databaseStorage",
        "databaseStorageGB",
        databaseStorageGB,
        `Database storage uses the greater of ${configuration.defaults.databaseStorage.minimumGB} GB or ${configuration.defaults.databaseStorage.gbPerThousandUsers} GB per 1,000 monthly users.`,
      ),
    );
  }
  fieldProvenance.push(
    provenance(
      "databaseStorageGB",
      input.databaseStorageGB === undefined ? "derived" : "user",
      input.databaseStorageGB === undefined
        ? "Derived from monthly users and the versioned database-storage heuristic."
        : "Database storage was supplied by the user.",
    ),
  );

  const objectStorageGB =
    input.objectStorageGB ??
    round(
      Math.max(
        configuration.defaults.objectStorage.minimumGB,
        usersInThousands * configuration.defaults.objectStorage.gbPerThousandUsers,
      ),
    );
  if (input.objectStorageGB === undefined) {
    assumptions.push(
      appliedAssumption(
        "defaults.objectStorage",
        "objectStorageGB",
        objectStorageGB,
        `Object storage uses the greater of ${configuration.defaults.objectStorage.minimumGB} GB or ${configuration.defaults.objectStorage.gbPerThousandUsers} GB per 1,000 monthly users.`,
      ),
    );
  }
  fieldProvenance.push(
    provenance(
      "objectStorageGB",
      input.objectStorageGB === undefined ? "derived" : "user",
      input.objectStorageGB === undefined
        ? "Derived from monthly users and the versioned object-storage heuristic."
        : "Object storage was supplied by the user.",
    ),
  );

  const availabilityTarget = configuration.availabilityTargets[input.availability];
  fieldProvenance.push(
    provenance(
      "availabilityTarget",
      "derived",
      `Mapped the user-selected ${input.availability} availability intent to the versioned target.`,
    ),
  );

  const regionPreference = getRegionPreference(input.geography, configuration);
  fieldProvenance.push(
    provenance(
      "regionPreference",
      "derived",
      "Mapped the user-supplied geography to a provider-neutral regional preference.",
    ),
  );

  const confidenceResult = calculateConfidence(
    input,
    {
      availability: "user",
      databaseStorage: input.databaseStorageGB === undefined ? "derived" : "user",
      egress: input.monthlyEgressGB === undefined ? "derived" : "user",
      geography: "user",
      objectStorage: input.objectStorageGB === undefined ? "derived" : "user",
      peakRps: input.peakRequestsPerSecond === undefined ? "derived" : "user",
      requestVolume: input.requestsPerMonth === undefined ? "derived" : "user",
      responseSize: input.averageResponseKB === undefined ? "default" : "user",
    },
    configuration,
  );

  return normalizedWorkloadSchema.parse({
    monthlyActiveUsers: input.monthlyActiveUsers,
    requestsPerMonth,
    averageRequestsPerSecond,
    peakRequestsPerSecond,
    averageResponseKB,
    monthlyEgressGB,
    databaseStorageGB,
    objectStorageGB,
    availabilityTarget,
    regionPreference,
    provenance: fieldProvenance,
    assumptions,
    ...confidenceResult,
    assumptionsVersion: configuration.version,
  });
}
