import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { withConnectedGmail, getGmailThread } from "@/lib/api/gmail";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: threadId } = await params;
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedGmail(db, orgId, (accessToken) => getGmailThread(accessToken, threadId));
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
