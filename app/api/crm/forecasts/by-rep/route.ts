import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getForecastByRep } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    const periodStart = params.get("period_start");
    const periodEnd = params.get("period_end");
    const period = params.get("period");
    if (!orgId || !periodStart || !periodEnd) throw new ApiError(400, "org_id, period_start, and period_end are required");

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      return getForecastByRep(db, orgId, periodStart, periodEnd, period);
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
