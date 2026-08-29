import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { requirePermission } from "@/lib/api/permissions";
import { getSummary, getUtilizationByDepartment } from "@/lib/api/resourceForecast";
import ForecastingPageClient, { type ForecastingInitialData } from "./ForecastingPageClient";

// Mirrors the client's periodRange("quarter") — the Summary tab's default period.
function quarterRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  const s = new Date(y, q * 3, 1);
  const e = new Date(y, q * 3 + 3, 0);
  return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
}

export default async function ForecastingPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ForecastingPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "resource_forecast", "view_all");
      const { start, end } = quarterRange();
      const [summary, deptUtil] = await Promise.all([
        getSummary(db, orgId, start, end),
        getUtilizationByDepartment(db, orgId, new Date().getFullYear()),
      ]);
      return { summary, deptUtil } as unknown as ForecastingInitialData;
    });
    return <ForecastingPageClient initial={initial} />;
  } catch {
    return <ForecastingPageClient />;
  }
}
