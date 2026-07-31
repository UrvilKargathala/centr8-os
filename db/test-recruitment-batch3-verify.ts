// Acceptance check for HR Batch 3 Recruitment/Hiring (CLAUDE.md §11a):
// admin/HR + hiring-manager access, and the assigned-interviewer-only
// feedback check. Same fixture/cleanup pattern as
// db/test-leave-batch2-verify.ts — real lib/api/recruitment.ts functions.
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { requireInterviewFeedbackAccess, requireCreateJobAccess, requireManageCandidatesAccess } from "../lib/api/recruitment";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000f1";
const INTERVIEWER_EMP_ID = "00000000-0000-0000-0000-0000000000f2";
const OTHER_INTERVIEWER_EMP_ID = "00000000-0000-0000-0000-0000000000f3";
const INTERVIEWER_USER = "00000000-0000-0000-0000-0000000000f4";
const OTHER_INTERVIEWER_USER = "00000000-0000-0000-0000-0000000000f5";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000f6";

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
      `insert into organizations (id, name, slug) values ($1, 'Recruitment Batch3 Verify Org', 'recruitment-batch3-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'member'), ($3, $2, 'member'), ($4, $2, 'viewer')
       on conflict (user_id, org_id) do nothing`,
      [INTERVIEWER_USER, ORG_ID, OTHER_INTERVIEWER_USER, VIEWER_USER],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id) values
         ($1, $2, 'Interviewer Emp', 'interviewer@f3.test', $3),
         ($4, $2, 'Other Interviewer Emp', 'other-interviewer@f3.test', $5)
       on conflict (id) do nothing`,
      [INTERVIEWER_EMP_ID, ORG_ID, INTERVIEWER_USER, OTHER_INTERVIEWER_EMP_ID, OTHER_INTERVIEWER_USER],
    );
    await client.query("commit");

    // (a) requireInterviewFeedbackAccess throws for a user who IS an
    // interviewer but not the ASSIGNED one for this specific interview
    await assertForbidden(
      withOrgContext(OTHER_INTERVIEWER_USER, (db) =>
        requireInterviewFeedbackAccess(db, OTHER_INTERVIEWER_USER, ORG_ID, INTERVIEWER_EMP_ID),
      ),
      "a different interviewer (not assigned to this interview) should be denied",
    );
    console.log("PASS: feedback denied for an interviewer not assigned to this interview");

    // (b) it succeeds for the assigned interviewer
    await withOrgContext(INTERVIEWER_USER, (db) => requireInterviewFeedbackAccess(db, INTERVIEWER_USER, ORG_ID, INTERVIEWER_EMP_ID));
    console.log("PASS: feedback allowed for the assigned interviewer");

    // (c) a role without create_job permission is denied by requireCreateJobAccess
    await assertForbidden(
      withOrgContext(VIEWER_USER, (db) => requireCreateJobAccess(db, VIEWER_USER, ORG_ID)),
      "viewer should not have recruitment:create_job",
    );
    console.log("PASS: viewer denied create_job");

    // (d) a role with only recruitment:read (not manage_candidates) is denied by requireManageCandidatesAccess
    await assertForbidden(
      withOrgContext(VIEWER_USER, (db) => requireManageCandidatesAccess(db, VIEWER_USER, ORG_ID)),
      "viewer (read-only) should not have recruitment:manage_candidates",
    );
    console.log("PASS: viewer denied manage_candidates");

    console.log("\nALL RECRUITMENT BATCH 3 CHECKS PASSED");
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
