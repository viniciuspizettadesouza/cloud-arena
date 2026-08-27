import type { ArchitectureCandidate, ArchitectureComponent } from "@cloud-arena/catalog";
import {
  costEstimateSchema,
  costLineItemSchema,
  normalizedWorkloadSchema,
  type CostEstimate,
  type CostEstimateGap,
  type CostLineItem,
  type NormalizedWorkload,
  type PricingTrace,
} from "@cloud-arena/contracts";
import type {
  ActivePricingSnapshot,
  PersistedPricingRecord,
  PricingCategory,
} from "@cloud-arena/pricing";

import { Decimal } from "./decimal.js";

export const COST_CALCULATION_VERSION = "cost-v1" as const;
export const MONTHLY_HOURS = 730;
export const DECIMAL_BYTES_PER_GB = 1_000_000_000;
export const BYTES_PER_GIB = 1_073_741_824;
export const LOAD_BALANCER_REQUEST_SIZE_KB = 1;
export const AZURE_CAPACITY_UNIT_PROCESSED_GB = 1_530;

const ZERO = Decimal.from(0);
const ONE = Decimal.from(1);
const REQUIRED_CATEGORIES: PricingCategory[] = [
  "compute",
  "database-compute",
  "database-storage",
  "object-storage",
  "load-balancer-hour",
  "load-balancer-capacity",
  "public-egress",
];

interface CalculationResult {
  lineItems: CostLineItem[];
  gaps: CostEstimateGap[];
}

function component(candidate: ArchitectureCandidate, id: string): ArchitectureComponent {
  const match = candidate.components.find((item) => item.id === id);
  if (match === undefined) throw new Error(`Candidate ${candidate.id} has no ${id} component.`);
  return match;
}

function recordsFor(
  snapshot: ActivePricingSnapshot | undefined,
  candidate: ArchitectureCandidate,
  category: PricingCategory,
): PersistedPricingRecord[] {
  if (snapshot === undefined || snapshot.provider !== candidate.provider) return [];
  const matches = snapshot.records.filter(
    (record) =>
      record.serviceCategory === category &&
      (record.region === candidate.region.code ||
        (component(candidate, "load-balancer").scope === "global" && record.region === "global")),
  );
  if (
    candidate.provider === "aws" &&
    (category === "database-compute" || category === "database-storage")
  ) {
    const deployment = component(candidate, "postgresql").deploymentOption?.id;
    const expected = deployment === "high-availability" ? "Multi-AZ" : "Single-AZ";
    const deploymentMatches = matches.filter(
      (record) => record.sourceAttributes["Deployment Option"] === expected,
    );
    if (deploymentMatches.length > 0) return deploymentMatches;
  }
  return matches;
}

function singleRecord(
  snapshot: ActivePricingSnapshot | undefined,
  candidate: ArchitectureCandidate,
  category: PricingCategory,
  expectedUnit: string | readonly string[],
): PersistedPricingRecord | undefined {
  const units = typeof expectedUnit === "string" ? [expectedUnit] : expectedUnit;
  const matches = recordsFor(snapshot, candidate, category).filter((record) =>
    units.includes(record.unit),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function trace(record: PersistedPricingRecord): PricingTrace {
  return {
    pricingRecordId: record.id,
    snapshotId: record.snapshotId,
    rawPayloadId: record.rawPayloadId,
    provider: record.provider,
    serviceName: record.serviceName,
    skuId: record.skuId,
    ...(record.skuName === undefined ? {} : { skuName: record.skuName }),
    region: record.region,
    unit: record.unit,
    unitPriceUSD: record.unitPrice,
    sourcePriceId: record.sourcePriceId,
    source: record.source,
    retrievedAt: record.retrievedAt,
    tierStart: record.tierStart,
    ...(record.tierEnd === undefined ? {} : { tierEnd: record.tierEnd }),
  };
}

function gap(category: PricingCategory, candidate: ArchitectureCandidate): CostEstimateGap {
  return {
    category,
    reason: `No unique compatible ${category} price exists in the active ${candidate.provider} snapshot for ${candidate.region.code}.`,
  };
}

function simpleLine(
  id: CostLineItem["id"],
  capabilityId: string,
  description: string,
  quantity: Decimal,
  unit: string,
  record: PersistedPricingRecord,
  formula: string,
): CostLineItem {
  const price = Decimal.from(record.unitPrice);
  return costLineItemSchema.parse({
    id,
    capabilityId,
    description,
    quantity: quantity.toNumber(),
    unit,
    unitPriceUSD: price.toNumber(),
    monthlyCostUSD: quantity.multiply(price).toNumber(),
    formula,
    pricing: [trace(record)],
  });
}

function provisionedLine(
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
  category: "compute" | "database-compute",
  architectureComponent: ArchitectureComponent,
  multiplier: number,
): CostLineItem | CostEstimateGap {
  const record = singleRecord(snapshot, candidate, category, "hour");
  if (record === undefined) return gap(category, candidate);
  const quantity = Decimal.from(architectureComponent.quantity)
    .multiply(Decimal.from(multiplier))
    .multiply(Decimal.from(MONTHLY_HOURS));
  return simpleLine(
    category,
    architectureComponent.capabilityId,
    architectureComponent.name,
    quantity,
    "instance-hour",
    record,
    `${architectureComponent.quantity} instance(s) × ${multiplier} deployment factor × ${MONTHLY_HOURS} hours × ${record.unitPrice} USD/hour`,
  );
}

function tiers(records: PersistedPricingRecord[]): PersistedPricingRecord[] | undefined {
  const sorted = [...records].sort((left, right) =>
    Decimal.from(left.tierStart).compare(Decimal.from(right.tierStart)),
  );
  if (sorted.length === 0) return undefined;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index] as PersistedPricingRecord;
    const next = sorted[index + 1] as PersistedPricingRecord;
    if (
      current.tierEnd === undefined ||
      Decimal.from(current.tierEnd).compare(Decimal.from(next.tierStart)) !== 0
    )
      return undefined;
  }
  return sorted;
}

