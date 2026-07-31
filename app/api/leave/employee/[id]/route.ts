import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, leaveRequests, leaveTypes } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { getOrCreateBalance, requireLeaveViewAccess } from "@/lib/api/leave";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

    const result = await withOrgContext(userId, async (db) => {
      const [emp] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!emp) return undefined;
      await requireLeaveViewAccess(db, userId, emp.orgId, id);

      const [requests, types] = await Promise.all([
        db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, id)).orderBy(desc(leaveRequests.requestedAt)),
        db.select().from(leaveTypes).where(eq(leaveTypes.orgId, emp.orgId)),
      ]);
      const activeTypes = types.filter((t) => t.isActive);
      const balances = await Promise.all(activeTypes.map((t) => getOrCreateBalance(db, emp.orgId, id, t.id, year)));

      return {
        requests,
        balances: activeTypes.map((t, i) => ({ leave_type: t, balance: balances[i] })),
      };
    });
    if (!result) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
