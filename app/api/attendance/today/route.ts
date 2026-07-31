import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { attendanceRecords } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/attendance";

// Widget's poll-on-mount/focus endpoint — the caller's own today record, or
// null if they haven't checked in yet. org_id identifies which org's
// employees row to resolve "own" against (a user can belong to >1 org).
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const row = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "attendance", "view_own");
      const employeeId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!employeeId) return null;

      const today = new Date().toISOString().slice(0, 10);
      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.workDate, today)));
      return existing ?? null;
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
