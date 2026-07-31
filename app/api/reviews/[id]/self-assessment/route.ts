import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { performanceReviews } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireReviewSelfAccess } from "@/lib/api/reviews";

type Params = { params: Promise<{ id: string }> };

// Only ever touches self_assessment + self_submitted_at + status — never
// manager_assessment or final_rating, which live behind a completely
// separate endpoint (manager-assessment/route.ts) with its own permission
// check, so there's no code path where a self-assessment PATCH could
// accidentally write the manager's fields.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(performanceReviews).where(eq(performanceReviews.id, id));
      if (!existing) return undefined;
      await requireReviewSelfAccess(db, userId, existing.orgId, existing.employeeId);

      const nextStatus = existing.status === "completed" ? existing.status : "manager_assessment_pending";

      const [updated] = await db
        .update(performanceReviews)
        .set({
          selfAssessment: {
            strengths: body.strengths ?? null,
            areas_for_growth: body.areas_for_growth ?? null,
            achievements: body.achievements ?? null,
            goals_next_period: body.goals_next_period ?? null,
            self_rating: body.self_rating ?? null,
          },
          selfSubmittedAt: new Date(),
          status: nextStatus,
        })
        .where(eq(performanceReviews.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Review not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
