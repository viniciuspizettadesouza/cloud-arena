import { z } from "zod";

import { normalizedWorkloadSchema, workloadInputSchema } from "@cloud-arena/contracts";
import { comparisonResultSchema } from "@cloud-arena/recommendation";

const textSchema = z.string().trim().min(1);
const providerSchema = z.enum(["aws", "azure", "gcp"]);

export const healthResponseSchema = z.strictObject({
  service: z.literal("cloud-arena-api"),
  status: z.literal("ok"),
  version: textSchema,
});

export const providersResponseSchema = z.strictObject({
  catalogVersion: textSchema,
  providers: z.array(
    z.strictObject({
      id: providerSchema,
      name: textSchema,
      capabilities: z.array(textSchema),
      selectableRegions: z.array(textSchema),
    }),
  ),
});

export const regionsResponseSchema = z.strictObject({
  catalogVersion: textSchema,
  regions: z.array(
    z.strictObject({
      id: textSchema,
      provider: providerSchema,
      code: textSchema,
      name: textSchema,
      geography: z.enum(["europe", "north-america", "south-america"]),
      country: textSchema,
      selectable: z.boolean(),
    }),
  ),
});

export const capabilitiesResponseSchema = z.strictObject({
  catalogVersion: textSchema,
  capabilities: z.array(
    z.strictObject({
      id: textSchema,
      name: textSchema,
      description: textSchema,
      category: z.enum(["compute", "database", "storage", "network"]),
      optional: z.boolean(),
      mappings: z.array(
        z.strictObject({
          provider: providerSchema,
          serviceId: textSchema,
          serviceName: textSchema,
          configurationId: textSchema,
          configurationName: textSchema,
          caveats: z.array(textSchema),
        }),
      ),
    }),
  ),
});

export const normalizeResponseSchema = z.strictObject({
  input: workloadInputSchema,
  normalizedWorkload: normalizedWorkloadSchema,
});

export const validationErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.literal("VALIDATION_ERROR"),
    message: textSchema,
    issues: z.array(
      z.strictObject({
        path: z.array(z.union([z.string(), z.number()])),
        code: textSchema,
        message: textSchema,
      }),
    ),
  }),
});

export const internalErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.literal("INTERNAL_ERROR"),
    message: textSchema,
  }),
});

export const API_SCHEMAS = {
  health: healthResponseSchema,
  providers: providersResponseSchema,
  regions: regionsResponseSchema,
  capabilities: capabilitiesResponseSchema,
  workloadInput: workloadInputSchema,
  normalizeResponse: normalizeResponseSchema,
  comparisonResponse: comparisonResultSchema,
  validationError: validationErrorResponseSchema,
  internalError: internalErrorResponseSchema,
} as const;
