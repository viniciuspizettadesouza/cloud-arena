import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { PostgresPricingSnapshotRepository, createDatabase } from "@cloud-arena/database";
import {
  PRICING_CATEGORIES,
  PricingSyncError,
  synchronizePricing,
  type PricingAdapter,
} from "@cloud-arena/pricing";
import { AwsPriceListAdapter } from "@cloud-arena/provider-aws";
import { AzureRetailPricesAdapter } from "@cloud-arena/provider-azure";
import { GcpCatalogAdapter } from "@cloud-arena/provider-gcp";

try {
  loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}

const regions = {
  aws: ["eu-west-1", "us-east-1", "sa-east-1"],
  azure: ["westeurope", "eastus", "brazilsouth"],
  gcp: ["europe-west1", "us-east4", "southamerica-east1"],
} as const;

function selectedProvider(): PricingAdapter["provider"] | undefined {
  const equalsArgument = process.argv.find((argument) => argument.startsWith("--provider="));
  const flagIndex = process.argv.indexOf("--provider");
  const value =
    equalsArgument?.slice("--provider=".length) ??
    (flagIndex === -1 ? undefined : process.argv[flagIndex + 1]);
  if (value === undefined) return undefined;
  if (value !== "aws" && value !== "azure" && value !== "gcp")
    throw new Error("--provider must be aws, azure, or gcp.");
  return value;
}

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://cloud_arena:cloud_arena_local_only@localhost:5432/cloud_arena";

const adapters: PricingAdapter[] = [
  new AwsPriceListAdapter(),
  new AzureRetailPricesAdapter(),
  new GcpCatalogAdapter(),
];
const requestedProvider = selectedProvider();
const selectedAdapters =
  requestedProvider === undefined
    ? adapters
    : adapters.filter(({ provider }) => provider === requestedProvider);
const database = createDatabase(databaseUrl);
const repository = new PostgresPricingSnapshotRepository(database.db);

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  return cause instanceof Error ? `${error.message}; cause: ${cause.message}` : error.message;
}

try {
  const outcomes = await Promise.allSettled(
    selectedAdapters.map((adapter) =>
      synchronizePricing(repository, adapter, {
        regions: [...regions[adapter.provider]],
        categories: [...PRICING_CATEGORIES],
        deadlineAt: new Date(Date.now() + 30 * 60 * 1_000),
      }),
    ),
  );
  let failed = false;
  outcomes.forEach((outcome, index) => {
    const provider = selectedAdapters[index]?.provider ?? "unknown";
    if (outcome.status === "fulfilled") {
      const value = outcome.value;
      console.log(
        `${provider}: ${value.status}; snapshot=${value.snapshotId}; records=${value.recordCount}; gaps=${value.gapCount}`,
      );
    } else {
      failed = true;
      const error = outcome.reason;
      const category = error instanceof PricingSyncError ? error.category : "unknown";
      const message = errorMessage(error);
      console.error(`${provider}: failed (${category}) — ${message}`);
    }
  });
  if (failed) process.exitCode = 1;
} finally {
  await database.close();
}
