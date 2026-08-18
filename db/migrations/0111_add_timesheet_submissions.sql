-- Timesheet submission / approval workflow.
-- Tracks per-person weekly submission status: draft → submitted → approved → rejected.

ALTER TYPE "public"."permission_action" ADD VALUE IF NOT EXISTS 'submit';

CREATE TABLE IF NOT EXISTS "timesheet_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "week_start" date NOT NULL,
  "status" text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  "submitted_at" timestamptz,
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "rejection_reason" text,
  "total_hours" numeric(5,2),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "timesheet_submissions_unique_week" UNIQUE ("org_id", "person_id", "week_start")
);

CREATE INDEX IF NOT EXISTS "idx_ts_sub_org" ON "timesheet_submissions" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_ts_sub_person_week" ON "timesheet_submissions" ("person_id", "week_start");

ALTER TABLE "timesheet_submissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_sub_select" ON "timesheet_submissions" FOR SELECT TO "authenticated"
  USING (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));
CREATE POLICY "ts_sub_insert" ON "timesheet_submissions" FOR INSERT TO "authenticated"
  WITH CHECK (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));
CREATE POLICY "ts_sub_update" ON "timesheet_submissions" FOR UPDATE TO "authenticated"
  USING (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));

-- Permissions: submit (own timesheet) for everyone, approve for owner/admin only.
INSERT INTO "permissions" ("role", "resource_type", "action") VALUES
  ('owner',  'time', 'submit'),
  ('admin',  'time', 'submit'),
  ('member', 'time', 'submit'),
  ('viewer', 'time', 'submit'),
  ('owner',  'time', 'approve'),
  ('admin',  'time', 'approve')
ON CONFLICT DO NOTHING;
