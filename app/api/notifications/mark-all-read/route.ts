import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { notifications } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

// RLS's notifications_update policy (user_id = auth.uid()) is what actually
// enforces "only the caller's own rows" here — the WHERE clause below is
// belt-and-suspenders, not the real guard.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, (db) =>
      db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.orgId, body.org_id), eq(notifications.isRead, false)))
        .returning({ id: notifications.id }),
    );

    return NextResponse.json({ data: { updated: rows.length } });
  } catch (err) {
    return handleApiError(err);
  }
}
