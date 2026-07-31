-- HR Batch 2 — Leave Management self-service. New enum values only,
-- separate migration from their usage (same reason as every prior
-- enum-value + usage pair in this file).
ALTER TYPE "public"."leave_request_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'request_own';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'manage_balances';
