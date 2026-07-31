// Acceptance check for HR Batch 4 Learning & Training (CLAUDE.md §11a):
// self-service consumption + admin-only authoring/oversight. Same
// fixture/cleanup pattern as db/test-reviews-batch3-verify.ts — real
// lib/api/training.ts functions, not reimplementations.
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { requireEnrollmentOwnAccess, requireTrainingManageAccess, requireTrainingViewAllProgressAccess } from "../lib/api/training";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000b1";
const OWN_EMP_ID = "00000000-0000-0000-0000-0000000000b2";
const OTHER_EMP_ID = "00000000-0000-0000-0000-0000000000b3";
const OWN_USER = "00000000-0000-0000-0000-0000000000b4";
const OTHER_USER = "00000000-0000-0000-0000-0000000000b5";

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
      `insert into organizations (id, name, slug) values ($1, 'Training Batch4 Verify Org', 'training-batch4-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'member'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [OWN_USER, ORG_ID, OTHER_USER],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id) values
         ($1, $2, 'Own Emp', 'own@h.test', $3),
         ($4, $2, 'Other Emp', 'other@h.test', $5)
       on conflict (id) do nothing`,
      [OWN_EMP_ID, ORG_ID, OWN_USER, OTHER_EMP_ID, OTHER_USER],
    );
    await client.query("commit");

    // (a) requireEnrollmentOwnAccess allows the enrollment's own employee
    await withOrgContext(OWN_USER, (db) => requireEnrollmentOwnAccess(db, OWN_USER, ORG_ID, OWN_EMP_ID));
    console.log("PASS: requireEnrollmentOwnAccess allows the enrollment's own employee");

    // (b) it denies a different employee trying to edit someone else's enrollment
    await assertForbidden(
      withOrgContext(OTHER_USER, (db) => requireEnrollmentOwnAccess(db, OTHER_USER, ORG_ID, OWN_EMP_ID)),
      "a different employee should not be able to edit someone else's enrollment",
    );
    console.log("PASS: requireEnrollmentOwnAccess denies editing someone else's enrollment");

    // (c) requireTrainingManageAccess and requireTrainingViewAllProgressAccess deny a role without those grants
    await assertForbidden(
      withOrgContext(OWN_USER, (db) => requireTrainingManageAccess(db, OWN_USER, ORG_ID)),
      "member without training:manage should be denied",
    );
    console.log("PASS: requireTrainingManageAccess denies a role without the grant");

    await assertForbidden(
      withOrgContext(OWN_USER, (db) => requireTrainingViewAllProgressAccess(db, OWN_USER, ORG_ID)),
      "member without training:view_all_progress should be denied",
    );
    console.log("PASS: requireTrainingViewAllProgressAccess denies a role without the grant");

    console.log("\nALL TRAINING BATCH 4 CHECKS PASSED");
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
