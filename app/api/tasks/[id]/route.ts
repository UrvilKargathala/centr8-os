import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const [row] = await withOrgContext(userId, (db) =>
      db.select().from(tasks).where(eq(tasks.id, id)),
    );
    if (!row) throw new ApiError(404, "Task not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "task", "update");

      const [updated] = await db
        .update(tasks)
        .set({
          title: body.title ?? undefined,
          description: body.description === undefined ? undefined : body.description,
          status: body.status ?? undefined,
          priority: body.priority ?? undefined,
          sprintId: body.sprint_id === undefined ? undefined : body.sprint_id,
          assigneeId: body.assignee_id === undefined ? undefined : body.assignee_id,
          estimate: body.estimate === undefined ? undefined : body.estimate,
          dueDate: body.due_date === undefined ? undefined : body.due_date,
        })
        .where(eq(tasks.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Task not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!existing) return undefined;

      await requirePermission(db, userId, existing.orgId, "task", "delete");

      const [deleted] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Task not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