function tieredLine(
  id: CostLineItem["id"],
  capabilityId: string,
  description: string,
  quantity: Decimal,
  unit: string,
  records: PersistedPricingRecord[],
  formulaPrefix: string,
): CostLineItem {
  let total = ZERO;
  const used: PersistedPricingRecord[] = [];
  for (const record of records) {
    const start = Decimal.from(record.tierStart);
    const end =
      record.tierEnd === undefined ? quantity : Decimal.from(record.tierEnd).min(quantity);
    const usage = end.subtract(start).max(ZERO);
    if (usage.compare(ZERO) > 0 || records.length === 1) used.push(record);
    total = total.add(usage.multiply(Decimal.from(record.unitPrice)));
  }
  const distinctPrices = new Set(used.map((record) => record.unitPrice));
  return costLineItemSchema.parse({
    id,
    capabilityId,
    description,
    quantity: quantity.toNumber(),
    unit,
    unitPriceUSD:
      distinctPrices.size === 1
        ? Decimal.from(used[0]?.unitPrice ?? records[0]?.unitPrice ?? "0").toNumber()
        : null,
    monthlyCostUSD: total.toNumber(),
    formula: `${formulaPrefix}; Σ max(0, min(quantity, tier end) - tier start) × tier rate`,
    pricing: (used.length === 0 ? [records[0] as PersistedPricingRecord] : used).map(trace),
  });
}

function storageLine(
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
  category: "database-storage" | "object-storage",
  quantityGB: number,
  architectureComponent: ArchitectureComponent,
): CostLineItem | CostEstimateGap {
  const compatible = recordsFor(snapshot, candidate, category).filter((record) =>
    ["gb-month", "gib-month"].includes(record.unit),
  );
  const pricedTiers = tiers(compatible);
  if (pricedTiers === undefined) return gap(category, candidate);
  const usesGiB = pricedTiers.every(({ unit }) => unit === "gib-month");
  if (!usesGiB && !pricedTiers.every(({ unit }) => unit === "gb-month"))
    return gap(category, candidate);
  const quantity = usesGiB
    ? Decimal.from(quantityGB)
        .multiply(Decimal.from(DECIMAL_BYTES_PER_GB))
        .divide(Decimal.from(BYTES_PER_GIB))
    : Decimal.from(quantityGB);
  return tieredLine(
    category,
    architectureComponent.capabilityId,
    architectureComponent.name,
    quantity,
    usesGiB ? "GiB-month" : "GB-month",
    pricedTiers,
    usesGiB
      ? `${quantityGB} decimal GB × ${DECIMAL_BYTES_PER_GB} / ${BYTES_PER_GIB}`
      : `${quantityGB} GB-month`,
  );
}

