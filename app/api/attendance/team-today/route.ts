import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

// Raw today's records, org-wide — the UI joins these against the employee
// list it already loads (GET /api/employees) to derive "absent" (active
// employee, no record, not a weekend/holiday) rather than this route
// guessing at who's "missing" without the full roster.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "attendance", "view_all");
      const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      return db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.orgId, orgId), eq(attendanceRecords.workDate, date)));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
