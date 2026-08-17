import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpWorkspaceMembers, withConnectedClickUp } from "@/lib/api/clickup";

// Workspace member list, for the "+ New DM" picker — GET /team/{team_id}
// (v2), the same endpoint validateClickUpToken already touches.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const members = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token) => fetchClickUpWorkspaceMembers(teamId, token));
    });

    return NextResponse.json({ data: members });
  } catch (err) {
    return handleApiError(err);
  }
}
