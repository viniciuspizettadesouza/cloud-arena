import Fastify, { type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";

import { normalizeWorkload, type WorkloadAssumptions } from "@cloud-arena/assumptions";
import { generateArchitectureCandidates, loadCatalog, type Catalog } from "@cloud-arena/catalog";
import { workloadInputSchema } from "@cloud-arena/contracts";
import { estimateCandidateCosts } from "@cloud-arena/cost";
import { type ActivePricingSnapshotReader, type ActivePricingSnapshot } from "@cloud-arena/pricing";
import { buildComparison } from "@cloud-arena/recommendation";
import { loadScoringConfig, type ScoringConfig } from "@cloud-arena/scoring";

import { buildOpenApiDocument } from "./openapi.js";
import {
  capabilitiesResponseSchema,
  healthResponseSchema,
  normalizeResponseSchema,
  providersResponseSchema,
  regionsResponseSchema,
} from "./schemas.js";

export interface ApiDependencies {
  catalog?: Catalog;
  assumptions?: WorkloadAssumptions;
  scoring?: ScoringConfig;
  snapshotReader?: ActivePricingSnapshotReader;
}

const missingSnapshotReader: ActivePricingSnapshotReader = {
  async getActiveSnapshot() {
    return undefined;
  },
};

export function buildApp(options: FastifyServerOptions = {}, dependencies: ApiDependencies = {}) {
  const app = Fastify(options);
  const catalog = dependencies.catalog ?? loadCatalog();
  const scoring = dependencies.scoring ?? loadScoringConfig();
  const snapshotReader = dependencies.snapshotReader ?? missingSnapshotReader;

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          issues: error.issues.map((issue) => ({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          })),
        },
      });
      return;
    }
    request.log.error(error);
    void reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "The comparison could not be completed." },
    });
  });

  app.get("/health", async () =>
    healthResponseSchema.parse({
      service: "cloud-arena-api",
      status: "ok",
      version: "0.0.0",
    }),
  );

  app.get("/v1/providers", async () =>
    providersResponseSchema.parse({
      catalogVersion: catalog.version,
      providers: catalog.providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        capabilities: provider.services.map(({ capabilityId }) => capabilityId),
        selectableRegions: catalog.regions
          .filter(({ provider: id, selectable }) => id === provider.id && selectable)
          .map(({ code }) => code),
      })),
    }),
  );

  app.get("/v1/regions", async () =>
    regionsResponseSchema.parse({
      catalogVersion: catalog.version,
      regions: catalog.regions.map(
        ({ id, provider, code, name, geography, country, selectable }) => ({
          id,
          provider,
          code,
          name,
          geography,
          country,
          selectable,
        }),
      ),
    }),
  );

  app.get("/v1/capabilities", async () =>
    capabilitiesResponseSchema.parse({
      catalogVersion: catalog.version,
      capabilities: catalog.capabilities.map((capability) => ({
        ...capability,
        mappings: catalog.providers.map((provider) => {
          const mapping = provider.services.find(
            ({ capabilityId }) => capabilityId === capability.id,
          );
          if (mapping === undefined)
            throw new Error(`Catalog has no ${provider.id} mapping for ${capability.id}.`);
          return {
            provider: provider.id,
            serviceId: mapping.service.id,
            serviceName: mapping.service.name,
            configurationId: mapping.configuration.id,
            configurationName: mapping.configuration.name,
            caveats: mapping.caveats,
          };
        }),
      })),
    }),
  );

  app.post("/v1/workloads/normalize", async (request) => {
    const input = workloadInputSchema.parse(request.body);
    const normalizedWorkload = normalizeWorkload(input, dependencies.assumptions);
    return normalizeResponseSchema.parse({ input, normalizedWorkload });
  });

  app.post("/v1/compare", async (request) => {
    const input = workloadInputSchema.parse(request.body);
    const normalizedWorkload = normalizeWorkload(input, dependencies.assumptions);
    const candidates = generateArchitectureCandidates(normalizedWorkload, catalog);
    const snapshots = (
      await Promise.all(
        (["aws", "azure", "gcp"] as const).map((provider) =>
          snapshotReader.getActiveSnapshot(provider),
        ),
      )
    ).filter((snapshot): snapshot is ActivePricingSnapshot => snapshot !== undefined);
    const candidateCosts = estimateCandidateCosts(normalizedWorkload, candidates, snapshots);
    return buildComparison(input, normalizedWorkload, candidateCosts, snapshots, scoring);
  });

  app.get("/openapi.json", async () => buildOpenApiDocument());

  return app;
}
