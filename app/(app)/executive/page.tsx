import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { loadDashboard } from "@/lib/api/dashboard";
import { listLatestHealthSnapshots } from "@/lib/api/projects";
import { ExecutivePageClient, type ExecutiveInitialData } from "./ExecutivePageClient";

export default async function ExecutivePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ExecutivePageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const [dashData, health] = await Promise.all([
        loadDashboard(db, userId, orgId),
        listLatestHealthSnapshots(db, userId, orgId).catch(() => []),
      ]);
      return { data: dashData, health } as unknown as ExecutiveInitialData;
    });
    return <ExecutivePageClient initial={initial} />;
  } catch {
    return <ExecutivePageClient />;
  }
}
