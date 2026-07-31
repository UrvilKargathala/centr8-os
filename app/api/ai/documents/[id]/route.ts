import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { generatedDocuments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { editDocument } from "@/lib/api/aiAssistant";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);

    const doc = await withOrgContext(userId, async (db) => {
      const [row] = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, id));
      if (!row) return null;
      await requirePermission(db, userId, row.orgId, "document", "read");
      return row;
    });

    if (!doc) throw new ApiError(404, "Document not found");
    return NextResponse.json({ data: doc });
  } catch (err) {
    return handleApiError(err);
  }
}

// Edit is only ever allowed while status='draft' — finalizing locks the
// document (irreversible, per the build spec), so this is the enforcement
// point rather than a UI-only restriction.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    const updated = await withOrgContext(userId, (db) => editDocument(db, userId, id, { title: body.title, content: body.content }));
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
