import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import postgres from "postgres";

const directory = fileURLToPath(new URL(".", import.meta.url));

config({ path: resolve(directory, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Copy .env.example to .env before checking PostgreSQL.",
  );
}

const client = postgres(databaseUrl, { max: 1 });

try {
  const result = await client<{ value: number }[]>`select 1::int as value`;

  if (result[0]?.value !== 1) {
    throw new Error("PostgreSQL connectivity check returned an unexpected result.");
  }

  console.log("PostgreSQL connectivity check passed.");
} finally {
  await client.end();
}
