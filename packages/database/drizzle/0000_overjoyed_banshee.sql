CREATE TABLE "system_metadata" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
