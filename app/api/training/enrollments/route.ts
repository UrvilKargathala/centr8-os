import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingCourses, trainingEnrollments } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { resolveOwnEmployeeId } from "@/lib/api/training";
import { eq } from "drizzle-orm";

// Enroll self in a course — training:enroll_own, always the caller's own
// linked employee record (there's no "enroll someone else" path here,
// unlike HR-admin-on-behalf-of modules elsewhere in this app).
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.course_id) throw new ApiError(400, "org_id and course_id are required");

    const [row] = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, body.org_id, "training", "enroll_own");
      const [course] = await db.select({ id: trainingCourses.id }).from(trainingCourses).where(eq(trainingCourses.id, body.course_id));
      if (!course) throw new ApiError(404, "Course not found");
      const ownId = await resolveOwnEmployeeId(db, userId, body.org_id);
      if (!ownId) throw new ApiError(400, "No linked employee record for this user");

      return db
        .insert(trainingEnrollments)
        .values({ orgId: body.org_id, courseId: body.course_id, employeeId: ownId })
        .onConflictDoNothing()
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
