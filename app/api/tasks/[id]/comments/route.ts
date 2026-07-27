import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { taskComments, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: taskId } = await params;
    const rows = await withOrgContext(userId, (db) =>
      db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(asc(taskComments.createdAt)),
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id: taskId } = await params;
    const body = await req.json();
    if (!body.body || typeof body.body !== "string" || !body.body.trim()) {
      throw new ApiError(400, "Comment body is required");
    }

    const [row] = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) throw new ApiError(404, "Task not found");
      await requirePermission(db, userId, task.orgId, "task_comment", "create");
      return db
        .insert(taskComments)
        .values({ orgId: task.orgId, taskId, authorUserId: userId, body: body.body.trim() })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
