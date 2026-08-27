ALTER TABLE "pricing_records" DROP CONSTRAINT "pricing_records_raw_payload_id_pricing_raw_payloads_id_fk";
--> statement-breakpoint
ALTER TABLE "pricing_records" ALTER COLUMN "raw_payload_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_records" ADD CONSTRAINT "pricing_records_raw_payload_id_pricing_raw_payloads_id_fk" FOREIGN KEY ("raw_payload_id") REFERENCES "public"."pricing_raw_payloads"("id") ON DELETE set null ON UPDATE no action;