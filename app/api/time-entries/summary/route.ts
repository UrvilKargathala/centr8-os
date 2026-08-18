import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getTimeEntrySummary, resolveOwnPersonId } from "@/lib/api/timeEntries";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const mine = sp.get("mine") === "true";

    const summary = await withOrgContext(userId, async (db) => {
      if (mine) {
        await requirePermission(db, userId, orgId, "time", "view_own");
        const myPersonId = await resolveOwnPersonId(db, userId, orgId);
        if (!myPersonId) return { totalHours: "0", billableHours: "0", entryCount: 0, byProject: [], byDate: [] };
        return getTimeEntrySummary(db, orgId, {
          personId: myPersonId,
          projectId: sp.get("project_id") ?? undefined,
          startDate: sp.get("start_date") ?? undefined,
          endDate: sp.get("end_date") ?? undefined,
        });
      }
      await requirePermission(db, userId, orgId, "time", "read");
      return getTimeEntrySummary(db, orgId, {
        personId: sp.get("person_id") ?? undefined,
        projectId: sp.get("project_id") ?? undefined,
        startDate: sp.get("start_date") ?? undefined,
        endDate: sp.get("end_date") ?? undefined,
      });
    });

    return NextResponse.json({ data: summary });
  } catch (err) {
    return handleApiError(err);
  }
}
