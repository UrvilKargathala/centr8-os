import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { listAllSprintPlans } from "@/lib/api/aiAssistant";
import { listProjectNames } from "@/lib/api/projects";
import { SprintPlansPageClient, type SprintPlanProposal } from "./SprintPlansPageClient";

export default async function SprintPlansPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <SprintPlansPageClient />;

  try {
    const [plans, projects] = await withOrgContext(userId, (db) =>
      Promise.all([listAllSprintPlans(db, userId, orgId), listProjectNames(db, orgId)]),
    );
    return <SprintPlansPageClient initialPlans={plans as unknown as SprintPlanProposal[]} initialProjects={projects} />;
  } catch {
    return <SprintPlansPageClient />;
  }
}
