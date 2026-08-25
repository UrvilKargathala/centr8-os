import { and, desc, eq, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import type { OrgScopedDb } from "@/db/withOrgContext";
import { taskAttachments, tasks } from "@/db/schema";

export type TaskListFilters = {
  orgId?: string;
  projectId?: string;
  sprintId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  project?: string;
  overdueOnly?: boolean;
  q?: string;
};

// Shared by app/api/tasks/route.ts (GET) and app/(app)/tasks/page.tsx
// (server-rendered initial load) — same filter conditions, same select
// shape (including the attachment-count subquery).
export function listTasksFiltered(db: OrgScopedDb, filters: TaskListFilters) {
  const attachmentCountSql = sql<number>`(
      select count(*)::int from ${taskAttachments}
      where ${taskAttachments.taskId} = ${tasks.id}
    )`.as("attachment_count");

  const conds: SQL[] = [];
  if (filters.sprintId) conds.push(eq(tasks.sprintId, filters.sprintId));
  else if (filters.projectId) conds.push(eq(tasks.projectId, filters.projectId));
  else if (filters.orgId) conds.push(eq(tasks.orgId, filters.orgId));

  if (filters.status) conds.push(eq(tasks.status, filters.status as never));
  if (filters.priority) conds.push(eq(tasks.priority, filters.priority as never));
  if (filters.assigneeId) conds.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters.project && !filters.projectId) conds.push(eq(tasks.projectId, filters.project));
  if (filters.overdueOnly) {
    const todayIso = new Date().toISOString().slice(0, 10);
    conds.push(lt(tasks.dueDate, todayIso));
    conds.push(ne(tasks.status, "done"));
    conds.push(ne(tasks.status, "cancelled"));
  }
  if (filters.q?.trim()) {
    conds.push(or(ilike(tasks.title, `%${filters.q}%`), ilike(tasks.description, `%${filters.q}%`))!);
  }

  return db
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
    .orderBy(desc(tasks.createdAt));
}

// Shared by app/api/tasks/counts/route.ts and app/(app)/tasks/page.tsx.
export async function getTaskCounts(db: OrgScopedDb, orgId: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const todayIso = now.toISOString().slice(0, 10);

  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`.as("total"),
      pending: sql<number>`count(*) filter (where ${tasks.status} = 'todo')::int`.as("pending"),
      in_progress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`.as("in_progress"),
      in_review: sql<number>`count(*) filter (where ${tasks.status} = 'in_review')::int`.as("in_review"),
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`.as("completed"),
      overdue: sql<number>`count(*) filter (where ${tasks.dueDate} < ${todayIso}::date and ${tasks.status} not in ('done','cancelled'))::int`.as("overdue"),
      last_week: sql<number>`count(*) filter (where ${tasks.createdAt} >= ${weekAgo})::int`.as("last_week"),
      prev_week: sql<number>`count(*) filter (where ${tasks.createdAt} >= ${twoWeeksAgo} and ${tasks.createdAt} < ${weekAgo})::int`.as("prev_week"),
      done_last_week: sql<number>`count(*) filter (where ${tasks.status} = 'done' and ${tasks.updatedAt} >= ${weekAgo})::int`.as("done_last_week"),
      done_prev_week: sql<number>`count(*) filter (where ${tasks.status} = 'done' and ${tasks.updatedAt} >= ${twoWeeksAgo} and ${tasks.updatedAt} < ${weekAgo})::int`.as("done_prev_week"),
    })
    .from(tasks)
    .where(eq(tasks.orgId, orgId));

  const trend = (curr: number, prev: number) => curr - prev;
  return {
    total: r.total,
    pending: r.pending,
    in_progress: r.in_progress,
    in_review: r.in_review,
    completed: r.completed,
    overdue: r.overdue,
    trend_total: trend(r.last_week, r.prev_week),
    trend_completed: trend(r.done_last_week, r.done_prev_week),
  };
}
