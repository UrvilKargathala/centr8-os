import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { notifications } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

type Params = { params: Promise<{ id: string }> };

// Dismiss/delete one — RLS-gated to the caller's own notifications
// (notifications_delete: user_id = auth.uid()).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const [row] = await withOrgContext(userId, (db) => db.delete(notifications).where(eq(notifications.id, id)).returning({ id: notifications.id }));
    if (!row) throw new ApiError(404, "Notification not found");

    return NextResponse.json({ data: { id: row.id } });
  } catch (err) {
    return handleApiError(err);
  }
}
