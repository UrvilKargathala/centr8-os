import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { tasks } from "@/db/schema";
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

    const rows = await withOrgContext(userId, (db) =>
      sprintId
        ? db.select().from(tasks).where(eq(tasks.sprintId, sprintId))
        : db.select().from(tasks).where(eq(tasks.projectId, projectId!)),
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
