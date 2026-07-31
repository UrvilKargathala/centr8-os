import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";
import { settlePendingDays } from "@/lib/api/leave";

type Params = { params: Promise<{ id: string }> };

// Own pending request only — cancelling an already-approved leave needs a
// separate flow (e.g. notifying whoever's covering) that doesn't exist
// yet. TODO: "cancel approved leave" once that process is defined.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "leave", "request_own");
      const ownId = await resolveOwnEmployeeId(db, userId, existing.orgId);
      if (!ownId || ownId !== existing.employeeId) throw new ApiError(403, "You can only cancel your own leave requests");
      if (existing.status !== "pending") throw new ApiError(409, "Only a pending request can be cancelled");

      const [updated] = await db
        .update(leaveRequests)
        .set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: body.cancellation_reason ?? null })
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
