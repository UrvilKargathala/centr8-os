import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getCrmStats, listAllLeads, listAllActivities, computePipelineStats } from "@/lib/api/crm";
import CrmDashboardPageClient, { type CrmDashboardInitialData } from "./CrmDashboardPageClient";

export default async function CrmDashboardPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId, grants } = await getCurrentOrg(userId);

  if (!orgId) return <CrmDashboardPageClient />;

  const canReadDeals = grants.some((g) => g.resourceType === "deal" && g.action === "read");

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [stats, leads, activities, pipeline] = await Promise.all([
        getCrmStats(db, userId, orgId),
        listAllLeads(db, userId, orgId),
        listAllActivities(db, userId, orgId),
        canReadDeals ? computePipelineStats(db, userId, orgId) : Promise.resolve(null),
      ]);
      return { stats, leads, activities, pipeline } as unknown as CrmDashboardInitialData;
    });
    return <CrmDashboardPageClient initial={initial} />;
  } catch {
    return <CrmDashboardPageClient />;
  }
}
