import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withOrgContext } from "@/db/withOrgContext";
import { employees, reviewCycles } from "@/db/schema";
import { ApiError, handleApiError, requireUserId } from "@/lib/api/helpers";
import { requirePermission } from "@/lib/api/permissions";
import { getOrCreateReview, resolveOwnEmployeeId } from "@/lib/api/reviews";

// Direct reports' reviews across active cycles — resolves "direct report"
// via employees.managerId, same relationship isManagerOf checks against.
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const orgId = req.nextUrl.searchParams.get("org_id");
    if (!orgId) throw new ApiError(400, "org_id is required");

    const data = await withOrgContext(userId, async (db) => {
      await requirePermission(db, userId, orgId, "review", "view_team");
      const ownId = await resolveOwnEmployeeId(db, userId, orgId);
      if (!ownId) return [];

      const reports = await db.select({ id: employees.id, fullName: employees.fullName }).from(employees).where(and(eq(employees.orgId, orgId), eq(employees.managerId, ownId)));
      if (reports.length === 0) return [];

      const cycles = (await db.select().from(reviewCycles).where(eq(reviewCycles.orgId, orgId))).filter((c) => c.status !== "draft");

      const rows: { cycle: typeof cycles[number]; review: Awaited<ReturnType<typeof getOrCreateReview>>; employee: (typeof reports)[number] }[] = [];
      for (const cycle of cycles) {
        for (const report of reports) {
          const review = await getOrCreateReview(db, orgId, cycle.id, report.id);
          rows.push({ cycle, review, employee: report });
        }
      }
      return rows;
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
}
