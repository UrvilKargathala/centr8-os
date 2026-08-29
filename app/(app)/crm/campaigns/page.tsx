import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { campaignRoi, computeCampaignMetrics, getCampaignsStats, listAllCampaigns } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { CampaignsPageClient, type CampaignsInitialData, type Metrics } from "./CampaignsPageClient";

export default async function CampaignsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <CampaignsPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [campaignRows, stats] = await Promise.all([listAllCampaigns(db, userId, orgId), getCampaignsStats(db, orgId)]);
      const metricsEntries = await Promise.all(
        campaignRows.map(async (c) => {
          const m = await computeCampaignMetrics(db, orgId, c.id);
          const roi = campaignRoi(m.revenue_won, c.budgetSpent);
          return [c.id, { leads_count: m.leads_count, deals_count: m.deals_count, revenue_won: m.revenue_won, roi_percent: roi }] as const;
        }),
      );
      const employees = await listAllEmployees(db, userId, orgId).catch(() => []);
      return {
        campaigns: campaignRows,
        metricsById: Object.fromEntries(metricsEntries) as Record<string, Metrics>,
        stats,
        employees,
      } as unknown as CampaignsInitialData;
    });
    return <CampaignsPageClient initial={initial} />;
  } catch {
    return <CampaignsPageClient />;
  }
}
