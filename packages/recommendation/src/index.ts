import { z } from "zod";

import { evaluateMonthlyBudget } from "@cloud-arena/assumptions";
import { architectureCandidateSchema, type ArchitectureCandidate } from "@cloud-arena/catalog";
import {
  budgetConstraintResultSchema,
  costEstimateSchema,
  normalizedWorkloadSchema,
  workloadInputSchema,
  type CostEstimate,
  type NormalizedWorkload,
  type WorkloadInput,
} from "@cloud-arena/contracts";
import { COST_CALCULATION_VERSION } from "@cloud-arena/cost";
import type { ActivePricingSnapshot } from "@cloud-arena/pricing";
import {
  candidateScoreSchema,
  loadScoringConfig,
  scoreCandidates,
  type CandidateScore,
  type ScoringConfig,
} from "@cloud-arena/scoring";

const textSchema = z.string().trim().min(1);

export const rankedCandidateSchema = z.strictObject({
  rank: z.number().int().positive(),
  candidate: architectureCandidateSchema,
  costEstimate: costEstimateSchema,
  constraints: budgetConstraintResultSchema,
  score: candidateScoreSchema,
});

export const runnerUpTradeOffSchema = z.strictObject({
  candidateId: textSchema,
  provider: z.enum(["aws", "azure", "gcp"]),
  reasons: z.array(textSchema).min(1),
});

export const recommendationSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("available"),
    candidateId: textSchema,
    provider: z.enum(["aws", "azure", "gcp"]),
    tie: z.boolean(),
    reasons: z.array(textSchema).min(1),
    caveats: z.array(textSchema),
    runnerUpTradeOffs: z.array(runnerUpTradeOffSchema),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    reason: textSchema,
  }),
]);

export const comparisonVersionSchema = z.strictObject({
  catalog: textSchema,
  assumptions: textSchema,
  scoring: textSchema,
  costCalculation: textSchema,
  pricingSnapshots: z.array(
    z.discriminatedUnion("status", [
      z.strictObject({
        provider: z.enum(["aws", "azure", "gcp"]),
        status: z.literal("active"),
        snapshotId: textSchema,
        retrievedAt: z.iso.datetime({ offset: true }),
      }),
      z.strictObject({
        provider: z.enum(["aws", "azure", "gcp"]),
        status: z.literal("missing"),
      }),
    ]),
  ),
});

export const comparisonResultSchema = z.strictObject({
  input: workloadInputSchema,
  normalizedWorkload: normalizedWorkloadSchema,
  candidates: z.array(rankedCandidateSchema).length(3),
  recommendation: recommendationSchema,
  assumptions: normalizedWorkloadSchema.shape.assumptions,
  missingInformation: normalizedWorkloadSchema.shape.missingInformation,
  confidence: normalizedWorkloadSchema.shape.confidence,
  confidenceLabel: normalizedWorkloadSchema.shape.confidenceLabel,
  versions: comparisonVersionSchema,
});

export type RankedCandidate = z.infer<typeof rankedCandidateSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type ComparisonResult = z.infer<typeof comparisonResultSchema>;

export interface CandidateWithCost {
  candidate: ArchitectureCandidate;
  costEstimate: CostEstimate;
}

function constraintOrder(status: RankedCandidate["constraints"]["status"]): number {
  if (status === "satisfied" || status === "not-applicable") return 0;
  if (status === "pending") return 1;
  return 2;
}

function compareRank(left: Omit<RankedCandidate, "rank">, right: Omit<RankedCandidate, "rank">) {
  const leftAvailability = left.costEstimate.status === "available" ? 0 : 1;
  const rightAvailability = right.costEstimate.status === "available" ? 0 : 1;
  if (leftAvailability !== rightAvailability) return leftAvailability - rightAvailability;
  const constraintDifference =
    constraintOrder(left.constraints.status) - constraintOrder(right.constraints.status);
  if (constraintDifference !== 0) return constraintDifference;
  if (left.score.totalScore !== right.score.totalScore)
    return right.score.totalScore - left.score.totalScore;
  if (left.costEstimate.status === "available" && right.costEstimate.status === "available") {
    const costDifference = left.costEstimate.monthlyCostUSD - right.costEstimate.monthlyCostUSD;
    if (costDifference !== 0) return costDifference;
  }
  return left.candidate.id.localeCompare(right.candidate.id);
}

function materiallyTied(left: RankedCandidate, right: RankedCandidate | undefined): boolean {
  return (
    right !== undefined &&
    left.costEstimate.status === right.costEstimate.status &&
    constraintOrder(left.constraints.status) === constraintOrder(right.constraints.status) &&
    left.score.totalScore === right.score.totalScore
  );
}

function dimensionLabel(id: CandidateScore["dimensions"][number]["id"]): string {
  return id.replaceAll("-", " ");
}

