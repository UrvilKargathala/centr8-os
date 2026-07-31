CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'intern', 'consultant');--> statement-breakpoint
ALTER TYPE "public"."employment_status" ADD VALUE 'on_leave';--> statement-breakpoint
ALTER TYPE "public"."employment_status" ADD VALUE 'notice_period';--> statement-breakpoint
ALTER TABLE "compensation_records" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employee_code" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "personal_email" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "country" text DEFAULT 'India';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employment_type" "employment_type" DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "available_hours_per_week" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "roles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "cost_rate_hourly" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "currency" text DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "onboarding_workflows" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "onboarding_workflows" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_org_code_unique" ON "employees" USING btree ("org_id","employee_code");