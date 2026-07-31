import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { performanceReviews } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireReviewManagerAccess } from "@/lib/api/reviews";

type Params = { params: Promise<{ id: string }> };

// Only ever touches manager_assessment + final_rating + status/timestamps
// — an employee's own self-assessment PATCH endpoint has no path to reach
// these fields, and this endpoint never touches self_assessment.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select().from(performanceReviews).where(eq(performanceReviews.id, id));
      if (!existing) return undefined;
      await requireReviewManagerAccess(db, userId, existing.orgId, existing.employeeId);

      const [updated] = await db
        .update(performanceReviews)
        .set({
          managerAssessment: {
            strengths: body.strengths ?? null,
            areas_for_growth: body.areas_for_growth ?? null,
            feedback: body.feedback ?? null,
            manager_rating: body.manager_rating ?? null,
          },
          finalRating: body.final_rating ?? undefined,
          managerSubmittedAt: new Date(),
          status: "completed",
          completedAt: new Date(),
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
