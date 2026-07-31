import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { rejectSprintPlan } from "@/lib/api/aiAssistant";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.rejection_reason) throw new ApiError(400, "rejection_reason is required");

    const result = await withOrgContext(userId, (db) => rejectSprintPlan(db, userId, id, body.rejection_reason));
    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
