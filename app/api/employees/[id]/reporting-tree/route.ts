import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { hasPermission, requirePermission } from "@/lib/api/permissions";
import { trimEmployeeFields } from "@/lib/api/employees";

type Params = { params: Promise<{ id: string }> };

// Chain of managers from this employee up to the root (CEO/no manager).
// Walked in application code rather than a recursive CTE — org depth here
// is a handful of levels, not worth the query complexity.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const result = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "employee", "read");
      const canViewFull = await hasPermission(db, userId, existing.orgId, "employee", "view_full");

      const chain = [];
      let current = existing;
      const seen = new Set([current.id]);
      while (current.managerId) {
        const [manager] = await db.select().from(employees).where(eq(employees.id, current.managerId));
        if (!manager || seen.has(manager.id)) break; // guards against a cyclic managerId chain
        chain.push(manager);
        seen.add(manager.id);
        current = manager;
      }
      return chain.map((r) => trimEmployeeFields(r, canViewFull));
    });
    if (!result) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
