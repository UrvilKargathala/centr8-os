-- HR Batch 2 — restructure Leave Management for self-service (replaces
-- Prompt 5.2's admin-only shape, confirmed by Urvil, same discipline as
-- Attendance's 0074 restructure). leave_policies used to double as "the
-- type" (name + days/year); now leave_types is the category employees
-- pick from and leave_policies is the allotment rule attached to it.
--
-- The one real row that existed (leave_policies 'PTO', 10 days/year, org
-- 00000000-0000-0000-0000-000000000001) is migrated into a leave_type +
-- restructured policy below rather than discarded — leave_requests had 0
-- rows, so that table is safe to drop-and-add like attendance_records was.

CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#2E62F0' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"max_consecutive_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leave_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "leave_types_isolation" ON "leave_types" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"allotted_days" numeric(5, 2) NOT NULL,
	"carried_forward_days" numeric(5, 2) DEFAULT 0 NOT NULL,
	"used_days" numeric(5, 2) DEFAULT 0 NOT NULL,
	"pending_days" numeric(5, 2) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leave_balances_org_employee_type_year_unique" ON "leave_balances" USING btree ("org_id","employee_id","leave_type_id","year");--> statement-breakpoint
ALTER TABLE "leave_balances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leave_balances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "leave_balances_isolation" ON "leave_balances" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

-- Migrate the existing 'PTO' policy into a leave_type (fixed id so the
-- restructured leave_policies row below can reference it in this same migration).
INSERT INTO "leave_types" ("id", "org_id", "name", "color", "requires_approval", "is_paid", "is_active")
VALUES ('ed24c05b-e54c-449c-beac-6b042c8c87ec', '00000000-0000-0000-0000-000000000001', 'PTO', '#2E62F0', true, true, true);--> statement-breakpoint

ALTER TABLE "leave_policies" ADD COLUMN "leave_type_id" uuid;--> statement-breakpoint
UPDATE "leave_policies" SET "leave_type_id" = 'ed24c05b-e54c-449c-beac-6b042c8c87ec' WHERE "id" = 'c7591515-b434-429f-9c48-7ad0d4e4db91';--> statement-breakpoint
ALTER TABLE "leave_policies" ALTER COLUMN "leave_type_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "applies_to" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "annual_allotment_days" numeric(5, 2);--> statement-breakpoint
UPDATE "leave_policies" SET "annual_allotment_days" = "days_per_year";--> statement-breakpoint
ALTER TABLE "leave_policies" ALTER COLUMN "annual_allotment_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "accrual_method" text DEFAULT 'annual_lump_sum' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "carry_forward_max_days" numeric(5, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "effective_from" date;--> statement-breakpoint
UPDATE "leave_policies" SET "effective_from" = '2026-01-01';--> statement-breakpoint
ALTER TABLE "leave_policies" ALTER COLUMN "effective_from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" DROP COLUMN "days_per_year";--> statement-breakpoint
ALTER TABLE "leave_policies" DROP COLUMN "accrual_rule";--> statement-breakpoint

ALTER TABLE "leave_requests" DROP COLUMN "policy_id";--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "approved_by";--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "leave_type_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "total_days" numeric(5, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "is_half_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "half_day_period" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_end_after_start" CHECK ("leave_requests"."end_date" >= "leave_requests"."start_date");
