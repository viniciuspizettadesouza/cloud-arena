import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const systemMetadata = pgTable("system_metadata", {
  key: varchar("key", { length: 128 }).primaryKey(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  value: text("value").notNull(),
});

export const pricingSnapshots = pgTable(
  "pricing_snapshots",
  {
    id: uuid("id").primaryKey(),
    provider: varchar("provider", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    adapterVersion: varchar("adapter_version", { length: 128 }).notNull(),
    requestedRegions: jsonb("requested_regions").$type<string[]>().notNull(),
    requestedCategories: jsonb("requested_categories").$type<string[]>().notNull(),
    requestParameters: jsonb("request_parameters").$type<Record<string, unknown>>(),
    gaps: jsonb("gaps").$type<unknown[]>().notNull().default([]),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull(),
    retrievedAt: timestamp("retrieved_at", { mode: "date", withTimezone: true }),
    activatedAt: timestamp("activated_at", { mode: "date", withTimezone: true }),
    failedAt: timestamp("failed_at", { mode: "date", withTimezone: true }),
    errorCategory: varchar("error_category", { length: 32 }),
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details").$type<Record<string, unknown>>(),
    rawRecordCount: integer("raw_record_count").notNull().default(0),
    normalizedRecordCount: integer("normalized_record_count").notNull().default(0),
  },
  (table) => [
    index("pricing_snapshots_provider_status_idx").on(table.provider, table.status),
    uniqueIndex("pricing_snapshots_one_active_provider_idx")
      .on(table.provider)
      .where(sql`${table.isActive} = true`),
  ],
);

export const pricingSyncLocks = pgTable("pricing_sync_locks", {
  provider: varchar("provider", { length: 16 }).primaryKey(),
  snapshotId: uuid("snapshot_id").notNull(),
  acquiredAt: timestamp("acquired_at", { mode: "date", withTimezone: true }).notNull(),
});

export const pricingRawPayloads = pgTable(
  "pricing_raw_payloads",
  {
    id: uuid("id").primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pricingSnapshots.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    pageNumber: integer("page_number").notNull(),
    checksum: varchar("checksum", { length: 128 }).notNull(),
    retrievedAt: timestamp("retrieved_at", { mode: "date", withTimezone: true }).notNull(),
    payload: jsonb("payload").notNull(),
  },
  (table) => [
    uniqueIndex("pricing_raw_payload_snapshot_page_idx").on(table.snapshotId, table.pageNumber),
  ],
);

export const pricingRecords = pgTable(
  "pricing_records",
  {
    id: uuid("id").primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pricingSnapshots.id, { onDelete: "cascade" }),
    rawPayloadId: uuid("raw_payload_id").references(() => pricingRawPayloads.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 16 }).notNull(),
    serviceCategory: varchar("service_category", { length: 64 }).notNull(),
    serviceName: text("service_name").notNull(),
    skuId: text("sku_id").notNull(),
    skuName: text("sku_name"),
    region: varchar("region", { length: 64 }).notNull(),
    pricingModel: varchar("pricing_model", { length: 32 }).notNull(),
    unit: varchar("unit", { length: 64 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 30, scale: 12 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    effectiveAt: timestamp("effective_at", { mode: "date", withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { mode: "date", withTimezone: true }).notNull(),
    source: text("source").notNull(),
    sourcePriceId: text("source_price_id").notNull(),
    sourceUnit: varchar("source_unit", { length: 64 }).notNull(),
    sourceUnitPrice: numeric("source_unit_price", { precision: 30, scale: 12 }).notNull(),
    unitConversionFactor: numeric("unit_conversion_factor", { precision: 30, scale: 12 }).notNull(),
    tierStart: numeric("tier_start", { precision: 30, scale: 12 }).notNull(),
    tierEnd: numeric("tier_end", { precision: 30, scale: 12 }),
    catalogPublishedAt: timestamp("catalog_published_at", { mode: "date", withTimezone: true }),
    sourceAttributes: jsonb("source_attributes").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    uniqueIndex("pricing_records_source_identity_idx").on(
      table.snapshotId,
      table.sourcePriceId,
      table.effectiveAt,
      table.region,
    ),
    index("pricing_records_lookup_idx").on(
      table.snapshotId,
      table.region,
      table.serviceCategory,
      table.skuId,
    ),
  ],
);
