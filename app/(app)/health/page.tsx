import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listLatestHealthSnapshots } from "@/lib/api/projects";
import { HealthPageClient, type Snapshot } from "./HealthPageClient";

export default async function ProjectHealthPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <HealthPageClient />;

  try {
    const initialSnapshots = await withOrgContext(userId, (db) => listLatestHealthSnapshots(db, userId, orgId));
    return <HealthPageClient initialSnapshots={initialSnapshots as unknown as Snapshot[]} />;
  } catch {
    return <HealthPageClient />;
  }
}
