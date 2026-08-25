import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { sprintPlanProposals } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { listAllSprintPlans } from "@/lib/api/aiAssistant";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");
    const projectId = req.nextUrl.searchParams.get("project_id");
    const status = req.nextUrl.searchParams.get("status");

    if (!projectId && !status) {
      const data = await withOrgContext(userId, (db) => listAllSprintPlans(db, userId, orgId));
      return NextResponse.json({ data });
    }

    const rows = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "sprint_plan", "read");
      const conditions = [eq(sprintPlanProposals.orgId, orgId)];
      if (projectId) conditions.push(eq(sprintPlanProposals.projectId, projectId));
      if (status) conditions.push(eq(sprintPlanProposals.status, status as "pending" | "approved" | "rejected" | "expired"));
      return db
        .select()
        .from(sprintPlanProposals)
        .where(and(...conditions))
        .orderBy(desc(sprintPlanProposals.createdAt));
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
