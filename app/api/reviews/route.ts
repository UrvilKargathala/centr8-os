import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { performanceReviews } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Org-wide, HR-admin only — filterable by cycle/status (department
// filtering happens client-side by joining against the employee list,
// same pattern the Attendance/Leave org-wide views use).
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const cycleId = req.nextUrl.searchParams.get("cycle_id");
    const status = req.nextUrl.searchParams.get("status");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "review", "view_all");
      const conditions = [eq(performanceReviews.orgId, orgId)];
      if (cycleId) conditions.push(eq(performanceReviews.cycleId, cycleId));
      if (status) conditions.push(eq(performanceReviews.status, status as (typeof performanceReviews.status.enumValues)[number]));
      return db.select().from(performanceReviews).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
