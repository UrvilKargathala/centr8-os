import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingCourses, trainingEnrollments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireTrainingViewAllProgressAccess } from "@/lib/api/training";

// Org-wide completion matrix — course list + every enrollment, so the UI
// can build employees x required-courses without N+1 calls.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requireTrainingViewAllProgressAccess(db, userId, orgId);
      const [courses, enrollments] = await Promise.all([
        db.select().from(trainingCourses).where(eq(trainingCourses.orgId, orgId)),
        db.select().from(trainingEnrollments).where(eq(trainingEnrollments.orgId, orgId)),
      ]);
      return { courses, enrollments };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
