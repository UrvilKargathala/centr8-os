import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveBalances, leaveTypes } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";
import { getOrCreateBalance } from "@/lib/api/leave";

// Current year's balance across every active leave type — lazily
// initializes a leave_balances row per type on first read, same as leave
// creation does, so this reflects the true remaining-days picture even
// before the employee has ever requested that type.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "view_own");
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) return [];

      const types = await db.select().from(leaveTypes).where(and(eq(leaveTypes.orgId, orgId), eq(leaveTypes.isActive, true)));
      const balances = await Promise.all(types.map((t) => getOrCreateBalance(db, orgId, employeeId, t.id, year)));
      return types.map((t, i) => ({ leave_type: t, balance: balances[i] }));
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
