import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { hrCaseCategories } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireCaseManageAccess } from "@/lib/api/hrCases";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "hr_case", "view_own");
      return db.select().from(hrCaseCategories).where(eq(hrCaseCategories.orgId, orgId));
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
    if (!body.org_id || !body.name) throw new ApiError(400, "org_id and name are required");

    const [row] = await withOrgContext(userId, async (db) => {
      await requireCaseManageAccess(db, userId, body.org_id);
      return db
        .insert(hrCaseCategories)
        .values({
          orgId: body.org_id,
          name: body.name,
          description: body.description ?? null,
          defaultAssigneeId: body.default_assignee_id ?? null,
          isActive: body.is_active ?? undefined,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
