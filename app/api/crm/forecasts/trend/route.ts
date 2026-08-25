import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getForecastTrend } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const periodType = params.get("period_type") ?? "monthly";
    const count = Number(params.get("count") ?? 6);

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      return getForecastTrend(db, orgId, periodType, count);
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
