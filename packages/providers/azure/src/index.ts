import { createHash } from "node:crypto";

import type { CloudProvider } from "@cloud-arena/domain";
import {
  PricingSyncError,
  fetchWithRetry,
  type PricingAdapter,
  type PricingAdapterResult,
  type PricingCategory,
  type PricingRecord,
  type PricingSyncRequest,
  type RetryOptions,
} from "@cloud-arena/pricing";

export const AZURE_PROVIDER: CloudProvider = "azure";
export const AZURE_ADAPTER_VERSION = "azure-retail-prices-v1";

export interface AzurePriceRecord {
  category?: string;
  currencyCode?: string;
  tierMinimumUnits?: number;
  retailPrice?: number;
  unitPrice?: number;
  armRegionName?: string;
  effectiveStartDate?: string;
  meterId?: string;
  meterName?: string;
  productId?: string;
  skuId?: string;
  productName?: string;
  skuName?: string;
  serviceName?: string;
  serviceId?: string;
  serviceFamily?: string;
  unitOfMeasure?: string;
  type?: string;
  isPrimaryMeterRegion?: boolean;
  armSkuName?: string;
}

export interface AzureFixture {
  provider: "azure";
  retrievedAt: string;
  region: string;
  records: AzurePriceRecord[];
}

interface AzurePage {
  Items?: AzurePriceRecord[];
  NextPageLink?: string | null;
}

const categories = new Set<PricingCategory>([
  "compute",
  "database-compute",
  "database-storage",
  "object-storage",
  "load-balancer-hour",
  "load-balancer-capacity",
  "public-egress",
]);

const units: Record<string, string | undefined> = {
  "1 Hour": "hour",
  "1/Hour": "hour",
  "1 GB/Month": "gb-month",
  "1 GiB/Month": "gib-month",
  "1 GB": "gb",
};

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === "")
    throw new PricingSyncError("source-schema", `Azure price record is missing ${field}.`);
  return value;
}

function normalizeAzureRecord(
  record: AzurePriceRecord,
  category: PricingCategory,
  retrievedAt: string,
  source: string,
  rawPayloadIndex: number,
): PricingRecord {
  if (
    required(record.currencyCode, "currencyCode") !== "USD" ||
    required(record.type, "type") !== "Consumption"
  )
    throw new PricingSyncError("normalization", "Azure record is not USD Consumption pricing.");
  const sourceUnit = required(record.unitOfMeasure, "unitOfMeasure");
  let unit = units[sourceUnit];
  if (category === "load-balancer-capacity" && sourceUnit === "1/Hour") unit = "capacity-unit-hour";
  if (unit === undefined)
    throw new PricingSyncError("normalization", `Unknown Azure pricing unit: ${sourceUnit}.`);
  const retailPrice = required(record.retailPrice, "retailPrice");
  const unitPrice = required(record.unitPrice, "unitPrice");
  if (retailPrice !== unitPrice)
    throw new PricingSyncError("normalization", "Azure unitPrice differs from retailPrice.");
  const meterId = required(record.meterId, "meterId");
  const tierStart = required(record.tierMinimumUnits, "tierMinimumUnits");
  const effectiveAt = required(record.effectiveStartDate, "effectiveStartDate");
  const armSkuName = record.armSkuName?.trim();
  const skuName = armSkuName || record.skuName;
  return {
    provider: "azure",
    serviceCategory: category,
    serviceName: required(record.serviceName, "serviceName"),
    skuId: required(record.skuId, "skuId"),
    ...(skuName === undefined ? {} : { skuName }),
    region: required(record.armRegionName, "armRegionName"),
    pricingModel: "on-demand",
    unit,
    unitPrice: String(retailPrice),
    currency: "USD",
    effectiveAt,
    retrievedAt,
    source,
    sourcePriceId: `${meterId}:${tierStart}:${effectiveAt}`,
    sourceUnit,
    sourceUnitPrice: String(retailPrice),
    unitConversionFactor: "1",
    tierStart: String(tierStart),
    rawPayloadIndex,
    sourceAttributes: {
      meterId,
      meterName: required(record.meterName, "meterName"),
      productId: required(record.productId, "productId"),
      productName: required(record.productName, "productName"),
      serviceId: required(record.serviceId, "serviceId"),
      ...(record.armSkuName === undefined ? {} : { armSkuName: record.armSkuName }),
      ...(record.isPrimaryMeterRegion === undefined
        ? {}
        : { isPrimaryMeterRegion: record.isPrimaryMeterRegion }),
    },
  };
}

function withTierEnds(records: PricingRecord[]): PricingRecord[] {
  const groups = Map.groupBy(
    records,
    (record) => `${record.region}|${record.sourceAttributes.meterId}`,
  );
  for (const group of groups.values()) {
    group.sort((left, right) => Number(left.tierStart) - Number(right.tierStart));
    group.forEach((record, index) => {
      const next = group[index + 1];
      if (next !== undefined) record.tierEnd = next.tierStart;
    });
  }
  return records;
}

