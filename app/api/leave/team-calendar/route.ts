import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, leaveRequests } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";

// scope=all (default, requires leave:view_all) — org-wide.
// scope=team — manager-scoped: only direct reports' leave. Requires
// leave:approve (same gate as the Approvals tab) and the caller to have
// a linked employee record that others report to.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const startDate = req.nextUrl.searchParams.get("start_date");
    const endDate = req.nextUrl.searchParams.get("end_date");
    const scope = req.nextUrl.searchParams.get("scope") ?? "all";

    const rows = await withOrgContext(userId, async (db) => {
      let employeeIds: string[] | null = null;

      if (scope === "team") {
        await requirePermission(db, userId, orgId, "leave", "approve");
        const ownId = await resolveOwnEmployeeId(db, userId, orgId);
        if (!ownId) throw new ApiError(403, "No linked employee record");
        const reports = await db
          .select({ id: employees.id })
          .from(employees)
          .where(and(eq(employees.orgId, orgId), eq(employees.managerId, ownId)));
        employeeIds = reports.map((r) => r.id);
        if (employeeIds.length === 0) return [];
      } else {
        await requirePermission(db, userId, orgId, "leave", "view_all");
      }

      const conditions = [eq(leaveRequests.orgId, orgId), inArray(leaveRequests.status, ["approved", "pending"])];
      if (employeeIds) conditions.push(inArray(leaveRequests.employeeId, employeeIds));
      if (startDate) conditions.push(gte(leaveRequests.endDate, startDate));
      if (endDate) conditions.push(lte(leaveRequests.startDate, endDate));
      return db.select().from(leaveRequests).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
