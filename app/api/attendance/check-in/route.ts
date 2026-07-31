import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getOrCreateSettings, requestIp, requireAttendanceSelfAccess, resolveOwnEmployeeId } from "@/lib/api/attendance";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const orgId = body.org_id;
    if (!orgId) throw new ApiError(400, "org_id is required");

    // Captured server-side from the request itself — never trusted from
    // the client body (Batch 2 constraint).
    const ipAddress = requestIp(req);
    const deviceInfo = req.headers.get("user-agent");

    const row = await withOrgContext(userId, async (db) => {
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) throw new ApiError(404, "No employee record linked to this account");
      await requireAttendanceSelfAccess(db, userId, orgId, employeeId);

      const settings = await getOrCreateSettings(db, orgId);
      if (settings.requireLocation && !body.location) {
        throw new ApiError(400, "Location is required to check in");
      }

      const today = new Date().toISOString().slice(0, 10);
      const [existing] = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.workDate, today)));
      if (existing) throw new ApiError(409, "Already checked in today");

      const [created] = await db
        .insert(attendanceRecords)
        .values({
          orgId,
          employeeId,
          workDate: today,
          checkInTime: new Date(),
          status: "checked_in",
          checkInNote: body.note ?? null,
          location: body.location ?? null,
          locationDetail: body.location_detail ?? null,
          ipAddress,
          deviceInfo,
        })
        .returning();
      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
