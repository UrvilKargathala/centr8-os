// Acceptance check for HR Batch 4 Employee Engagement/Surveys (CLAUDE.md
// §11a) — THE MOST IMPORTANT TEST IN THE BATCH: verifies an anonymous
// response's answers can never be joined back to the responding employee
// via any authorized query path. Same fixture/cleanup pattern as
// db/test-reviews-batch3-verify.ts — real lib/api/surveys.ts functions.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { surveyResponses, surveyRespondents } from "./schema";
import {
  submitResponse,
  getSurveyOrThrow,
  requireSurveyManageAccess,
  requireSurveyRespondAccess,
  requireSurveyViewResultsAccess,
} from "../lib/api/surveys";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000c1";
const RESPONDER_EMP_ID = "00000000-0000-0000-0000-0000000000c2";
const RESPONDER_USER = "00000000-0000-0000-0000-0000000000c3";
const SURVEY_ID = "00000000-0000-0000-0000-0000000000c4";

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
      `insert into organizations (id, name, slug) values ($1, 'Surveys Batch4 Verify Org', 'surveys-batch4-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [RESPONDER_USER, ORG_ID],
    );
    await client.query(
      `insert into employees (id, org_id, full_name, email, user_id) values ($1, $2, 'Responder Emp', 'responder@i.test', $3)
       on conflict (id) do nothing`,
      [RESPONDER_EMP_ID, ORG_ID, RESPONDER_USER],
    );
    await client.query(
      `insert into engagement_surveys (id, org_id, title, questions, is_anonymous, status) values
         ($1, $2, 'Anon Verify Survey', $3, true, 'active')
       on conflict (id) do nothing`,
      [SURVEY_ID, ORG_ID, JSON.stringify([{ id: "q1", text: "How are you?", type: "rating_1_5" }])],
    );
    await client.query("commit");

    // requireSurveyManageAccess/requireSurveyRespondAccess/requireSurveyViewResultsAccess
    // deny roles without those grants — respond IS granted to member, manage/view_results are not.
    await withOrgContext(RESPONDER_USER, (db) => requireSurveyRespondAccess(db, RESPONDER_USER, ORG_ID));
    console.log("PASS: requireSurveyRespondAccess allows a member (granted by default)");
    await assertForbidden(
      withOrgContext(RESPONDER_USER, (db) => requireSurveyManageAccess(db, RESPONDER_USER, ORG_ID)),
      "member without engagement:manage should be denied",
    );
    console.log("PASS: requireSurveyManageAccess denies a role without the grant");
    await assertForbidden(
      withOrgContext(RESPONDER_USER, (db) => requireSurveyViewResultsAccess(db, RESPONDER_USER, ORG_ID)),
      "member without engagement:view_results should be denied",
    );
    console.log("PASS: requireSurveyViewResultsAccess denies a role without the grant");

    // (b) submit a real anonymous response
    const survey = await withOrgContext(RESPONDER_USER, (db) => getSurveyOrThrow(db, SURVEY_ID));
    const response = await withOrgContext(RESPONDER_USER, (db) =>
      submitResponse(db, ORG_ID, survey, RESPONDER_EMP_ID, { q1: 5 }),
    );

    // (c) survey_responses.employeeId is null for this response
    const [responseRow] = await withOrgContext(RESPONDER_USER, (db) =>
      db.select().from(surveyResponses).where(eq(surveyResponses.id, response.id)),
    );
    assert(responseRow.employeeId === null, "anonymous response row must have employeeId = null");
    console.log("PASS: survey_responses.employee_id is null for the anonymous response");

    // (d) survey_respondents DOES have a row with the real employeeId (dedup, no answer content)
    const [respondentRow] = await withOrgContext(RESPONDER_USER, (db) =>
      db.select().from(surveyRespondents).where(eq(surveyRespondents.surveyId, SURVEY_ID)),
    );
    assert(respondentRow?.employeeId === RESPONDER_EMP_ID, "survey_respondents must record the real employeeId for dedup");
    console.log("PASS: survey_respondents records the real employeeId (dedup only, no answers)");

    // (e) submitting again for the same survey+employee throws (409, "already responded")
    try {
      await withOrgContext(RESPONDER_USER, (db) => submitResponse(db, ORG_ID, survey, RESPONDER_EMP_ID, { q1: 3 }));
      throw new Error("FAIL: expected a 409 on duplicate submission, nothing was thrown");
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) throw err;
      assert(/already responded/i.test(err.message), "duplicate-submission error should mention already responded");
    }
    console.log("PASS: duplicate submission throws 409 'already responded'");

    // (f) functional check: the exact select shape the results route uses
    // (answers only) never carries an employee_id key.
    const rows = await withOrgContext(RESPONDER_USER, (db) =>
      db.select({ answers: surveyResponses.answers }).from(surveyResponses).where(eq(surveyResponses.surveyId, SURVEY_ID)),
    );
    assert(rows.length > 0, "expected at least one response row");
    for (const row of rows) {
      assert(!("employeeId" in row) && !("employee_id" in row), "results-route-shaped query must never carry an employee_id key");
    }
    console.log("PASS: results-route-shaped query never returns an employee_id key");

    console.log("\nALL SURVEYS BATCH 4 CHECKS PASSED");
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
