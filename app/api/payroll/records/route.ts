import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { payslipRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireCompensationViewAccess } from "@/lib/api/employees";

// Zero self-service in this pillar (unlike Attendance/Leave) — always
// requires compensation:view_sensitive, org-wide, even when filtering to
// a single employee_id. No self-view fallback exists here by design.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    const periodStart = req.nextUrl.searchParams.get("period_start");
    const periodEnd = req.nextUrl.searchParams.get("period_end");
    const status = req.nextUrl.searchParams.get("status");

    const rows = await withOrgContext(userId, async (db) => {
      await requireCompensationViewAccess(db, userId, orgId);
      const conditions = [eq(payslipRecords.orgId, orgId)];
      if (employeeId) conditions.push(eq(payslipRecords.employeeId, employeeId));
      if (periodStart) conditions.push(eq(payslipRecords.periodStart, periodStart));
      if (periodEnd) conditions.push(eq(payslipRecords.periodEnd, periodEnd));
      if (status) conditions.push(eq(payslipRecords.status, status as (typeof payslipRecords.status.enumValues)[number]));
      return db.select().from(payslipRecords).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
