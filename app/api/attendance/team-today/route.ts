import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listTeamAttendanceForDate } from "@/lib/api/attendance";

// Raw today's records, org-wide — the UI joins these against the employee
// list it already loads (GET /api/employees) to derive "absent" (active
// employee, no record, not a weekend/holiday) rather than this route
// guessing at who's "missing" without the full roster.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

    const rows = await withOrgContext(userId, (db) => listTeamAttendanceForDate(db, userId, orgId, date));

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
