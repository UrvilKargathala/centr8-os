import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getWorkload } from "@/lib/api/resourceForecast";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    const weekStart = sp.get("week_start");
    const weeksCount = parseInt(sp.get("weeks_count") ?? "12", 10);
    if (!orgId) throw new ApiError(400, "org_id is required");
    if (!weekStart) throw new ApiError(400, "week_start is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "resource_forecast", "view_all");
      return getWorkload(db, orgId, weekStart, weeksCount);
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
