CREATE TYPE "public"."forecast_period_type" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint

ALTER TABLE "campaigns" ALTER COLUMN "type" SET DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "budget_allocated" numeric(12,2);--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "budget_spent" numeric(12,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "target_audience" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP TABLE "forecasts";--> statement-breakpoint
CREATE TABLE "forecast_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"period" text NOT NULL,
	"period_type" "forecast_period_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target_value" numeric(15,2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"owner_id" uuid,
	"department" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "forecast_targets_org_period_owner_unique" UNIQUE("org_id","period","owner_id")
);--> statement-breakpoint
ALTER TABLE "forecast_targets" ADD CONSTRAINT "forecast_targets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forecast_targets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "forecast_targets_isolation" ON "forecast_targets" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));
