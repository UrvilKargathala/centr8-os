import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { tasks, taskAttachments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const sp = req.nextUrl.searchParams;
    const projectId = sp.get("project_id");
    const sprintId = sp.get("sprint_id");
    const orgId = sp.get("org_id");
    if (!projectId && !sprintId && !orgId) {
      throw new ApiError(400, "project_id, sprint_id, or org_id is required");
    }

    const attachmentCountSql = sql<number>`(
      select count(*)::int from ${taskAttachments}
      where ${taskAttachments.taskId} = ${tasks.id}
    )`.as("attachment_count");

    const conds: SQL[] = [];
    if (sprintId) conds.push(eq(tasks.sprintId, sprintId));
    else if (projectId) conds.push(eq(tasks.projectId, projectId));
    else if (orgId) conds.push(eq(tasks.orgId, orgId));

    const statusFilter = sp.get("status");
    if (statusFilter) conds.push(eq(tasks.status, statusFilter as never));
    const priorityFilter = sp.get("priority");
    if (priorityFilter) conds.push(eq(tasks.priority, priorityFilter as never));
    const assigneeFilter = sp.get("assignee_id");
    if (assigneeFilter) conds.push(eq(tasks.assigneeId, assigneeFilter));
    const projFilter = sp.get("project");
    if (projFilter && !projectId) conds.push(eq(tasks.projectId, projFilter));
    if (sp.get("overdue_only") === "true") {
      const todayIso = new Date().toISOString().slice(0, 10);
      conds.push(lt(tasks.dueDate, todayIso));
      conds.push(ne(tasks.status, "done"));
      conds.push(ne(tasks.status, "cancelled"));
    }
    const q = sp.get("q");
    if (q && q.trim()) {
      conds.push(or(ilike(tasks.title, `%${q}%`), ilike(tasks.description, `%${q}%`))!);
    }

    const rows = await withOrgContext(userId, (db) =>
      db
        .select({
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
          createdAt: tasks.createdAt,
          attachmentCount: attachmentCountSql,
        })
        .from(tasks)
        .where(and(...conds))
        .orderBy(desc(tasks.createdAt)),
    );

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
