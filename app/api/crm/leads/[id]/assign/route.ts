import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { leads } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireLeadAssignAccess } from "@/lib/api/crm";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.owner_id) throw new ApiError(400, "owner_id is required");

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: leads.orgId }).from(leads).where(eq(leads.id, id));
      if (!existing) return undefined;
      await requireLeadAssignAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(leads)
        .set({ ownerId: body.owner_id, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Lead not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
