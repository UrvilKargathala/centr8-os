import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, payslipRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { bonusInPeriod, getActiveCompensationRecord, prorateGross, requirePayrollGenerateAccess, totalDeductions } from "@/lib/api/payroll";

// For each employee: finds their active compensation_records row for the
// period, computes gross (prorated) + bonus-in-period + deductions, and
// creates a draft payslip_records row. Skips anyone who already has a
// record for this exact period (the unique constraint is the real
// backstop; this pre-check just avoids a noisy insert-conflict per
// employee) and anyone with no active compensation record to generate from.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const orgId = body.org_id;
    if (!orgId || !body.period_start || !body.period_end) {
      throw new ApiError(400, "org_id, period_start, and period_end are required");
    }

    const result = await withOrgContext(userId, async (db) => {
      await requirePayrollGenerateAccess(db, userId, orgId);

      const allEmployees = await db.select({ id: employees.id }).from(employees).where(eq(employees.orgId, orgId));
      const targetIds =
        body.employee_ids === "all" || !body.employee_ids
          ? allEmployees.map((e) => e.id)
          : (body.employee_ids as string[]);

      const existing = await db
        .select({ employeeId: payslipRecords.employeeId })
        .from(payslipRecords)
        .where(and(eq(payslipRecords.orgId, orgId), eq(payslipRecords.periodStart, body.period_start), eq(payslipRecords.periodEnd, body.period_end)));
      const alreadyGenerated = new Set(existing.map((e) => e.employeeId));

      const created = [];
      const skippedNoCompRecord: string[] = [];
      let skippedAlreadyGenerated = 0;
      for (const employeeId of targetIds) {
        if (alreadyGenerated.has(employeeId)) {
          skippedAlreadyGenerated++;
          continue;
        }

        const comp = await getActiveCompensationRecord(db, employeeId, body.period_end);
        if (!comp) {
          skippedNoCompRecord.push(employeeId);
          continue;
        }

        const grossFromSalary = prorateGross(comp.baseSalary, body.period_start, body.period_end, comp.effectiveDate, comp.endDate);
        const grossBonus = bonusInPeriod(comp.bonus, body.period_start, body.period_end);
        const gross = Math.round((grossFromSalary + grossBonus) * 100) / 100;
        const deductions = totalDeductions(comp.deductions);
        const net = Math.round((gross - deductions) * 100) / 100;

        const [row] = await db
          .insert(payslipRecords)
          .values({
            orgId,
            employeeId,
            compensationRecordId: comp.id,
            periodStart: body.period_start,
            periodEnd: body.period_end,
            grossAmount: gross,
            totalDeductions: deductions,
            netAmount: net,
            currency: comp.currency,
            status: "draft",
            generatedBy: userId,
          })
          .onConflictDoNothing()
          .returning();
        if (row) created.push(row);
      }

      return { created, skipped_already_generated: skippedAlreadyGenerated, skipped_no_compensation_record: skippedNoCompRecord.length };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
