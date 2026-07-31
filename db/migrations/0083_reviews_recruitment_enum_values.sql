-- HR Batch 3 — Performance Reviews & OKRs (hybrid self+manager model) and
-- Recruitment/Hiring (Kanban pipeline + interview scheduling). New enum
-- values only, separate migration from their usage (same reason as every
-- prior enum-value + usage pair in this file).
ALTER TYPE "public"."resource_type" ADD VALUE 'review';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'okr';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'submit_self';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'submit_manager';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'view_team';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'create_own';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'create_team';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'create_job';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'manage_candidates';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'schedule_interview';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'submit_feedback';--> statement-breakpoint
ALTER TYPE "public"."performance_review_status" ADD VALUE 'not_started';--> statement-breakpoint
ALTER TYPE "public"."performance_review_status" ADD VALUE 'self_assessment_pending';--> statement-breakpoint
ALTER TYPE "public"."performance_review_status" ADD VALUE 'manager_assessment_pending';--> statement-breakpoint
ALTER TYPE "public"."job_posting_status" ADD VALUE 'on_hold';--> statement-breakpoint
ALTER TYPE "public"."job_posting_status" ADD VALUE 'filled';--> statement-breakpoint
ALTER TYPE "public"."candidate_stage" ADD VALUE 'screening';
