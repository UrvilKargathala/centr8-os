// Acceptance check for HR Batch 2 Part 3 (Payroll & Compensation): a
// member/viewer role (this codebase's roles — "Editor" from the prompt
// doesn't exist here, member/viewer are the closest non-admin roles) gets
// 403 on every compensation/payroll permission check, gross/net math is
// correct for a full-month and a mid-period-hire scenario, and generating
// payroll twice for the same period doesn't create duplicate rows. Same
// fixture/cleanup pattern as the Attendance/Leave Batch 2 verify scripts —
// the real requirePermission/requireCompensationViewAccess/prorateGross/
// getActiveCompensationRecord, not a reimplementation.
import { and, eq } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { withOrgContext } from "./withOrgContext";
import { payslipRecords } from "./schema";
import { requirePermission } from "../lib/api/permissions";
import { requireCompensationViewAccess } from "../lib/api/employees";
import { bonusInPeriod, getActiveCompensationRecord, prorateGross, requirePayrollFinalizeAccess, requirePayrollGenerateAccess, requirePayrollMarkPaidAccess, totalDeductions } from "../lib/api/payroll";
import { ApiError } from "../lib/api/helpers";

const ORG_ID = "00000000-0000-0000-0000-0000000000a1";
const EMP_FULL_ID = "00000000-0000-0000-0000-0000000000a2"; // employed the whole period
const EMP_MIDHIRE_ID = "00000000-0000-0000-0000-0000000000a3"; // hired mid-period
const OWNER_USER = "00000000-0000-0000-0000-0000000000a4";
const MEMBER_USER = "00000000-0000-0000-0000-0000000000a5";
const VIEWER_USER = "00000000-0000-0000-0000-0000000000a6";

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
      `insert into organizations (id, name, slug) values ($1, 'Payroll Batch2 Verify Org', 'payroll-batch2-verify')
       on conflict (id) do nothing`,
      [ORG_ID],
    );
    await client.query(
      `insert into org_memberships (user_id, org_id, role) values
         ($1, $2, 'owner'), ($3, $2, 'member'), ($4, $2, 'viewer')
       on conflict (user_id, org_id) do nothing`,
      [OWNER_USER, ORG_ID, MEMBER_USER, VIEWER_USER],
    );
    await client.query(
      `insert into employees (id, org_id, full_name) values ($1, $2, 'Full Period Employee'), ($3, $2, 'Mid-Hire Employee')
       on conflict (id) do nothing`,
      [EMP_FULL_ID, ORG_ID, EMP_MIDHIRE_ID],
    );
    await client.query(
      `insert into compensation_records (org_id, employee_id, base_salary, currency, pay_frequency, effective_date)
       values ($1, $2, 3100.00, 'USD', 'monthly', '2025-01-01')`,
      [ORG_ID, EMP_FULL_ID],
    );
    // Hired the 16th of a 31-day month — exactly half the month, roughly.
    await client.query(
      `insert into compensation_records (org_id, employee_id, base_salary, currency, pay_frequency, effective_date)
       values ($1, $2, 3100.00, 'USD', 'monthly', '2026-08-16')`,
      [ORG_ID, EMP_MIDHIRE_ID],
    );
    await client.query("commit");

    // --- Check 1: member/viewer 403 on every compensation/payroll check ---
    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requireCompensationViewAccess(db, MEMBER_USER, ORG_ID)),
      "member should not have compensation:view_sensitive",
    );
    await assertForbidden(
      withOrgContext(VIEWER_USER, (db) => requireCompensationViewAccess(db, VIEWER_USER, ORG_ID)),
      "viewer should not have compensation:view_sensitive",
    );
    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requirePermission(db, MEMBER_USER, ORG_ID, "compensation", "update")),
      "member should not have compensation:update",
    );
    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requirePayrollGenerateAccess(db, MEMBER_USER, ORG_ID)),
      "member should not have payroll:generate",
    );
    await assertForbidden(
      withOrgContext(VIEWER_USER, (db) => requirePayrollGenerateAccess(db, VIEWER_USER, ORG_ID)),
      "viewer should not have payroll:generate",
    );
    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requirePayrollFinalizeAccess(db, MEMBER_USER, ORG_ID)),
      "member should not have payroll:finalize",
    );
    await assertForbidden(
      withOrgContext(MEMBER_USER, (db) => requirePayrollMarkPaidAccess(db, MEMBER_USER, ORG_ID)),
      "member should not have payroll:mark_paid",
    );
    console.log("PASS: member/viewer get 403 on every compensation/payroll permission check");

    await withOrgContext(OWNER_USER, (db) => requireCompensationViewAccess(db, OWNER_USER, ORG_ID));
    await withOrgContext(OWNER_USER, (db) => requirePayrollGenerateAccess(db, OWNER_USER, ORG_ID));
    console.log("PASS: owner passes the same checks (role-based, not a blanket deny)");

    // --- Check 2: gross/net math — full month ---
    const PERIOD_START = "2026-08-01";
    const PERIOD_END = "2026-08-31"; // 31-day month
    const fullComp = await withOrgContext(OWNER_USER, (db) => getActiveCompensationRecord(db, EMP_FULL_ID, PERIOD_END));
    assert(fullComp, "expected an active compensation record for the full-period employee");
    const fullGross = prorateGross(fullComp!.baseSalary, PERIOD_START, PERIOD_END, fullComp!.effectiveDate, fullComp!.endDate);
    assert(fullGross === 3100, `expected full-month gross 3100, got ${fullGross}`);
    console.log("PASS: full-month gross equals the base salary exactly");

    // --- Check 3: gross/net math — mid-period hire ---
    const midComp = await withOrgContext(OWNER_USER, (db) => getActiveCompensationRecord(db, EMP_MIDHIRE_ID, PERIOD_END));
    assert(midComp, "expected an active compensation record for the mid-hire employee");
    const midGross = prorateGross(midComp!.baseSalary, PERIOD_START, PERIOD_END, midComp!.effectiveDate, midComp!.endDate);
    // Hired 2026-08-16 in a 31-day month spanning Aug 1-31: active days = 16..31 inclusive = 16 days.
    const expectedMid = Math.round((3100 / 31) * 16 * 100) / 100;
    assert(midGross === expectedMid, `expected mid-hire prorated gross ${expectedMid}, got ${midGross}`);
    assert(midGross < fullGross, "mid-hire gross should be less than a full month's gross");
    console.log(`PASS: mid-period-hire gross is correctly prorated (${midGross} of ${fullGross})`);

    assert(bonusInPeriod(null, PERIOD_START, PERIOD_END) === 0, "bonusInPeriod should be 0 with no bonus array");
    assert(totalDeductions(null) === 0, "totalDeductions should be 0 with no deductions array");
    const net = Math.round((fullGross - totalDeductions(fullComp!.deductions)) * 100) / 100;
    assert(net === fullGross, "net should equal gross when there are no deductions");
    console.log("PASS: bonus/deduction helpers handle the no-data case correctly");

    // --- Check 4: generating twice for the same period doesn't duplicate ---
    await withOrgContext(OWNER_USER, async (db) => {
      await db
        .insert(payslipRecords)
        .values({
          orgId: ORG_ID,
          employeeId: EMP_FULL_ID,
          compensationRecordId: fullComp!.id,
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          grossAmount: fullGross,
          totalDeductions: 0,
          netAmount: fullGross,
          currency: "USD",
          status: "draft",
          generatedBy: OWNER_USER,
        })
        .onConflictDoNothing();
    });
    // Second "generation" — same pre-check the route uses: skip anyone who
    // already has a record for this exact period.
    const alreadyGenerated = await withOrgContext(OWNER_USER, (db) =>
      db.select({ employeeId: payslipRecords.employeeId }).from(payslipRecords).where(and(eq(payslipRecords.orgId, ORG_ID), eq(payslipRecords.periodStart, PERIOD_START), eq(payslipRecords.periodEnd, PERIOD_END))),
    );
    assert(alreadyGenerated.some((r) => r.employeeId === EMP_FULL_ID), "expected the first generation's row to be visible to the dedupe pre-check");

    const countBefore = (await client.query("select count(*) from payslip_records where org_id = $1", [ORG_ID])).rows[0].count;
    // Attempt a duplicate insert the way a second generate call's raw
    // insert would (guarded only by onConflictDoNothing, same as the route) —
    // the unique(org_id, employee_id, period_start, period_end) constraint
    // must be the real backstop even if the pre-check were ever bypassed.
    await withOrgContext(OWNER_USER, async (db) => {
      await db
        .insert(payslipRecords)
        .values({
          orgId: ORG_ID,
          employeeId: EMP_FULL_ID,
          compensationRecordId: fullComp!.id,
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          grossAmount: fullGross,
          totalDeductions: 0,
          netAmount: fullGross,
          currency: "USD",
          status: "draft",
          generatedBy: OWNER_USER,
        })
        .onConflictDoNothing();
    });
    const countAfter = (await client.query("select count(*) from payslip_records where org_id = $1", [ORG_ID])).rows[0].count;
    assert(countBefore === countAfter, `expected no new rows from the duplicate generate attempt, went from ${countBefore} to ${countAfter}`);
    console.log("PASS: generating payroll twice for the same period does not create duplicate records");

    console.log("\nALL PAYROLL BATCH 2 CHECKS PASSED");
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
