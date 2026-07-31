ALTER TABLE "deals" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "value" TYPE numeric(15,2);--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "currency" SET DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "probability" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "recurring_revenue" numeric(15,2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "recurring_frequency" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "actual_close_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "converted_from_lead_id" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "won_notes" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_step" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "next_step_due_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage" "deal_stage",
	"to_stage" "deal_stage" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" uuid,
	"duration_in_previous_stage_minutes" integer
);--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal_stage_history" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "deal_stage_history_isolation" ON "deal_stage_history" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

ALTER TABLE "deals" FORCE ROW LEVEL SECURITY;
