import { desc, eq } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { milestones, people, projectHealthSnapshots, projectMembers, projects, tasks } from "@/db/schema";

// Consolidates what app/(app)/projects/page.tsx's client `loadAll()` used to
// fan out over HTTP (projects, health, per-project milestones/tasks/members)
// into one server-side load — same tables the individual API routes already
// query (app/api/projects, app/api/ai/project-health, app/api/milestones,
// app/api/tasks, app/api/projects/[id]/members), just called directly
// inside one withOrgContext transaction instead of N HTTP round trips.
export async function getProjectsPageData(db: OrgScopedDb, orgId: string) {
  const projectRows = await db.select().from(projects).where(eq(projects.orgId, orgId));

  const healthRowsRaw = await db
    .selectDistinctOn([projectHealthSnapshots.projectId])
    .from(projectHealthSnapshots)
    .innerJoin(projects, eq(projects.id, projectHealthSnapshots.projectId))
    .where(eq(projectHealthSnapshots.orgId, orgId))
    .orderBy(projectHealthSnapshots.projectId, desc(projectHealthSnapshots.createdAt));

  const health: Record<string, unknown> = {};
  for (const r of healthRowsRaw) {
    health[r.project_health_snapshots.projectId] = { ...r.project_health_snapshots, projectName: r.projects.name };
  }

  const milestoneCounts: Record<string, number> = {};
  const taskProgress: Record<string, { done: number; total: number }> = {};
  const taskDeadlines: { projectId: string; projectName: string; taskId: string; taskTitle: string; dueDate: string }[] = [];
  const projectMembersMap: Record<string, unknown[]> = {};

  await Promise.all(
    projectRows.map(async (p) => {
      const [ms, projTasks, members] = await Promise.all([
        db.select().from(milestones).where(eq(milestones.projectId, p.id)),
        db
          .select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
          .from(tasks)
          .where(eq(tasks.projectId, p.id)),
        db
          .select({
            projectId: projectMembers.projectId,
            personId: projectMembers.personId,
            role: projectMembers.role,
            hoursPerWeek: projectMembers.hoursPerWeek,
            access: projectMembers.access,
            isLead: projectMembers.isLead,
            fullName: people.fullName,
            jobTitle: people.jobTitle,
            avatarUrl: people.avatarUrl,
          })
          .from(projectMembers)
          .leftJoin(people, eq(projectMembers.personId, people.id))
          .where(eq(projectMembers.projectId, p.id)),
      ]);

      milestoneCounts[p.id] = ms.length;
      taskProgress[p.id] = { done: projTasks.filter((t) => t.status === "done").length, total: projTasks.length };
      for (const t of projTasks) {
        if (t.dueDate && t.status !== "done" && t.status !== "cancelled") {
          taskDeadlines.push({ projectId: p.id, projectName: p.name, taskId: t.id, taskTitle: t.title, dueDate: t.dueDate });
        }
      }
      projectMembersMap[p.id] = members;
    }),
  );

  return { projects: projectRows, health, milestoneCounts, taskProgress, taskDeadlines, projectMembers: projectMembersMap };
}
