import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Org-wide only for now — requires leave:view_all. TODO: a manager-scoped
// version (their own reports' leave, without full org visibility) once
// there's a real use case for it; building the broad version first per
// the Batch 2 spec.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const startDate = req.nextUrl.searchParams.get("start_date");
    const endDate = req.nextUrl.searchParams.get("end_date");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "view_all");
      const conditions = [eq(leaveRequests.orgId, orgId), inArray(leaveRequests.status, ["approved", "pending"])];
      if (startDate) conditions.push(gte(leaveRequests.endDate, startDate));
      if (endDate) conditions.push(lte(leaveRequests.startDate, endDate));
      return db.select().from(leaveRequests).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
