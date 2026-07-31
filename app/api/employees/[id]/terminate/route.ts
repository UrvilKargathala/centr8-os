import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Dedicated endpoint for the spec's terminate flow (Part 3) — thin wrapper
// around the same employee:terminate check PATCH .../employees/[id] already
// enforces for employment_status="terminated", so terminate has one call
// site whether the caller uses this route or the general PATCH.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: employees.orgId }).from(employees).where(eq(employees.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "employee", "terminate");

      const [updated] = await db
        .update(employees)
        .set({
          employmentStatus: "terminated",
          endDate: body.end_date ?? new Date().toISOString().slice(0, 10),
        })
        .where(eq(employees.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Employee not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
