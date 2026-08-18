import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { resourceForecastEntries } from "@/db/schema";
import { requirePermission } from "@/lib/api/permissions";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const body = await req.json();
    const { org_id, planned_hours, is_billable } = body;
    if (!org_id) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, org_id, "resource_forecast", "update");
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (planned_hours != null) set.plannedHours = String(planned_hours);
      if (is_billable != null) set.isBillable = is_billable;

      const [updated] = await db
        .update(resourceForecastEntries)
        .set(set)
        .where(and(eq(resourceForecastEntries.id, id), eq(resourceForecastEntries.orgId, org_id)))
        .returning();
      if (!updated) throw new ApiError(404, "Entry not found");
      return updated;
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "resource_forecast", "delete");
      const [deleted] = await db
        .delete(resourceForecastEntries)
        .where(and(eq(resourceForecastEntries.id, id), eq(resourceForecastEntries.orgId, orgId)))
        .returning();
      if (!deleted) throw new ApiError(404, "Entry not found");
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
