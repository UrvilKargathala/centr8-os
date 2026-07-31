CREATE TYPE "public"."hr_case_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."training_content_type" AS ENUM('link', 'video', 'document', 'external');--> statement-breakpoint
CREATE TYPE "public"."training_enrollment_status" AS ENUM('enrolled', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."survey_question_type" AS ENUM('rating_1_5', 'text', 'multiple_choice');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('draft', 'active', 'closed');--> statement-breakpoint

CREATE TABLE "hr_case_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_assignee_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "hr_case_categories" ADD CONSTRAINT "hr_case_categories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_case_categories" ADD CONSTRAINT "hr_case_categories_default_assignee_id_employees_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_case_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hr_case_categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "hr_case_categories_isolation" ON "hr_case_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

ALTER TABLE "hr_cases" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "hr_cases" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "hr_cases" ADD COLUMN "priority" "hr_case_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_cases" ADD COLUMN "is_confidential" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_cases" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hr_cases" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "hr_cases" SET "subject" = "category" WHERE "subject" IS NULL;--> statement-breakpoint
ALTER TABLE "hr_cases" ALTER COLUMN "subject" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_cases" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_cases" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "hr_cases" ADD CONSTRAINT "hr_cases_category_id_hr_case_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hr_case_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "hr_case_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"is_internal_note" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "hr_case_comments" ADD CONSTRAINT "hr_case_comments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_case_comments" ADD CONSTRAINT "hr_case_comments_case_id_hr_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."hr_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_case_comments" ADD CONSTRAINT "hr_case_comments_author_id_employees_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_case_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hr_case_comments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "hr_case_comments_isolation" ON "hr_case_comments" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

ALTER TABLE "training_courses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "content_type" "training_content_type" DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "content_url" text;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "required_for_roles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "training_courses" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "training_courses" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "training_courses" DROP COLUMN "required_for_role";--> statement-breakpoint

DROP TABLE "training_completions";--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"status" "training_enrollment_status" DEFAULT 'enrolled' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "training_enrollments_course_employee_unique" UNIQUE("course_id","employee_id")
);--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_course_id_training_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "training_enrollments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "training_enrollments_isolation" ON "training_enrollments" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

ALTER TABLE "engagement_surveys" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD COLUMN "is_anonymous" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD COLUMN "status" "survey_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD COLUMN "created_by" uuid;--> statement-breakpoint

ALTER TABLE "survey_responses" ADD COLUMN "submitted_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "survey_responses" DROP COLUMN "anonymous";--> statement-breakpoint

CREATE TABLE "survey_respondents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_respondents_survey_employee_unique" UNIQUE("survey_id","employee_id")
);--> statement-breakpoint
ALTER TABLE "survey_respondents" ADD CONSTRAINT "survey_respondents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_respondents" ADD CONSTRAINT "survey_respondents_survey_id_engagement_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."engagement_surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_respondents" ADD CONSTRAINT "survey_respondents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_respondents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_respondents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "survey_respondents_isolation" ON "survey_respondents" AS PERMISSIVE FOR ALL TO "authenticated" USING (org_id in (select * from auth.user_org_ids())) WITH CHECK (org_id in (select * from auth.user_org_ids()));--> statement-breakpoint

ALTER TABLE "hr_cases" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "training_courses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "engagement_surveys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_responses" FORCE ROW LEVEL SECURITY;
