-- Audit fixes: FORCE RLS, org_id indexes, unique constraints
-- Hand-written (same reason as 0102/0103/0105 — drizzle snapshot chain is stale)

-- ============================================================
-- 1. FORCE ROW LEVEL SECURITY on 10 tables that only had ENABLE
-- ============================================================
ALTER TABLE "task_comments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "attendance_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payslip_records" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_stage_history" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "forecast_targets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "task_assignees" FORCE ROW LEVEL SECURITY;
ALTER TABLE "timesheet_submissions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "time_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "resource_forecast_entries" FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Unique constraint on integrations(org_id, provider)
-- ============================================================
-- Drop any duplicates first (keep the most recent by connected_at)
DELETE FROM "integrations" a
  USING "integrations" b
  WHERE a.org_id = b.org_id
    AND a.provider = b.provider
    AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS "integrations_org_provider_unique"
  ON "integrations" ("org_id", "provider");

-- ============================================================
-- 3. Partial unique index on forecast_targets for NULL owner_id
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "forecast_targets_org_period_null_owner"
  ON "forecast_targets" ("org_id", "period_type", "period_start")
  WHERE "owner_id" IS NULL;

-- ============================================================
-- 4. org_id indexes on high-traffic tables
-- ============================================================
CREATE INDEX IF NOT EXISTS "tasks_org_id_idx" ON "tasks" ("org_id");
CREATE INDEX IF NOT EXISTS "deals_org_id_idx" ON "deals" ("org_id");
CREATE INDEX IF NOT EXISTS "leads_org_id_idx" ON "leads" ("org_id");
CREATE INDEX IF NOT EXISTS "activities_org_id_idx" ON "activities" ("org_id");
CREATE INDEX IF NOT EXISTS "audit_log_org_id_idx" ON "audit_log" ("org_id");
CREATE INDEX IF NOT EXISTS "attendance_records_org_id_idx" ON "attendance_records" ("org_id");
CREATE INDEX IF NOT EXISTS "leave_requests_org_id_idx" ON "leave_requests" ("org_id");
CREATE INDEX IF NOT EXISTS "employees_org_id_idx" ON "employees" ("org_id");
CREATE INDEX IF NOT EXISTS "projects_org_id_idx" ON "projects" ("org_id");
CREATE INDEX IF NOT EXISTS "sprints_org_id_idx" ON "sprints" ("org_id");
CREATE INDEX IF NOT EXISTS "contacts_org_id_idx" ON "contacts" ("org_id");
CREATE INDEX IF NOT EXISTS "accounts_org_id_idx" ON "accounts" ("org_id");
CREATE INDEX IF NOT EXISTS "campaigns_org_id_idx" ON "campaigns" ("org_id");
CREATE INDEX IF NOT EXISTS "people_org_id_idx" ON "people" ("org_id");
CREATE INDEX IF NOT EXISTS "hr_cases_org_id_idx" ON "hr_cases" ("org_id");

-- 5. FK indexes on columns used in JOINs
CREATE INDEX IF NOT EXISTS "tasks_assignee_id_idx" ON "tasks" ("assignee_id");
CREATE INDEX IF NOT EXISTS "tasks_sprint_id_idx" ON "tasks" ("sprint_id");
CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "deals_account_id_idx" ON "deals" ("account_id");
CREATE INDEX IF NOT EXISTS "contacts_account_id_idx" ON "contacts" ("account_id");
CREATE INDEX IF NOT EXISTS "activities_related_id_idx" ON "activities" ("related_id");
