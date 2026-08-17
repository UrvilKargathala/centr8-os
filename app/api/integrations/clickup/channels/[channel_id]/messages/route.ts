import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpChatMessages, postClickUpChatMessage, withConnectedClickUp } from "@/lib/api/clickup";

type Params = { params: Promise<{ channel_id: string }> };

// Always fetched fresh (spec: "always fetch messages fresh when a channel
// is opened") — no caching here, unlike the channel list.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { channel_id } = await params;
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const messages = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (teamId, token) => fetchClickUpChatMessages(teamId, channel_id, token));
    });

    return NextResponse.json({ data: messages });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { channel_id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.message) throw new ApiError(400, "org_id and message are required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "read");
      return withConnectedClickUp(db, body.org_id, (teamId, token) => postClickUpChatMessage(teamId, channel_id, token, body.message));
    });

    return NextResponse.json({ data: { sent: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
