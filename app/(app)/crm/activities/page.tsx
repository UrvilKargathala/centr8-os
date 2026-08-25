import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllActivities } from "@/lib/api/crm";
import { listAllEmployees } from "@/lib/api/employees";
import { ActivitiesPageClient, type ActivitiesInitialData } from "./ActivitiesPageClient";

export default async function ActivitiesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ActivitiesPageClient />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const activities = await listAllActivities(db, userId, orgId);
      const employees = await listAllEmployees(db, userId, orgId).catch(() => []);
      return { activities, employees } as unknown as ActivitiesInitialData;
    });
    return <ActivitiesPageClient initial={initial} />;
  } catch {
    return <ActivitiesPageClient />;
  }
}
