-- HR Batch 3 — restructures performance_reviews/okrs (hybrid self+manager
-- review model) and job_postings/candidates (Kanban pipeline), adds
-- review_cycles and interview_schedules. All four existing tables had 0
-- rows, so columns are extended/relaxed in place rather than needing data
-- migration (same as every prior HR Batch restructure in this file).

CREATE TYPE "public"."review_cycle_status" AS ENUM('draft', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."final_rating" AS ENUM('exceeds', 'meets', 'needs_improvement', 'unsatisfactory');--> statement-breakpoint
CREATE TYPE "public"."okr_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('video', 'phone', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."interview_recommendation" AS ENUM('strong_yes', 'yes', 'no', 'strong_no');--> statement-breakpoint

CREATE TABLE "review_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cycle_type" text DEFAULT 'quarterly' NOT NULL,
	"self_assessment_open_date" date,
	"self_assessment_due_date" date,
	"manager_assessment_due_date" date,
	"status" "review_cycle_status" DEFAULT 'draft' NOT NULL,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);--> statement-breakpoint
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "review_cycles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "review_cycles_isolation" ON "review_cycles" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

ALTER TABLE "performance_reviews" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "self_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "manager_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "final_rating" "final_rating";--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "self_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "manager_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ALTER COLUMN "period" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ALTER COLUMN "ratings" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ALTER COLUMN "status" SET DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ALTER COLUMN "cycle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_employee_unique" UNIQUE("cycle_id","employee_id");--> statement-breakpoint

ALTER TABLE "okrs" ADD COLUMN "team_name" text;--> statement-breakpoint
ALTER TABLE "okrs" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "okrs" ADD CONSTRAINT "okrs_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "okrs" ADD COLUMN "status" "okr_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "okrs" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "okrs" ADD COLUMN "created_by" uuid;--> statement-breakpoint

ALTER TABLE "job_postings" ADD COLUMN "employment_type" text DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "requirements" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "salary_range_min" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "salary_range_max" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "hiring_manager_id" uuid;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_hiring_manager_id_employees_id_fk" FOREIGN KEY ("hiring_manager_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "created_by" uuid;--> statement-breakpoint

ALTER TABLE "candidates" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_url" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "applied_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

CREATE TABLE "interview_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"interviewer_id" uuid,
	"scheduled_at" timestamp with time zone,
	"interview_type" "interview_type" DEFAULT 'video' NOT NULL,
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"feedback" text,
	"recommendation" "interview_recommendation",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_schedules" ADD CONSTRAINT "interview_schedules_interviewer_id_employees_id_fk" FOREIGN KEY ("interviewer_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interview_schedules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "interview_schedules_isolation" ON "interview_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));
