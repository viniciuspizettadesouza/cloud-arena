CREATE TABLE "pricing_raw_payloads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"source" text NOT NULL,
	"page_number" integer NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"raw_payload_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"service_category" varchar(64) NOT NULL,
	"service_name" text NOT NULL,
	"sku_id" text NOT NULL,
	"sku_name" text,
	"region" varchar(64) NOT NULL,
	"pricing_model" varchar(32) NOT NULL,
	"unit" varchar(64) NOT NULL,
	"unit_price" numeric(30, 12) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"effective_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"source_price_id" text NOT NULL,
	"source_unit" varchar(64) NOT NULL,
	"source_unit_price" numeric(30, 12) NOT NULL,
	"unit_conversion_factor" numeric(30, 12) NOT NULL,
	"tier_start" numeric(30, 12) NOT NULL,
	"tier_end" numeric(30, 12),
	"catalog_published_at" timestamp with time zone,
	"source_attributes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"adapter_version" varchar(128) NOT NULL,
	"requested_regions" jsonb NOT NULL,
	"requested_categories" jsonb NOT NULL,
	"request_parameters" jsonb,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"retrieved_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_category" varchar(32),
	"error_message" text,
	"error_details" jsonb,
	"raw_record_count" integer DEFAULT 0 NOT NULL,
	"normalized_record_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_sync_locks" (
	"provider" varchar(16) PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_raw_payloads" ADD CONSTRAINT "pricing_raw_payloads_snapshot_id_pricing_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pricing_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_records" ADD CONSTRAINT "pricing_records_snapshot_id_pricing_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."pricing_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_records" ADD CONSTRAINT "pricing_records_raw_payload_id_pricing_raw_payloads_id_fk" FOREIGN KEY ("raw_payload_id") REFERENCES "public"."pricing_raw_payloads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_raw_payload_snapshot_page_idx" ON "pricing_raw_payloads" USING btree ("snapshot_id","page_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_records_source_identity_idx" ON "pricing_records" USING btree ("snapshot_id","source_price_id","effective_at","region");--> statement-breakpoint
CREATE INDEX "pricing_records_lookup_idx" ON "pricing_records" USING btree ("snapshot_id","region","service_category","sku_id");--> statement-breakpoint
CREATE INDEX "pricing_snapshots_provider_status_idx" ON "pricing_snapshots" USING btree ("provider","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_snapshots_one_active_provider_idx" ON "pricing_snapshots" USING btree ("provider") WHERE "pricing_snapshots"."is_active" = true;