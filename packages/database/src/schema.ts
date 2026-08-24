import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const systemMetadata = pgTable("system_metadata", {
  key: varchar("key", { length: 128 }).primaryKey(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  value: text("value").notNull(),
});
