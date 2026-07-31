import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission, requirePermission } from "@/lib/api/permissions";
import { trimEmployeeFields } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string }> };

// Direct reports only (one level) — the org-chart's expand/collapse walks
// this per node rather than fetching a whole subtree at once.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "employee", "read");
      const canViewFull = await hasPermission(db, userId, existing.orgId, "employee", "view_full");
      const rows = await db.select().from(employees).where(eq(employees.managerId, id));
      return rows.map((r) => trimEmployeeFields(r, canViewFull));
    });
    if (!result) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
