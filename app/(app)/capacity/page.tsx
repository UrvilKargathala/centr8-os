import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listCapacityData } from "@/lib/api/team";
import { CapacityPageClient, type Person, type Task } from "./CapacityPageClient";

export default async function CapacityPlanningPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <CapacityPageClient />;

  const [people, tasks] = await withOrgContext(userId, (db) => listCapacityData(db, orgId));
  return <CapacityPageClient initialPeople={people as unknown as Person[]} initialTasks={tasks as unknown as Task[]} />;
}
