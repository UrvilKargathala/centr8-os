-- HR Batch 2 Part 3 — extends compensation_records in place (Batch 1's
-- table, not a new "compensation_history" table — see the migration
-- comment in db/schema.ts) and adds payslip_records for record-keeping
-- payslip generation. Zero self-service — this pillar stays HR-admin-only,
-- deliberately, unlike Attendance/Leave.

ALTER TABLE "compensation_records" ADD COLUMN "pay_frequency" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD COLUMN "deductions" jsonb;--> statement-breakpoint
ALTER TABLE "compensation_records" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TYPE "public"."payslip_status" AS ENUM('draft', 'finalized', 'paid');--> statement-breakpoint
CREATE TABLE "payslip_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"compensation_record_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_amount" numeric(12, 2) NOT NULL,
	"total_deductions" numeric(12, 2) DEFAULT 0 NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "payslip_status" DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid,
	"paid_at" timestamp with time zone,
	"notes" text
);--> statement-breakpoint
ALTER TABLE "payslip_records" ADD CONSTRAINT "payslip_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_records" ADD CONSTRAINT "payslip_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_records" ADD CONSTRAINT "payslip_records_compensation_record_id_compensation_records_id_fk" FOREIGN KEY ("compensation_record_id") REFERENCES "public"."compensation_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_records_org_employee_period_unique" ON "payslip_records" USING btree ("org_id","employee_id","period_start","period_end");--> statement-breakpoint
ALTER TABLE "payslip_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payslip_records" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payslip_records_isolation" ON "payslip_records" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));
