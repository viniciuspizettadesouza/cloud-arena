import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { z } from "zod";

import { availabilitySchema } from "@cloud-arena/contracts";
import { CLOUD_PROVIDERS } from "@cloud-arena/domain";

const idSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const textSchema = z.string().trim().min(1);
const dateSchema = z.iso.date();
const detailScalarSchema = z.union([textSchema, z.number().finite(), z.boolean()]);
const detailsSchema = z.record(
  textSchema,
  z.union([detailScalarSchema, z.array(detailScalarSchema)]),
);

export const catalogVersionSchema = z.string().regex(/^catalog-v[1-9]\d*$/);
export const catalogProviderSchema = z.enum(CLOUD_PROVIDERS);
export const catalogGeographySchema = z.enum(["europe", "north-america", "south-america"]);

export const evidenceSchema = z.strictObject({
  title: textSchema,
  url: z.url(),
  retrievedAt: dateSchema,
});

export const catalogManifestSchema = z.strictObject({
  version: catalogVersionSchema,
  files: z.strictObject({
    capabilities: textSchema,
    providers: textSchema,
    regions: textSchema,
    patterns: textSchema,
  }),
});

export const capabilitySchema = z.strictObject({
  id: idSchema,
  name: textSchema,
  description: textSchema,
  category: z.enum(["compute", "database", "storage", "network"]),
  optional: z.boolean(),
});

export const capabilityDocumentSchema = z.strictObject({
  version: catalogVersionSchema,
  capabilities: z.array(capabilitySchema).min(1),
});

export const deploymentOptionSchema = z.strictObject({
  id: idSchema,
  name: textSchema,
  details: detailsSchema,
  caveats: z.array(textSchema),
});

export const regionSupportSchema = z.strictObject({
  regionId: idSchema,
  checkedAt: dateSchema,
  evidence: z.array(evidenceSchema).min(1),
});

const serviceConfigurationSchema = z
  .strictObject({
    id: idSchema,
    name: textSchema,
    details: detailsSchema,
  })
  .superRefine((configuration, context) => {
    for (const key of Object.keys(configuration.details)) {
      const normalizedKey = key.toLowerCase().replaceAll(/[^a-z]/g, "");
      if (normalizedKey.includes("billingsku"))
        addIssue(
          context,
          "Provider billing SKU identifiers do not belong in semantic configurations.",
          ["details", key],
        );
    }
  });

export const serviceMappingSchema = z.strictObject({
  capabilityId: idSchema,
  service: z.strictObject({ id: idSchema, name: textSchema }),
  configuration: serviceConfigurationSchema,
  scope: z.enum(["regional", "global"]),
  deploymentOptions: z.array(deploymentOptionSchema),
  regionSupport: z.array(regionSupportSchema).min(1),
  caveats: z.array(textSchema).min(1),
});

export const providerSchema = z.strictObject({
  id: catalogProviderSchema,
  name: textSchema,
  services: z.array(serviceMappingSchema).min(1),
});

export const providerDocumentSchema = z.strictObject({
  version: catalogVersionSchema,
  providers: z.array(providerSchema).min(1),
});

export const regionSchema = z.strictObject({
  id: idSchema,
  provider: catalogProviderSchema,
  code: textSchema,
  name: textSchema,
  geography: catalogGeographySchema,
  country: textSchema,
  selectable: z.boolean(),
  evidence: z.array(evidenceSchema).min(1),
});

export const geographyDefaultSchema = z.strictObject({
  geography: catalogGeographySchema,
  provider: catalogProviderSchema,
  regionId: idSchema,
  selectionRationale: textSchema,
  latencyClaim: z.literal(false),
});

export const regionDocumentSchema = z.strictObject({
  version: catalogVersionSchema,
  regions: z.array(regionSchema).min(1),
  geographyDefaults: z.array(geographyDefaultSchema).min(1),
});

const patternNodeSchema = z.discriminatedUnion("type", [
  z.strictObject({ id: idSchema, type: z.literal("external"), name: textSchema }),
  z.strictObject({
    id: idSchema,
    type: z.literal("component"),
    name: textSchema,
    capabilityId: idSchema,
    required: z.boolean(),
    quantity: z.discriminatedUnion("source", [
      z.strictObject({ source: z.literal("fixed"), value: z.number().int().positive() }),
      z.strictObject({ source: z.literal("availability-rule") }),
    ]),
    deploymentOptionSource: z.enum(["none", "availability-rule"]),
  }),
]);

