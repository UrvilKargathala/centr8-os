import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireAttendanceEditAccess } from "@/lib/api/attendance";

type Params = { params: Promise<{ id: string }> };

// Editing an existing record (correcting times, status, notes) — always
// attendance:edit_any, always stamps edited_by/edited_at for the audit
// trail, whether the row started as a self check-in or a manual entry.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id));
      if (!existing) return undefined;
      await requireAttendanceEditAccess(db, userId, existing.orgId);

      const checkInTime = body.check_in_time === undefined ? undefined : body.check_in_time ? new Date(body.check_in_time) : null;
      const checkOutTime = body.check_out_time === undefined ? undefined : body.check_out_time ? new Date(body.check_out_time) : null;
      const resolvedCheckIn = checkInTime === undefined ? existing.checkInTime : checkInTime;
      const resolvedCheckOut = checkOutTime === undefined ? existing.checkOutTime : checkOutTime;
      const totalMinutes =
        resolvedCheckIn && resolvedCheckOut
          ? Math.round((resolvedCheckOut.getTime() - resolvedCheckIn.getTime()) / 60000)
          : undefined;

      const [updated] = await db
        .update(attendanceRecords)
        .set({
          checkInTime,
          checkOutTime,
          totalMinutes,
          status: body.status ?? undefined,
          checkInNote: body.check_in_note === undefined ? undefined : body.check_in_note,
          checkOutNote: body.check_out_note === undefined ? undefined : body.check_out_note,
          location: body.location === undefined ? undefined : body.location,
          locationDetail: body.location_detail === undefined ? undefined : body.location_detail,
          manualEntryReason: body.reason === undefined ? undefined : body.reason,
          editedBy: userId,
          editedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Attendance record not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
