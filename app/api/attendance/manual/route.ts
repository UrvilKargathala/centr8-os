import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords, employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireAttendanceEditAccess } from "@/lib/api/attendance";

// HR admin backfill/correction path — replaces the old admin-console
// "record on someone's behalf" flow now that check-in/out is self-service.
// Still gated to attendance:edit_any, and always flagged is_manual_entry so
// it's distinguishable from a real self check-in in history/reporting.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.employee_id || !body.work_date) throw new ApiError(400, "employee_id and work_date are required");
    if (!body.reason) throw new ApiError(400, "reason is required for a manual entry");

    const row = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, body.employee_id));
      if (!emp) return undefined;
      await requireAttendanceEditAccess(db, userId, emp.orgId);

      const [existing] = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, body.employee_id), eq(attendanceRecords.workDate, body.work_date)));
      if (existing) throw new ApiError(409, "A record already exists for this employee on this date — edit it instead");

      const checkInTime = body.check_in_time ? new Date(body.check_in_time) : null;
      const checkOutTime = body.check_out_time ? new Date(body.check_out_time) : null;
      const totalMinutes = checkInTime && checkOutTime ? Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000) : null;

      const [created] = await db
        .insert(attendanceRecords)
        .values({
          orgId: emp.orgId,
          employeeId: body.employee_id,
          workDate: body.work_date,
          checkInTime,
          checkOutTime,
          totalMinutes,
          status: body.status ?? (checkOutTime ? "checked_out" : checkInTime ? "checked_in" : "absent"),
          checkInNote: body.note ?? null,
          isManualEntry: true,
          manualEntryReason: body.reason,
          editedBy: userId,
          editedAt: new Date(),
        })
        .returning();
      return created;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
