// Acceptance check for HR Batch 4 HR Cases & Helpdesk (CLAUDE.md §11a):
// full self-service raise + admin-managed resolution. Same fixture/cleanup
// pattern as db/test-reviews-batch3-verify.ts — real lib/api/hrCases.ts
// functions, not reimplementations.
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { requireCaseViewAccess, requireCaseManageAccess } from "../lib/api/hrCases";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000a1";
const RAISER_EMP_ID = "00000000-0000-0000-0000-0000000000a2";
const RANDOM_EMP_ID = "00000000-0000-0000-0000-0000000000a3";
const RAISER_USER = "00000000-0000-0000-0000-0000000000a4";
const RANDOM_USER = "00000000-0000-0000-0000-0000000000a5";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000a6";
const CASE_ID = "00000000-0000-0000-0000-0000000000a7";

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
      `insert into organizations (id, name, slug) values ($1, 'HR Cases Batch4 Verify Org', 'hr-cases-batch4-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'member'), ($3, $2, 'member'), ($4, $2, 'admin')
       on conflict (user_id, org_id) do nothing`,
      [RAISER_USER, ORG_ID, RANDOM_USER, ADMIN_USER],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id) values
         ($1, $2, 'Raiser Emp', 'raiser@g.test', $3),
         ($4, $2, 'Random Emp', 'random@g.test', $5)
       on conflict (id) do nothing`,
      [RAISER_EMP_ID, ORG_ID, RAISER_USER, RANDOM_EMP_ID, RANDOM_USER],
    );
    await client.query(
      `insert into hr_cases (id, org_id, employee_id, subject, description) values ($1, $2, $3, 'Test case', 'Test description')
       on conflict (id) do nothing`,
      [CASE_ID, ORG_ID, RAISER_EMP_ID],
    );
    await client.query("commit");

    // (d) requireCaseManageAccess denies a role without the manage grant
    await assertForbidden(
      withOrgContext(RANDOM_USER, (db) => requireCaseManageAccess(db, RANDOM_USER, ORG_ID)),
      "member without hr_case:manage should be denied manage access",
    );
    console.log("PASS: requireCaseManageAccess denies a role without the manage grant");

    // (a) a manage-holder can view any case
    const isHandlerForAdmin = await withOrgContext(ADMIN_USER, (db) => requireCaseViewAccess(db, ADMIN_USER, ORG_ID, RAISER_EMP_ID));
    assert(isHandlerForAdmin === true, "admin (manage-holder) should be able to view any case, and be treated as a handler");
    console.log("PASS: manage-holder can view any case");

    // (b) the case's own raiser can view their own case
    const isHandlerForRaiser = await withOrgContext(RAISER_USER, (db) => requireCaseViewAccess(db, RAISER_USER, ORG_ID, RAISER_EMP_ID));
    assert(isHandlerForRaiser === false, "the case's own raiser should be able to view it, but not be treated as a handler");
    console.log("PASS: case's own raiser can view their own case");

    // (c) a random employee (no manage grant, not the raiser) is denied
    await assertForbidden(
      withOrgContext(RANDOM_USER, (db) => requireCaseViewAccess(db, RANDOM_USER, ORG_ID, RAISER_EMP_ID)),
      "random employee with no manage grant and not the raiser should be denied",
    );
    console.log("PASS: random employee denied viewing someone else's case");

    console.log("\nALL HR CASES BATCH 4 CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id = $1", [ORG_ID]);
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
