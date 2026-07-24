import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { taskAttachments, tasks } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { signedDownloadUrl, uploadTaskAttachment } from "@/lib/api/storage";

type Params = { params: Promise<{ id: string }> };

// List rides along on task:read (same "no separate check" pattern as
// attendance/leave reading off employee reads) — a signed, short-lived
// download URL is generated per file on every list call rather than
// stored, so a revoked/expired link never lingers in a cached response.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const rows = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!task) return undefined;
      await requirePermission(db, userId, task.orgId, "task", "read");
      return db.select().from(taskAttachments).where(eq(taskAttachments.taskId, id));
    });
    if (!rows) throw new ApiError(404, "Task not found");

    const withUrls = await Promise.all(
      rows.map(async (a) => ({ ...a, downloadUrl: await signedDownloadUrl(a.filePath) })),
    );

    return NextResponse.json({ data: withUrls });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "file is required");

    const row = await withOrgContext(userId, async (db) => {
      const [task] = await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, id));
      if (!task) return undefined;
      await requirePermission(db, userId, task.orgId, "task", "update");

      const buffer = Buffer.from(await file.arrayBuffer());
      const path = await uploadTaskAttachment(task.orgId, id, file.name, buffer, file.type);

      const [inserted] = await db
        .insert(taskAttachments)
        .values({
          orgId: task.orgId,
          taskId: id,
          fileName: file.name,
          filePath: path,
          fileSize: buffer.length,
          mimeType: file.type || null,
          uploadedByUserId: userId,
        })
        .returning();
      return inserted;
    });
    if (!row) throw new ApiError(404, "Task not found");

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
