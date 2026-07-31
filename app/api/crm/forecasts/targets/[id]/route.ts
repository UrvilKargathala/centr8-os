import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { forecastTargets } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireForecastSetTargetAccess } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: forecastTargets.orgId }).from(forecastTargets).where(eq(forecastTargets.id, id));
      if (!existing) return undefined;
      await requireForecastSetTargetAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(forecastTargets)
        .set({
          targetValue: body.target_value === undefined ? undefined : body.target_value,
          periodStart: body.period_start === undefined ? undefined : body.period_start,
          periodEnd: body.period_end === undefined ? undefined : body.period_end,
          department: body.department === undefined ? undefined : body.department,
          notes: body.notes === undefined ? undefined : body.notes,
        })
        .where(eq(forecastTargets.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Forecast target not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
