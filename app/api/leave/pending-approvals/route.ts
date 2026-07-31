import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission, requirePermission } from "@/lib/api/permissions";
import { isManagerOf } from "@/lib/api/employees";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "leave", "approve");
      const pending = await db.select().from(leaveRequests).where(and(eq(leaveRequests.orgId, orgId), eq(leaveRequests.status, "pending")));

      if (await hasPermission(db, userId, orgId, "leave", "view_all")) return pending;

      const decisions = await Promise.all(pending.map((r) => isManagerOf(db, userId, orgId, r.employeeId)));
      return pending.filter((_, i) => decisions[i]);
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
