import { createHash } from "node:crypto";

import type { CloudProvider } from "@cloud-arena/domain";
import {
  PricingSyncError,
  fetchWithRetry,
  type HttpResponse,
  type PricingAdapter,
  type PricingAdapterResult,
  type PricingCategory,
  type PricingRecord,
  type PricingSyncRequest,
  type RetryOptions,
} from "@cloud-arena/pricing";

export const AWS_PROVIDER: CloudProvider = "aws";
export const AWS_ADAPTER_VERSION = "aws-price-list-v1";

type AwsValue = string | undefined;
export type AwsPriceRow = Record<string, AwsValue> & { category?: string; offerCode?: string };

export interface AwsFixture {
  provider: "aws";
  retrievedAt: string;
  region: string;
  records: AwsPriceRow[];
}

const categoryMap: Record<string, PricingCategory | undefined> = {
  compute: "compute",
  "database-compute": "database-compute",
  "database-storage": "database-storage",
  "object-storage": "object-storage",
  "load-balancer-hour": "load-balancer-hour",
  "load-balancer-capacity": "load-balancer-capacity",
  "public-egress": "public-egress",
};

const unitMap: Record<string, string | undefined> = {
  Hrs: "hour",
  "GB-Mo": "gb-month",
  GB: "gb",
  "LCU-Hrs": "lcu-hour",
};

function required(row: AwsPriceRow, field: string): string {
  const value = row[field];
  if (value === undefined || value.trim() === "")
    throw new PricingSyncError("source-schema", `AWS price row is missing ${field}.`);
  return value;
}

function normalizeAwsRow(
  row: AwsPriceRow,
  retrievedAt: string,
  source: string,
  rawPayloadIndex: number,
): PricingRecord {
  const category = categoryMap[required(row, "category")];
  if (category === undefined)
    throw new PricingSyncError("normalization", `Unsupported AWS category: ${row.category}.`);
  if (required(row, "TermType") !== "OnDemand" || required(row, "Currency") !== "USD")
    throw new PricingSyncError("normalization", "AWS record is not USD OnDemand pricing.");
  const sourceUnit = required(row, "Unit");
  const unit = unitMap[sourceUnit];
  if (unit === undefined)
    throw new PricingSyncError("normalization", `Unknown AWS pricing unit: ${sourceUnit}.`);
  const endingRange = required(row, "EndingRange");
  const region = row["Region Code"] ?? row["From Region Code"];
  if (region === undefined)
    throw new PricingSyncError("source-schema", "AWS record has no Region Code.");
  const skuName =
    row["Instance Type"] ?? row["Volume Type"] ?? row["Storage Class"] ?? row.PriceDescription;
  const effectiveAt = required(row, "EffectiveDate");
  const catalogPublishedAt = row.publicationDate;
  return {
    provider: "aws",
    serviceCategory: category,
    serviceName: required(row, "offerCode"),
    skuId: required(row, "SKU"),
    ...(skuName === undefined ? {} : { skuName }),
    region,
    pricingModel: "on-demand",
    unit,
    unitPrice: required(row, "PricePerUnit"),
    currency: "USD",
    effectiveAt,
    retrievedAt,
    source,
    sourcePriceId: required(row, "RateCode"),
    sourceUnit,
    sourceUnitPrice: required(row, "PricePerUnit"),
    unitConversionFactor: "1",
    tierStart: required(row, "StartingRange"),
    ...(endingRange === "Inf" ? {} : { tierEnd: endingRange }),
    ...(catalogPublishedAt === undefined ? {} : { catalogPublishedAt }),
    rawPayloadIndex,
    sourceAttributes: Object.fromEntries(
      ["Product Family", "PriceDescription", "operation", "usageType", "Deployment Option"].flatMap(
        (key) => (row[key] === undefined ? [] : [[key, row[key] as string]]),
      ),
    ),
  };
}

export function parseAwsFixture(fixture: AwsFixture): PricingAdapterResult {
  if (fixture.provider !== "aws" || !Array.isArray(fixture.records))
    throw new PricingSyncError("source-schema", "Invalid AWS pricing fixture.");
  const source = `fixture:aws:${fixture.region}`;
  return {
    provider: "aws",
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
    records: fixture.records.map((row) => normalizeAwsRow(row, fixture.retrievedAt, source, 0)),
    gaps: [],
    requestParameters: { fixtureVersion: 1, region: fixture.region },
  };
}

const offerByCategory: Record<PricingCategory, string> = {
  compute: "AmazonEC2",
  "database-compute": "AmazonRDS",
  "database-storage": "AmazonRDS",
  "object-storage": "AmazonS3",
  "load-balancer-hour": "AWSELB",
  "load-balancer-capacity": "AWSELB",
  "public-egress": "AWSDataTransfer",
};

