import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { notifications } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

type Params = { params: Promise<{ id: string }> };

// Update is RLS-gated to the caller's own notifications
// (notifications_update: user_id = auth.uid()) — a mismatched id just
// updates 0 rows, which we surface as a 404 rather than a silent no-op.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const [row] = await withOrgContext(userId, (db) =>
      db.update(notifications).set({ isRead: true, readAt: new Date() }).where(eq(notifications.id, id)).returning(),
    );
    if (!row) throw new ApiError(404, "Notification not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
