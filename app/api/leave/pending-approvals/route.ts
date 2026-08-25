import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listPendingLeaveApprovals } from "@/lib/api/leave";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, (db) => listPendingLeaveApprovals(db, userId, orgId));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
