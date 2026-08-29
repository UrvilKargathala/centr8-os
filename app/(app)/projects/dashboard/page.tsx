import { getAuthUser } from "@/lib/supabase/server";
import { withOrgContext } from "@/db/withOrgContext";
import { getCurrentOrg } from "@/lib/org/currentOrg";
import { getProjectsDashboardData, listRecentAuditLog } from "@/lib/api/projects";
import { TASK_STATUSES } from "@/lib/constants";
import { ProjectsDashboardPageClient, type ProjectsDashboardInitialData } from "./ProjectsDashboardPageClient";

export default async function DashboardPage() {
  const { data } = await getAuthUser();
  const userId = data.user!.id;
  const { orgId } = await getCurrentOrg(userId);

  if (!orgId) return <ProjectsDashboardPageClient />;

  const initial = await withOrgContext(userId, async (db) => {
    const [{ projects, perProject }, activity] = await Promise.all([
      getProjectsDashboardData(db, orgId),
      listRecentAuditLog(db, orgId, 15),
    ]);

    const counts: Record<string, number> = {};
    for (const status of TASK_STATUSES) counts[status] = 0;
    for (const { tasks } of perProject) for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;

    const allTasks = perProject.flatMap(({ project, tasks }) => tasks.map((t) => ({ ...t, projectId: project.id, projectName: project.name })));
    const sprints = perProject.flatMap(({ sprints }) => sprints);

    return { projects, taskCounts: counts, allTasks, sprints, activity };
  });

  return <ProjectsDashboardPageClient initial={initial as unknown as ProjectsDashboardInitialData} />;
}