export function parseAzureFixture(fixture: AzureFixture): PricingAdapterResult {
  if (fixture.provider !== "azure" || !Array.isArray(fixture.records))
    throw new PricingSyncError("source-schema", "Invalid Azure pricing fixture.");
  const source = `fixture:azure:${fixture.region}`;
  const normalized = fixture.records.map((record) => {
    const fixtureCategory =
      record.category === "load-balancer-fixed" ? "load-balancer-hour" : record.category;
    if (fixtureCategory === undefined || !categories.has(fixtureCategory as PricingCategory))
      throw new PricingSyncError(
        "normalization",
        `Unsupported Azure category: ${record.category}.`,
      );
    return normalizeAzureRecord(
      record,
      fixtureCategory as PricingCategory,
      fixture.retrievedAt,
      source,
      0,
    );
  });
  return {
    provider: "azure",
    retrievedAt: fixture.retrievedAt,
    rawPayloads: [
      {
        source,
        retrievedAt: fixture.retrievedAt,
        pageNumber: 1,
        checksum: `fixture-${fixture.records.length}`,
        payload: fixture,
      },
    ],
    records: withTierEnds(normalized),
    gaps: [],
    requestParameters: { fixtureVersion: 1, region: fixture.region },
  };
}

const filters: Record<PricingCategory, string> = {
  compute: "serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_D2as_v5'",
  "database-compute":
    "serviceName eq 'Azure Database for PostgreSQL' and armSkuName eq 'Standard_D2ds_v5'",
  "database-storage":
    "serviceName eq 'Azure Database for PostgreSQL' and contains(productName, 'Flex Server Storage')",
  "object-storage":
    "serviceName eq 'Storage' and productName eq 'Blob Storage' and skuName eq 'Hot LRS'",
  "load-balancer-hour":
    "serviceName eq 'Application Gateway' and productName eq 'Application Gateway Standard v2'",
  "load-balancer-capacity":
    "serviceName eq 'Application Gateway' and productName eq 'Application Gateway Standard v2'",
  "public-egress": "serviceName eq 'Bandwidth' and meterName eq 'Standard Data Transfer Out'",
};

function categoryMatches(category: PricingCategory, item: AzurePriceRecord): boolean {
  const meter = item.meterName ?? "";
  if (category === "load-balancer-hour") return meter === "Standard Fixed Cost";
  if (category === "load-balancer-capacity") return meter === "Standard Capacity Units";
  if (category === "compute")
    return !`${item.productName ?? ""} ${meter}`.match(/Windows|Spot|Low Priority|Cloud Services/i);
  if (category === "object-storage") return meter === "Hot LRS Data Stored";
  if (category === "database-compute")
    return item.productName?.includes("Flexible Server") === true;
  if (category === "database-storage") return meter === "Storage Data Stored";
  if (category === "public-egress")
    return item.productName?.includes("Rtn Preference: MGN") === true;
  return true;
}

export class AzureRetailPricesAdapter implements PricingAdapter {
  readonly provider = "azure" as const;
  readonly version = AZURE_ADAPTER_VERSION;
  readonly #retryOptions: RetryOptions;

  constructor(retryOptions: RetryOptions = {}) {
    this.#retryOptions = retryOptions;
  }

  async fetch(request: PricingSyncRequest): Promise<PricingAdapterResult> {
    const retrievedAt = new Date().toISOString();
    const rawPayloads: PricingAdapterResult["rawPayloads"] = [];
    const records: PricingRecord[] = [];
    const requestFilters: string[] = [];

    for (const region of request.regions) {
      for (const category of request.categories) {
        const filter = `armRegionName eq '${region}' and priceType eq 'Consumption' and ${filters[category]}`;
        requestFilters.push(filter);
        const url = new URL("https://prices.azure.com/api/retail/prices");
        url.searchParams.set("currencyCode", "USD");
        url.searchParams.set("$filter", filter);
        let next: string | null = url.toString();
        const seen = new Set<string>();
        while (next !== null) {
          if (request.deadlineAt !== undefined && Date.now() >= request.deadlineAt.getTime())
            throw new PricingSyncError(
              "transient-provider",
              "Azure pricing sync deadline expired.",
            );
          if (seen.has(next))
            throw new PricingSyncError("source-schema", "Azure returned a repeated NextPageLink.");
          seen.add(next);
          const nextUrl = new URL(next);
          if (nextUrl.protocol !== "https:" || nextUrl.hostname !== "prices.azure.com")
            throw new PricingSyncError(
              "source-schema",
              "Azure returned an untrusted NextPageLink.",
            );
          const response = await fetchWithRetry(next, {}, this.#retryOptions);
          const page = (await response.json()) as AzurePage;
          if (!Array.isArray(page.Items))
            throw new PricingSyncError("source-schema", "Azure response has no Items array.");
          const rawPayloadIndex = rawPayloads.length;
          rawPayloads.push({
            source: next,
            retrievedAt,
            pageNumber: rawPayloadIndex + 1,
            checksum: createHash("sha256").update(JSON.stringify(page)).digest("hex"),
            payload: page,
          });
          for (const item of page.Items.filter((candidate) => categoryMatches(category, candidate)))
            records.push(normalizeAzureRecord(item, category, retrievedAt, next, rawPayloadIndex));
          next = page.NextPageLink ?? null;
        }
      }
    }

    return {
      provider: "azure",
      retrievedAt,
      rawPayloads,
      records: withTierEnds(records),
      gaps: [],
      requestParameters: { currencyCode: "USD", filters: requestFilters },
    };
  }
}
