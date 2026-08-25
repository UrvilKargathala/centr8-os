import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";
import { getMyLeaveRequests } from "@/lib/api/leave";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const status = req.nextUrl.searchParams.get("status");

    if (!status) {
      const data = await withOrgContext(userId, (db) => getMyLeaveRequests(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "view_own");
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) return [];

      const conditions = [eq(leaveRequests.employeeId, employeeId)];
      if (status) conditions.push(eq(leaveRequests.status, status as (typeof leaveRequests.status.enumValues)[number]));

      return db
        .select()
        .from(leaveRequests)
        .where(and(...conditions))
        .orderBy(desc(leaveRequests.requestedAt));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
