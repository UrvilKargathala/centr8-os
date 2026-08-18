-- Resource Forecasting — forward-looking resource allocation planning.
-- Tracks planned hours per person per project per week.

ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'resource_forecast';

CREATE TABLE IF NOT EXISTS "resource_forecast_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "week_start" date NOT NULL,
  "planned_hours" numeric(5,2) NOT NULL DEFAULT 0,
  "is_billable" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  CONSTRAINT "rfe_unique_allocation" UNIQUE ("org_id", "project_id", "person_id", "week_start")
);

CREATE INDEX IF NOT EXISTS "idx_rfe_org" ON "resource_forecast_entries" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_rfe_project" ON "resource_forecast_entries" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_rfe_person_week" ON "resource_forecast_entries" ("person_id", "week_start");

ALTER TABLE "resource_forecast_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfe_select" ON "resource_forecast_entries" FOR SELECT TO "authenticated"
  USING (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));
CREATE POLICY "rfe_insert" ON "resource_forecast_entries" FOR INSERT TO "authenticated"
  WITH CHECK (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));
CREATE POLICY "rfe_update" ON "resource_forecast_entries" FOR UPDATE TO "authenticated"
  USING (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())))
  WITH CHECK (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));
CREATE POLICY "rfe_delete" ON "resource_forecast_entries" FOR DELETE TO "authenticated"
  USING (org_id IN (SELECT om.org_id FROM org_memberships om WHERE om.user_id = (SELECT auth.uid())));

-- Permissions:
-- resource_forecast:read — everyone (view forecasts)
-- resource_forecast:create/update/delete — owner/admin/member (PM-tier input)
-- resource_forecast:view_all — owner/admin (org-wide insights + AI)
INSERT INTO "permissions" ("role", "resource_type", "action") VALUES
  ('owner',  'resource_forecast', 'read'),
  ('admin',  'resource_forecast', 'read'),
  ('member', 'resource_forecast', 'read'),
  ('viewer', 'resource_forecast', 'read'),
  ('owner',  'resource_forecast', 'create'),
  ('admin',  'resource_forecast', 'create'),
  ('member', 'resource_forecast', 'create'),
  ('owner',  'resource_forecast', 'update'),
  ('admin',  'resource_forecast', 'update'),
  ('member', 'resource_forecast', 'update'),
  ('owner',  'resource_forecast', 'delete'),
  ('admin',  'resource_forecast', 'delete'),
  ('member', 'resource_forecast', 'delete'),
  ('owner',  'resource_forecast', 'view_all'),
  ('admin',  'resource_forecast', 'view_all')
ON CONFLICT DO NOTHING;
