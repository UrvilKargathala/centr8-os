import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllProjects } from "@/lib/api/projects";
import { BudgetsPageClient, type Project } from "./BudgetsPageClient";

export default async function BudgetsPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <BudgetsPageClient />;

  const projects = await withOrgContext(userId, (db) => listAllProjects(db, orgId));
  return <BudgetsPageClient initialProjects={projects as unknown as Project[]} />;
}
