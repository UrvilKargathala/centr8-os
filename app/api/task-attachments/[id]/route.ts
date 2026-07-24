import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { taskAttachments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { deleteTaskAttachment } from "@/lib/api/storage";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id));
      if (!existing) return undefined;
      await requirePermission(db, userId, existing.orgId, "task", "update");

      const [deleted] = await db.delete(taskAttachments).where(eq(taskAttachments.id, id)).returning();
      return deleted;
    });
    if (!row) throw new ApiError(404, "Attachment not found");

    await deleteTaskAttachment(row.filePath);

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
