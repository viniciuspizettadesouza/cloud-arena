import { z } from "zod";

import {
  availabilitySchema,
  normalizedWorkloadSchema,
  type NormalizedWorkload,
} from "@cloud-arena/contracts";
import { CLOUD_PROVIDERS, type CloudProvider } from "@cloud-arena/domain";

import {
  catalogSchema,
  loadCatalog,
  type ArchitecturePattern,
  type Catalog,
  type ComponentPatternNode,
  type Provider,
  type Region,
} from "./config.js";

export const BASELINE_PATTERN_ID = "vm-managed-postgres" as const;
const textSchema = z.string().trim().min(1);
const detailScalarSchema = z.union([z.string(), z.number().finite(), z.boolean()]);
const detailsSchema = z.record(
  z.string(),
  z.union([detailScalarSchema, z.array(detailScalarSchema)]),
);

export const architectureComponentSchema = z.strictObject({
  id: textSchema,
  name: textSchema,
  capabilityId: textSchema,
  serviceId: textSchema,
  serviceName: textSchema,
  configurationId: textSchema,
  configurationName: textSchema,
  configurationDetails: detailsSchema,
  scope: z.enum(["regional", "global"]),
  quantity: z.number().int().positive(),
  deploymentOption: z
    .strictObject({
      id: textSchema,
      name: textSchema,
      details: detailsSchema,
      caveats: z.array(textSchema),
    })
    .nullable(),
  caveats: z.array(textSchema),
});

export const architectureCandidateSchema = z.strictObject({
  id: textSchema,
  catalogVersion: textSchema,
  provider: z.enum(CLOUD_PROVIDERS),
  patternId: textSchema,
  availability: availabilitySchema,
  region: z.strictObject({
    id: textSchema,
    provider: z.enum(CLOUD_PROVIDERS),
    code: textSchema,
    name: textSchema,
    geography: textSchema,
    country: textSchema,
  }),
  regionSelection: z.strictObject({ rationale: textSchema, latencyClaim: z.literal(false) }),
  components: z.array(architectureComponentSchema).min(1),
  graph: z.strictObject({
    externalNodes: z.array(z.strictObject({ id: textSchema, name: textSchema })),
    edges: z.array(
      z.strictObject({
        from: textSchema,
        to: textSchema,
        relationship: z.enum(["request-flow", "data-access"]),
      }),
    ),
  }),
  excludedCapabilities: z.array(
    z.strictObject({
      capabilityId: textSchema,
      reasonCode: textSchema,
      reason: textSchema,
      serviceId: textSchema,
      serviceName: textSchema,
      configurationId: textSchema,
      configurationName: textSchema,
    }),
  ),
  caveats: z.array(textSchema),
});

export type ArchitectureComponent = z.infer<typeof architectureComponentSchema>;
export type ArchitectureCandidate = z.infer<typeof architectureCandidateSchema>;

function exactlyOne<T>(values: readonly T[], description: string): T {
  if (values.length !== 1)
    throw new Error(`Expected exactly one ${description}; received ${values.length}.`);
  return values[0] as T;
}

function serviceFor(provider: Provider, capabilityId: string): Provider["services"][number] {
  return exactlyOne(
    provider.services.filter((item) => item.capabilityId === capabilityId),
    `${provider.id} mapping for ${capabilityId}`,
  );
}

