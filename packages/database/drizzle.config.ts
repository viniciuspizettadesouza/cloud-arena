import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const directory = fileURLToPath(new URL(".", import.meta.url));

config({ path: resolve(directory, "../../.env"), quiet: true });

export default defineConfig({
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://cloud_arena:cloud_arena_local_only@localhost:5432/cloud_arena",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
