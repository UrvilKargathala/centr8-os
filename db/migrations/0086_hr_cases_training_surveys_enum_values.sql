ALTER TYPE "public"."hr_case_status" ADD VALUE 'waiting_on_employee';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'hr_case';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'training';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'engagement';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'manage';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'enroll_own';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'view_all_progress';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'respond';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'view_results';
