import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getSummary } from "@/lib/api/resourceForecast";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    const periodStart = sp.get("period_start");
    const periodEnd = sp.get("period_end");
    if (!orgId) throw new ApiError(400, "org_id is required");
    if (!periodStart || !periodEnd) throw new ApiError(400, "period_start and period_end are required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "resource_forecast", "view_all");
      return getSummary(db, orgId, periodStart, periodEnd);
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
