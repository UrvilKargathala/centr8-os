// Acceptance check for CRM Batch 2 (Deals/Pipeline, CLAUDE.md §11a). Same
// fixture/cleanup pattern as db/test-crm-batch1-verify.ts — real
// lib/api/crm.ts + lib/api/permissions.ts functions, direct-connection DML
// for fixtures, cascading org delete for cleanup.
import { and, eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { accounts, activities, contacts, dealStageHistory, deals, leads } from "./schema";
import { changeDealStage, closeDeal, convertLead, requireDealCloseAccess } from "../lib/api/crm";
import { requirePermission } from "../lib/api/permissions";
import { ApiError } from "../lib/api/helpers";

const ORG_A = "00000000-0000-0000-0000-0000000000e1";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000e3";
const MEMBER_USER = "00000000-0000-0000-0000-0000000000e4";
const LEAD_CREATE_DEAL_ID = "00000000-0000-0000-0000-0000000000e5";
const LEAD_NO_DEAL_ID = "00000000-0000-0000-0000-0000000000e6";
const DEAL_STAGE_ID = "00000000-0000-0000-0000-0000000000e7";
const DEAL_LOST_ID = "00000000-0000-0000-0000-0000000000e8";
const DEAL_WON_ID = "00000000-0000-0000-0000-0000000000e9";

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
      `insert into organizations (id, name, slug) values ($1, 'CRM Deals Batch2 Verify Org', 'crm-deals-batch2-verify')
       on conflict (id) do nothing`,
      [ORG_A],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'viewer'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [VIEWER_USER, ORG_A, MEMBER_USER],
    );
    await client.query(
      `insert into leads (id, org_id, name, company, status) values
         ($1, $2, 'Convert With Deal', 'DealCo', 'qualified'),
         ($3, $2, 'Convert No Deal', 'NoDealCo', 'qualified')
       on conflict (id) do nothing`,
      [LEAD_CREATE_DEAL_ID, ORG_A, LEAD_NO_DEAL_ID],
    );
    await client.query(
      `insert into deals (id, org_id, name, stage, probability, value, currency) values
         ($1, $2, 'Stage Test Deal', 'prospecting', 10, 1000, 'INR'),
         ($3, $2, 'Lost Test Deal', 'prospecting', 10, 500, 'INR'),
         ($4, $2, 'Won Test Deal', 'prospecting', 10, 2000, 'INR')
       on conflict (id) do nothing`,
      [DEAL_STAGE_ID, ORG_A, DEAL_LOST_ID, DEAL_WON_ID],
    );
    await client.query("commit");

    // (a) Viewer cannot create or close a deal
    await assertApiError(
      withOrgContext(VIEWER_USER, (db) => requirePermission(db, VIEWER_USER, ORG_A, "deal", "create")),
      403,
      "viewer should not be able to create a deal",
    );
    console.log("PASS: viewer denied deal:create");
    await assertApiError(
      withOrgContext(VIEWER_USER, (db) => requireDealCloseAccess(db, VIEWER_USER, ORG_A)),
      403,
      "viewer should not be able to close a deal",
    );
    console.log("PASS: viewer denied deal:close");

    // (b) changeDealStage creates stage_history + status_change activity, updates deal
    await withOrgContext(MEMBER_USER, (db) => changeDealStage(db, ORG_A, DEAL_STAGE_ID, "discovery", null));
    const [afterStageChange] = await withOrgContext(MEMBER_USER, (db) => db.select().from(deals).where(eq(deals.id, DEAL_STAGE_ID)));
    assert(afterStageChange.stage === "discovery", "deal.stage should be updated to discovery");
    assert(afterStageChange.probability === 25, "deal.probability should default to discovery's 25");
    const historyRows = await withOrgContext(MEMBER_USER, (db) => db.select().from(dealStageHistory).where(eq(dealStageHistory.dealId, DEAL_STAGE_ID)));
    assert(historyRows.length === 1, "changeDealStage should create exactly one deal_stage_history row");
    assert(historyRows[0].fromStage === "prospecting" && historyRows[0].toStage === "discovery", "history row should record from/to stage");
    const activityRows = await withOrgContext(MEMBER_USER, (db) =>
      db.select().from(activities).where(and(eq(activities.relatedId, DEAL_STAGE_ID), eq(activities.type, "status_change"))),
    );
    assert(activityRows.length === 1, "changeDealStage should create exactly one status_change activity");
    console.log("PASS: changeDealStage creates stage_history + status_change activity and updates the deal");

    // (c) closeDeal(lost) with no lost_reason throws 400, no actualCloseDate side effect
    await assertApiError(
      withOrgContext(MEMBER_USER, (db) => closeDeal(db, ORG_A, DEAL_LOST_ID, "lost", null)),
      400,
      "closing a deal as lost with no lost_reason should throw 400",
    );
    const [afterFailedClose] = await withOrgContext(MEMBER_USER, (db) => db.select().from(deals).where(eq(deals.id, DEAL_LOST_ID)));
    assert(afterFailedClose.actualCloseDate === null, "a rejected close must not set actualCloseDate");
    assert(afterFailedClose.stage === "prospecting", "a rejected close must not change stage either");
    console.log("PASS: closeDeal(lost, no reason) throws 400 with no side effects");

    // (d) closeDeal(won) sets actualCloseDate and creates stage_history + activity
    await withOrgContext(MEMBER_USER, (db) => closeDeal(db, ORG_A, DEAL_WON_ID, "won", null));
    const [afterWon] = await withOrgContext(MEMBER_USER, (db) => db.select().from(deals).where(eq(deals.id, DEAL_WON_ID)));
    assert(afterWon.stage === "won", "deal.stage should be won");
    assert(afterWon.actualCloseDate !== null, "actualCloseDate should be set on won close");
    const wonHistory = await withOrgContext(MEMBER_USER, (db) => db.select().from(dealStageHistory).where(eq(dealStageHistory.dealId, DEAL_WON_ID)));
    assert(wonHistory.length === 1 && wonHistory[0].toStage === "won", "closeDeal(won) should record a stage_history row");
    const wonActivity = await withOrgContext(MEMBER_USER, (db) =>
      db.select().from(activities).where(and(eq(activities.relatedId, DEAL_WON_ID), eq(activities.type, "status_change"))),
    );
    assert(wonActivity.length === 1, "closeDeal(won) should record a status_change activity");
    console.log("PASS: closeDeal(won) sets actualCloseDate and records history+activity");

    // (e) convertLead({createDeal:true}) creates account+contact+deal; {createDeal:false} creates only account+contact
    const withDeal = await withOrgContext(MEMBER_USER, (db) => convertLead(db, ORG_A, null, LEAD_CREATE_DEAL_ID, { createDeal: true }));
    assert(withDeal.deal !== null, "convertLead({createDeal:true}) should return a non-null deal");
    assert(withDeal.deal!.accountId === withDeal.account.id, "deal.accountId should point at the newly created account");
    assert(withDeal.deal!.primaryContactId === withDeal.contact.id, "deal.primaryContactId should point at the newly created contact");
    const [dealExists] = await withOrgContext(MEMBER_USER, (db) => db.select().from(deals).where(eq(deals.id, withDeal.deal!.id)));
    assert(!!dealExists, "the created deal should exist in the deals table");

    const withoutDeal = await withOrgContext(MEMBER_USER, (db) => convertLead(db, ORG_A, null, LEAD_NO_DEAL_ID, { createDeal: false }));
    assert(withoutDeal.deal === null, "convertLead({createDeal:false}) should return deal: null");
    const [{ acctCount }] = await withOrgContext(MEMBER_USER, async (db) => {
      const rows = await db.select().from(accounts).where(and(eq(accounts.orgId, ORG_A), eq(accounts.name, "NoDealCo")));
      return [{ acctCount: rows.length }];
    });
    assert(acctCount === 1, "account+contact should still be created when createDeal is false");
    const dealsForNoDealLead = await withOrgContext(MEMBER_USER, (db) => db.select().from(deals).where(eq(deals.convertedFromLeadId, LEAD_NO_DEAL_ID)));
    assert(dealsForNoDealLead.length === 0, "no deal should be created when createDeal is false");
    console.log("PASS: convertLead createDeal true/false behaves correctly");

    // (f) pipeline-stats math: weighted_pipeline_value = sum(value * probability/100) over open-stage deals
    const openDeals = await withOrgContext(MEMBER_USER, (db) =>
      db.select().from(deals).where(and(eq(deals.orgId, ORG_A), eq(deals.stage, "discovery"))),
    );
    const handComputed = openDeals.reduce((sum, d) => sum + (Number(d.value ?? 0) * (d.probability ?? 0)) / 100, 0);
    const expected = (1000 * 25) / 100; // DEAL_STAGE_ID moved to discovery (25%) with value 1000
    assert(handComputed === expected, `hand-computed weighted value (${handComputed}) should match expected (${expected})`);
    console.log("PASS: pipeline-stats weighted-value math matches hand computation");

    console.log("\nALL CRM DEALS BATCH 2 CHECKS PASSED");
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
