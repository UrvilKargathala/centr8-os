import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, leaveBalances, leaveRequests } from "@/db/schema";
import { and } from "drizzle-orm";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";
import { settlePendingDays } from "@/lib/api/leave";
import { createNotification } from "@/lib/notifications/create";

type Params = { params: Promise<{ id: string }> };

// Own leave cancellation — pending or approved. Pending releases pending_days;
// approved reverses used_days back to available. Rejected/cancelled/expired
// requests can't be cancelled.
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
      if (existing.status !== "pending" && existing.status !== "approved") {
        throw new ApiError(409, "Only pending or approved requests can be cancelled");
      }

      const [updated] = await db
        .update(leaveRequests)
        .set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: body.cancellation_reason ?? null })
        .where(eq(leaveRequests.id, id))
        .returning();

      if (existing.status === "pending") {
        await settlePendingDays(db, existing.orgId, existing.employeeId, existing.leaveTypeId, existing.startDate, existing.totalDays, "released");
      } else {
        // Approved leave — reverse used_days
        const [balance] = await db
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.orgId, existing.orgId),
              eq(leaveBalances.employeeId, existing.employeeId),
              eq(leaveBalances.leaveTypeId, existing.leaveTypeId),
              eq(leaveBalances.year, new Date(existing.startDate).getFullYear()),
            ),
          );
        if (balance) {
          await db
            .update(leaveBalances)
            .set({ usedDays: Math.max(0, balance.usedDays - existing.totalDays), updatedAt: new Date() })
            .where(eq(leaveBalances.id, balance.id));
        }

        // Notify manager that approved leave was cancelled
        const [emp] = await db.select({ managerId: employees.managerId }).from(employees).where(eq(employees.id, existing.employeeId));
        if (emp?.managerId) {
          const [mgr] = await db.select({ userId: employees.userId }).from(employees).where(eq(employees.id, emp.managerId));
          if (mgr?.userId) {
            createNotification(db, {
              orgId: existing.orgId,
              userId: mgr.userId,
              type: "leave_approved",
              title: "Approved leave cancelled by employee",
              body: `${existing.startDate} to ${existing.endDate}`,
              linkType: "leave_request",
              linkId: existing.id,
            }).catch(() => {});
          }
        }
      }

      return updated;
    });
    if (!row) throw new ApiError(404, "Leave request not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
