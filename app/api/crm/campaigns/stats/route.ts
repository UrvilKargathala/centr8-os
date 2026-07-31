import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { campaigns } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { campaignRoi, computeCampaignMetrics } from "@/lib/api/crm";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const stats = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "campaign", "read");
      const allCampaigns = await db.select().from(campaigns).where(eq(campaigns.orgId, orgId));

      const active = allCampaigns.filter((c) => c.status === "active");
      const totalBudgetAllocated = active.reduce((s, c) => s + Number(c.budgetAllocated ?? 0), 0);
      const totalBudgetSpent = active.reduce((s, c) => s + Number(c.budgetSpent ?? 0), 0);

      let totalLeads = 0;
      let best: { name: string; roi: number } | null = null;
      let worst: { name: string; roi: number } | null = null;
      for (const c of allCampaigns) {
        const metrics = await computeCampaignMetrics(db, orgId, c.id);
        totalLeads += metrics.leads_count;
        const roi = campaignRoi(metrics.revenue_won, c.budgetSpent);
        if (roi !== null) {
          if (!best || roi > best.roi) best = { name: c.name, roi };
          if (!worst || roi < worst.roi) worst = { name: c.name, roi };
        }
      }

      return {
        active_campaigns: active.length,
        total_budget_allocated: totalBudgetAllocated,
        total_budget_spent: totalBudgetSpent,
        total_leads_generated: totalLeads,
        best_performing: best,
        worst_performing: worst,
      };
    });

    return NextResponse.json({ data: stats });
  } catch (err) {
    return handleApiError(err);
  }
}
