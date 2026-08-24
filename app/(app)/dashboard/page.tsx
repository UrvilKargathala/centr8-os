import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { loadDashboard } from "@/lib/api/dashboard";
import { DashboardPageClient, type DashboardData } from "./DashboardPageClient";

// Server-rendered: reuses the exact lib/api/dashboard.ts loadDashboard()
// function app/api/dashboard/route.ts calls, just invoked directly during
// render instead of over HTTP after mount.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <DashboardPageClient />;

  const dashboardData = await withOrgContext(userId, (db) => loadDashboard(db, userId, orgId));

  return <DashboardPageClient initialData={dashboardData as unknown as DashboardData} />;
}
