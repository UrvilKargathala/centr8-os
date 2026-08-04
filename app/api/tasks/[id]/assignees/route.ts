import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { taskAssignees, tasks, people } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

// Multi-assignee list for the task detail card — rides task:read/task:update
// (no separate permission type), same pattern as attachments.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const rows = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!task) return undefined;
      await requirePermission(db, userId, task.orgId, "task", "read");
      return db
        .select({ personId: taskAssignees.personId, fullName: people.fullName, jobTitle: people.jobTitle, avatarUrl: people.avatarUrl })
        .from(taskAssignees)
        .innerJoin(people, eq(people.id, taskAssignees.personId))
        .where(eq(taskAssignees.taskId, id));
    });
    if (!rows) throw new ApiError(404, "Task not found");

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.person_id) throw new ApiError(400, "person_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!task) return undefined;
      await requirePermission(db, userId, task.orgId, "task", "update");

      const [inserted] = await db
        .insert(taskAssignees)
        .values({ taskId: id, personId: body.person_id, orgId: task.orgId })
        .onConflictDoNothing()
        .returning();
      return inserted ?? { taskId: id, personId: body.person_id, orgId: task.orgId };
    });
    if (!row) throw new ApiError(404, "Task not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const personId = req.nextUrl.searchParams.get("person_id");
    if (!personId) throw new ApiError(400, "person_id is required");

    await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!task) throw new ApiError(404, "Task not found");
      await requirePermission(db, userId, task.orgId, "task", "update");
      await db.delete(taskAssignees).where(and(eq(taskAssignees.taskId, id), eq(taskAssignees.personId, personId)));
    });

    return NextResponse.json({ data: { taskId: id, personId } });
  } catch (err) {
    return handleApiError(err);
  }
}
