import { createClient } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getProjectsPageData } from "@/lib/api/projects";
import { ProjectsPageClient, type ProjectsPageInitialData } from "./ProjectsPageClient";

// Server-rendered: fetches projects + health + milestones/tasks/members in
// one withOrgContext transaction (lib/api/projects.ts) instead of the
// client fan-out over /api/projects, /api/ai/project-health, /api/milestones,
// /api/tasks, /api/projects/[id]/members that used to run after mount.
export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ProjectsPageClient />;

  const pageData = await withOrgContext(userId, (db) => getProjectsPageData(db, orgId));

  return <ProjectsPageClient initial={pageData as unknown as ProjectsPageInitialData} />;
}
