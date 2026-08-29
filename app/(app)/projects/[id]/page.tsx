import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getProjectDetailData } from "@/lib/api/projects";
import ProjectDetailPageClient, { type ProjectDetailInitialData } from "./ProjectDetailPageClient";

// Seeds the Overview tab's data (project, milestones, sprints, tasks, team
// lookup). Team/Activity/Portal-access sub-tabs stay client-fetched on tab
// switch, same convention as every other tabbed page.
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ProjectDetailPageClient params={params} />;

  try {
    const initial = await withOrgContext(userId, async (db) => {
      const result = await getProjectDetailData(db, orgId, id);
      if (!result.project) throw new Error("Project not found");
      return result as unknown as ProjectDetailInitialData;
    });
    return <ProjectDetailPageClient params={params} initial={initial} />;
  } catch {
    return <ProjectDetailPageClient params={params} />;
  }
}
