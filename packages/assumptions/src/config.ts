import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { z } from "zod";

import {
  availabilitySchema,
  impactSchema,
  trafficProfileSchema,
  valueSourceSchema,
} from "@cloud-arena/contracts";

const trafficHeuristicSchema = z.strictObject({
  requestsPerUserPerDay: z.number().finite().positive(),
  peakMultiplier: z.number().finite().min(1),
});

const scaledStorageSchema = z.strictObject({
  minimumGB: z.number().finite().nonnegative(),
  gbPerThousandUsers: z.number().finite().nonnegative(),
});

const confidenceFactorConfigSchema = z.strictObject({
  field: z.string().min(1),
  weight: z.number().finite().positive().max(1),
  impact: impactSchema,
  missingField: z.string().min(1),
  description: z.string().min(1),
});

export const workloadAssumptionsSchema = z
  .strictObject({
    version: z.string().regex(/^workload-v\d+$/),
    calendar: z.strictObject({
      daysPerMonth: z.number().int().positive(),
      secondsPerDay: z.number().int().positive(),
      kilobytesPerGigabyte: z.number().int().positive(),
    }),
    trafficProfiles: z.record(trafficProfileSchema, trafficHeuristicSchema),
    defaults: z.strictObject({
      averageResponseKB: z.number().finite().positive(),
      databaseStorage: scaledStorageSchema,
      objectStorage: scaledStorageSchema,
    }),
    availabilityTargets: z.record(availabilitySchema, z.number().finite().min(0).max(1)),
    geographyPreferences: z.strictObject({
      Europe: z.string().min(1),
      "North America": z.string().min(1),
      "South America": z.string().min(1),
    }),
    confidence: z.strictObject({
      sourceContributions: z.record(valueSourceSchema, z.number().finite().min(0).max(1)),
      thresholds: z.strictObject({
        medium: z.number().finite().min(0).max(1),
        high: z.number().finite().min(0).max(1),
      }),
      factors: z.strictObject({
        requestVolume: confidenceFactorConfigSchema,
        peakRps: confidenceFactorConfigSchema,
        egress: confidenceFactorConfigSchema,
        databaseStorage: confidenceFactorConfigSchema,
        objectStorage: confidenceFactorConfigSchema,
        responseSize: confidenceFactorConfigSchema,
        geography: confidenceFactorConfigSchema,
        availability: confidenceFactorConfigSchema,
      }),
    }),
  })
  .superRefine((configuration, context) => {
    const totalWeight = Object.values(configuration.confidence.factors).reduce(
      (total, factor) => total + factor.weight,
      0,
    );

    if (Math.abs(totalWeight - 1) > 1e-9) {
      context.addIssue({
        code: "custom",
        message: `Confidence factor weights must sum to 1; received ${totalWeight}.`,
        path: ["confidence", "factors"],
      });
    }

    if (configuration.confidence.thresholds.medium >= configuration.confidence.thresholds.high) {
      context.addIssue({
        code: "custom",
        message: "The medium confidence threshold must be lower than the high threshold.",
        path: ["confidence", "thresholds"],
      });
    }
  });

export type WorkloadAssumptions = z.infer<typeof workloadAssumptionsSchema>;

export const DEFAULT_WORKLOAD_ASSUMPTIONS_PATH = fileURLToPath(
  new URL("../../../data/assumptions/workload-v1.yaml", import.meta.url),
);

export function parseWorkloadAssumptions(source: string): WorkloadAssumptions {
  return workloadAssumptionsSchema.parse(parse(source));
}

export function loadWorkloadAssumptions(
  path = DEFAULT_WORKLOAD_ASSUMPTIONS_PATH,
): WorkloadAssumptions {
  return parseWorkloadAssumptions(readFileSync(path, "utf8"));
}
