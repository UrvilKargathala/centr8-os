import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingCourses } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requireTrainingManageAccess } from "@/lib/api/training";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await requireUserId(req);
    const body = await req.json();

    const row = await withOrgContext(userId, async (db) => {
      const [existing] = await db.select({ orgId: trainingCourses.orgId }).from(trainingCourses).where(eq(trainingCourses.id, id));
      if (!existing) return undefined;
      await requireTrainingManageAccess(db, userId, existing.orgId);

      const [updated] = await db
        .update(trainingCourses)
        .set({
          title: body.title ?? undefined,
          description: body.description === undefined ? undefined : body.description,
          category: body.category === undefined ? undefined : body.category,
          contentType: body.content_type ?? undefined,
          contentUrl: body.content_url === undefined ? undefined : body.content_url,
          durationMinutes: body.duration_minutes === undefined ? undefined : body.duration_minutes,
          requiredForRoles: body.required_for_roles ?? undefined,
          isActive: body.is_active === undefined ? undefined : body.is_active,
        })
        .where(eq(trainingCourses.id, id))
        .returning();
      return updated;
    });
    if (!row) throw new ApiError(404, "Course not found");

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}
