import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { generateAI } from "@/lib/ai/generate";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const { org_id, summary_data } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");
    if (!summary_data) throw new ApiError(400, "summary_data is required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, org_id, "resource_forecast", "view_all");
    });

    const result = await generateAI("Analyst", "resource_forecast_insights", {
      data: summary_data,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
