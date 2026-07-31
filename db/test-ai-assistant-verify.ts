// Acceptance check for the AI Assistant build-out (Sprint Plans, Ask AI,
// Documents, Recommendations — CLAUDE.md §11a). Same fixture/cleanup
// pattern as db/test-crm-batch3-verify.ts — real lib/api/aiAssistant.ts
// functions, direct-connection DML for fixtures, cascading org delete for
// cleanup.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { aiConversations, aiMessages, generatedDocuments, sprintPlanProposals, sprints, tasks } from "./schema";
import { approveSprintPlan, editDocument, finalizeDocument, rejectSprintPlan, reviewDocument } from "../lib/api/aiAssistant";
import { generateAI } from "../lib/ai/generate";
import { ApiError } from "../lib/api/helpers";

const ORG_A = "00000000-0000-0000-0000-0000000000a1";
const ADMIN_USER = "00000000-0000-0000-0000-0000000000a2";
const OTHER_USER = "00000000-0000-0000-0000-0000000000a3";
const PROJECT_ID = "00000000-0000-0000-0000-0000000000a4";
const PENDING_PLAN_APPROVE = "00000000-0000-0000-0000-0000000000a5";
const PENDING_PLAN_REJECT = "00000000-0000-0000-0000-0000000000a6";
const DRAFT_DOC = "00000000-0000-0000-0000-0000000000a7";
const REVIEWED_DOC = "00000000-0000-0000-0000-0000000000a8";
const CONVO_A = "00000000-0000-0000-0000-0000000000a9";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function assertApiError(promise: Promise<unknown>, status: number, message: string) {
  try {
    await promise;
    throw new Error(`FAIL: ${message} (expected ApiError ${status}, nothing was thrown)`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== status) throw err;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DIRECT_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query(
      `insert into organizations (id, name, slug) values ($1, 'AI Assistant Verify Org', 'ai-assistant-verify')
       on conflict (id) do nothing`,
      [ORG_A],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'admin'), ($3, $2, 'admin')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_A, OTHER_USER],
    );
    await client.query(`insert into projects (id, org_id, name, status) values ($1, $2, 'AI Verify Project', 'active') on conflict (id) do nothing`, [
      PROJECT_ID,
      ORG_A,
    ]);
    await client.query(
      `insert into sprint_plan_proposals (id, org_id, project_id, sprint_name, proposed_tasks, status) values
         ($1, $2, $3, 'Verify Sprint A', $4, 'pending'),
         ($5, $2, $3, 'Verify Sprint B', $4, 'pending')
       on conflict (id) do nothing`,
      [
        PENDING_PLAN_APPROVE,
        ORG_A,
        PROJECT_ID,
        JSON.stringify([{ title: "Verify task 1", assignee_name: "Nobody", estimate: 4, priority: "high" }]),
        PENDING_PLAN_REJECT,
      ],
    );
    await client.query(
      `insert into generated_documents (id, org_id, doc_type, title, content, status) values
         ($1, $2, 'prd', 'Draft Doc', 'draft content', 'draft'),
         ($3, $2, 'sop', 'Reviewed Doc', 'reviewed content', 'reviewed')
       on conflict (id) do nothing`,
      [DRAFT_DOC, ORG_A, REVIEWED_DOC],
    );
    await client.query(`insert into ai_conversations (id, org_id, user_id, title) values ($1, $2, $3, 'Verify Convo') on conflict (id) do nothing`, [
      CONVO_A,
      ORG_A,
      ADMIN_USER,
    ]);
    await client.query(`insert into ai_messages (org_id, conversation_id, role, content) values ($1, $2, 'user', 'hello')`, [ORG_A, CONVO_A]);
    await client.query("commit");

    // (a) Sprint plan approval creates a real sprint + tasks
    const { sprint, tasks: createdTasks } = await withOrgContext(ADMIN_USER, (db) => approveSprintPlan(db, ADMIN_USER, PENDING_PLAN_APPROVE));
    assert(!!sprint, "approveSprintPlan should return a created sprint");
    assert(createdTasks.length === 1, "approveSprintPlan should create the proposed tasks");
    const [sprintRow] = await withOrgContext(ADMIN_USER, (db) => db.select().from(sprints).where(eq(sprints.id, sprint.id)));
    assert(!!sprintRow, "the sprint row should actually exist in the sprints table");
    const [taskRow] = await withOrgContext(ADMIN_USER, (db) => db.select().from(tasks).where(eq(tasks.sprintId, sprint.id)));
    assert(taskRow?.title === "Verify task 1", "the task row should exist and match the proposal's task title");
    console.log("PASS: sprint plan approval creates real sprint + tasks");

    // Re-approving an already-approved proposal is rejected
    await assertApiError(
      withOrgContext(ADMIN_USER, (db) => approveSprintPlan(db, ADMIN_USER, PENDING_PLAN_APPROVE)),
      400,
      "re-approving an already-approved proposal should fail",
    );
    console.log("PASS: re-approving an approved proposal is rejected");

    // (b) Rejection does NOT create a sprint or tasks
    const rejected = await withOrgContext(ADMIN_USER, (db) => rejectSprintPlan(db, ADMIN_USER, PENDING_PLAN_REJECT, "Not enough capacity this cycle"));
    assert(rejected.status === "rejected", "rejected proposal should have status='rejected'");
    assert(rejected.rejectionReason === "Not enough capacity this cycle", "rejection reason should persist");
    const sprintsForRejected = await withOrgContext(ADMIN_USER, (db) => db.select().from(sprints).where(eq(sprints.name, "Verify Sprint B")));
    assert(sprintsForRejected.length === 0, "rejecting a proposal must not create a sprint");
    console.log("PASS: sprint plan rejection persists reason and creates no sprint/tasks");

    // (c) Document finalization locks edits
    const reviewed = await withOrgContext(ADMIN_USER, (db) => reviewDocument(db, ADMIN_USER, DRAFT_DOC, false));
    assert(reviewed.status === "reviewed", "marking a draft reviewed should set status='reviewed'");
    const finalized = await withOrgContext(ADMIN_USER, (db) => finalizeDocument(db, ADMIN_USER, DRAFT_DOC));
    assert(finalized.status === "finalized", "finalizing a reviewed document should set status='finalized'");
    await assertApiError(
      withOrgContext(ADMIN_USER, (db) => editDocument(db, ADMIN_USER, DRAFT_DOC, { content: "trying to sneak an edit in" })),
      400,
      "editing a finalized document should be rejected",
    );
    await assertApiError(
      withOrgContext(ADMIN_USER, (db) => reviewDocument(db, ADMIN_USER, DRAFT_DOC, true)),
      400,
      "reverting a finalized document to draft should be rejected (finalize is one-way)",
    );
    console.log("PASS: document finalization locks edits (PATCH and revert both rejected)");

    // A reviewed (not yet finalized) doc CAN still revert to draft
    const reverted = await withOrgContext(ADMIN_USER, (db) => reviewDocument(db, ADMIN_USER, REVIEWED_DOC, true));
    assert(reverted.status === "draft", "reverting a merely-reviewed document should succeed");
    console.log("PASS: reviewed (non-finalized) document can revert to draft");

    // (d) Conversation messages are user-scoped — RLS blocks a different
    // user from even seeing the conversation row, let alone its messages.
    const ownVisible = await withOrgContext(ADMIN_USER, (db) => db.select().from(aiConversations).where(eq(aiConversations.id, CONVO_A)));
    assert(ownVisible.length === 1, "the conversation's owner should be able to see it");
    const otherVisible = await withOrgContext(OTHER_USER, (db) => db.select().from(aiConversations).where(eq(aiConversations.id, CONVO_A)));
    assert(otherVisible.length === 0, "a different user must not see another user's conversation (RLS ai_conversations_isolation)");
    const otherMessages = await withOrgContext(OTHER_USER, (db) => db.select().from(aiMessages).where(eq(aiMessages.conversationId, CONVO_A)));
    assert(otherMessages.length === 0, "a different user must not see another user's messages (RLS ai_messages_isolation)");
    console.log("PASS: conversation messages are user-scoped (User A cannot see User B's conversations)");

    // (e) Recommendations mock returns org-scoped, non-trivial output
    const recs = (await generateAI("Analyst", "generate_recommendations", {
      overdue_tasks_count: 3,
      at_risk_project_names: ["AI Verify Project"],
      over_allocated_members: ["Test Person"],
      at_risk_deal_names: ["Stale Deal"],
      pending_leave_requests: 1,
      pending_sprint_plans: 1,
    })) as { recommendations: { category: string }[] };
    assert(recs.recommendations.length >= 5, "generate_recommendations should return several recommendations given a busy org context");
    const categories = new Set(recs.recommendations.map((r) => r.category));
    assert(categories.size >= 3, "recommendations should span multiple categories (cross-pillar), not just one");
    console.log("PASS: recommendations mock returns varied, cross-pillar output for a given org context");

    console.log("\nALL AI ASSISTANT CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id in ($1)", [ORG_A]);
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
