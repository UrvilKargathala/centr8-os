import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getForecastByRep, getForecastForPeriod, getForecastTrend, listAccountNames } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { requirePermission } from "@/lib/api/permissions";
import { ForecastsPageClient, currentPeriod, type ForecastsInitialData } from "./ForecastsPageClient";

const PERIOD_TYPE: ForecastsInitialData["periodType"] = "monthly";

export default async function ForecastsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ForecastsPageClient />;

  try {
    const period = currentPeriod(PERIOD_TYPE);
    const initial = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "forecast", "read");
      const [forecast, byRep, trend] = await Promise.all([
        getForecastForPeriod(db, orgId, period.start, period.end, period.period),
        getForecastByRep(db, orgId, period.start, period.end, period.period),
        getForecastTrend(db, orgId, PERIOD_TYPE, 6),
      ]);
      const [accounts, employees] = await Promise.all([
        listAccountNames(db, userId, orgId).catch(() => []),
        listAllEmployees(db, userId, orgId).catch(() => []),
      ]);
      return { periodType: PERIOD_TYPE, forecast, byRep, trend, accounts, employees } as unknown as ForecastsInitialData;
    });
    return <ForecastsPageClient initial={initial} />;
  } catch {
    return <ForecastsPageClient />;
  }
}
