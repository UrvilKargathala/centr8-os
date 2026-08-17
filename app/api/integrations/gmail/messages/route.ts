import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { withConnectedGmail, listGmailMessages } from "@/lib/api/gmail";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const q = sp.get("q") ?? undefined;
    const label = sp.get("label") ?? undefined;
    const pageToken = sp.get("page_token") ?? undefined;

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "integration", "read");
      return withConnectedGmail(db, orgId, (accessToken) =>
        listGmailMessages(accessToken, {
          q,
          labelIds: label ? [label] : undefined,
          maxResults: 20,
          pageToken,
        }),
      );
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
