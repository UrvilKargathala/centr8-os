import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { okrs } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireOkrCreateAccess } from "@/lib/api/reviews";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(okrs).where(eq(okrs.id, id));
      if (!existing) return undefined;
      await requireOkrCreateAccess(db, userId, existing.orgId, existing.employeeId);

      const [updated] = await db
        .update(okrs)
        .set({
          objective: body.objective ?? undefined,
          keyResults: body.key_results ?? undefined,
          period: body.period ?? undefined,
          status: body.status ?? undefined,
        })
        .where(eq(okrs.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "OKR not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
