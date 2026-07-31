-- HR Batch 2 Part 3 — Payroll & Compensation. New enum values only,
-- separate migration from their usage (same reason as every prior
-- enum-value + usage pair in this file).
ALTER TYPE "public"."resource_type" ADD VALUE 'payroll';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'generate';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'finalize';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'mark_paid';