export const architecturePatternSchema = z.strictObject({
  id: idSchema,
  name: textSchema,
  description: textSchema,
  caveats: z.array(textSchema).min(1),
  nodes: z.array(patternNodeSchema).min(1),
  edges: z
    .array(
      z.strictObject({
        from: idSchema,
        to: idSchema,
        relationship: z.enum(["request-flow", "data-access"]),
      }),
    )
    .min(1),
  excludedCapabilities: z.array(
    z.strictObject({ capabilityId: idSchema, reasonCode: idSchema, reason: textSchema }),
  ),
  availabilityRules: z.array(
    z.strictObject({
      availability: availabilitySchema,
      requirements: z.array(
        z.strictObject({
          componentId: idSchema,
          quantity: z.number().int().positive().optional(),
          deploymentOptionId: idSchema.optional(),
        }),
      ),
      caveats: z.array(textSchema).min(1),
    }),
  ),
});

export const patternDocumentSchema = z.strictObject({
  version: catalogVersionSchema,
  patterns: z.array(architecturePatternSchema).min(1),
});

const catalogObjectSchema = z.strictObject({
  version: catalogVersionSchema,
  capabilities: z.array(capabilitySchema).min(1),
  providers: z.array(providerSchema).min(1),
  regions: z.array(regionSchema).min(1),
  geographyDefaults: z.array(geographyDefaultSchema).min(1),
  patterns: z.array(architecturePatternSchema).min(1),
});

type CatalogInput = z.infer<typeof catalogObjectSchema>;

function addIssue(context: z.RefinementCtx, message: string, path: PropertyKey[]): void {
  context.addIssue({ code: "custom", message, path });
}

function uniqueById<T extends { id: string }>(
  values: readonly T[],
  description: string,
  path: string,
  context: z.RefinementCtx,
): Map<string, T> {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    if (result.has(value.id))
      addIssue(context, `Duplicate ${description} ID ${value.id}.`, [path, index, "id"]);
    else result.set(value.id, value);
  });
  return result;
}

