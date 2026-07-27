-- Enum value added on its own so a later migration can seed permission
-- rows using it — same two-step pattern as 0052 (integration), 0043
-- (leads), etc.

ALTER TYPE "public"."resource_type" ADD VALUE 'task_comment';
