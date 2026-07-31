-- HR Batch 2 — restructure attendance_records for self-service check-in/
-- check-out (replaces the Prompt 5.2 admin-only shape). Safe to
-- drop-and-add rather than rename in place: migration 0072 already
-- deleted the only 2 rows that existed, so there's no data to carry
-- across the column shape change.
ALTER TABLE "attendance_records" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "attendance_records" DROP COLUMN "check_in";--> statement-breakpoint
ALTER TABLE "attendance_records" DROP COLUMN "check_out";--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "work_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "check_in_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "check_out_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "total_minutes" integer;--> statement-breakpoint
ALTER TABLE "attendance_records" ALTER COLUMN "status" SET DEFAULT 'checked_in';--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "check_in_note" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "check_out_note" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "location_detail" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "device_info" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "is_manual_entry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "manual_entry_reason" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "edited_by" uuid;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_org_employee_date_unique" UNIQUE("org_id","employee_id","work_date");--> statement-breakpoint
CREATE TABLE "attendance_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"workday_start_time" time DEFAULT '09:00' NOT NULL,
	"workday_end_time" time DEFAULT '18:00' NOT NULL,
	"workday_hours_target" numeric(4, 2) DEFAULT 8.0 NOT NULL,
	"min_hours_for_full_day" numeric(4, 2) DEFAULT 7.0 NOT NULL,
	"min_hours_for_half_day" numeric(4, 2) DEFAULT 4.0 NOT NULL,
	"weekend_days" jsonb DEFAULT '["saturday","sunday"]'::jsonb NOT NULL,
	"require_location" boolean DEFAULT false NOT NULL,
	"require_note_on_late_checkin" boolean DEFAULT false NOT NULL,
	"late_checkin_threshold_minutes" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);--> statement-breakpoint
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attendance_settings_isolation" ON "attendance_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint
insert into attendance_settings (org_id) select id from organizations on conflict (org_id) do nothing;
