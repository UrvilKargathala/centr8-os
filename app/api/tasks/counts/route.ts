import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getTaskCounts } from "@/lib/api/tasks";

// Rollup of task counts by status + overdue + created-in-last-7-days trends.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, (db) => getTaskCounts(db, orgId));
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
