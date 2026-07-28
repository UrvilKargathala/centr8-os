import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { auditLog, tasks, sprints, milestones, projects } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

type Params = { params: Promise<{ id: string }> };

// Project-scoped activity feed. Matches audit_log rows where the target is
// either the project itself, or any child (tasks / sprints / milestones)
// belonging to the project. Newest first, capped at 50.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: projectId } = await params;

    const rows = await withOrgContext(userId, async (db) => {
      const [project] = await db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) throw new ApiError(404, "Project not found");

      // Subquery: task IDs that belong to this project.
      const taskIdsSql = sql<string>`(select id from ${tasks} where project_id = ${projectId})`;
      const sprintIdsSql = sql<string>`(select id from ${sprints} where project_id = ${projectId})`;
      const milestoneIdsSql = sql<string>`(select id from ${milestones} where project_id = ${projectId})`;

      return db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.orgId, project.orgId),
            or(
              eq(auditLog.targetId, projectId),
              sql`${auditLog.targetId} in ${taskIdsSql}`,
              sql`${auditLog.targetId} in ${sprintIdsSql}`,
              sql`${auditLog.targetId} in ${milestoneIdsSql}`,
            )!,
          ),
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(50);
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
