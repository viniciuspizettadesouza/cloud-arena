import { z } from "zod";

import type { CloudProvider } from "@cloud-arena/domain";

const positiveFiniteNumber = z.number().finite().positive();
const nonNegativeFiniteNumber = z.number().finite().nonnegative();

export const applicationTypeSchema = z.literal("web-api");
export const trafficProfileSchema = z.enum(["low", "medium", "high", "spiky"]);
export const availabilitySchema = z.enum(["standard", "production", "high", "mission-critical"]);
export const prioritySchema = z.enum(["cost", "balanced", "reliability", "low-operations"]);
export const preferenceLevelSchema = z.enum(["low", "medium", "high"]);

export const geographySchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("continent"),
    value: z.enum(["Europe", "North America", "South America"]),
  }),
  z.strictObject({
    type: z.literal("country"),
    value: z.string().trim().min(2).max(100),
  }),
  z.strictObject({
    type: z.literal("provider-region"),
    value: z.string().trim().min(2).max(100),
  }),
]);

export const workloadInputSchema = z.strictObject({
  applicationType: applicationTypeSchema,
  monthlyActiveUsers: z.number().int().positive().max(1_000_000_000),
  geography: geographySchema,
  trafficProfile: trafficProfileSchema,
  availability: availabilitySchema,
  priority: prioritySchema,
  requestsPerMonth: z.number().int().positive().max(1_000_000_000_000).optional(),
  averageRequestsPerUserPerDay: positiveFiniteNumber.max(1_000_000).optional(),
  peakRequestsPerSecond: nonNegativeFiniteNumber.max(100_000_000).optional(),
  averageResponseKB: positiveFiniteNumber.max(10_000_000).optional(),
  databaseStorageGB: nonNegativeFiniteNumber.max(100_000_000).optional(),
  databaseReadWriteProfile: z.string().trim().min(1).max(100).optional(),
  objectStorageGB: nonNegativeFiniteNumber.max(1_000_000_000).optional(),
  monthlyEgressGB: nonNegativeFiniteNumber.max(1_000_000_000).optional(),
  monthlyBudgetUSD: positiveFiniteNumber.max(1_000_000_000).optional(),
  managedServicesPreference: preferenceLevelSchema.optional(),
  vendorLockInTolerance: preferenceLevelSchema.optional(),
});

export type WorkloadInput = z.infer<typeof workloadInputSchema>;
export type TrafficProfile = z.infer<typeof trafficProfileSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type Geography = z.infer<typeof geographySchema>;

export const valueSourceSchema = z.enum(["user", "derived", "default"]);
export type ValueSource = z.infer<typeof valueSourceSchema>;

export const fieldProvenanceSchema = z.strictObject({
  field: z.string().min(1),
  source: valueSourceSchema,
  description: z.string().min(1),
});
export type FieldProvenance = z.infer<typeof fieldProvenanceSchema>;

export const assumptionSchema = z.strictObject({
  id: z.string().min(1),
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().min(1),
  overridable: z.boolean(),
});
export type Assumption = z.infer<typeof assumptionSchema>;

export const impactSchema = z.enum(["low", "medium", "high"]);
export type Impact = z.infer<typeof impactSchema>;

export const missingInformationSchema = z.strictObject({
  field: z.string().min(1),
  impact: impactSchema,
  reason: z.string().min(1),
});
export type MissingInformation = z.infer<typeof missingInformationSchema>;

export const confidenceLabelSchema = z.enum(["low", "medium", "high"]);
export type ConfidenceLabel = z.infer<typeof confidenceLabelSchema>;

export const confidenceFactorSchema = z.strictObject({
  id: z.string().min(1),
  field: z.string().min(1),
  source: valueSourceSchema,
  weight: z.number().min(0).max(1),
  contribution: z.number().min(0).max(1),
});
export type ConfidenceFactor = z.infer<typeof confidenceFactorSchema>;

export const normalizedWorkloadSchema = z.strictObject({
  monthlyActiveUsers: positiveFiniteNumber,
  requestsPerMonth: positiveFiniteNumber,
  averageRequestsPerSecond: nonNegativeFiniteNumber,
  peakRequestsPerSecond: nonNegativeFiniteNumber,
  averageResponseKB: positiveFiniteNumber,
  monthlyEgressGB: nonNegativeFiniteNumber,
  databaseStorageGB: nonNegativeFiniteNumber,
  objectStorageGB: nonNegativeFiniteNumber,
  availabilityTarget: z.number().min(0).max(1),
  regionPreference: z.string().min(1),
  provenance: z.array(fieldProvenanceSchema),
  assumptions: z.array(assumptionSchema),
  missingInformation: z.array(missingInformationSchema),
  confidence: z.number().min(0).max(1),
  confidenceLabel: confidenceLabelSchema,
  confidenceFactors: z.array(confidenceFactorSchema),
  assumptionsVersion: z.string().min(1),
});
export type NormalizedWorkload = z.infer<typeof normalizedWorkloadSchema>;

export const constraintViolationSchema = z.strictObject({
  constraint: z.string().min(1),
  expected: z.string().min(1),
  actual: z.union([z.number(), z.string()]),
});
export type ConstraintViolation = z.infer<typeof constraintViolationSchema>;

export const budgetConstraintResultSchema = z.strictObject({
  constraint: z.literal("monthly-budget"),
  status: z.enum(["not-applicable", "pending", "satisfied", "violated"]),
  satisfied: z.boolean().nullable(),
  budgetUSD: positiveFiniteNumber.optional(),
  actualMonthlyCostUSD: nonNegativeFiniteNumber.optional(),
  violations: z.array(constraintViolationSchema),
});
export type BudgetConstraintResult = z.infer<typeof budgetConstraintResultSchema>;

export interface ProviderReference {
  provider: CloudProvider;
}

export const CONTRACTS_PACKAGE = "@cloud-arena/contracts" as const;
