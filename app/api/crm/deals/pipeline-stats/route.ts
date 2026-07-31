import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { deals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

const OPEN_STAGES = ["prospecting", "discovery", "proposal", "negotiation", "contract_sent"];

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const stats = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "deal", "read");
      const allDeals = await db.select().from(deals).where(eq(deals.orgId, orgId));

      const now = Date.now();
      const byStage: Record<string, { stage: string; count: number; total_value: number; avg_days_in_stage: number }> = {};
      for (const stage of OPEN_STAGES) byStage[stage] = { stage, count: 0, total_value: 0, avg_days_in_stage: 0 };

      const daysInStageSum: Record<string, number> = {};
      for (const d of allDeals) {
        if (!OPEN_STAGES.includes(d.stage)) continue;
        const bucket = byStage[d.stage];
        bucket.count += 1;
        bucket.total_value += Number(d.value ?? 0);
        const days = (now - d.stageChangedAt.getTime()) / (24 * 60 * 60 * 1000);
        daysInStageSum[d.stage] = (daysInStageSum[d.stage] ?? 0) + days;
      }
      for (const stage of OPEN_STAGES) {
        const bucket = byStage[stage];
        bucket.avg_days_in_stage = bucket.count > 0 ? daysInStageSum[stage] / bucket.count : 0;
      }

      const openDeals = allDeals.filter((d) => OPEN_STAGES.includes(d.stage));
      const totalPipelineValue = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
      const weightedPipelineValue = openDeals.reduce((s, d) => s + (Number(d.value ?? 0) * (d.probability ?? 0)) / 100, 0);

      const wonDeals = allDeals.filter((d) => d.stage === "won");
      const lostDeals = allDeals.filter((d) => d.stage === "lost");
      const winRate = wonDeals.length + lostDeals.length > 0 ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 : 0;

      const cycleDays = wonDeals
        .filter((d) => d.actualCloseDate)
        .map((d) => (new Date(d.actualCloseDate as string).getTime() - d.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const avgDealCycleDays = cycleDays.length > 0 ? cycleDays.reduce((s, n) => s + n, 0) / cycleDays.length : 0;

      return {
        stages: OPEN_STAGES.map((s) => byStage[s]),
        total_pipeline_value: totalPipelineValue,
        weighted_pipeline_value: weightedPipelineValue,
        avg_deal_cycle_days: avgDealCycleDays,
        win_rate_percent: winRate,
      };
    });

    return NextResponse.json({ data: stats });
  } catch (err) {
    return handleApiError(err);
  }
}