function processedLoadBalancerGB(workload: NormalizedWorkload): Decimal {
  const requestGB = Decimal.from(workload.requestsPerMonth)
    .multiply(Decimal.from(LOAD_BALANCER_REQUEST_SIZE_KB))
    .divide(Decimal.from(1_000_000));
  return Decimal.from(workload.monthlyEgressGB).add(requestGB);
}

function loadBalancerLine(
  workload: NormalizedWorkload,
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
): CostLineItem | CostEstimateGap[] {
  const hourly = singleRecord(snapshot, candidate, "load-balancer-hour", "hour");
  const capacity = singleRecord(snapshot, candidate, "load-balancer-capacity", [
    "lcu-hour",
    "capacity-unit-hour",
    "gb",
    "gib",
  ]);
  const gaps = [
    ...(hourly === undefined ? [gap("load-balancer-hour", candidate)] : []),
    ...(capacity === undefined ? [gap("load-balancer-capacity", candidate)] : []),
  ];
  if (hourly === undefined || capacity === undefined) return gaps;
  const processedGB = processedLoadBalancerGB(workload);
  const fixedQuantity = Decimal.from(MONTHLY_HOURS).multiply(
    Decimal.from(component(candidate, "load-balancer").quantity),
  );
  let capacityQuantity: Decimal;
  let capacityFormula: string;
  if (capacity.unit === "lcu-hour") {
    capacityQuantity = processedGB;
    capacityFormula = `${processedGB.toNumber()} processed GB ÷ 1 GB/LCU-hour`;
  } else if (capacity.unit === "capacity-unit-hour") {
    const units = processedGB.divide(Decimal.from(AZURE_CAPACITY_UNIT_PROCESSED_GB)).max(ONE);
    capacityQuantity = units.multiply(Decimal.from(MONTHLY_HOURS));
    capacityFormula = `max(1, ${processedGB.toNumber()} processed GB ÷ ${AZURE_CAPACITY_UNIT_PROCESSED_GB}) × ${MONTHLY_HOURS} hours`;
  } else {
    capacityQuantity =
      capacity.unit === "gib"
        ? processedGB
            .multiply(Decimal.from(DECIMAL_BYTES_PER_GB))
            .divide(Decimal.from(BYTES_PER_GIB))
        : processedGB;
    capacityFormula = `${processedGB.toNumber()} processed GB${capacity.unit === "gib" ? ` × ${DECIMAL_BYTES_PER_GB} / ${BYTES_PER_GIB}` : ""}`;
  }
  const fixedCost = fixedQuantity.multiply(Decimal.from(hourly.unitPrice));
  const capacityCost = capacityQuantity.multiply(Decimal.from(capacity.unitPrice));
  return costLineItemSchema.parse({
    id: "load-balancer",
    capabilityId: "network.load-balancer",
    description: component(candidate, "load-balancer").name,
    quantity: fixedQuantity.toNumber() + capacityQuantity.toNumber(),
    unit: `hour + ${capacity.unit}`,
    unitPriceUSD: null,
    monthlyCostUSD: fixedCost.add(capacityCost).toNumber(),
    formula: `${MONTHLY_HOURS} hours × ${hourly.unitPrice} USD/hour + (${capacityFormula}) × ${capacity.unitPrice} USD/${capacity.unit}`,
    pricing: [trace(hourly), trace(capacity)],
  });
}

function egressLine(
  workload: NormalizedWorkload,
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
): CostLineItem | CostEstimateGap {
  const compatible = recordsFor(snapshot, candidate, "public-egress").filter((record) =>
    ["gb", "gib"].includes(record.unit),
  );
  const pricedTiers = tiers(compatible);
  if (pricedTiers === undefined) return gap("public-egress", candidate);
  const usesGiB = pricedTiers.every(({ unit }) => unit === "gib");
  if (!usesGiB && !pricedTiers.every(({ unit }) => unit === "gb"))
    return gap("public-egress", candidate);
  let quantity = usesGiB
    ? Decimal.from(workload.monthlyEgressGB)
        .multiply(Decimal.from(DECIMAL_BYTES_PER_GB))
        .divide(Decimal.from(BYTES_PER_GIB))
    : Decimal.from(workload.monthlyEgressGB);
  const allowance = candidate.provider === "aws" ? Decimal.from(100) : ZERO;
  quantity = quantity.subtract(allowance).max(ZERO);
  return tieredLine(
    "public-egress",
    "network.public-egress",
    "Public internet egress",
    quantity,
    usesGiB ? "GiB" : "GB",
    pricedTiers,
    `${workload.monthlyEgressGB} decimal GB${usesGiB ? ` × ${DECIMAL_BYTES_PER_GB} / ${BYTES_PER_GIB}` : ""}${candidate.provider === "aws" ? " - 100 GB global free allowance" : ""}`,
  );
}

