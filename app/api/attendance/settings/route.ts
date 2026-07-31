import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { attendanceSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateSettings, requireAttendanceEditAccess } from "@/lib/api/attendance";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "attendance", "view_own");
      return getOrCreateSettings(db, orgId);
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      await requireAttendanceEditAccess(db, userId, body.org_id);
      await getOrCreateSettings(db, body.org_id); // ensure a row exists to update

      const [updated] = await db
        .update(attendanceSettings)
        .set({
          workdayStartTime: body.workday_start_time ?? undefined,
          workdayEndTime: body.workday_end_time ?? undefined,
          workdayHoursTarget: body.workday_hours_target ?? undefined,
          minHoursForFullDay: body.min_hours_for_full_day ?? undefined,
          minHoursForHalfDay: body.min_hours_for_half_day ?? undefined,
          weekendDays: body.weekend_days ?? undefined,
          requireLocation: body.require_location ?? undefined,
          requireNoteOnLateCheckin: body.require_note_on_late_checkin ?? undefined,
          lateCheckinThresholdMinutes: body.late_checkin_threshold_minutes ?? undefined,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(attendanceSettings.orgId, body.org_id))
        .returning();
      return updated;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
