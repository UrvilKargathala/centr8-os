import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { tasks, taskAttachments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const projectId = req.nextUrl.searchParams.get("project_id");
    const sprintId = req.nextUrl.searchParams.get("sprint_id");
    if (!projectId && !sprintId) {
      throw new ApiError(400, "project_id or sprint_id is required");
    }

    // Attachment count as a correlated subquery so the board doesn't need
    // N+1 per-task fetches to render the paperclip badge.
    const attachmentCountSql = sql<number>`(
      select count(*)::int from ${taskAttachments}
      where ${taskAttachments.taskId} = ${tasks.id}
    )`.as("attachment_count");

    const rows = await withOrgContext(userId, (db) => {
      const q = db.select({
        id: tasks.id,
        orgId: tasks.orgId,
        projectId: tasks.projectId,
        sprintId: tasks.sprintId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        estimate: tasks.estimate,
        assigneeId: tasks.assigneeId,
        dueDate: tasks.dueDate,
        attachmentCount: attachmentCountSql,
      }).from(tasks);
      return sprintId
        ? q.where(eq(tasks.sprintId, sprintId))
        : q.where(eq(tasks.projectId, projectId!));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();

    if (!body.org_id || !body.project_id || !body.title) {
      throw new ApiError(400, "org_id, project_id and title are required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "task", "create");
      return db
        .insert(tasks)
        .values({
          orgId: body.org_id,
          projectId: body.project_id,
          sprintId: body.sprint_id ?? null,
          title: body.title,
          description: body.description ?? null,
          status: body.status ?? undefined,
          priority: body.priority ?? undefined,
          assigneeId: body.assignee_id ?? null,
          estimate: body.estimate ?? null,
          dueDate: body.due_date ?? null,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
