import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { people, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { createNotification } from "@/lib/notifications/create";
import { listTasksFiltered } from "@/lib/api/tasks";

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

    const rows = await withOrgContext(userId, (db) =>
      listTasksFiltered(db, {
        orgId: orgId ?? undefined,
        projectId: projectId ?? undefined,
        sprintId: sprintId ?? undefined,
        status: sp.get("status") ?? undefined,
        priority: sp.get("priority") ?? undefined,
        assigneeId: sp.get("assignee_id") ?? undefined,
        project: sp.get("project") ?? undefined,
        overdueOnly: sp.get("overdue_only") === "true",
        q: sp.get("q") ?? undefined,
      }),
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
      const [created] = await db
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

      if (body.assignee_id) {
        const [person] = await db.select({ userId: people.userId }).from(people).where(eq(people.id, body.assignee_id));
        if (person?.userId) {
          createNotification(db, {
            orgId: body.org_id,
            userId: person.userId,
            type: "task_assigned",
            title: "Task assigned to you",
            body: created.title,
            linkType: "task",
            linkId: created.id,
          }).catch(() => {});
        }
      }

      // Mention detection in new task description
      if (body.description) {
        const mentions = (body.description as string).match(/@([\w]+(?:\s+[\w]+)?)/g);
        if (mentions) {
          const orgPeople = await db
            .select({ id: people.id, fullName: people.fullName, userId: people.userId })
            .from(people)
            .where(eq(people.orgId, body.org_id));
          const seen = new Set<string>();
          for (const raw of mentions) {
            const name = raw.slice(1).toLowerCase();
            if (seen.has(name)) continue;
            seen.add(name);
            const match = orgPeople.find((p) => p.fullName.toLowerCase().startsWith(name));
            if (match?.userId) {
              createNotification(db, {
                orgId: body.org_id,
                userId: match.userId,
                type: "mention",
                title: "You were mentioned in a task",
                body: created.title,
                linkType: "task",
                linkId: created.id,
              }).catch(() => {});
            }
          }
        }
      }

      return [created];
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
