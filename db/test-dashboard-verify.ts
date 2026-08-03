// Acceptance check for the global cross-pillar dashboard (/dashboard,
// CLAUDE.md). Same fixture/cleanup pattern as db/test-ai-assistant-verify.ts.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { auditLog, activities as crmActivities } from "./schema";
import { loadDashboard } from "../lib/api/dashboard";

const ORG_A = "00000000-0000-0000-0000-0000000000d1";
const ORG_B = "00000000-0000-0000-0000-0000000000d2";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000d3";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000d4";
const PROJECT_ID = "00000000-0000-0000-0000-0000000000d5";
const LEAD_ID = "00000000-0000-0000-0000-0000000000d6";
const OTHER_ORG_LEAD_ID = "00000000-0000-0000-0000-0000000000d7";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values
         ($1, 'Dashboard Verify Org A', 'dashboard-verify-a'),
         ($2, 'Dashboard Verify Org B', 'dashboard-verify-b')
       on conflict (id) do nothing`,
      [ORG_A, ORG_B],
    );
    // ADMIN_USER: full admin in org A. VIEWER_USER: a *custom* role name
    // with no seeded grants at all — every built-in role (owner/admin/
    // member/viewer) gets lead:read (CRM Batch 1 seeded viewer read-only,
    // not zero access), so a genuinely CRM-denied user has to be a custom
    // role, same as an org would create for e.g. "finance-only" access.
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'admin'), ($3, $2, 'no_access_role')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_A, VIEWER_USER],
    );
    await client.query(`insert into projects (id, org_id, name, status) values ($1, $2, 'Dashboard Verify Project', 'active') on conflict (id) do nothing`, [
      PROJECT_ID,
      ORG_A,
    ]);
    await client.query(`insert into leads (id, org_id, name, company, status) values ($1, $2, 'Dashboard Verify Lead', 'VerifyCo', 'new') on conflict (id) do nothing`, [
      LEAD_ID,
      ORG_A,
    ]);
    await client.query(`insert into leads (id, org_id, name, company, status) values ($1, $2, 'Other Org Lead', 'OtherCo', 'new') on conflict (id) do nothing`, [
      OTHER_ORG_LEAD_ID,
      ORG_B,
    ]);
    await client.query(
      `insert into audit_log (org_id, actor_type, action, target_type, target_id) values ($1, 'human', 'project_created', 'project', $2)`,
      [ORG_A, PROJECT_ID],
    );
    await client.query(
      `insert into activities (org_id, related_type, related_id, type, subject) values ($1, 'lead', $2, 'note', 'Dashboard verify activity')`,
      [ORG_A, LEAD_ID],
    );
    await client.query("commit");

    // (a) Endpoint returns all expected sections with correct shapes, admin sees real data.
    const adminView = await withOrgContext(ADMIN_USER, (db) => loadDashboard(db, ADMIN_USER, ORG_A));
    for (const key of ["projects", "tasks", "sprints", "employees", "attendance", "leave", "open_hr_cases", "leads", "deals", "accounts", "communication", "ai", "recent_activity"]) {
      assert(key in adminView, `dashboard response should include a "${key}" key`);
    }
    assert(adminView.projects !== null && adminView.projects.total >= 1, "admin (project:read) should see real project counts, not null");
    assert(adminView.leads !== null && adminView.leads.total >= 1, "admin (lead:read) should see real lead counts, not null");
    assert(Array.isArray(adminView.recent_activity), "recent_activity should be an array");
    assert(typeof adminView.communication.unread_messages === "number", "communication section should always be present (mock data, ungated)");
    console.log("PASS: dashboard endpoint returns all expected sections with correct shapes");

    // (b) A user without CRM permissions gets the CRM sections as null, not a 403 on the whole endpoint.
    const viewerView = await withOrgContext(VIEWER_USER, (db) => loadDashboard(db, VIEWER_USER, ORG_A));
    assert(viewerView.leads === null, "viewer without lead:read should get leads=null, not an error or zeroed data");
    assert(viewerView.deals === null, "viewer without deal:read should get deals=null");
    assert(viewerView.accounts === null, "viewer without account:read should get accounts=null");
    assert(viewerView.communication !== null, "communication section (ungated mock data) should still be present for a low-privilege user");
    console.log("PASS: a user without CRM permissions gets CRM sections as null, not a 403 on the whole endpoint");

    // (c) Activity feed is correctly org-scoped — org A's admin never sees org B's audit/activity rows.
    const activityTitles = adminView.recent_activity.map((a) => a.description + a.title);
    assert(!activityTitles.some((t) => t.includes("Other Org")), "org A's activity feed must not include org B's rows");
    const orgBCount = await withOrgContext(ADMIN_USER, (db) => db.select().from(crmActivities).where(eq(crmActivities.orgId, ORG_B)));
    assert(orgBCount.length === 0, "org A's admin querying under withOrgContext must not see org B's activities rows at all (RLS)");
    const auditOrgB = await withOrgContext(ADMIN_USER, (db) => db.select().from(auditLog).where(eq(auditLog.orgId, ORG_B)));
    assert(auditOrgB.length === 0, "org A's admin must not see org B's audit_log rows (RLS)");
    console.log("PASS: activity feed is correctly org-scoped");

    console.log("\nALL DASHBOARD CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id in ($1, $2)", [ORG_A, ORG_B]);
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