function recommendationReasons(candidate: RankedCandidate): string[] {
  const strongest = [...candidate.score.dimensions]
    .sort(
      (left, right) =>
        right.weightedContribution - left.weightedContribution || left.id.localeCompare(right.id),
    )
    .slice(0, 2)
    .map(
      (dimension) =>
        `${dimensionLabel(dimension.id)} contributed ${dimension.weightedContribution} points under the ${candidate.score.profile} profile.`,
    );
  if (candidate.costEstimate.status === "available")
    strongest.push(
      `The traceable estimated monthly public cost is USD ${candidate.costEstimate.monthlyCostUSD}.`,
    );
  if (candidate.constraints.status === "satisfied")
    strongest.push("The candidate satisfies the configured monthly budget.");
  return strongest;
}

function tradeOff(winner: RankedCandidate, alternative: RankedCandidate) {
  const reasons: string[] = [];
  if (alternative.costEstimate.status === "unavailable")
    reasons.push("Required pricing is unavailable, so this candidate cannot be recommended.");
  else if (alternative.constraints.status === "violated")
    reasons.push("This candidate violates the configured monthly budget.");
  if (alternative.score.totalScore < winner.score.totalScore)
    reasons.push(
      `Its weighted score is ${alternative.score.totalScore}, compared with ${winner.score.totalScore} for the recommendation.`,
    );
  if (
    alternative.costEstimate.status === "available" &&
    winner.costEstimate.status === "available" &&
    alternative.costEstimate.monthlyCostUSD !== winner.costEstimate.monthlyCostUSD
  )
    reasons.push(
      `Its estimated monthly cost is USD ${alternative.costEstimate.monthlyCostUSD}, versus USD ${winner.costEstimate.monthlyCostUSD}.`,
    );
  if (reasons.length === 0)
    reasons.push(
      "The candidates are materially tied; the documented stable candidate-ID tie-break applies.",
    );
  return runnerUpTradeOffSchema.parse({
    candidateId: alternative.candidate.id,
    provider: alternative.candidate.provider,
    reasons,
  });
}

function recommendationFor(ranked: RankedCandidate[]): Recommendation {
  const winner = ranked[0];
  if (winner === undefined || winner.costEstimate.status === "unavailable")
    return {
      status: "unavailable",
      reason:
        "No candidate has complete required public pricing; a recommendation would be misleading.",
    };
  const caveats = [
    ...winner.candidate.caveats,
    ...winner.costEstimate.excludedItems,
    ...winner.constraints.violations.map(
      ({ expected, actual }) => `Constraint violation: expected ${expected}; actual ${actual}.`,
    ),
  ];
  return recommendationSchema.parse({
    status: "available",
    candidateId: winner.candidate.id,
    provider: winner.candidate.provider,
    tie: materiallyTied(winner, ranked[1]),
    reasons: recommendationReasons(winner),
    caveats: [...new Set(caveats)],
    runnerUpTradeOffs: ranked.slice(1).map((alternative) => tradeOff(winner, alternative)),
  });
}

export function buildComparison(
  uncheckedInput: WorkloadInput,
  uncheckedWorkload: NormalizedWorkload,
  candidateCosts: readonly CandidateWithCost[],
  snapshots: readonly ActivePricingSnapshot[],
  configuration: ScoringConfig = loadScoringConfig(),
): ComparisonResult {
  const input = workloadInputSchema.parse(uncheckedInput);
  const normalizedWorkload = normalizedWorkloadSchema.parse(uncheckedWorkload);
  if (candidateCosts.length !== 3)
    throw new Error("A comparison requires exactly three candidates.");
  const scores = scoreCandidates(candidateCosts, input.priority, configuration);
  const unranked = candidateCosts.map(({ candidate, costEstimate }, index) => ({
    candidate: architectureCandidateSchema.parse(candidate),
    costEstimate: costEstimateSchema.parse(costEstimate),
    constraints: evaluateMonthlyBudget(
      input,
      costEstimate.status === "available" ? costEstimate.monthlyCostUSD : undefined,
    ),
    score: scores[index] as CandidateScore,
  }));
  const candidates = unranked
    .sort(compareRank)
    .map((candidate, index) => rankedCandidateSchema.parse({ ...candidate, rank: index + 1 }));
  const providers = ["aws", "azure", "gcp"] as const;
  return comparisonResultSchema.parse({
    input,
    normalizedWorkload,
    candidates,
    recommendation: recommendationFor(candidates),
    assumptions: normalizedWorkload.assumptions,
    missingInformation: normalizedWorkload.missingInformation,
    confidence: normalizedWorkload.confidence,
    confidenceLabel: normalizedWorkload.confidenceLabel,
    versions: {
      catalog: candidates[0]?.candidate.catalogVersion,
      assumptions: normalizedWorkload.assumptionsVersion,
      scoring: configuration.version,
      costCalculation: COST_CALCULATION_VERSION,
      pricingSnapshots: providers.map((provider) => {
        const snapshot = snapshots.find((item) => item.provider === provider);
        return snapshot === undefined
          ? { provider, status: "missing" as const }
          : {
              provider,
              status: "active" as const,
              snapshotId: snapshot.id,
              retrievedAt: snapshot.retrievedAt,
            };
      }),
    },
  });
}

export const RECOMMENDATION_PACKAGE = "@cloud-arena/recommendation" as const;
