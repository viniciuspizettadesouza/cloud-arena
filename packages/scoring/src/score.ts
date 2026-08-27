import { z } from "zod";

import {
  availabilitySchema,
  costEstimateSchema,
  prioritySchema,
  type CostEstimate,
  type Priority,
} from "@cloud-arena/contracts";

import { loadScoringConfig, scoreDimensionIdSchema, type ScoringConfig } from "./config.js";

const scoreValueSchema = z.number().finite().min(0).max(100);
const textSchema = z.string().trim().min(1);

export const scoreSourceTypeSchema = z.enum(["objective", "architecture-rule", "heuristic"]);
export const scoreClassificationSchema = z.enum(["strong", "moderate", "weak"]);

export const scoreDimensionSchema = z.strictObject({
  id: scoreDimensionIdSchema,
  rawScore: scoreValueSchema,
  weight: z.number().finite().min(0).max(1),
  weightedContribution: scoreValueSchema,
  sourceType: scoreSourceTypeSchema,
  confidence: z.number().finite().min(0).max(1),
  reasons: z.array(textSchema).min(1),
});

export const candidateScoreSchema = z.strictObject({
  totalScore: scoreValueSchema,
  classification: scoreClassificationSchema,
  dimensions: z.array(scoreDimensionSchema).length(4),
  scoringVersion: textSchema,
  profile: prioritySchema,
});

export type ScoreDimension = z.infer<typeof scoreDimensionSchema>;
export type CandidateScore = z.infer<typeof candidateScoreSchema>;

export interface ScoringCandidate {
  id: string;
  availability: z.infer<typeof availabilitySchema>;
  components: Array<{
    scope: "regional" | "global";
    deploymentOption: { id: string } | null;
  }>;
  excludedCapabilities: readonly unknown[];
}

export interface CandidateCostInput {
  candidate: ScoringCandidate;
  costEstimate: CostEstimate;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function classification(totalScore: number, configuration: ScoringConfig) {
  if (totalScore >= configuration.classification.strongMinimum) return "strong" as const;
  if (totalScore >= configuration.classification.moderateMinimum) return "moderate" as const;
  return "weak" as const;
}

function costScore(costEstimate: CostEstimate, minimumAvailableCost: number | undefined) {
  if (costEstimate.status === "unavailable" || minimumAvailableCost === undefined)
    return {
      rawScore: 0,
      confidence: 0,
      reasons: ["Required public pricing is unavailable, so no objective cost score is assigned."],
    };
  const rawScore =
    costEstimate.monthlyCostUSD === 0
      ? 100
      : (minimumAvailableCost / costEstimate.monthlyCostUSD) * 100;
  return {
    rawScore: clamp(rawScore),
    confidence: costEstimate.confidence,
    reasons: [
      `Relative public-cost score compares USD ${costEstimate.monthlyCostUSD} with the lowest available candidate cost of USD ${minimumAvailableCost}.`,
    ],
  };
}

export function scoreCandidates(
  inputs: readonly CandidateCostInput[],
  profile: Priority,
  configuration: ScoringConfig = loadScoringConfig(),
): CandidateScore[] {
  const parsedProfile = prioritySchema.parse(profile);
  const availableCosts = inputs.flatMap(({ costEstimate }) =>
    costEstimate.status === "available" ? [costEstimate.monthlyCostUSD] : [],
  );
  const minimumAvailableCost =
    availableCosts.length === 0 ? undefined : Math.min(...availableCosts);
  const weights = configuration.profiles[parsedProfile];

  return inputs.map(({ candidate, costEstimate: uncheckedCost }) => {
    const costEstimate = costEstimateSchema.parse(uncheckedCost);
    const cost = costScore(costEstimate, minimumAvailableCost);
    const reliabilityRaw = configuration.heuristics.reliabilityFit[candidate.availability];
    const highAvailability = candidate.components.some(
      ({ deploymentOption }) => deploymentOption?.id === "high-availability",
    );
    const globalComponents = candidate.components.filter(({ scope }) => scope === "global").length;
    const operationsRaw = clamp(
      configuration.heuristics.operationalSimplicity.base -
        candidate.components.length *
          configuration.heuristics.operationalSimplicity.componentPenalty -
        (highAvailability
          ? configuration.heuristics.operationalSimplicity.highAvailabilityPenalty
          : 0) -
        globalComponents * configuration.heuristics.operationalSimplicity.globalComponentPenalty,
    );
    const portabilityRaw = clamp(
      configuration.heuristics.portability.base -
        candidate.excludedCapabilities.length *
          configuration.heuristics.portability.excludedCapabilityPenalty,
    );
    const dimensionInputs: Array<
      Omit<ScoreDimension, "weight" | "weightedContribution"> & { id: ScoreDimension["id"] }
    > = [
      { id: "cost", sourceType: "objective", ...cost },
      {
        id: "reliability-fit",
        rawScore: reliabilityRaw,
        sourceType: "architecture-rule",
        confidence: configuration.heuristics.reliabilityFit.confidence,
        reasons: [
          `The ${candidate.availability} baseline receives the versioned architecture-rule fit score; this is not measured availability.`,
        ],
      },
      {
        id: "operational-simplicity",
        rawScore: operationsRaw,
        sourceType: "heuristic",
        confidence: configuration.heuristics.operationalSimplicity.confidence,
        reasons: [
          `The heuristic accounts for ${candidate.components.length} managed components, ${highAvailability ? "an HA deployment" : "no HA standby"}, and ${globalComponents} global component(s).`,
        ],
      },
      {
        id: "portability",
        rawScore: portabilityRaw,
        sourceType: "heuristic",
        confidence: configuration.heuristics.portability.confidence,
        reasons: [
          `The provider-neutral pattern has ${candidate.excludedCapabilities.length} explicitly excluded capability mapping(s).`,
        ],
      },
    ];
    const dimensions = dimensionInputs.map((dimension) => {
      const weight = weights[dimension.id];
      return scoreDimensionSchema.parse({
        ...dimension,
        rawScore: round(dimension.rawScore),
        weight,
        weightedContribution: round(dimension.rawScore * weight),
      });
    });
    const totalScore = round(
      dimensions.reduce((sum, dimension) => sum + dimension.weightedContribution, 0),
    );
    return candidateScoreSchema.parse({
      totalScore,
      classification: classification(totalScore, configuration),
      dimensions,
      scoringVersion: configuration.version,
      profile: parsedProfile,
    });
  });
}
