import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, leaveBalances, leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";
import { countLeaveDays, getLeaveType, getOrCreateBalance, remainingDays } from "@/lib/api/leave";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const orgId = body.org_id;
    if (!orgId || !body.leave_type_id || !body.start_date || !body.end_date) {
      throw new ApiError(400, "org_id, leave_type_id, start_date, and end_date are required");
    }
    if (body.is_half_day && !["morning", "afternoon"].includes(body.half_day_period)) {
      throw new ApiError(400, "half_day_period must be 'morning' or 'afternoon' when is_half_day is true");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "request_own");
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) throw new ApiError(404, "No employee record linked to this account");

      const leaveType = await getLeaveType(db, body.leave_type_id);
      if (!leaveType || leaveType.orgId !== orgId) throw new ApiError(404, "Leave type not found");
      if (!leaveType.isActive) throw new ApiError(400, "This leave type is no longer active");

      const totalDays = body.is_half_day ? 0.5 : await countLeaveDays(db, orgId, body.start_date, body.end_date);
      if (totalDays <= 0) throw new ApiError(400, "The requested range contains no working days");
      if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
        throw new ApiError(400, `${leaveType.name} can't exceed ${leaveType.maxConsecutiveDays} consecutive days`);
      }

      const year = new Date(body.start_date).getFullYear();
      const balance = await getOrCreateBalance(db, orgId, employeeId, body.leave_type_id, year);

      // Unpaid leave has no balance ceiling by design — server-side check
      // still runs for every paid type, same discipline as Attendance's
      // server-side auth checks (never client-trust-only).
      if (leaveType.isPaid) {
        if (!balance) throw new ApiError(400, "No leave policy covers this leave type for your role — contact HR");
        if (totalDays > remainingDays(balance)) {
          throw new ApiError(400, `Insufficient balance: ${remainingDays(balance)} day(s) remaining, this request needs ${totalDays}`);
        }
      }

      const [created] = await db
        .insert(leaveRequests)
        .values({
          orgId,
          employeeId,
          leaveTypeId: body.leave_type_id,
          startDate: body.start_date,
          endDate: body.end_date,
          totalDays,
          isHalfDay: Boolean(body.is_half_day),
          halfDayPeriod: body.is_half_day ? body.half_day_period : null,
          reason: body.reason ?? null,
        })
        .returning();

      // Days are "at risk" the moment a request is filed, before approval —
      // increment pending_days immediately (spec Part 1).
      if (balance) {
        await db
          .update(leaveBalances)
          .set({ pendingDays: balance.pendingDays + totalDays, updatedAt: new Date() })
          .where(eq(leaveBalances.id, balance.id));
      }

      // TODO: real manager notification (email/Slack) once a notification
      // pipeline exists — logging is the stand-in for now.
      const [employee] = await db.select({ managerId: employees.managerId, fullName: employees.fullName }).from(employees).where(eq(employees.id, employeeId));
      console.log("leave request notification (stub):", {
        managerId: employee?.managerId ?? null,
        requestedBy: employee?.fullName,
        leaveType: leaveType.name,
        startDate: body.start_date,
        endDate: body.end_date,
        totalDays,
      });

      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
