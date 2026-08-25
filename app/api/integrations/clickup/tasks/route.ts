import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpTasks, withConnectedClickUp } from "@/lib/api/clickup";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const tasks = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token, config) => fetchClickUpTasks(teamId, token, config.selected_list_id));
    });

    return NextResponse.json({ data: tasks });
  } catch (err) {
    return handleApiError(err);
  }
}
