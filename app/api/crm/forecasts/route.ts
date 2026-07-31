import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { forecastTargets } from "@/db/schema";
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
    if (!orgId || !periodStart || !periodEnd) throw new ApiError(400, "org_id, period_start, and period_end are required");
    const ownerId = params.get("owner_id");
    const period = params.get("period");

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      const forecast = await computeForecast(db, orgId, periodStart, periodEnd, ownerId);

      const targetConditions = [eq(forecastTargets.orgId, orgId)];
      if (period) targetConditions.push(eq(forecastTargets.period, period));
      if (ownerId) targetConditions.push(eq(forecastTargets.ownerId, ownerId));
      const targetRows = await db.select().from(forecastTargets).where(and(...targetConditions));
      const target = targetRows.find((t) => (ownerId ? t.ownerId === ownerId : t.ownerId === null)) ?? targetRows[0] ?? null;
      const targetValue = target?.targetValue ?? 0;

      return {
        period: period ?? `${periodStart}..${periodEnd}`,
        target_value: targetValue,
        pipeline_value: forecast.pipeline_value,
        weighted_value: forecast.weighted_value,
        committed_value: forecast.committed_value,
        won_value: forecast.won_value,
        gap: targetValue - forecast.won_value - forecast.weighted_value,
        deals_count: forecast.deals_count,
        deals_by_stage: forecast.deals_by_stage,
        deals: forecast.deals,
      };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
