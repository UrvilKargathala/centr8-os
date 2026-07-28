import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";

// Rollup of task counts by status + overdue + created-in-last-7-days trends.
// Everything runs in a single trip: one select with several `count() filter
// (where …)` aggregates. Cheaper than fetching all tasks client-side and
// counting there once workspaces get real scale.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const todayIso = now.toISOString().slice(0, 10);

    const rows = await withOrgContext(userId, (db) =>
      db
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
        .where(eq(tasks.orgId, orgId)),
    );

    const r = rows[0];
    const trend = (curr: number, prev: number) => curr - prev;

    return NextResponse.json({
      data: {
        total: r.total,
        pending: r.pending,
        in_progress: r.in_progress,
        in_review: r.in_review,
        completed: r.completed,
        overdue: r.overdue,
        trend_total: trend(r.last_week, r.prev_week),
        trend_completed: trend(r.done_last_week, r.done_prev_week),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
