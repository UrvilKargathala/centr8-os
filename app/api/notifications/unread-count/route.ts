import { NextRequest, NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { notifications } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

// Fast count-only query for the bell badge — RLS scopes to the caller's own
// unread rows, so no explicit user_id filter is needed here either.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const [row] = await withOrgContext(userId, (db) =>
      db
        .select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.orgId, orgId), eq(notifications.isRead, false))),
    );

    return NextResponse.json({ data: { count: row?.count ?? 0 } });
  } catch (err) {
    return handleApiError(err);
  }
}
