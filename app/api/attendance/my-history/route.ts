import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const startDate = req.nextUrl.searchParams.get("start_date");
    const endDate = req.nextUrl.searchParams.get("end_date");
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30") || 30, 200);
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0") || 0;

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "attendance", "view_own");
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) return [];

      const conditions = [eq(attendanceRecords.employeeId, employeeId)];
      if (startDate) conditions.push(gte(attendanceRecords.workDate, startDate));
      if (endDate) conditions.push(lte(attendanceRecords.workDate, endDate));

      return db
        .select()
        .from(attendanceRecords)
        .where(and(...conditions))
        .orderBy(desc(attendanceRecords.workDate))
        .limit(limit)
        .offset(offset);
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
