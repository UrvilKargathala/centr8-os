import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { taskComments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

type Params = { params: Promise<{ id: string }> };

async function loadComment(userId: string, id: string) {
  const row = await withOrgContext(userId, (db) =>
    db.select().from(taskComments).where(eq(taskComments.id, id)).limit(1),
  );
  if (!row[0]) throw new ApiError(404, "Comment not found");
  return row[0];
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const existing = await loadComment(userId, id);
    const body = await req.json();

    // Update gated on author OR org's task_comment:update grant.
    const isAuthor = existing.authorUserId === userId;

    const [row] = await withOrgContext(userId, async (db) => {
      if (!isAuthor) await requirePermission(db, userId, existing.orgId, "task_comment", "update");
      return db
        .update(taskComments)
        .set({ body: body.body ?? undefined, updatedAt: new Date() })
        .where(eq(taskComments.id, id))
        .returning();
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(req);
    const { id } = await params;
    const existing = await loadComment(userId, id);
    const isAuthor = existing.authorUserId === userId;

    await withOrgContext(userId, async (db) => {
      if (!isAuthor) await requirePermission(db, userId, existing.orgId, "task_comment", "delete");
      await db.delete(taskComments).where(eq(taskComments.id, id));
    });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    return handleApiError(err);
  }
}
