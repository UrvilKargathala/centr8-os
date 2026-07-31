import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, forecastTargets } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { computeForecast } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    const periodStart = params.get("period_start");
    const periodEnd = params.get("period_end");
    const period = params.get("period");
    if (!orgId || !periodStart || !periodEnd) throw new ApiError(400, "org_id, period_start, and period_end are required");

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      const reps = await db.select().from(employees).where(eq(employees.orgId, orgId));
      const targets = period ? await db.select().from(forecastTargets).where(eq(forecastTargets.orgId, orgId)) : [];

      return Promise.all(
        reps.map(async (rep) => {
          const forecast = await computeForecast(db, orgId, periodStart, periodEnd, rep.id);
          const target = targets.find((t) => t.ownerId === rep.id && t.period === period);
          const targetValue = target?.targetValue ?? 0;
          return {
            owner_id: rep.id,
            owner_name: rep.fullName,
            target_value: targetValue,
            won_value: forecast.won_value,
            weighted_value: forecast.weighted_value,
            pipeline_value: forecast.pipeline_value,
            gap: targetValue - forecast.won_value - forecast.weighted_value,
          };
        }),
      );
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