function validateCatalog(catalog: CatalogInput, context: z.RefinementCtx): void {
  const capabilities = uniqueById(catalog.capabilities, "capability", "capabilities", context);
  const regions = uniqueById(catalog.regions, "region", "regions", context);
  const providers = uniqueById(catalog.providers, "provider", "providers", context);
  uniqueById(catalog.patterns, "pattern", "patterns", context);

  catalog.regions.forEach((region, index) => {
    if (region.id !== `${region.provider}.${region.code}`) {
      addIssue(
        context,
        `Region ID must be provider-qualified as ${region.provider}.${region.code}.`,
        ["regions", index, "id"],
      );
    }
  });

  const mappings = new Map<string, z.infer<typeof serviceMappingSchema>>();
  const serviceIds = new Set<string>();
  const configurationIds = new Set<string>();
  catalog.providers.forEach((provider, providerIndex) => {
    const mappedCapabilities = new Set<string>();
    provider.services.forEach((mapping, mappingIndex) => {
      const path = ["providers", providerIndex, "services", mappingIndex];
      if (!capabilities.has(mapping.capabilityId))
        addIssue(context, `Unknown capability reference ${mapping.capabilityId}.`, [
          ...path,
          "capabilityId",
        ]);
      if (mappedCapabilities.has(mapping.capabilityId))
        addIssue(
          context,
          `Provider ${provider.id} has duplicate mappings for ${mapping.capabilityId}.`,
          [...path, "capabilityId"],
        );
      mappedCapabilities.add(mapping.capabilityId);
      mappings.set(`${provider.id}:${mapping.capabilityId}`, mapping);

      for (const [kind, id, seen] of [
        ["service", mapping.service.id, serviceIds],
        ["configuration", mapping.configuration.id, configurationIds],
      ] as const) {
        if (!id.startsWith(`${provider.id}.`))
          addIssue(context, `${kind} ID ${id} must be qualified with ${provider.id}.`, path);
        if (seen.has(id)) addIssue(context, `Duplicate ${kind} ID ${id}.`, path);
        seen.add(id);
      }

      const optionIds = new Set<string>();
      mapping.deploymentOptions.forEach((option, optionIndex) => {
        if (optionIds.has(option.id))
          addIssue(context, `Duplicate deployment option ID ${option.id}.`, [
            ...path,
            "deploymentOptions",
            optionIndex,
            "id",
          ]);
        optionIds.add(option.id);
      });
      const supportIds = new Set<string>();
      mapping.regionSupport.forEach((support, supportIndex) => {
        const supportPath = [...path, "regionSupport", supportIndex, "regionId"];
        const region = regions.get(support.regionId);
        if (supportIds.has(support.regionId))
          addIssue(context, `Duplicate region support ${support.regionId}.`, supportPath);
        if (region === undefined)
          addIssue(context, `Unknown region reference ${support.regionId}.`, supportPath);
        else if (region.provider !== provider.id)
          addIssue(
            context,
            `Region ${support.regionId} does not belong to ${provider.id}.`,
            supportPath,
          );
        supportIds.add(support.regionId);
      });
    });
    for (const capability of catalog.capabilities) {
      if (!mappedCapabilities.has(capability.id))
        addIssue(context, `Provider ${provider.id} is missing ${capability.id}.`, [
          "providers",
          providerIndex,
          "services",
        ]);
    }
  });
  for (const provider of CLOUD_PROVIDERS) {
    if (!providers.has(provider))
      addIssue(context, `Catalog is missing provider ${provider}.`, ["providers"]);
  }

  const defaults = new Set<string>();
  catalog.geographyDefaults.forEach((selection, index) => {
    const key = `${selection.geography}:${selection.provider}`;
    if (defaults.has(key))
      addIssue(context, `Duplicate geography default ${key}.`, ["geographyDefaults", index]);
    defaults.add(key);
    const region = regions.get(selection.regionId);
    if (region === undefined)
      addIssue(context, `Unknown default region ${selection.regionId}.`, [
        "geographyDefaults",
        index,
        "regionId",
      ]);
    else if (
      region.provider !== selection.provider ||
      region.geography !== selection.geography ||
      !region.selectable
    ) {
      addIssue(
        context,
        `Default region ${selection.regionId} is not a selectable match for ${key}.`,
        ["geographyDefaults", index, "regionId"],
      );
    }
  });
  for (const geography of catalogGeographySchema.options) {
    for (const provider of CLOUD_PROVIDERS) {
      if (!defaults.has(`${geography}:${provider}`))
        addIssue(context, `Missing geography default for ${geography}/${provider}.`, [
          "geographyDefaults",
        ]);
    }
  }

  catalog.patterns.forEach((pattern, patternIndex) => {
    const path = ["patterns", patternIndex];
    const nodes = uniqueById(pattern.nodes, "pattern node", "nodes", context);
    const componentCapabilities = new Set<string>();
    pattern.nodes.forEach((node, nodeIndex) => {
      if (node.type === "component") {
        componentCapabilities.add(node.capabilityId);
        if (!capabilities.has(node.capabilityId))
          addIssue(context, `Unknown pattern capability ${node.capabilityId}.`, [
            ...path,
            "nodes",
            nodeIndex,
            "capabilityId",
          ]);
      }
    });
    const edges = new Set<string>();
    pattern.edges.forEach((edge, edgeIndex) => {
      if (!nodes.has(edge.from) || !nodes.has(edge.to))
        addIssue(context, `Pattern edge references an unknown node.`, [
          ...path,
          "edges",
          edgeIndex,
        ]);
      const key = `${edge.from}:${edge.to}:${edge.relationship}`;
      if (edges.has(key))
        addIssue(context, `Duplicate pattern edge ${key}.`, [...path, "edges", edgeIndex]);
      edges.add(key);
    });
    const excluded = new Set<string>();
    pattern.excludedCapabilities.forEach((item, itemIndex) => {
      if (!capabilities.has(item.capabilityId))
        addIssue(context, `Unknown excluded capability ${item.capabilityId}.`, [
          ...path,
          "excludedCapabilities",
          itemIndex,
        ]);
      if (excluded.has(item.capabilityId) || componentCapabilities.has(item.capabilityId))
        addIssue(
          context,
          `Capability ${item.capabilityId} is duplicated or both included and excluded.`,
          [...path, "excludedCapabilities", itemIndex],
        );
      excluded.add(item.capabilityId);
    });
    const rules = new Set<string>();
    pattern.availabilityRules.forEach((rule, ruleIndex) => {
      if (rules.has(rule.availability))
        addIssue(context, `Duplicate availability rule ${rule.availability}.`, [
          ...path,
          "availabilityRules",
          ruleIndex,
        ]);
      rules.add(rule.availability);
      const requirements = new Set<string>();
      rule.requirements.forEach((requirement, requirementIndex) => {
        const node = nodes.get(requirement.componentId);
        const requirementPath = [
          ...path,
          "availabilityRules",
          ruleIndex,
          "requirements",
          requirementIndex,
        ];
        if (requirements.has(requirement.componentId))
          addIssue(
            context,
            `Duplicate component requirement ${requirement.componentId}.`,
            requirementPath,
          );
        requirements.add(requirement.componentId);
        if (node === undefined || node.type !== "component")
          return addIssue(
            context,
            `Unknown component requirement ${requirement.componentId}.`,
            requirementPath,
          );
        if (node.quantity.source === "availability-rule" && requirement.quantity === undefined)
          addIssue(
            context,
            `Requirement ${requirement.componentId} needs a quantity.`,
            requirementPath,
          );
        if (
          node.deploymentOptionSource === "availability-rule" &&
          requirement.deploymentOptionId === undefined
        )
          addIssue(
            context,
            `Requirement ${requirement.componentId} needs a deployment option.`,
            requirementPath,
          );
        if (requirement.deploymentOptionId !== undefined) {
          for (const provider of CLOUD_PROVIDERS) {
            const mapping = mappings.get(`${provider}:${node.capabilityId}`);
            if (
              mapping !== undefined &&
              !mapping.deploymentOptions.some(({ id }) => id === requirement.deploymentOptionId)
            )
              addIssue(
                context,
                `${provider} has no deployment option ${requirement.deploymentOptionId}.`,
                requirementPath,
              );
          }
        }
      });
      pattern.nodes
        .filter(
          (node): node is Extract<typeof node, { type: "component" }> => node.type === "component",
        )
        .forEach((node) => {
          if (
            (node.quantity.source === "availability-rule" ||
              node.deploymentOptionSource === "availability-rule") &&
            !requirements.has(node.id)
          )
            addIssue(context, `Rule ${rule.availability} is missing ${node.id}.`, [
              ...path,
              "availabilityRules",
              ruleIndex,
            ]);
        });
    });
    for (const availability of availabilitySchema.options) {
      if (!rules.has(availability))
        addIssue(context, `Pattern ${pattern.id} is missing ${availability}.`, [
          ...path,
          "availabilityRules",
        ]);
    }

    const requiredCapabilities = pattern.nodes
      .filter(
        (node): node is Extract<typeof node, { type: "component" }> => node.type === "component",
      )
      .filter((node) => node.required)
      .map((node) => node.capabilityId);
    catalog.geographyDefaults.forEach((selection, selectionIndex) => {
      for (const capability of requiredCapabilities) {
        const mapping = mappings.get(`${selection.provider}:${capability}`);
        if (
          mapping !== undefined &&
          !mapping.regionSupport.some(({ regionId }) => regionId === selection.regionId)
        )
          addIssue(
            context,
            `${mapping.configuration.id} is not evidenced in ${selection.regionId}.`,
            ["geographyDefaults", selectionIndex, "regionId"],
          );
      }
    });
  });
}

