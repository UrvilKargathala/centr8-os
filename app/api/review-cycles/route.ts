import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { reviewCycles } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { requireReviewConfigureAccess } from "@/lib/api/reviews";

// Everyone with review:view_own needs to see what cycles exist (to know
// what they're being reviewed on) — reading isn't gated behind
// review:configure, same reasoning leave/attendance settings use.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "review", "view_own");
      return db.select().from(reviewCycles).where(eq(reviewCycles.orgId, orgId));
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
      await requireReviewConfigureAccess(db, userId, body.org_id);
      return db
        .insert(reviewCycles)
        .values({
          orgId: body.org_id,
          name: body.name,
          cycleType: body.cycle_type ?? undefined,
          selfAssessmentOpenDate: body.self_assessment_open_date ?? null,
          selfAssessmentDueDate: body.self_assessment_due_date ?? null,
          managerAssessmentDueDate: body.manager_assessment_due_date ?? null,
          status: body.status ?? undefined,
          appliesTo: body.applies_to ?? undefined,
          createdBy: userId,
        })
        .returning();
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
