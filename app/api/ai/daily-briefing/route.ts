import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { generateAI } from "@/lib/ai/generate";

export async function POST(req: NextRequest) {
  try {
    await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.dashboard_data) {
      throw new ApiError(400, "org_id and dashboard_data are required");
    }

    const result = await generateAI("Analyst", "daily_briefing", {
      dashboard_data: body.dashboard_data,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
