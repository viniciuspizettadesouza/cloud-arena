import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { z } from "zod";

import { prioritySchema } from "@cloud-arena/contracts";

export const scoreDimensionIdSchema = z.enum([
  "cost",
  "reliability-fit",
  "operational-simplicity",
  "portability",
]);
export type ScoreDimensionId = z.infer<typeof scoreDimensionIdSchema>;

const scoreSchema = z.number().finite().min(0).max(100);
const confidenceSchema = z.number().finite().min(0).max(1);
const weightsSchema = z.record(scoreDimensionIdSchema, z.number().finite().min(0).max(1));

export const scoringConfigSchema = z
  .strictObject({
    version: z.string().regex(/^scoring-v[1-9]\d*$/),
    profiles: z.record(prioritySchema, weightsSchema),
    heuristics: z.strictObject({
      reliabilityFit: z.strictObject({
        standard: scoreSchema,
        production: scoreSchema,
        high: scoreSchema,
        "mission-critical": scoreSchema,
        confidence: confidenceSchema,
      }),
      operationalSimplicity: z.strictObject({
        base: scoreSchema,
        componentPenalty: scoreSchema,
        highAvailabilityPenalty: scoreSchema,
        globalComponentPenalty: scoreSchema,
        confidence: confidenceSchema,
      }),
      portability: z.strictObject({
        base: scoreSchema,
        excludedCapabilityPenalty: scoreSchema,
        confidence: confidenceSchema,
      }),
    }),
    classification: z.strictObject({
      strongMinimum: scoreSchema,
      moderateMinimum: scoreSchema,
    }),
  })
  .superRefine((configuration, context) => {
    for (const [profile, weights] of Object.entries(configuration.profiles)) {
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(total - 1) > 1e-9)
        context.addIssue({
          code: "custom",
          message: `${profile} weights must sum to 1; received ${total}.`,
          path: ["profiles", profile],
        });
    }
    if (configuration.classification.moderateMinimum >= configuration.classification.strongMinimum)
      context.addIssue({
        code: "custom",
        message: "The moderate classification threshold must be lower than strong.",
        path: ["classification"],
      });
  });

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export const DEFAULT_SCORING_CONFIG_PATH = fileURLToPath(
  new URL("../../../data/scoring/v1.yaml", import.meta.url),
);

export function parseScoringConfig(source: string): ScoringConfig {
  return scoringConfigSchema.parse(parse(source));
}

export function loadScoringConfig(path = DEFAULT_SCORING_CONFIG_PATH): ScoringConfig {
  return parseScoringConfig(readFileSync(path, "utf8"));
}
