// Acceptance check for HR Batch 2 (Attendance self-service): a member
// cannot create a manual entry (attendance:edit_any is owner/admin-only),
// and cannot view another employee's attendance without attendance:view_all.
// Same fixture/cleanup pattern as db/test-rbac.ts and
// db/test-hr-batch1-verify.ts — the real requirePermission/
// requireAttendanceEditAccess/requireAttendanceViewAccess, not a reimplementation.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { requireAttendanceEditAccess, requireAttendanceViewAccess, requireAttendanceSelfAccess, resolveOwnEmployeeId } from "../lib/api/attendance";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000e1";
const EMP_A_ID = "00000000-0000-0000-0000-0000000000e2";
const EMP_B_ID = "00000000-0000-0000-0000-0000000000e3";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000e4";
const MEMBER_A_USER = "00000000-0000-0000-0000-0000000000e5"; // linked to employee A
const MEMBER_B_USER = "00000000-0000-0000-0000-0000000000e6"; // linked to employee B

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
      `insert into organizations (id, name, slug) values ($1, 'Attendance Batch2 Verify Org', 'attendance-batch2-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'admin'), ($3, $2, 'member'), ($4, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, MEMBER_A_USER, MEMBER_B_USER],
    );
    await client.query(
      `insert into employees (id, org_id, user_id, full_name) values
         ($1, $2, $3, 'Employee A'), ($4, $2, $5, 'Employee B')
       on conflict (id) do nothing`,
      [EMP_A_ID, ORG_ID, MEMBER_A_USER, EMP_B_ID, MEMBER_B_USER],
    );
    await client.query("commit");

    // --- member cannot create a manual entry (attendance:edit_any) ---
    await assertForbidden(
      withOrgContext(MEMBER_A_USER, (db) => requireAttendanceEditAccess(db, MEMBER_A_USER, ORG_ID)),
      "member should not have attendance:edit_any",
    );
    console.log("PASS: member is blocked from manual-entry auth check (403)");

    await withOrgContext(ADMIN_USER, (db) => requireAttendanceEditAccess(db, ADMIN_USER, ORG_ID));
    console.log("PASS: admin passes the manual-entry auth check");

    // --- member A cannot view member B's attendance without view_all ---
    await assertForbidden(
      withOrgContext(MEMBER_A_USER, (db) => requireAttendanceViewAccess(db, MEMBER_A_USER, ORG_ID, EMP_B_ID)),
      "member A should not be able to view employee B's attendance",
    );
    console.log("PASS: member A hitting employee B's attendance history gets a 403");

    // --- member A CAN view their own attendance ---
    await withOrgContext(MEMBER_A_USER, (db) => requireAttendanceViewAccess(db, MEMBER_A_USER, ORG_ID, EMP_A_ID));
    console.log("PASS: member A can view their own attendance");

    // --- admin (view_all) can view anyone's ---
    await withOrgContext(ADMIN_USER, (db) => requireAttendanceViewAccess(db, ADMIN_USER, ORG_ID, EMP_A_ID));
    console.log("PASS: admin (view_all) can view employee A's attendance");

    // --- member A cannot self-check-in as employee B ---
    await assertForbidden(
      withOrgContext(MEMBER_A_USER, (db) => requireAttendanceSelfAccess(db, MEMBER_A_USER, ORG_ID, EMP_B_ID)),
      "member A should not be able to check in as employee B",
    );
    console.log("PASS: member A cannot self-check-in on employee B's record (403)");

    // --- member A CAN self-check-in as themself ---
    await withOrgContext(MEMBER_A_USER, (db) => requireAttendanceSelfAccess(db, MEMBER_A_USER, ORG_ID, EMP_A_ID));
    console.log("PASS: member A can self-check-in on their own record");

    // --- resolveOwnEmployeeId resolves correctly ---
    const resolved = await withOrgContext(MEMBER_B_USER, (db) => resolveOwnEmployeeId(db, MEMBER_B_USER, ORG_ID));
    assert(resolved === EMP_B_ID, "resolveOwnEmployeeId should resolve member B to employee B");
    console.log("PASS: resolveOwnEmployeeId resolves the correct employee row");

    console.log("\nALL ATTENDANCE BATCH 2 CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id = $1", [ORG_ID]); // cascades everything above
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
