import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listNotifications } from "@/lib/api/notifications";

// No permission gate — RLS alone scopes every row to its recipient
// (notifications_select: user_id = auth.uid()), same reasoning as
// ai_conversations. unread_only + limit/offset for the dropdown (small
// page) vs. the full /notifications page (paginated).
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const unreadOnly = params.get("unread_only") === "true";
    const limitParam = Number(params.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;
    const offsetParam = Number(params.get("offset") ?? "0");
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const rows = await withOrgContext(userId, (db) => listNotifications(db, orgId, { unreadOnly, limit, offset }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
