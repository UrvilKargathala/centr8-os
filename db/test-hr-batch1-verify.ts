// Acceptance check for HR Batch 1 (CLAUDE.md §11a): compensation:view_sensitive
// really 403s a role without the grant, and employee:view_full field
// trimming really strips sensitive fields for a role without it. Uses the
// same fixture/cleanup pattern as db/test-rbac.ts — the real
// requirePermission/hasPermission/trimEmployeeFields, not a reimplementation.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { employees } from "./schema";
import { hasPermission } from "../lib/api/permissions";
import { trimEmployeeFields, requireCompensationViewAccess } from "../lib/api/employees";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000d1";
const EMP_ID = "00000000-0000-0000-0000-0000000000d2";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000d3";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000d5";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function assertForbidden(promise: Promise<unknown>, message: string) {
  try {
    await promise;
    throw new Error(`FAIL: ${message} (expected a 403, nothing was thrown)`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 403) throw err;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'HR Batch1 Verify Org', 'hr-batch1-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'admin'),
         ($3, $2, 'viewer')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, VIEWER_USER],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, date_of_birth, cost_rate_hourly, notes)
       values ($1, $2, 'Verify Test Employee', 'verify@test.com', '1990-01-01', 55.00, 'confidential note')
       on conflict (id) do nothing`,
      [EMP_ID, ORG_ID],
    );
    await client.query("commit");

    // --- Check 1: GET .../compensation's server-side gate really 403s a
    // role without compensation:view_sensitive, not just UI-hidden ---
    await assertForbidden(
      withOrgContext(VIEWER_USER, (db) => requireCompensationViewAccess(db, VIEWER_USER, ORG_ID)),
      "viewer should be blocked from compensation:view_sensitive (this is the exact check GET /api/employees/[id]/compensation runs)",
    );
    console.log("PASS: viewer hitting the compensation route's auth check directly gets a 403");

    await withOrgContext(ADMIN_USER, (db) => requireCompensationViewAccess(db, ADMIN_USER, ORG_ID));
    console.log("PASS: admin passes the same check (role-based, not a blanket deny)");

    // --- Check 2: GET /api/employees field trimming is server-side, keyed
    // off employee:view_full, not client-side omission ---
    const viewerCanFull = await withOrgContext(VIEWER_USER, (db) =>
      hasPermission(db, VIEWER_USER, ORG_ID, "employee", "view_full"),
    );
    assert(viewerCanFull === false, "viewer should not have employee:view_full");

    const row = await withOrgContext(VIEWER_USER, async (db) => {
      const [existing] = await db.select().from(employees).where(eq(employees.id, EMP_ID));
      return existing!;
    });
    const trimmedForViewer = trimEmployeeFields(row, false);
    assert((trimmedForViewer as Record<string, unknown>).dateOfBirth === undefined, "dateOfBirth leaked to viewer");
    assert((trimmedForViewer as Record<string, unknown>).costRateHourly === undefined, "costRateHourly leaked to viewer");
    assert((trimmedForViewer as Record<string, unknown>).notes === undefined, "notes leaked to viewer");
    assert(trimmedForViewer.fullName === "Verify Test Employee", "basic field fullName should still be present");
    console.log("PASS: employee:view_full-gated fields (DOB, cost rate, notes) are stripped for a viewer, server-side");

    const trimmedForAdmin = trimEmployeeFields(row, true);
    assert((trimmedForAdmin as Record<string, unknown>).dateOfBirth === "1990-01-01", "admin (view_full) should still see dateOfBirth");
    console.log("PASS: employee:view_full role (admin) still receives the full field set");

    console.log("\nALL HR BATCH 1 CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id = $1", [ORG_ID]); // cascades employees + memberships
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
