import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllPeople, listOpenTaskEstimates } from "@/lib/api/team";
import { TeamPageClient, type Person } from "./TeamPageClient";

// Server-rendered: fetches the initial Team list + capacity data during
// render (same withOrgContext + lib/api/team.ts functions app/api/team's
// route uses) instead of showing a skeleton then fetching client-side.
// AppLayout already redirects unauthenticated visits, so a user is present.
export default async function TeamPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <TeamPageClient />;

  const [people, taskEstimates] = await withOrgContext(userId, (db) =>
    Promise.all([listAllPeople(db, orgId), listOpenTaskEstimates(db, orgId)]),
  );

  return <TeamPageClient initialPeople={people as unknown as Person[]} initialTaskEstimates={taskEstimates} />;
}
