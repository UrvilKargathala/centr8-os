ALTER TYPE "public"."campaign_status" ADD VALUE 'draft' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE 'paused' AFTER 'active';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'set_target';
