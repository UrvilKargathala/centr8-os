// Acceptance check for CRM Batch 3 (Sales Forecasts, Campaigns, CLAUDE.md
// §11a). Same fixture/cleanup pattern as db/test-crm-deals-batch2-verify.ts —
// real lib/api/crm.ts + lib/api/permissions.ts functions, direct-connection
// DML for fixtures, cascading org delete for cleanup.
import { eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { deals } from "./schema";
import {
  campaignRoi,
  changeDealStage,
  computeCampaignMetrics,
  computeForecast,
  convertLead,
  requireCampaignCreateAccess,
  requireForecastSetTargetAccess,
} from "../lib/api/crm";
import { ApiError } from "../lib/api/helpers";

const ORG_A = "00000000-0000-0000-0000-0000000000f1";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000f3";
const MEMBER_USER = "00000000-0000-0000-0000-0000000000f4";
const DEAL_OPEN_1 = "00000000-0000-0000-0000-0000000000f5";
const DEAL_OPEN_2 = "00000000-0000-0000-0000-0000000000f6";
const DEAL_WON = "00000000-0000-0000-0000-0000000000f7";
const CAMPAIGN_ID = "00000000-0000-0000-0000-0000000000f8";
const LEAD_ID = "00000000-0000-0000-0000-0000000000f9";

const PERIOD_START = "2026-07-01";
const PERIOD_END = "2026-07-31";

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
      `insert into organizations (id, name, slug) values ($1, 'CRM Batch3 Verify Org', 'crm-batch3-verify')
       on conflict (id) do nothing`,
      [ORG_A],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'viewer'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [VIEWER_USER, ORG_A, MEMBER_USER],
    );
    await client.query(
      `insert into deals (id, org_id, name, stage, probability, value, currency, expected_close_date) values
         ($1, $2, 'Open Deal 1', 'discovery', 25, 1000, 'INR', $5),
         ($3, $2, 'Open Deal 2', 'negotiation', 60, 2000, 'INR', $5),
         ($4, $2, 'Deal To Win', 'prospecting', 10, 500, 'INR', $5)
       on conflict (id) do nothing`,
      [DEAL_OPEN_1, ORG_A, DEAL_OPEN_2, DEAL_WON, PERIOD_START],
    );
    await client.query(
      `insert into campaigns (id, org_id, name, type, status, budget_spent) values
         ($1, $2, 'Batch3 Test Campaign', 'email', 'active', 400)
       on conflict (id) do nothing`,
      [CAMPAIGN_ID, ORG_A],
    );
    await client.query(
      `insert into leads (id, org_id, name, company, status, campaign_id) values
         ($1, $2, 'Campaign Lead', 'LeadCo', 'qualified', $3)
       on conflict (id) do nothing`,
      [LEAD_ID, ORG_A, CAMPAIGN_ID],
    );
    await client.query("commit");

    // (a) Viewer cannot set a forecast target or create a campaign
    await assertApiError(
      withOrgContext(VIEWER_USER, (db) => requireForecastSetTargetAccess(db, VIEWER_USER, ORG_A)),
      403,
      "viewer should not be able to set a forecast target",
    );
    console.log("PASS: viewer denied forecast:set_target");
    await assertApiError(
      withOrgContext(VIEWER_USER, (db) => requireCampaignCreateAccess(db, VIEWER_USER, ORG_A)),
      403,
      "viewer should not be able to create a campaign",
    );
    console.log("PASS: viewer denied campaign:create");

    // (b) computeForecast sums by stage with probability weighting
    const forecast = await withOrgContext(MEMBER_USER, (db) => computeForecast(db, ORG_A, PERIOD_START, PERIOD_END));
    const expectedWeighted = (1000 * 25) / 100 + (2000 * 60) / 100 + (500 * 10) / 100; // discovery+negotiation+prospecting are all OPEN_STAGES
    assert(forecast.weighted_value === expectedWeighted, `weighted_value (${forecast.weighted_value}) should match hand computation (${expectedWeighted})`);
    assert(forecast.won_value === 0, "won_value should be 0 before any deal is closed won");
    console.log("PASS: computeForecast weighted-value math matches hand computation");

    // (c) campaign attribution: convertLead(createDeal:true) on a campaign-attributed
    // lead attributes the resulting deal via convertedFromLeadId -> lead.campaignId
    const { deal: convertedDeal } = await withOrgContext(MEMBER_USER, (db) => convertLead(db, ORG_A, null, LEAD_ID, { createDeal: true, dealValue: 5000 }));
    assert(!!convertedDeal, "convertLead should create a deal");
    let metrics = await withOrgContext(MEMBER_USER, (db) => computeCampaignMetrics(db, ORG_A, CAMPAIGN_ID));
    assert(metrics.leads_count >= 1, "leads_count should include the campaign-attributed lead");
    assert(metrics.deals_count >= 1, "deals_count should include the deal created via conversion (convertedFromLeadId attribution)");
    assert(metrics.revenue_won === 0, "revenue_won should be 0 before the converted deal is won");

    await withOrgContext(MEMBER_USER, (db) => changeDealStage(db, ORG_A, convertedDeal!.id, "won", null));
    metrics = await withOrgContext(MEMBER_USER, (db) => computeCampaignMetrics(db, ORG_A, CAMPAIGN_ID));
    assert(metrics.revenue_won === 5000, `revenue_won (${metrics.revenue_won}) should reflect the won deal's value (5000)`);
    console.log("PASS: computeCampaignMetrics attributes leads + converted-lead deals, revenue_won reflects won value");

    // (d) campaignRoi
    assert(campaignRoi(1500, 400) === ((1500 - 400) / 400) * 100, "campaignRoi should match (revenue - spent) / spent * 100");
    assert(campaignRoi(1000, 0) === null, "campaignRoi should return null when budgetSpent is 0");
    console.log("PASS: campaignRoi calculation and null-on-zero-spend behavior");

    console.log("\nALL CRM BATCH 3 CHECKS PASSED");
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
