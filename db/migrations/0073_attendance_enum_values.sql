-- HR Batch 2 — Attendance self-service. New enum values only (separate
-- migration from their usage, same reason as every prior enum-value +
-- usage pair in this file: Postgres won't let a new value be used in the
-- same transaction that adds it).
ALTER TYPE "public"."attendance_status" ADD VALUE 'checked_in';--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE 'checked_out';--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE 'on_leave';--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE 'holiday';--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE 'weekend';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'record_own';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'view_own';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'view_all';--> statement-breakpoint
ALTER TYPE "public"."permission_action" ADD VALUE 'edit_any';
