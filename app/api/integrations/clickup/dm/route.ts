import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { createClickUpChatDM, withConnectedClickUp } from "@/lib/api/clickup";

// Idempotent on ClickUp's side — calling this again with the same
// member_ids returns the existing DM channel rather than creating a
// duplicate (verified against the live API).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !Array.isArray(body.member_ids) || body.member_ids.length === 0) {
      throw new ApiError(400, "org_id and a non-empty member_ids array are required");
    }

    const channel = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "read");
      return withConnectedClickUp(db, body.org_id, (teamId, token) => createClickUpChatDM(teamId, token, body.member_ids));
    });

    return NextResponse.json({ data: channel }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