function resolveComponent(
  node: ComponentPatternNode,
  provider: Provider,
  region: Region,
  rule: ArchitecturePattern["availabilityRules"][number],
): ArchitectureComponent {
  const mapping = serviceFor(provider, node.capabilityId);
  const matchingRequirements = rule.requirements.filter(
    ({ componentId }) => componentId === node.id,
  );
  if (matchingRequirements.length > 1)
    throw new Error(
      `Expected at most one ${rule.availability} requirement for ${node.id}; received ${matchingRequirements.length}.`,
    );
  const requirement = matchingRequirements[0];
  const quantity = node.quantity.source === "fixed" ? node.quantity.value : requirement?.quantity;
  if (quantity === undefined) throw new Error(`No quantity is defined for ${node.id}.`);
  const deploymentOption =
    node.deploymentOptionSource === "none"
      ? null
      : exactlyOne(
          mapping.deploymentOptions.filter(({ id }) => id === requirement?.deploymentOptionId),
          `${provider.id} deployment option ${requirement?.deploymentOptionId}`,
        );
  exactlyOne(
    mapping.regionSupport.filter(({ regionId }) => regionId === region.id),
    `${mapping.configuration.id} support record for ${region.id}`,
  );
  return architectureComponentSchema.parse({
    id: node.id,
    name: node.name,
    capabilityId: node.capabilityId,
    serviceId: mapping.service.id,
    serviceName: mapping.service.name,
    configurationId: mapping.configuration.id,
    configurationName: mapping.configuration.name,
    configurationDetails: mapping.configuration.details,
    scope: mapping.scope,
    quantity,
    deploymentOption,
    caveats: [...mapping.caveats, ...(deploymentOption?.caveats ?? [])],
  });
}

function generateProviderCandidate(
  workload: NormalizedWorkload,
  catalog: Catalog,
  pattern: ArchitecturePattern,
  providerId: CloudProvider,
): ArchitectureCandidate {
  const provider = exactlyOne(
    catalog.providers.filter(({ id }) => id === providerId),
    `provider ${providerId}`,
  );
  const selection = exactlyOne(
    catalog.geographyDefaults.filter(
      ({ geography, provider: id }) => geography === workload.regionPreference && id === providerId,
    ),
    `${providerId} default for ${workload.regionPreference}`,
  );
  const region = exactlyOne(
    catalog.regions.filter(({ id }) => id === selection.regionId),
    `region ${selection.regionId}`,
  );
  const rule = exactlyOne(
    pattern.availabilityRules.filter(({ availability }) => availability === workload.availability),
    `${pattern.id} ${workload.availability} rule`,
  );
  const components = pattern.nodes
    .filter((node): node is ComponentPatternNode => node.type === "component")
    .map((node) => resolveComponent(node, provider, region, rule));
  const excludedCapabilities = pattern.excludedCapabilities.map((excluded) => {
    const mapping = serviceFor(provider, excluded.capabilityId);
    return {
      ...excluded,
      serviceId: mapping.service.id,
      serviceName: mapping.service.name,
      configurationId: mapping.configuration.id,
      configurationName: mapping.configuration.name,
    };
  });

  return architectureCandidateSchema.parse({
    id: `${providerId}:${pattern.id}:${region.code}`,
    catalogVersion: catalog.version,
    provider: providerId,
    patternId: pattern.id,
    availability: workload.availability,
    region: {
      id: region.id,
      provider: region.provider,
      code: region.code,
      name: region.name,
      geography: region.geography,
      country: region.country,
    },
    regionSelection: { rationale: selection.selectionRationale, latencyClaim: false },
    components,
    graph: {
      externalNodes: pattern.nodes
        .filter((node) => node.type === "external")
        .map(({ id, name }) => ({ id, name })),
      edges: pattern.edges,
    },
    excludedCapabilities,
    caveats: [
      ...new Set([
        ...pattern.caveats,
        ...rule.caveats,
        ...components.flatMap(({ caveats }) => caveats),
      ]),
    ],
  });
}

export function generateArchitectureCandidates(
  uncheckedWorkload: NormalizedWorkload,
  uncheckedCatalog: Catalog = loadCatalog(),
  patternId: string = BASELINE_PATTERN_ID,
): ArchitectureCandidate[] {
  const workload = normalizedWorkloadSchema.parse(uncheckedWorkload);
  const catalog = catalogSchema.parse(uncheckedCatalog);
  const pattern = exactlyOne(
    catalog.patterns.filter(({ id }) => id === patternId),
    `pattern ${patternId}`,
  );
  return CLOUD_PROVIDERS.map((provider) =>
    generateProviderCandidate(workload, catalog, pattern, provider),
  );
}
