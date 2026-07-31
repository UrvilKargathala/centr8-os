import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords, employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireAttendanceViewAccess } from "@/lib/api/attendance";

type Params = { params: Promise<{ id: string }> };

// History for a specific employee — used by the Employee Detail Attendance
// tab. Gated by attendance:view_all OR (attendance:view_own AND the
// requester's own linked employee row is this one).
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const startDate = req.nextUrl.searchParams.get("start_date");
    const endDate = req.nextUrl.searchParams.get("end_date");

    const rows = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!emp) return undefined;
      await requireAttendanceViewAccess(db, userId, emp.orgId, id);

      const conditions = [eq(attendanceRecords.employeeId, id)];
      if (startDate) conditions.push(gte(attendanceRecords.workDate, startDate));
      if (endDate) conditions.push(lte(attendanceRecords.workDate, endDate));

      return db
        .select()
        .from(attendanceRecords)
        .where(and(...conditions))
        .orderBy(desc(attendanceRecords.workDate));
    });
    if (rows === undefined) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
