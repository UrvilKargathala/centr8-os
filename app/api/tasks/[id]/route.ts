import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { people, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { createNotification } from "@/lib/notifications/create";

function extractMentionedNames(text: string): string[] {
  const matches = text.match(/@([\w]+(?:\s+[\w]+)?)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

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
      const [existing] = await db.select({ orgId: tasks.orgId, assigneeId: tasks.assigneeId, description: tasks.description }).from(tasks).where(eq(tasks.id, id));
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
          category: body.category === undefined ? undefined : body.category,
          startTime: body.start_time === undefined ? undefined : body.start_time,
          endTime: body.end_time === undefined ? undefined : body.end_time,
        })
        .where(eq(tasks.id, id))
        .returning();

      // Fire task_assigned notification when assignee changes
      const newAssignee = body.assignee_id;
      if (newAssignee && newAssignee !== existing.assigneeId) {
        const [person] = await db.select({ userId: people.userId }).from(people).where(eq(people.id, newAssignee));
        if (person?.userId) {
          createNotification(db, {
            orgId: existing.orgId,
            userId: person.userId,
            type: "task_assigned",
            title: "Task assigned to you",
            body: updated.title,
            linkType: "task",
            linkId: updated.id,
          }).catch(() => {});
        }
      }

      // Fire mention notifications when description changes and contains @Name
      if (body.description !== undefined && body.description !== existing.description) {
        const oldNames = existing.description ? extractMentionedNames(existing.description) : [];
        const newNames = extractMentionedNames(body.description ?? "");
        const freshMentions = newNames.filter((n) => !oldNames.includes(n));
        if (freshMentions.length > 0) {
          const orgPeople = await db
            .select({ id: people.id, fullName: people.fullName, userId: people.userId })
            .from(people)
            .where(eq(people.orgId, existing.orgId));
          for (const name of freshMentions) {
            const match = orgPeople.find((p) => p.fullName.toLowerCase().startsWith(name));
            if (match?.userId) {
              createNotification(db, {
                orgId: existing.orgId,
                userId: match.userId,
                type: "mention",
                title: `You were mentioned in a task`,
                body: updated.title,
                linkType: "task",
                linkId: updated.id,
              }).catch(() => {});
            }
          }
        }
      }

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
