import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireLeaveApproveAccess, settlePendingDays } from "@/lib/api/leave";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.review_note) throw new ApiError(400, "review_note is required when rejecting a request");

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return undefined;
      if (existing.status !== "pending") throw new ApiError(409, "This request was already decided");

      await requireLeaveApproveAccess(db, userId, existing.orgId, existing.employeeId);

      const [updated] = await db
        .update(leaveRequests)
        .set({ status: "rejected", reviewedBy: userId, reviewedAt: new Date(), reviewNote: body.review_note })
        .where(eq(leaveRequests.id, id))
        .returning();

      await settlePendingDays(db, existing.orgId, existing.employeeId, existing.leaveTypeId, existing.startDate, existing.totalDays, "released");

      return updated;
    });
    if (!row) throw new ApiError(404, "Leave request not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
