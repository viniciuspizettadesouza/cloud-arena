import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { PostgresActivePricingSnapshotReader, createDatabase } from "@cloud-arena/database";

import { buildApp } from "./app.js";

try {
  loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://cloud_arena:cloud_arena_local_only@localhost:5432/cloud_arena";
const database = createDatabase(databaseUrl);
const app = buildApp(
  { logger: true },
  { snapshotReader: new PostgresActivePricingSnapshotReader(database.db) },
);
app.addHook("onClose", async () => database.close());
const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? "3001");

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
