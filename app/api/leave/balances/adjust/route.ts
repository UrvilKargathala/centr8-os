import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog, leaveBalances } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getOrCreateBalance, requireLeaveManageBalancesAccess } from "@/lib/api/leave";

// Manual correction (e.g. migrating historical balances) — always audited,
// same discipline as every other admin-override action in this app.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.employee_id || !body.leave_type_id || !body.year || body.adjustment_days == null || !body.reason) {
      throw new ApiError(400, "org_id, employee_id, leave_type_id, year, adjustment_days, and reason are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requireLeaveManageBalancesAccess(db, userId, body.org_id);

      const balance = await getOrCreateBalance(db, body.org_id, body.employee_id, body.leave_type_id, body.year);
      if (!balance) throw new ApiError(400, "No leave policy covers this employee/leave type — create a policy first");

      const [updated] = await db
        .update(leaveBalances)
        .set({ allottedDays: balance.allottedDays + body.adjustment_days, updatedAt: new Date() })
        .where(eq(leaveBalances.id, balance.id))
        .returning();

      await db.insert(auditLog).values({
        orgId: body.org_id,
        actorUserId: userId,
        actorType: "human",
        action: "leave_balance_adjusted",
        targetType: "leave_balance",
        targetId: balance.id,
        metadata: { employee_id: body.employee_id, leave_type_id: body.leave_type_id, year: body.year, adjustment_days: body.adjustment_days, reason: body.reason },
      });

      return updated;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
