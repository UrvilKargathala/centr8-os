import { NextRequest, NextResponse } from "next/server";
import { withOrgContext } from "@/db/withOrgContext";
import { trainingCourses } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { listAllCourses, requireTrainingManageAccess } from "@/lib/api/training";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, (db) => listAllCourses(db, userId, orgId));
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const body = await req.json();
    if (!body.org_id || !body.title) throw new ApiError(400, "org_id and title are required");

    const [row] = await withOrgContext(userId, async (db) => {
      await requireTrainingManageAccess(db, userId, body.org_id);
      return db
        .insert(trainingCourses)
        .values({
          orgId: body.org_id,
          title: body.title,
          description: body.description ?? null,
          category: body.category ?? null,
          contentType: body.content_type ?? undefined,
          contentUrl: body.content_url ?? null,
          durationMinutes: body.duration_minutes ?? null,
          requiredForRoles: body.required_for_roles ?? [],
          isActive: body.is_active ?? undefined,
          createdBy: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
