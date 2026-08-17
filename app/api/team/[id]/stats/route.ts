import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { tasks } from "@/db/schema";
import { handleApiError, requireUserId } from "@/lib/api/helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: personId } = await params;

    const result = await withOrgContext(userId, async (db) => {
      const assigned = eq(tasks.assigneeId, personId);

      const monthlyRaw = await db
        .select({
          month: sql<string>`to_char(${tasks.updatedAt}, 'YYYY-MM')`.as("month"),
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(tasks)
        .where(and(assigned, eq(tasks.status, "done")))
        .groupBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM')`);

      const dailyRaw = await db
        .select({
          day: sql<string>`to_char(${tasks.updatedAt}, 'YYYY-MM-DD')`.as("day"),
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(tasks)
        .where(and(assigned, eq(tasks.status, "done")))
        .groupBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${tasks.updatedAt}, 'YYYY-MM-DD')`);

      const [utilization] = await db
        .select({
          totalEstimate: sql<number>`coalesce(sum(${tasks.estimate}), 0)::int`.as("total_estimate"),
          openCount: sql<number>`count(*)::int`.as("open_count"),
        })
        .from(tasks)
        .where(and(assigned, ne(tasks.status, "done"), ne(tasks.status, "cancelled")));

      const recentTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .where(assigned)
        .orderBy(desc(tasks.updatedAt))
        .limit(10);

      return {
        monthly: monthlyRaw,
        daily: dailyRaw,
        utilization: utilization ?? { totalEstimate: 0, openCount: 0 },
        recentTasks,
      };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
