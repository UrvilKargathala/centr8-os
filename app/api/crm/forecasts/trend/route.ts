import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { forecastTargets } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { computeForecast } from "@/lib/api/crm";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Builds the last N periods (ending at the current one) for a given
// period_type, each as { period, periodStart, periodEnd }.
function buildPeriods(periodType: string, count: number) {
  const now = new Date();
  const periods: { period: string; start: string; end: string }[] = [];

  if (periodType === "monthly") {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      periods.push({ period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, start: isoDate(start), end: isoDate(end) });
    }
  } else if (periodType === "quarterly") {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    for (let i = count - 1; i >= 0; i--) {
      const totalQuarters = now.getFullYear() * 4 + currentQuarter - i;
      const year = Math.floor(totalQuarters / 4);
      const q = totalQuarters % 4;
      const start = new Date(year, q * 3, 1);
      const end = new Date(year, q * 3 + 3, 0);
      periods.push({ period: `Q${q + 1} ${year}`, start: isoDate(start), end: isoDate(end) });
    }
  } else {
    for (let i = count - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      periods.push({ period: `${year}`, start: isoDate(new Date(year, 0, 1)), end: isoDate(new Date(year, 11, 31)) });
    }
  }
  return periods;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const periodType = params.get("period_type") ?? "monthly";
    const count = Number(params.get("count") ?? 6);

    const result = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      const periods = buildPeriods(periodType, count);
      const targets = await db.select().from(forecastTargets).where(eq(forecastTargets.orgId, orgId));

      return Promise.all(
        periods.map(async (p) => {
          const forecast = await computeForecast(db, orgId, p.start, p.end);
          const target = targets.find((t) => t.period === p.period && t.ownerId === null);
          return {
            period: p.period,
            target: target?.targetValue ?? 0,
            won: forecast.won_value,
            weighted: forecast.weighted_value,
            pipeline: forecast.pipeline_value,
          };
        }),
      );
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
