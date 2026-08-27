import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { createDatabase } from "../src/client.js";
import { PostgresPricingSnapshotRepository } from "../src/pricing-repository.js";

const directory = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(directory, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to enforce pricing retention.");

const { db, close } = createDatabase(databaseUrl);
try {
  const result = await new PostgresPricingSnapshotRepository(db).enforceRetention();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await close();
}
