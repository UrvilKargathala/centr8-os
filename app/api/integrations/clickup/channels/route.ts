import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpChatChannels, withConnectedClickUp } from "@/lib/api/clickup";

// Channel list is cached 60s server-side (lib/api/clickup.ts) — this route
// itself always calls through, the cache lives one layer down.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const channels = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token) => fetchClickUpChatChannels(teamId, token));
    });

    return NextResponse.json({ data: channels });
  } catch (err) {
    return handleApiError(err);
  }
}
