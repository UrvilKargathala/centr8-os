-- PM Time Tracking: task-level time logging (timesheets).
-- Hand-written (not drizzle-kit-generated) — same reason as 0102+.

-- 1. Extend enums
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'time';
ALTER TYPE "public"."permission_action" ADD VALUE IF NOT EXISTS 'log_own';

-- 2. Create time_entries table
CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "hours" numeric(5,2) NOT NULL,
  "description" text,
  "is_billable" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  CONSTRAINT "time_entries_hours_check" CHECK (hours > 0 AND hours <= 24)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "idx_time_entries_org" ON "time_entries" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_time_entries_person_date" ON "time_entries" ("person_id", "date");
CREATE INDEX IF NOT EXISTS "idx_time_entries_task" ON "time_entries" ("task_id") WHERE "task_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_time_entries_project" ON "time_entries" ("project_id");

-- 4. RLS
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON "time_entries" FOR SELECT TO "authenticated"
  USING ("org_id" IN (SELECT "org_id" FROM "org_memberships" WHERE "user_id" = auth.uid()));

CREATE POLICY "time_entries_insert" ON "time_entries" FOR INSERT TO "authenticated"
  WITH CHECK ("org_id" IN (SELECT "org_id" FROM "org_memberships" WHERE "user_id" = auth.uid()));

CREATE POLICY "time_entries_update" ON "time_entries" FOR UPDATE TO "authenticated"
  USING ("org_id" IN (SELECT "org_id" FROM "org_memberships" WHERE "user_id" = auth.uid()))
  WITH CHECK ("org_id" IN (SELECT "org_id" FROM "org_memberships" WHERE "user_id" = auth.uid()));

CREATE POLICY "time_entries_delete" ON "time_entries" FOR DELETE TO "authenticated"
  USING ("org_id" IN (SELECT "org_id" FROM "org_memberships" WHERE "user_id" = auth.uid()));

-- 5. Seed default permissions for "time" resource type.
-- log_own + view_own: every role (self-service, like attendance).
-- read (all entries in org): owner/admin/member.
-- create/update/delete (manage others' entries): owner/admin only.
INSERT INTO "permissions" ("role", "resource_type", "action") VALUES
  ('owner',  'time', 'log_own'),
  ('admin',  'time', 'log_own'),
  ('member', 'time', 'log_own'),
  ('viewer', 'time', 'log_own'),
  ('owner',  'time', 'view_own'),
  ('admin',  'time', 'view_own'),
  ('member', 'time', 'view_own'),
  ('viewer', 'time', 'view_own'),
  ('owner',  'time', 'read'),
  ('admin',  'time', 'read'),
  ('member', 'time', 'read'),
  ('owner',  'time', 'create'),
  ('admin',  'time', 'create'),
  ('owner',  'time', 'update'),
  ('admin',  'time', 'update'),
  ('owner',  'time', 'delete'),
  ('admin',  'time', 'delete')
ON CONFLICT DO NOTHING;
