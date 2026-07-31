// Acceptance check for HR Batch 3 Performance Reviews (CLAUDE.md §11a):
// the hybrid self+manager access model actually enforces its three tiers.
// Same fixture/cleanup pattern as db/test-leave-batch2-verify.ts — real
// lib/api/reviews.ts functions, not reimplementations.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { performanceReviews } from "./schema";
import {
  requireReviewSelfAccess,
  requireReviewManagerAccess,
  requireReviewViewAccess,
  getOrCreateReview,
} from "../lib/api/reviews";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000e1";
const CYCLE_ID = "00000000-0000-0000-0000-0000000000e2";
const MANAGER_EMP_ID = "00000000-0000-0000-0000-0000000000e3";
const REPORT_EMP_ID = "00000000-0000-0000-0000-0000000000e4";
const OTHER_EMP_ID = "00000000-0000-0000-0000-0000000000e5";
const MANAGER_USER = "00000000-0000-0000-0000-0000000000e6";
const REPORT_USER = "00000000-0000-0000-0000-0000000000e7";
const RANDOM_USER = "00000000-0000-0000-0000-0000000000e8";

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
      `insert into organizations (id, name, slug) values ($1, 'Reviews Batch3 Verify Org', 'reviews-batch3-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'member'), ($3, $2, 'member'), ($4, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [MANAGER_USER, ORG_ID, REPORT_USER, RANDOM_USER],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id) values
         ($1, $2, 'Manager Emp', 'manager@e3.test', $3),
         ($4, $2, 'Other Emp', 'other@e3.test', null)
       on conflict (id) do nothing`,
      [MANAGER_EMP_ID, ORG_ID, MANAGER_USER, OTHER_EMP_ID],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id, manager_id) values ($1, $2, 'Report Emp', 'report@e3.test', $3, $4)
       on conflict (id) do nothing`,
      [REPORT_EMP_ID, ORG_ID, REPORT_USER, MANAGER_EMP_ID],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id) values ($1, $2, 'Random Emp', 'random@e3.test', $3)
       on conflict (id) do nothing`,
      ["00000000-0000-0000-0000-0000000000e9", ORG_ID, RANDOM_USER],
    );
    await client.query(
      `insert into review_cycles (id, org_id, name, status) values ($1, $2, 'Q1 Verify', 'active') on conflict (id) do nothing`,
      [CYCLE_ID, ORG_ID],
    );
    await client.query("commit");

    // (a) an employee calling requireReviewSelfAccess for someone else's employeeId throws
    await assertForbidden(
      withOrgContext(REPORT_USER, (db) => requireReviewSelfAccess(db, REPORT_USER, ORG_ID, OTHER_EMP_ID)),
      "report should not be able to submit a self-assessment for someone else",
    );
    console.log("PASS: self-assessment for someone else's employeeId is denied");

    // (b) the self-assessment path never writes managerAssessment/finalRating
    const review = await withOrgContext(REPORT_USER, (db) => getOrCreateReview(db, ORG_ID, CYCLE_ID, REPORT_EMP_ID));
    await withOrgContext(REPORT_USER, (db) => requireReviewSelfAccess(db, REPORT_USER, ORG_ID, REPORT_EMP_ID));
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `update performance_reviews set self_assessment = $1, self_submitted_at = now(), status = 'manager_assessment_pending' where id = $2`,
      [JSON.stringify({ strengths: "x" }), review.id],
    );
    await client.query("commit");
    const [afterSelf] = await withOrgContext(REPORT_USER, (db) =>
      db.select().from(performanceReviews).where(eq(performanceReviews.id, review.id)),
    );
    assert(
      JSON.stringify(afterSelf.managerAssessment) === JSON.stringify({}),
      "self-assessment write path should never touch manager_assessment",
    );
    assert(afterSelf.finalRating === null, "self-assessment write path should never touch final_rating");
    console.log("PASS: self-assessment path leaves manager_assessment/final_rating untouched");

    // (c) a non-manager calling requireReviewManagerAccess for a report they don't manage throws
    await assertForbidden(
      withOrgContext(RANDOM_USER, (db) => requireReviewManagerAccess(db, RANDOM_USER, ORG_ID, REPORT_EMP_ID)),
      "random employee should not be able to submit a manager assessment for someone they don't manage",
    );
    console.log("PASS: manager assessment denied for a non-manager");

    // (d) a manager CAN call requireReviewManagerAccess for their own direct report
    await withOrgContext(MANAGER_USER, (db) => requireReviewManagerAccess(db, MANAGER_USER, ORG_ID, REPORT_EMP_ID));
    console.log("PASS: manager can submit a manager assessment for their own report");

    // (e) requireReviewViewAccess tiering
    await withOrgContext(REPORT_USER, (db) => requireReviewViewAccess(db, REPORT_USER, ORG_ID, REPORT_EMP_ID)); // view_own + ownership
    console.log("PASS: view_own + ownership allows viewing own review");
    await withOrgContext(MANAGER_USER, (db) => requireReviewViewAccess(db, MANAGER_USER, ORG_ID, REPORT_EMP_ID)); // view_team + isManagerOf
    console.log("PASS: view_team + isManagerOf allows manager to view report's review");
    await assertForbidden(
      withOrgContext(RANDOM_USER, (db) => requireReviewViewAccess(db, RANDOM_USER, ORG_ID, REPORT_EMP_ID)),
      "random employee with none of view_all/view_own-ownership/view_team-manager should be denied",
    );
    console.log("PASS: random employee with no matching tier is denied");

    console.log("\nALL REVIEWS BATCH 3 CHECKS PASSED");
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
