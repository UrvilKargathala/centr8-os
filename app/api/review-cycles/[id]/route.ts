import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { reviewCycles } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireReviewConfigureAccess } from "@/lib/api/reviews";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: reviewCycles.orgId }).from(reviewCycles).where(eq(reviewCycles.id, id));
      if (!existing) return undefined;
      await requireReviewConfigureAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(reviewCycles)
        .set({
          name: body.name ?? undefined,
          cycleType: body.cycle_type ?? undefined,
          selfAssessmentOpenDate: body.self_assessment_open_date === undefined ? undefined : body.self_assessment_open_date,
          selfAssessmentDueDate: body.self_assessment_due_date === undefined ? undefined : body.self_assessment_due_date,
          managerAssessmentDueDate: body.manager_assessment_due_date === undefined ? undefined : body.manager_assessment_due_date,
          status: body.status ?? undefined,
          appliesTo: body.applies_to ?? undefined,
        })
        .where(eq(reviewCycles.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Review cycle not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
