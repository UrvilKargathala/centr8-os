import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { generatedDocuments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const docType = req.nextUrl.searchParams.get("doc_type");
    const status = req.nextUrl.searchParams.get("status");
    const search = req.nextUrl.searchParams.get("search");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "document", "read");
      const conditions = [eq(generatedDocuments.orgId, orgId)];
      if (docType) conditions.push(eq(generatedDocuments.docType, docType as never));
      if (status) conditions.push(eq(generatedDocuments.status, status as never));
      if (search) conditions.push(ilike(generatedDocuments.title, `%${search}%`));
      return db
        .select()
        .from(generatedDocuments)
        .where(and(...conditions))
        .orderBy(desc(generatedDocuments.createdAt));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
