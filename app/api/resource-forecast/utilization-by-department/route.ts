import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getUtilizationByDepartment } from "@/lib/api/resourceForecast";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    const year = parseInt(sp.get("year") ?? String(new Date().getFullYear()), 10);
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "resource_forecast", "view_all");
      return getUtilizationByDepartment(db, orgId, year);
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
