// Acceptance check for HR Batch 2 (Leave Management self-service): a
// member cannot approve their own leave request without being a manager
// or holding leave:view_all (403), a member cannot view another
// employee's leave without permission (403), and balance math is correct
// across create->approve and create->reject paths. Same fixture/cleanup
// pattern as db/test-attendance-batch2-verify.ts — the real
// requireLeaveApproveAccess/requireLeaveViewAccess/getOrCreateBalance/
// settlePendingDays, not a reimplementation.
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import {
  countLeaveDays,
  getOrCreateBalance,
  requireLeaveApproveAccess,
  requireLeaveViewAccess,
  settlePendingDays,
} from "../lib/api/leave";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000f1";
const EMP_A_ID = "00000000-0000-0000-0000-0000000000f2"; // requester
const EMP_B_ID = "00000000-0000-0000-0000-0000000000f3"; // unrelated employee
const ADMIN_USER = "00000000-0000-0000-0000-0000000000f4";
const MEMBER_A_USER = "00000000-0000-0000-0000-0000000000f5"; // linked to employee A, not a manager
const LEAVE_TYPE_ID = "00000000-0000-0000-0000-0000000000f6";

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
      `insert into organizations (id, name, slug) values ($1, 'Leave Batch2 Verify Org', 'leave-batch2-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'admin'), ($3, $2, 'member')
       on conflict (user_id, org_id) do nothing`,
      [ADMIN_USER, ORG_ID, MEMBER_A_USER],
    );
    await client.query(
      `insert into employees (id, org_id, user_id, full_name) values
         ($1, $2, $3, 'Employee A'), ($4, $2, null, 'Employee B')
       on conflict (id) do nothing`,
      [EMP_A_ID, ORG_ID, MEMBER_A_USER, EMP_B_ID],
    );
    await client.query(
      `insert into leave_types (id, org_id, name, is_paid, is_active) values ($1, $2, 'Verify Leave', true, true)
       on conflict (id) do nothing`,
      [LEAVE_TYPE_ID, ORG_ID],
    );
    await client.query(
      `insert into leave_policies (org_id, leave_type_id, name, applies_to, annual_allotment_days, effective_from)
       values ($1, $2, 'Verify Policy', 'all', 10, '2026-01-01')
       on conflict do nothing`,
      [ORG_ID, LEAVE_TYPE_ID],
    );
    await client.query("commit");

    // --- Check 1: member cannot approve without being a manager or
    // holding leave:view_all — this is the exact check
    // POST /api/leave/request/[id]/approve runs ---
    await assertForbidden(
      withOrgContext(MEMBER_A_USER, (db) => requireLeaveApproveAccess(db, MEMBER_A_USER, ORG_ID, EMP_A_ID)),
      "member should not be able to approve their own leave request",
    );
    console.log("PASS: member hitting the approve auth check on their own request gets a 403");

    await withOrgContext(ADMIN_USER, (db) => requireLeaveApproveAccess(db, ADMIN_USER, ORG_ID, EMP_A_ID));
    console.log("PASS: admin (view_all) passes the approve auth check");

    // --- Check 2: member cannot view another employee's leave ---
    await assertForbidden(
      withOrgContext(MEMBER_A_USER, (db) => requireLeaveViewAccess(db, MEMBER_A_USER, ORG_ID, EMP_B_ID)),
      "member A should not be able to view employee B's leave",
    );
    console.log("PASS: member A hitting employee B's leave view check gets a 403");

    await withOrgContext(MEMBER_A_USER, (db) => requireLeaveViewAccess(db, MEMBER_A_USER, ORG_ID, EMP_A_ID));
    console.log("PASS: member A can view their own leave");

    // --- Check 3: weekday-exclusive day counting ---
    const days = await withOrgContext(ADMIN_USER, (db) => countLeaveDays(db, ORG_ID, "2026-08-03", "2026-08-07")); // Mon-Fri
    assert(days === 5, `expected 5 weekdays Mon-Fri, got ${days}`);
    const daysAcrossWeekend = await withOrgContext(ADMIN_USER, (db) => countLeaveDays(db, ORG_ID, "2026-08-03", "2026-08-10")); // Mon-Mon, spans a weekend
    assert(daysAcrossWeekend === 6, `expected 6 weekdays spanning a weekend, got ${daysAcrossWeekend}`);
    console.log("PASS: weekday-exclusive day counting excludes weekends correctly");

    // --- Check 4: balance math across create -> approve ---
    const year = 2026;
    const totalDays = 3;
    let balance = await withOrgContext(ADMIN_USER, (db) => getOrCreateBalance(db, ORG_ID, EMP_A_ID, LEAVE_TYPE_ID, year));
    assert(balance !== null, "balance should lazily initialize from the policy");
    assert(balance!.allottedDays === 10, `expected allotted_days 10 from policy, got ${balance!.allottedDays}`);

    // simulate creation: pending_days += totalDays (what POST /api/leave/request does)
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("update leave_balances set pending_days = pending_days + $1 where id = $2", [totalDays, balance!.id]);
    await client.query("commit");

    await withOrgContext(ADMIN_USER, (db) => settlePendingDays(db, ORG_ID, EMP_A_ID, LEAVE_TYPE_ID, "2026-08-03", totalDays, "approved"));
    const afterApprove = await client.query("select used_days, pending_days from leave_balances where id = $1", [balance!.id]);
    assert(Number(afterApprove.rows[0].used_days) === totalDays, `expected used_days ${totalDays} after approval, got ${afterApprove.rows[0].used_days}`);
    assert(Number(afterApprove.rows[0].pending_days) === 0, `expected pending_days 0 after approval, got ${afterApprove.rows[0].pending_days}`);
    console.log("PASS: approve path moves pending_days -> used_days correctly");

    // --- Check 5: balance math across create -> reject (no used_days change) ---
    await client.query("begin");
    await client.query("set role service_role");
    await client.query("update leave_balances set pending_days = pending_days + $1 where id = $2", [totalDays, balance!.id]);
    await client.query("commit");

    await withOrgContext(ADMIN_USER, (db) => settlePendingDays(db, ORG_ID, EMP_A_ID, LEAVE_TYPE_ID, "2026-09-03", totalDays, "released"));
    const afterReject = await client.query("select used_days, pending_days from leave_balances where id = $1", [balance!.id]);
    assert(Number(afterReject.rows[0].used_days) === totalDays, `used_days should stay ${totalDays} (unchanged from the approve above) after a reject, got ${afterReject.rows[0].used_days}`);
    assert(Number(afterReject.rows[0].pending_days) === 0, `expected pending_days back to 0 after reject, got ${afterReject.rows[0].pending_days}`);
    console.log("PASS: reject/cancel path releases pending_days without touching used_days");

    console.log("\nALL LEAVE BATCH 2 CHECKS PASSED");
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
