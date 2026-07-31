import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { forecastTargets } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireForecastSetTargetAccess } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const params = req.nextUrl.searchParams;
    const orgId = params.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const periodType = params.get("period_type");
    const ownerId = params.get("owner_id");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      const conditions = [eq(forecastTargets.orgId, orgId)];
      if (periodType) conditions.push(eq(forecastTargets.periodType, periodType as (typeof forecastTargets.periodType.enumValues)[number]));
      if (ownerId) conditions.push(eq(forecastTargets.ownerId, ownerId));
      return db.select().from(forecastTargets).where(and(...conditions));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.period || !body.period_type || !body.period_start || !body.period_end || body.target_value === undefined) {
      throw new ApiError(400, "org_id, period, period_type, period_start, period_end, and target_value are required");
    }

    const row = await withOrgContext(userId, async (db) => {
      await requireForecastSetTargetAccess(db, userId, body.org_id);
      const [created] = await db
        .insert(forecastTargets)
        .values({
          orgId: body.org_id,
          period: body.period,
          periodType: body.period_type,
          periodStart: body.period_start,
          periodEnd: body.period_end,
          targetValue: body.target_value,
          currency: body.currency ?? undefined,
          ownerId: body.owner_id ?? null,
          department: body.department ?? null,
          notes: body.notes ?? null,
          createdBy: userId,
        })
        .returning();
      return created;
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