function selectedCategory(row: AwsPriceRow, offerCode: string): PricingCategory | undefined {
  if (row.TermType !== "OnDemand" || row.Currency !== "USD") return undefined;
  if (offerCode === "AmazonEC2")
    return row["Product Family"] === "Compute Instance" &&
      row["Instance Type"] === "m6i.large" &&
      row["Operating System"] === "Linux" &&
      row.Tenancy === "Shared" &&
      row["Pre Installed S/W"] === "NA" &&
      row.CapacityStatus === "Used" &&
      row.operation === "RunInstances"
      ? "compute"
      : undefined;
  if (offerCode === "AmazonRDS") {
    if (
      row["Product Family"] === "Database Instance" &&
      row["Instance Type"] === "db.m6g.large" &&
      row["Database Engine"] === "PostgreSQL"
    )
      return "database-compute";
    if (
      row["Product Family"] === "Database Storage" &&
      row["Volume Type"] === "General Purpose-GP3" &&
      row["Database Engine"] === "PostgreSQL"
    )
      return "database-storage";
    return undefined;
  }
  if (offerCode === "AmazonS3")
    return row["Product Family"] === "Storage" &&
      row["Storage Class"] === "General Purpose" &&
      row["Volume Type"] === "Standard"
      ? "object-storage"
      : undefined;
  if (offerCode === "AWSELB" && row["Product Family"] === "Load Balancer-Application") {
    if (row.Unit === "Hrs") return "load-balancer-hour";
    if (row.Unit === "LCU-Hrs") return "load-balancer-capacity";
  }
  if (offerCode === "AWSDataTransfer")
    return row["Transfer Type"] === "AWS Outbound" && row["To Location"] === "External"
      ? "public-egress"
      : undefined;
  return undefined;
}

async function parseAwsCsv(
  response: HttpResponse,
  offerCode: string,
  wanted: ReadonlySet<PricingCategory>,
): Promise<{ checksum: string; metadata: Record<string, string>; rows: AwsPriceRow[] }> {
  if (response.body === null)
    throw new PricingSyncError("source-schema", "AWS price response has no body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const hash = createHash("sha256");
  const metadata: Record<string, string> = {};
  const selected: AwsPriceRow[] = [];
  let headers: string[] | undefined;
  let field = "";
  let row: string[] = [];
  let quoted = false;
  let quotePending = false;

  const acceptRow = (values: string[]) => {
    if (values.length === 0 || values.every((value) => value === "")) return;
    if (headers === undefined) {
      if (values.includes("SKU") && values.includes("RateCode")) headers = values;
      else if (values.length >= 2 && values[0] !== undefined && values[1] !== undefined)
        metadata[values[0]] = values[1];
      return;
    }
    const candidate = Object.fromEntries(
      headers.map((header, index) => [header, values[index]]),
    ) as AwsPriceRow;
    const category = selectedCategory(candidate, offerCode);
    if (category !== undefined && wanted.has(category))
      selected.push({
        ...candidate,
        category,
        offerCode,
        publicationDate: metadata["Publication Date"],
        catalogVersion: metadata.Version,
      });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value === undefined)
      throw new PricingSyncError("source-schema", "AWS response stream returned no bytes.");
    hash.update(value);
    const text = decoder.decode(value, { stream: true });
    for (const character of text) {
      if (quoted) {
        if (quotePending) {
          if (character === '"') {
            field += '"';
            quotePending = false;
            continue;
          }
          quoted = false;
          quotePending = false;
        } else if (character === '"') {
          quotePending = true;
          continue;
        } else {
          field += character;
          continue;
        }
      }
      if (character === '"' && field === "") quoted = true;
      else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
        acceptRow(row);
        row = [];
        field = "";
      } else field += character;
    }
  }
  field += decoder.decode();
  if (quoted && !quotePending)
    throw new PricingSyncError("source-schema", "AWS CSV ended inside a quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    acceptRow(row);
  }
  if (headers === undefined)
    throw new PricingSyncError("source-schema", "AWS CSV ended without a price header.");
  return { checksum: hash.digest("hex"), metadata, rows: selected };
}

export class AwsPriceListAdapter implements PricingAdapter {
  readonly provider = "aws" as const;
  readonly version = AWS_ADAPTER_VERSION;
  readonly #retryOptions: RetryOptions;

  constructor(retryOptions: RetryOptions = {}) {
    this.#retryOptions = retryOptions;
  }

  async fetch(request: PricingSyncRequest): Promise<PricingAdapterResult> {
    const retrievedAt = new Date().toISOString();
    const rawPayloads: PricingAdapterResult["rawPayloads"] = [];
    const records: PricingRecord[] = [];
    const sources: string[] = [];
    for (const region of request.regions) {
      const offers = new Set(request.categories.map((category) => offerByCategory[category]));
      for (const offerCode of offers) {
        if (request.deadlineAt !== undefined && Date.now() >= request.deadlineAt.getTime())
          throw new PricingSyncError("transient-provider", "AWS pricing sync deadline expired.");
        const url = `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/${offerCode}/current/${region}/index.csv`;
        const response = await fetchWithRetry(url, {}, this.#retryOptions);
        const wanted = new Set(
          request.categories.filter((category) => offerByCategory[category] === offerCode),
        );
        const parsed = await parseAwsCsv(response, offerCode, wanted);
        const version = parsed.metadata.Version;
        const source = version === undefined ? url : `${url}#version=${version}`;
        sources.push(source);
        const rawPayloadIndex = rawPayloads.length;
        rawPayloads.push({
          source,
          retrievedAt,
          pageNumber: rawPayloadIndex + 1,
          checksum: parsed.checksum,
          payload: { metadata: parsed.metadata, selectedRecords: parsed.rows },
        });
        records.push(
          ...parsed.rows.map((row) => normalizeAwsRow(row, retrievedAt, source, rawPayloadIndex)),
        );
      }
    }
    return {
      provider: "aws",
      retrievedAt,
      rawPayloads,
      records,
      gaps: [],
      requestParameters: { sources },
    };
  }
}
