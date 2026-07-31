import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { computeCheckoutStatus, getOrCreateSettings, requireAttendanceSelfAccess, resolveOwnEmployeeId } from "@/lib/api/attendance";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const orgId = body.org_id;
    if (!orgId) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) throw new ApiError(404, "No employee record linked to this account");
      await requireAttendanceSelfAccess(db, userId, orgId, employeeId);

      const today = new Date().toISOString().slice(0, 10);
      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.workDate, today)));
      if (!existing || !existing.checkInTime) throw new ApiError(409, "No active check-in for today");
      if (existing.checkOutTime) throw new ApiError(409, "Already checked out today");

      const checkOutTime = new Date();
      const totalMinutes = Math.round((checkOutTime.getTime() - existing.checkInTime.getTime()) / 60000);
      const settings = await getOrCreateSettings(db, orgId);
      const status = computeCheckoutStatus(totalMinutes, settings);

      const [updated] = await db
        .update(attendanceRecords)
        .set({
          checkOutTime,
          totalMinutes,
          status,
          checkOutNote: body.note ?? null,
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      return updated;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
