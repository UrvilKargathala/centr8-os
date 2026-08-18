import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getActiveProjects } from "@/lib/api/resourceForecast";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "resource_forecast", "read");
      return getActiveProjects(db, orgId);
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
