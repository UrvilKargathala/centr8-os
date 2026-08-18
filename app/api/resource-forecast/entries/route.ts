import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { upsertForecastEntry } from "@/lib/api/resourceForecast";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    const { org_id, project_id, person_id, week_start, planned_hours, is_billable } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");
    if (!project_id) throw new ApiError(400, "project_id is required");
    if (!person_id) throw new ApiError(400, "person_id is required");
    if (!week_start) throw new ApiError(400, "week_start is required");
    if (planned_hours == null || planned_hours < 0) throw new ApiError(400, "planned_hours must be >= 0");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, org_id, "resource_forecast", "create");
      return upsertForecastEntry(db, org_id, {
        projectId: project_id,
        personId: person_id,
        weekStart: week_start,
        plannedHours: planned_hours,
        isBillable: is_billable ?? true,
        createdBy: userId,
      });
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