function split(
  results: Array<CostLineItem | CostEstimateGap | CostEstimateGap[]>,
): CalculationResult {
  const lineItems: CostLineItem[] = [];
  const gaps: CostEstimateGap[] = [];
  for (const result of results.flat()) {
    if ("reason" in result) gaps.push(result);
    else lineItems.push(result);
  }
  return { lineItems, gaps };
}

export function calculateProvisionedCosts(
  uncheckedWorkload: NormalizedWorkload,
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
): CalculationResult {
  const workload = normalizedWorkloadSchema.parse(uncheckedWorkload);
  const database = component(candidate, "postgresql");
  const databaseFactor =
    database.deploymentOption?.id === "high-availability" && candidate.provider !== "aws" ? 2 : 1;
  return split([
    provisionedLine(candidate, snapshot, "compute", component(candidate, "compute"), 1),
    provisionedLine(candidate, snapshot, "database-compute", database, databaseFactor),
    storageLine(candidate, snapshot, "database-storage", workload.databaseStorageGB, database),
  ]);
}

export function calculateVariableCosts(
  uncheckedWorkload: NormalizedWorkload,
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
): CalculationResult {
  const workload = normalizedWorkloadSchema.parse(uncheckedWorkload);
  return split([
    storageLine(
      candidate,
      snapshot,
      "object-storage",
      workload.objectStorageGB,
      component(candidate, "object-storage"),
    ),
    loadBalancerLine(workload, candidate, snapshot),
    egressLine(workload, candidate, snapshot),
  ]);
}

export function estimateCandidateCost(
  uncheckedWorkload: NormalizedWorkload,
  candidate: ArchitectureCandidate,
  snapshot: ActivePricingSnapshot | undefined,
): CostEstimate {
  const workload = normalizedWorkloadSchema.parse(uncheckedWorkload);
  const provisioned = calculateProvisionedCosts(workload, candidate, snapshot);
  const variable = calculateVariableCosts(workload, candidate, snapshot);
  const lineItems = [...provisioned.lineItems, ...variable.lineItems];
  const gaps = [...provisioned.gaps, ...variable.gaps];
  if (snapshot === undefined)
    for (const category of REQUIRED_CATEGORIES)
      if (!gaps.some((item) => item.category === category)) gaps.push(gap(category, candidate));
  const total = lineItems.reduce(
    (sum, lineItem) => sum.add(Decimal.from(lineItem.monthlyCostUSD)),
    ZERO,
  );
  return costEstimateSchema.parse({
    status: gaps.length === 0 ? "available" : "unavailable",
    currency: "USD",
    ...(gaps.length === 0 ? { monthlyCostUSD: total.toNumber() } : {}),
    lineItems,
    includedItems: [
      "Compute instance hours",
      "Managed PostgreSQL compute and provisioned storage",
      "Object-storage capacity",
      "Layer 7 load-balancer fixed and capacity usage",
      "Public internet egress to the selected geography",
    ],
    excludedItems: [
      "VM boot disks, snapshots, and backups",
      "Storage operations, retrieval, replication, IOPS, and throughput",
      "DNS, certificates, WAF, CDN, NAT, public IPv4, and inter-zone traffic",
      "Support, taxes, credits, commitments, and negotiated discounts",
      ...candidate.excludedCapabilities.map(
        ({ serviceName, reason }) => `${serviceName}: ${reason}`,
      ),
    ],
    gaps,
    ...(snapshot === undefined ? {} : { pricingSnapshotAt: snapshot.retrievedAt }),
    confidence: gaps.length === 0 ? workload.confidence : 0,
    calculationVersion: COST_CALCULATION_VERSION,
  });
}

export function estimateCandidateCosts(
  workload: NormalizedWorkload,
  candidates: readonly ArchitectureCandidate[],
  snapshots: readonly ActivePricingSnapshot[],
): Array<{ candidate: ArchitectureCandidate; costEstimate: CostEstimate }> {
  return candidates.map((candidate) => ({
    candidate,
    costEstimate: estimateCandidateCost(
      workload,
      candidate,
      snapshots.find(({ provider }) => provider === candidate.provider),
    ),
  }));
}

export const COST_PACKAGE = "@cloud-arena/cost" as const;
