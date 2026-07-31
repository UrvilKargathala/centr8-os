import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { candidates } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireManageCandidatesAccess } from "@/lib/api/recruitment";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(candidates).where(eq(candidates.id, id));
      if (!existing) return undefined;
      await requireManageCandidatesAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(candidates)
        .set({
          stage: body.stage ?? undefined,
          rating: body.rating ?? undefined,
          notes: body.notes ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Candidate not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
