// Acceptance check for CRM Batch 1 (Leads/Contacts/Accounts + activities,
// CLAUDE.md §11a). Same fixture/cleanup pattern as
// db/test-surveys-batch4-verify.ts — real lib/api/crm.ts + lib/api/permissions.ts
// functions, direct-connection DML for fixtures, cascading org delete for cleanup.
import { and, eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { accounts, activities, contacts, leads } from "./schema";
import { convertLead, requireLeadAssignAccess } from "../lib/api/crm";
import { requirePermission } from "../lib/api/permissions";
import { ApiError } from "../lib/api/helpers";

const ORG_A = "00000000-0000-0000-0000-0000000000d1";
const ORG_B = "00000000-0000-0000-0000-0000000000d2";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000d3";
const MEMBER_USER = "00000000-0000-0000-0000-0000000000d4";
const LEAD_ID = "00000000-0000-0000-0000-0000000000d5";
const LOST_LEAD_ID = "00000000-0000-0000-0000-0000000000d6";

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
      `insert into organizations (id, name, slug) values ($1, 'CRM Batch1 Verify Org A', 'crm-batch1-verify-a'), ($2, 'CRM Batch1 Verify Org B', 'crm-batch1-verify-b')
       on conflict (id) do nothing`,
      [ORG_A, ORG_B],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values ($1, $2, 'viewer'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [VIEWER_USER, ORG_A, MEMBER_USER],
    );
    await client.query(
      `insert into leads (id, org_id, name, company, status) values
         ($1, $2, 'Convert Me', 'Acme Co', 'qualified'),
         ($3, $2, 'Lost Lead', 'Lost Co', 'lost')
       on conflict (id) do nothing`,
      [LEAD_ID, ORG_A, LOST_LEAD_ID],
    );
    await client.query("commit");

    // (a) Viewer cannot create a lead
    await assertApiError(
      withOrgContext(VIEWER_USER, (db) => requirePermission(db, VIEWER_USER, ORG_A, "lead", "create")),
      403,
      "viewer should not be able to create a lead",
    );
    console.log("PASS: viewer denied lead:create");

    // (b) convertLead creates account + contact and sets lead fields
    const result = await withOrgContext(MEMBER_USER, (db) => convertLead(db, ORG_A, null, LEAD_ID));
    assert(result.lead.status === "converted", "lead status should be converted");
    assert(result.lead.convertedAccountId === result.account.id, "lead.convertedAccountId should match created account");
    assert(result.lead.convertedContactId === result.contact.id, "lead.convertedContactId should match created contact");
    assert(result.account.name === "Acme Co", "account name should come from lead.companyName");
    assert(result.contact.fullName === "Convert Me", "contact name should come from lead.fullName");
    console.log("PASS: convertLead creates account+contact and updates the lead");

    // (c) Re-converting throws 400, no second account/contact
    await assertApiError(
      withOrgContext(MEMBER_USER, (db) => convertLead(db, ORG_A, null, LEAD_ID)),
      400,
      "re-converting an already-converted lead should throw 400",
    );
    const [{ acctCount }] = await withOrgContext(MEMBER_USER, async (db) => {
      const rows = await db.select().from(accounts).where(and(eq(accounts.orgId, ORG_A), eq(accounts.name, "Acme Co")));
      return [{ acctCount: rows.length }];
    });
    assert(acctCount === 1, "re-conversion must not create a second account");
    console.log("PASS: re-converting a converted lead throws 400 and does not duplicate");

    // (d) Converting a 'lost' lead throws 400
    await assertApiError(
      withOrgContext(MEMBER_USER, (db) => convertLead(db, ORG_A, null, LOST_LEAD_ID)),
      400,
      "converting a lost lead should throw 400",
    );
    console.log("PASS: converting a lost lead throws 400");

    // (e) requireLeadAssignAccess denies member (only owner/admin get lead:assign)
    await assertApiError(
      withOrgContext(MEMBER_USER, (db) => requireLeadAssignAccess(db, MEMBER_USER, ORG_A)),
      403,
      "member should not have lead:assign",
    );
    console.log("PASS: requireLeadAssignAccess denies a member");

    // (f) activities are org-scoped — an activity in Org A must not show up when filtered to Org B
    await withOrgContext(MEMBER_USER, (db) =>
      db.insert(activities).values({
        orgId: ORG_A,
        relatedType: "lead",
        relatedId: LEAD_ID,
        type: "note",
        subject: "Org A only note",
      }),
    );
    const orgBActivities = await withOrgContext(MEMBER_USER, (db) => db.select().from(activities).where(eq(activities.orgId, ORG_B)));
    assert(
      orgBActivities.every((a) => a.subject !== "Org A only note"),
      "an Org A activity must not appear when querying Org B's activities",
    );
    console.log("PASS: activities are correctly org-scoped");

    console.log("\nALL CRM BATCH 1 CHECKS PASSED");
  } finally {
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("delete from organizations where id in ($1, $2)", [ORG_A, ORG_B]);
    await client.query("commit");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
