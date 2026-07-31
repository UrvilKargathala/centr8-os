import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { engagementSurveys } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireSurveyManageAccess } from "@/lib/api/surveys";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "engagement", "respond");
      return db.select().from(engagementSurveys).where(eq(engagementSurveys.orgId, orgId));
    });

    return NextResponse.json({ data: rows });
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
      await requireSurveyManageAccess(db, userId, body.org_id);
      return db
        .insert(engagementSurveys)
        .values({
          orgId: body.org_id,
          title: body.title,
          description: body.description ?? null,
          questions: body.questions ?? [],
          isAnonymous: body.is_anonymous ?? undefined,
          status: body.status ?? undefined,
          opensAt: body.opens_at ? new Date(body.opens_at) : null,
          closesAt: body.closes_at ? new Date(body.closes_at) : null,
          createdBy: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
