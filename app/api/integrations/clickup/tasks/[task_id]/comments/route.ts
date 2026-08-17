import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { fetchClickUpComments, postClickUpComment, withConnectedClickUp } from "@/lib/api/clickup";

type Params = { params: Promise<{ task_id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { task_id } = await params;
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const comments = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedClickUp(db, orgId, (_teamId, token) => fetchClickUpComments(task_id, token));
    });

    return NextResponse.json({ data: comments });
  } catch (err) {
    return handleApiError(err);
  }
}

// Posting a comment isn't a sensitive admin action — same integration:read
// gate as viewing, not integration:configure (that's reserved for
// connecting/disconnecting the workspace itself).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { task_id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.comment_text) throw new ApiError(400, "org_id and comment_text are required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "integration", "read");
      return withConnectedClickUp(db, body.org_id, (_teamId, token) => postClickUpComment(task_id, token, body.comment_text));
    });

    return NextResponse.json({ data: { posted: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
