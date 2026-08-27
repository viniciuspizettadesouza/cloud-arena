import { z } from "zod";

import { API_SCHEMAS } from "./schemas.js";

function jsonSchema(schema: z.ZodType): object {
  return z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" });
}

function response(description: string, schema: z.ZodType) {
  return {
    description,
    content: { "application/json": { schema: jsonSchema(schema) } },
  };
}

function postOperation(summary: string, responseSchema: z.ZodType) {
  return {
    summary,
    requestBody: {
      required: true,
      content: { "application/json": { schema: jsonSchema(API_SCHEMAS.workloadInput) } },
    },
    responses: {
      "200": response("Successful response", responseSchema),
      "400": response("Invalid workload input", API_SCHEMAS.validationError),
      "500": response("Internal server error", API_SCHEMAS.internalError),
    },
  };
}

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Cloud Arena API",
      version: "0.0.0",
      description: "Deterministic multi-cloud architecture and public-price comparison API.",
    },
    paths: {
      "/health": {
        get: {
          summary: "Report API readiness",
          responses: { "200": response("Service is ready", API_SCHEMAS.health) },
        },
      },
      "/v1/providers": {
        get: {
          summary: "List supported providers",
          responses: { "200": response("Provider reference data", API_SCHEMAS.providers) },
        },
      },
      "/v1/regions": {
        get: {
          summary: "List curated launch regions",
          responses: { "200": response("Region reference data", API_SCHEMAS.regions) },
        },
      },
      "/v1/capabilities": {
        get: {
          summary: "List provider-neutral capabilities and mappings",
          responses: {
            "200": response("Capability reference data", API_SCHEMAS.capabilities),
          },
        },
      },
      "/v1/workloads/normalize": {
        post: postOperation("Normalize a workload", API_SCHEMAS.normalizeResponse),
      },
      "/v1/compare": {
        post: postOperation("Compare provider candidates", API_SCHEMAS.comparisonResponse),
      },
      "/openapi.json": {
        get: {
          summary: "Return this generated OpenAPI document",
          responses: { "200": { description: "OpenAPI 3.1 document" } },
        },
      },
    },
  } as const;
}