export const catalogSchema = catalogObjectSchema.superRefine(validateCatalog);
export type Catalog = z.infer<typeof catalogSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Region = z.infer<typeof regionSchema>;
export type ArchitecturePattern = z.infer<typeof architecturePatternSchema>;
export type ComponentPatternNode = Extract<
  ArchitecturePattern["nodes"][number],
  { type: "component" }
>;

export const DEFAULT_CATALOG_MANIFEST_PATH = fileURLToPath(
  new URL("../../../data/catalog/catalog-v1.yaml", import.meta.url),
);

function parseYaml(source: string): unknown {
  return parse(source, { merge: true });
}

export function parseCatalog(source: string | unknown): Catalog {
  return catalogSchema.parse(typeof source === "string" ? parseYaml(source) : source);
}

export function loadCatalog(manifestPath = DEFAULT_CATALOG_MANIFEST_PATH): Catalog {
  const manifest = catalogManifestSchema.parse(parseYaml(readFileSync(manifestPath, "utf8")));
  const base = dirname(manifestPath);
  const load = (path: string): unknown => parseYaml(readFileSync(resolve(base, path), "utf8"));
  const capabilities = capabilityDocumentSchema.parse(load(manifest.files.capabilities));
  const providers = providerDocumentSchema.parse(load(manifest.files.providers));
  const regions = regionDocumentSchema.parse(load(manifest.files.regions));
  const patterns = patternDocumentSchema.parse(load(manifest.files.patterns));
  for (const [name, version] of [
    ["capabilities", capabilities.version],
    ["providers", providers.version],
    ["regions", regions.version],
    ["patterns", patterns.version],
  ] as const) {
    if (version !== manifest.version)
      throw new Error(`${name} version ${version} does not match ${manifest.version}.`);
  }
  return parseCatalog({
    version: manifest.version,
    capabilities: capabilities.capabilities,
    providers: providers.providers,
    regions: regions.regions,
    geographyDefaults: regions.geographyDefaults,
    patterns: patterns.patterns,
  });
}
